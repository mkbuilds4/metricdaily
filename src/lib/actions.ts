'use server';

import { revalidatePath } from 'next/cache'; // Import revalidatePath
import type { DailyWorkLog, UPHTarget, GoogleSheetsData } from '@/types';
import { exportToGoogleSheets as exportSheetService } from '@/services/google-sheets'; // Import the service
import { calculateHoursWorked } from './utils'; // Import the calculator

// --- In-Memory Data Stores (Replace with Database/Persistent Storage) ---

let workLogStore: DailyWorkLog[] = [
    // Sample Data (Optional - remove for production)
    // { id: 'log-1721234567890-abc12', date: '2024-07-15', startTime: '09:00', endTime: '17:30', breakDurationMinutes: 30, hoursWorked: 8, documentsCompleted: 50, videoSessionsCompleted: 10, notes: 'Regular day' },
    // { id: 'log-1721320987654-def34', date: '2024-07-16', startTime: '08:30', endTime: '17:30', breakDurationMinutes: 45, hoursWorked: 8.25, documentsCompleted: 65, videoSessionsCompleted: 12, notes: 'Busy morning' },
    // { id: 'log-1721407321098-ghi56', date: '2024-07-17', startTime: '10:00', endTime: '16:00', breakDurationMinutes: 0, hoursWorked: 6, documentsCompleted: 40, videoSessionsCompleted: 8, notes: 'Short day' },
]; // Start empty or with actual persisted data

let uphTargetStore: UPHTarget[] = [
    // Sample Data (Ensure one is active by default) - Using new fields
    { id: 'std-1', name: 'Standard', targetUPH: 10, docsPerUnit: 5, videosPerUnit: 2.5, isActive: true }, // e.g., 5 docs = 1 unit, 2.5 videos = 1 unit
    { id: 'peak-1', name: 'Peak Hours', targetUPH: 12.5, docsPerUnit: 4, videosPerUnit: 2, isActive: false }, // e.g., 4 docs = 1 unit, 2 videos = 1 unit
];

// let nextWorkLogId = workLogStore.length + 1; // Remove if using timestamp/random ID
let nextTargetId = uphTargetStore.length + 1;

// --- Helper Function ---
function generateId(prefix: string = 'id'): string {
    // In a real app, use a more robust ID generation (e.g., UUID)
    // Using timestamp + random string for better uniqueness for logs
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}


// === Work Log Actions ===

/**
 * Fetches all work logs.
 * Replace with database query in a real application.
 */
export async function getWorkLogs(): Promise<DailyWorkLog[]> {
  console.log('[Action] getWorkLogs called');
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50));
  // Return a deep copy to prevent accidental mutation of the store, sorted by date desc
  return JSON.parse(JSON.stringify(workLogStore)).sort((a: DailyWorkLog, b: DailyWorkLog) => b.date.localeCompare(a.date));
}

/**
 * Saves (adds or updates) a work log entry.
 * If an entry for the given date exists, it updates it. Otherwise, it adds a new one.
 * Expects `hoursWorked` to be pre-calculated and passed in.
 * Replace with database upsert logic in a real application.
 */
export async function saveWorkLog(
    logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number } // Allow optional ID for updates
): Promise<DailyWorkLog> {
    console.log('[Action] saveWorkLog called with:', logData);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async

    // Data validation (basic)
    if (logData.hoursWorked < 0) {
        throw new Error("Hours worked cannot be negative.");
    }
    // Consider adding more validation for times, break duration etc. if needed server-side

    const existingIndex = logData.id ? workLogStore.findIndex(log => log.id === logData.id) : workLogStore.findIndex(log => log.date === logData.date); // Prefer ID if provided, else check date for upsert

    let savedLog: DailyWorkLog;

    if (existingIndex > -1) {
        // Update existing log
        const logToUpdate = workLogStore[existingIndex];
        savedLog = {
            ...logToUpdate, // Keep original ID and other fields
            ...logData, // Apply updates from payload (includes calculated hoursWorked)
             // Ensure ID from payload (if present) matches or use original ID
            id: logData.id || logToUpdate.id
        };
        workLogStore[existingIndex] = savedLog;
        console.log('[Action] Updated log:', savedLog);
    } else {
        // Add new log
        const newLog: DailyWorkLog = {
            ...logData,
            id: generateId('log'), // Generate a unique ID for new logs
            // hoursWorked is already provided in logData
        };
        workLogStore.push(newLog);
        savedLog = newLog;
        console.log('[Action] Added new log:', savedLog);
    }

    // Sort the store again after modification
     workLogStore.sort((a, b) => b.date.localeCompare(a.date));

    revalidatePath('/'); // Revalidate the page after saving
    return JSON.parse(JSON.stringify(savedLog)); // Return a copy
}


/**
 * Exports work log data to Google Sheets using the service.
 */
