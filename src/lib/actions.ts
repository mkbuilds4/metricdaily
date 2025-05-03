'use server';

import { revalidatePath } from 'next/cache'; // Import revalidatePath
import type { DailyWorkLog, UPHTarget, GoogleSheetsData } from '@/types';
import { exportToGoogleSheets as exportSheetService } from '@/services/google-sheets'; // Import the service

// --- In-Memory Data Stores (Replace with Database/Persistent Storage) ---

let workLogStore: DailyWorkLog[] = [
    // Sample Data (Optional - remove for production)
    { id: '2024-07-15', date: '2024-07-15', documentsCompleted: 50, videoSessionsCompleted: 10, hoursWorked: 7.5, notes: 'Regular day' },
    { id: '2024-07-16', date: '2024-07-16', documentsCompleted: 65, videoSessionsCompleted: 12, hoursWorked: 8, notes: 'Busy morning' },
    { id: '2024-07-17', date: '2024-07-17', documentsCompleted: 40, videoSessionsCompleted: 8, hoursWorked: 6, notes: 'Short day' },
];

let uphTargetStore: UPHTarget[] = [
    // Sample Data (Ensure one is active by default)
    { id: 'std-1', name: 'Standard', targetUPH: 10, docWeight: 1, videoWeight: 2, isActive: true },
    { id: 'peak-1', name: 'Peak Hours', targetUPH: 12.5, docWeight: 1, videoWeight: 2.5, isActive: false },
];

let nextWorkLogId = workLogStore.length + 1;
let nextTargetId = uphTargetStore.length + 1;

// --- Helper Function ---
function generateId(prefix: string = 'id'): string {
    // In a real app, use a more robust ID generation (e.g., UUID)
    if (prefix === 'log') {
        // Use date as ID for logs if it's unique for the day
        // return logData.date; // Be cautious if multiple logs per day are possible
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; // Fallback if date isn't unique ID
    } else if (prefix === 'target') {
         return `${prefix}-${nextTargetId++}`;
    }
    // Fallback for other potential uses
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
  // Return a deep copy to prevent accidental mutation of the store
  return JSON.parse(JSON.stringify(workLogStore));
}

/**
 * Saves (adds or updates) a work log entry.
 * If an entry for the given date exists, it updates it. Otherwise, it adds a new one.
 * Replace with database upsert logic in a real application.
 */
export async function saveWorkLog(logData: Omit<DailyWorkLog, 'id'>): Promise<DailyWorkLog> {
    console.log('[Action] saveWorkLog called with:', logData);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async

    const existingIndex = workLogStore.findIndex(log => log.date === logData.date);
    let savedLog: DailyWorkLog;

    if (existingIndex > -1) {
        // Update existing log
        // Important: Preserve the original ID when updating
        savedLog = { ...workLogStore[existingIndex], ...logData };
        workLogStore[existingIndex] = savedLog;
        console.log('[Action] Updated log:', savedLog);
    } else {
        // Add new log
        const newLog: DailyWorkLog = {
        ...logData,
        id: generateId('log'), // Generate a unique ID for new logs
        };
        workLogStore.push(newLog);
        savedLog = newLog;
        console.log('[Action] Added new log:', savedLog);
    }

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
    await exportSheetService(data, spreadsheetId, sheetName);
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
