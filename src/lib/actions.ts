
// src/lib/actions.ts
// Client-side actions interacting with localStorage.

import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateHoursWorked } from '@/lib/utils'; // Import utility
import { sampleWorkLogs, sampleUPHTargets } from './sample-data'; // Import sample data

// --- Constants for localStorage keys ---
const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';

// --- Helper Functions ---

/**
 * Generates a simple pseudo-UUID for local IDs.
 */
function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}


/**
 * Safely retrieves and parses JSON data from localStorage.
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    console.warn(`Attempted to access localStorage key "${key}" on the server.`);
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key “${key}”:`, error);
    return defaultValue;
  }
}

/**
 * Safely stringifies and saves data to localStorage.
 */
function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    console.error('Attempted to save to localStorage on the server.');
    return;
  }
  try {
    const item = JSON.stringify(value);
    window.localStorage.setItem(key, item);
  } catch (error) {
    console.error(`Error writing to localStorage key “${key}”:`, error);
  }
}

// === Work Log Actions (Client-Side) ===

/**
 * Fetches all work logs from localStorage, sorted by date descending.
 */
export function getWorkLogs(): DailyWorkLog[] {
  console.log('[Client Action] getWorkLogs called');
  const logs = getFromLocalStorage<DailyWorkLog[]>(WORK_LOGS_KEY, []);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`[Client Action] Fetched ${logs.length} work logs from localStorage.`);
  return logs;
}

/**
 * Saves (adds or updates) a work log entry in localStorage.
 * If logData includes breakDurationMinutes, it implies hoursWorked should be recalculated.
 */
export function saveWorkLog(
  logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked?: number } // hoursWorked is optional, will be recalculated if break changes
): DailyWorkLog {
  console.log('[Client Action] saveWorkLog called with:', logData);

  // Recalculate hoursWorked if breakDurationMinutes is part of the update or if it's a new log.
  // If hoursWorked is explicitly provided and breakDurationMinutes is not, use the provided hoursWorked.
  let finalHoursWorked: number;
  if (logData.breakDurationMinutes !== undefined) {
      finalHoursWorked = calculateHoursWorked(logData.date, logData.startTime, logData.endTime, logData.breakDurationMinutes);
  } else if (logData.hoursWorked !== undefined) {
      finalHoursWorked = logData.hoursWorked;
  } else {
      // This case should ideally not happen if called correctly (e.g., from form submission or break update)
      // Fallback to calculating from existing break if updating, or default if new.
      const existingLog = logData.id ? getWorkLogs().find(l => l.id === logData.id) : null;
      finalHoursWorked = calculateHoursWorked(logData.date, logData.startTime, logData.endTime, existingLog?.breakDurationMinutes ?? 65);
  }


  if (finalHoursWorked < 0) { // Allow 0 hours worked (e.g. full day break)
    throw new Error('Calculated hours worked cannot be negative.');
  }
  if (logData.documentsCompleted === undefined || isNaN(logData.documentsCompleted) || logData.documentsCompleted < 0) {
    throw new Error('Documents completed must be a non-negative number.');
  }
  if (logData.videoSessionsCompleted === undefined || isNaN(logData.videoSessionsCompleted) || logData.videoSessionsCompleted < 0) {
    throw new Error('Video sessions completed must be a non-negative number.');
  }
  if (!logData.date || !/^\d{4}-\d{2}-\d{2}$/.test(logData.date)) {
    throw new Error('Date must be in YYYY-MM-DD format.');
  }
   // Check associated target exists if targetId is provided
   if (logData.targetId) {
       const targets = getUPHTargets();
       if (!targets.some(t => t.id === logData.targetId)) {
           console.warn(`[Client Action] Target ID "${logData.targetId}" provided for log does not exist. Saving log without association.`);
       }
   }


  const logs = getWorkLogs();
  let savedLog: DailyWorkLog;
  let operation: 'added' | 'updated' = 'added';

  // Create a complete log entry with the final calculated hoursWorked
  const completeLogData = { ...logData, hoursWorked: finalHoursWorked };


  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      savedLog = { ...logs[index], ...completeLogData }; // Use completeLogData
      logs[index] = savedLog;
      console.log('[Client Action] Updated log using provided ID:', logData.id);
      operation = 'updated';
    } else {
      console.warn('[Client Action] Log ID provided but not found, adding as new:', logData.id);
      savedLog = { ...completeLogData, id: generateLocalId() }; // Use completeLogData
      logs.push(savedLog);
       operation = 'added';
    }
  } else {
    const existingLogIndex = logs.findIndex(log => log.date === logData.date);
    if (existingLogIndex > -1) {
        const existingId = logs[existingLogIndex].id;
        const targetIdToKeep = logData.targetId ?? logs[existingLogIndex].targetId;
        savedLog = { ...logs[existingLogIndex], ...completeLogData, id: existingId, targetId: targetIdToKeep }; // Use completeLogData
        logs[existingLogIndex] = savedLog;
        console.log('[Client Action] Updated existing log found by date:', logData.date, ' ID:', existingId);
        operation = 'updated';
    } else {
        savedLog = { ...completeLogData, id: generateLocalId() }; // Use completeLogData
        logs.push(savedLog);
        console.log('[Client Action] Added new log with ID:', savedLog.id);
         operation = 'added';
    }
  }

  logs.sort((a, b) => b.date.localeCompare(a.date));
  saveToLocalStorage(WORK_LOGS_KEY, logs);

  console.log(`[Client Action] Log successfully ${operation}.`);
  return savedLog;
}