export async function exportWorkLogsToSheet(data: GoogleSheetsData[], spreadsheetId: string, sheetName: string): Promise<void> {
  console.log('[Action] exportWorkLogsToSheet called');
  if (!spreadsheetId || spreadsheetId === 'YOUR_SPREADSHEET_ID' || !sheetName) {
    throw new Error("Google Sheet ID or Sheet Name is not configured properly.");
  }
  // In a real app, you might fetch sensitive info like spreadsheetId from server-side env vars
  try {
    // Transform data if needed to match GoogleSheetsData structure expected by the service
     const transformedData = data.map(item => ({
        date: item.date,
        startTime: item.startTime, // Make sure these fields are included in the data passed to this action
        endTime: item.endTime,
        breakMinutes: item.breakMinutes,
        hoursWorked: item.hoursWorked,
        docs: item.docs,
        videos: item.videos,
        calculatedUnits: item.calculatedUnits,
        calculatedUPH: item.calculatedUPH,
        targetUnits: item.targetUnits,
        remainingUnits: item.remainingUnits,
        notes: item.notes || '',
    }));

    await exportSheetService(transformedData, spreadsheetId, sheetName);
     // No revalidation needed for export unless it affects displayed data
  } catch (error) {
     console.error("Export to Google Sheets failed in action:", error);
     // Re-throw the error so the client component can potentially catch it
     throw error;
  }
}

// === UPH Target Actions ===

/**
 * Fetches all UPH targets.
 */
export async function getUPHTargets(): Promise<UPHTarget[]> {
  console.log('[Action] getUPHTargets called');
  await new Promise(resolve => setTimeout(resolve, 50));
  return JSON.parse(JSON.stringify(uphTargetStore));
}

/**
 * Adds a new UPH target. Defaults to isActive: false.
 */
export async function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): Promise<UPHTarget> {
  console.log('[Action] addUPHTarget called with:', targetData);
    // Validate docsPerUnit and videosPerUnit
  if (targetData.docsPerUnit <= 0 || targetData.videosPerUnit <= 0) {
    throw new Error("Items per unit must be positive numbers.");
  }
  await new Promise(resolve => setTimeout(resolve, 100));
  const newTarget: UPHTarget = {
    ...targetData,
    id: generateId('target'),
    isActive: false, // New targets are inactive by default
  };
  uphTargetStore.push(newTarget);
  console.log('[Action] Added new target:', newTarget);
  revalidatePath('/'); // Revalidate after adding
  return JSON.parse(JSON.stringify(newTarget));
}

/**
 * Updates an existing UPH target. Preserves isActive status unless explicitly changed.
 */
export async function updateUPHTarget(targetData: UPHTarget): Promise<UPHTarget> {
  console.log('[Action] updateUPHTarget called with:', targetData);
   // Validate docsPerUnit and videosPerUnit
  if (targetData.docsPerUnit <= 0 || targetData.videosPerUnit <= 0) {
    throw new Error("Items per unit must be positive numbers.");
  }
  await new Promise(resolve => setTimeout(resolve, 100));
  const index = uphTargetStore.findIndex(t => t.id === targetData.id);
  if (index === -1) {
    throw new Error(`Target with ID ${targetData.id} not found.`);
  }
  // Ensure we don't accidentally change isActive unless intended (though UI passes the full object)
  uphTargetStore[index] = { ...uphTargetStore[index], ...targetData };
   console.log('[Action] Updated target:', uphTargetStore[index]);
   revalidatePath('/'); // Revalidate after updating
  return JSON.parse(JSON.stringify(uphTargetStore[index]));
}

/**
 * Deletes a UPH target. Cannot delete the active target.
 */
export async function deleteUPHTarget(id: string): Promise<void> {
  console.log('[Action] deleteUPHTarget called for ID:', id);
  await new Promise(resolve => setTimeout(resolve, 100));
  const index = uphTargetStore.findIndex(t => t.id === id);
  if (index === -1) {
    // Consider just returning if not found, or throwing based on requirements
    console.warn(`[Action] Target with ID ${id} not found for deletion.`);
    return;
    // throw new Error(`Target with ID ${id} not found.`);
  }
  if (uphTargetStore[index].isActive) {
    throw new Error("Cannot delete the currently active target.");
  }
  uphTargetStore.splice(index, 1);
  console.log('[Action] Deleted target with ID:', id);
  revalidatePath('/'); // Revalidate after deleting
}

/**
 * Sets a specific target as active and deactivates all others.
 */
export async function setActiveUPHTarget(id: string): Promise<UPHTarget> {
  console.log('[Action] setActiveUPHTarget called for ID:', id);
  await new Promise(resolve => setTimeout(resolve, 100));
  const targetIndex = uphTargetStore.findIndex(t => t.id === id);
  if (targetIndex === -1) {
    throw new Error(`Target with ID ${id} not found.`);
  }

  // Only proceed if the target isn't already active
  if (uphTargetStore[targetIndex].isActive) {
      console.log('[Action] Target already active:', id);
      return JSON.parse(JSON.stringify(uphTargetStore[targetIndex]));
  }


  uphTargetStore = uphTargetStore.map((target, index) => ({
    ...target,
    isActive: index === targetIndex,
  }));

  const activeTarget = uphTargetStore[targetIndex];
  console.log('[Action] Set active target:', activeTarget);
  revalidatePath('/'); // Revalidate after setting active
  return JSON.parse(JSON.stringify(activeTarget));
}

/**
 * Fetches the currently active UPH target.
 */
export async function getActiveUPHTarget(): Promise<UPHTarget | null> {
  console.log('[Action] getActiveUPHTarget called');
  await new Promise(resolve => setTimeout(resolve, 50));
  const activeTarget = uphTargetStore.find(t => t.isActive);
  return activeTarget ? JSON.parse(JSON.stringify(activeTarget)) : null;
}