/**
 * Deletes a work log entry from localStorage by ID.
 */
export function deleteWorkLog(id: string): void {
    console.log('[Client Action] deleteWorkLog called for ID:', id);
    let logs = getWorkLogs();
    const initialLength = logs.length;
    logs = logs.filter(log => log.id !== id);

    if (logs.length < initialLength) {
        saveToLocalStorage(WORK_LOGS_KEY, logs);
        console.log('[Client Action] Deleted log with ID:', id);
    } else {
        console.warn('[Client Action] Log ID not found for deletion:', id);
        throw new Error(`Work log with ID ${id} not found for deletion.`);
    }
}

// === UPH Target Actions (Client-Side) ===

/**
 * Fetches all UPH targets from localStorage.
 */
export function getUPHTargets(): UPHTarget[] {
  console.log('[Client Action] getUPHTargets called');
  const targets = getFromLocalStorage<UPHTarget[]>(UPH_TARGETS_KEY, []);
  console.log(`[Client Action] Fetched ${targets.length} UPH targets from localStorage.`);
  return targets;
}

/**
 * Adds a new UPH target to localStorage. Defaults to isActive: false.
 */
export function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): UPHTarget {
  console.log('[Client Action] addUPHTarget called with:', targetData);

  if (!targetData.name || targetData.name.trim() === '') {
    throw new Error('Target name cannot be empty.');
  }
  if (targetData.targetUPH === undefined || isNaN(targetData.targetUPH) || targetData.targetUPH <= 0) {
    throw new Error('Target UPH must be a positive number.');
  }
  if (targetData.docsPerUnit === undefined || isNaN(targetData.docsPerUnit) || targetData.docsPerUnit <= 0) {
    throw new Error('Documents per unit must be a positive number.');
  }
  if (targetData.videosPerUnit === undefined || isNaN(targetData.videosPerUnit) || targetData.videosPerUnit <= 0) {
    throw new Error('Video sessions per unit must be a positive number.');
  }

  const targets = getUPHTargets();
  const newTarget: UPHTarget = {
    ...targetData,
    id: generateLocalId(),
    isActive: targets.length === 0, // Activate the first target added
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  console.log('[Client Action] Added new target with ID:', newTarget.id);
  return newTarget;
}

/**
 * Updates an existing UPH target in localStorage.
 */
export function updateUPHTarget(targetData: UPHTarget): UPHTarget {
  console.log('[Client Action] updateUPHTarget called with:', targetData);

  if (!targetData.id) throw new Error('Target ID is required for update.');
  if (!targetData.name || targetData.name.trim() === '') throw new Error('Target name cannot be empty.');
  if (targetData.targetUPH === undefined || isNaN(targetData.targetUPH) || targetData.targetUPH <= 0) throw new Error('Target UPH must be a positive number.');
  if (targetData.docsPerUnit === undefined || isNaN(targetData.docsPerUnit) || targetData.docsPerUnit <= 0) throw new Error('Documents per unit must be a positive number.');
  if (targetData.videosPerUnit === undefined || isNaN(targetData.videosPerUnit) || targetData.videosPerUnit <= 0) throw new Error('Video sessions per unit must be a positive number.');

  const targets = getUPHTargets();
  const index = targets.findIndex((t) => t.id === targetData.id);

  if (index > -1) {
    targets[index] = targetData;
    saveToLocalStorage(UPH_TARGETS_KEY, targets);
    console.log('[Client Action] Updated target with ID:', targetData.id);
  } else {
    console.warn('[Client Action] Target ID not found for update:', targetData.id);
    throw new Error(`Target with ID ${targetData.id} not found for update.`);
  }
  return targetData;
}

/**
 * Deletes a UPH target from localStorage. Cannot delete the active target.
 */
export function deleteUPHTarget(id: string): void {
  console.log('[Client Action] deleteUPHTarget called for ID:', id);
  let targets = getUPHTargets();
  const targetToDelete = targets.find((t) => t.id === id);

  if (!targetToDelete) {
    throw new Error(`Target with ID ${id} not found for deletion.`);
  }
  if (targetToDelete.isActive) {
    throw new Error('Cannot delete the currently active target. Set another target as active first.');
  }

  targets = targets.filter((t) => t.id !== id);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  console.log('[Client Action] Deleted target with ID:', id);
}

/**
 * Sets a specific target as active in localStorage and deactivates all others.
 */
export function setActiveUPHTarget(id: string): UPHTarget {
  console.log('[Client Action] setActiveUPHTarget called for ID:', id);
  let targets = getUPHTargets();
  let activatedTarget: UPHTarget | null = null;

  const updatedTargets = targets.map((t) => {
    const shouldBeActive = t.id === id;
    if (shouldBeActive) {
      activatedTarget = { ...t, isActive: true };
      return activatedTarget;
    } else {
      return { ...t, isActive: false };
    }
  });

  if (!activatedTarget) {
    throw new Error(`Target with ID ${id} not found.`);
  }

  saveToLocalStorage(UPH_TARGETS_KEY, updatedTargets);
  console.log('[Client Action] Set active target completed for:', id);
  return activatedTarget;
}

/**
 * Fetches the currently active UPH target from localStorage.
 */
export function getActiveUPHTarget(): UPHTarget | null {
  console.log('[Client Action] getActiveUPHTarget called');
  const targets = getUPHTargets();
  const activeTarget = targets.find((t) => t.isActive);

  if (activeTarget) {
    console.log('[Client Action] Found active UPH target:', activeTarget.id);
    return activeTarget;
  } else {
    console.log('[Client Action] No active UPH target found.');
    // Optionally, activate the first target if none is active
    if (targets.length > 0) {
      console.log('[Client Action] Activating the first target by default.');
      return setActiveUPHTarget(targets[0].id);
    }
    return null;
  }
}

// === Sample Data and Clear Actions ===

/**
 * Loads sample work logs and UPH targets into localStorage if no data exists.
 * @returns {boolean} True if sample data was loaded, false otherwise.
 */
export function loadSampleData(): boolean {
    console.log('[Client Action] Attempting to load sample data...');
    const currentLogs = getWorkLogs();
    const currentTargets = getUPHTargets();

    if (currentLogs.length === 0 && currentTargets.length === 0) {
        // Ensure sample data has unique IDs and correct target associations
        const processedTargets = sampleUPHTargets.map((target, index) => ({
            ...target,
            id: target.id || generateLocalId(), // Ensure ID exists
            isActive: index === 0, // Activate the first sample target
        }));

        const processedLogs = sampleWorkLogs.map(log => ({
            ...log,
            id: log.id || generateLocalId(), // Ensure ID exists
            // Assign a valid target ID from the processed sample targets
            targetId: processedTargets[0]?.id || undefined, // Assign first target ID or undefined
        }));

        saveToLocalStorage(WORK_LOGS_KEY, processedLogs);
        saveToLocalStorage(UPH_TARGETS_KEY, processedTargets);
        console.log('[Client Action] Sample data loaded into localStorage.');
        return true;
    } else {
        console.log('[Client Action] Existing data found. Sample data not loaded.');
        return false;
    }
}

/**
 * Clears all work logs and UPH targets from localStorage.
 */
export function clearAllData(): void {
    if (typeof window === 'undefined') {
        console.error('Attempted to clear localStorage on the server.');
        return;
    }
    console.log('[Client Action] Clearing all data from localStorage...');
    window.localStorage.removeItem(WORK_LOGS_KEY);
    window.localStorage.removeItem(UPH_TARGETS_KEY);
    console.log('[Client Action] All data cleared.');
}

/**
 * Archives today's work log by simply ensuring it's saved.
 * The main logic of distinguishing today vs previous is in page components.
 * This function ensures today's log is persisted.
 */
export function archiveTodayLog(): DailyWorkLog | null {
    if (typeof window === 'undefined') return null;
    const todayDateStr = formatDateISO(new Date());
    const logs = getWorkLogs();
    const todayLog = logs.find(log => log.date === todayDateStr);

    if (todayLog) {
        // Today's log already exists and is saved by `saveWorkLog` calls.
        // No specific "archival" action beyond normal saving is needed
        // as `getWorkLogs` and `getPreviousLogs` on pages handle filtering.
        console.log("[Client Action] archiveTodayLog: Today's log already exists and is part of workLogs.", todayLog);
        // Optionally re-save it if there's a chance it could be modified elsewhere without saving
        // but current flow should handle this.
        // saveWorkLog(todayLog); // This would re-trigger calculations, might not be necessary
        return todayLog;
    } else {
        console.log("[Client Action] archiveTodayLog: No log found for today to archive.");
        return null;
    }
}
