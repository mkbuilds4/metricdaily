// src/lib/actions.ts
// These functions now run CLIENT-SIDE and interact with localStorage.

import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils'; // Import utility

// --- Constants for localStorage keys ---
const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';

// --- Helper Functions ---

/**
 * Generates a simple pseudo-UUID for local IDs.
 * IMPORTANT: Not cryptographically secure or guaranteed unique like a real UUID v4.
 * Suitable for simple local storage IDs where collisions are highly unlikely.
 */
function generateLocalId(): string {
  // Simple timestamp + random string
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}


/**
 * Safely retrieves and parses JSON data from localStorage.
 * @param key The localStorage key.
 * @param defaultValue The value to return if the key is not found or parsing fails.
 */
function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    // Cannot access localStorage on the server
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
 * @param key The localStorage key.
 * @param value The value to save.
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
  // Sort logs by date descending (most recent first)
  logs.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`[Client Action] Fetched ${logs.length} work logs from localStorage.`);
  return logs;
}

/**
 * Saves (adds or updates) a work log entry in localStorage.
 * Expects `hoursWorked` to be pre-calculated.
 * If `logData.id` is provided, it updates the existing entry.
 * Otherwise, it adds a new entry with a generated local ID.
 * Updates log for the same date if one exists instead of adding duplicates.
 */
export function saveWorkLog(
  logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }
): DailyWorkLog {
  console.log('[Client Action] saveWorkLog called with:', logData);

  // Basic validation
   if (logData.hoursWorked === undefined || logData.hoursWorked === null || isNaN(logData.hoursWorked) || logData.hoursWorked < 0) {
    console.error('Invalid hoursWorked provided:', logData.hoursWorked);
    throw new Error('Hours worked must be a non-negative number.');
  }
  if (logData.documentsCompleted === undefined || logData.documentsCompleted === null || isNaN(logData.documentsCompleted) || logData.documentsCompleted < 0) {
    console.error('Invalid documentsCompleted provided:', logData.documentsCompleted);
    throw new Error('Documents completed must be a non-negative number.');
  }
  if (logData.videoSessionsCompleted === undefined || logData.videoSessionsCompleted === null || isNaN(logData.videoSessionsCompleted) || logData.videoSessionsCompleted < 0) {
    console.error('Invalid videoSessionsCompleted provided:', logData.videoSessionsCompleted);
    throw new Error('Video sessions completed must be a non-negative number.');
  }
  // Ensure date format is valid (basic check, more robust validation might be needed)
  if (!logData.date || !/^\d{4}-\d{2}-\d{2}$/.test(logData.date)) {
       console.error('Invalid date format provided:', logData.date);
       throw new Error('Date must be in YYYY-MM-DD format.');
  }

  const logs = getWorkLogs(); // Get current logs
  let savedLog: DailyWorkLog;
  let operation: 'added' | 'updated' = 'added'; // Track operation type

  // Check if an ID was provided for update
  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      // Update existing log found by ID
      savedLog = { ...logs[index], ...logData }; // Merge updates
      logs[index] = savedLog;
      console.log('[Client Action] Updated log using provided ID:', logData.id);
      operation = 'updated';
    } else {
      // ID provided but not found - treat as new entry (perhaps log was deleted elsewhere)
      // Generate a new ID and add it.
      console.warn('[Client Action] Log ID provided but not found, adding as new:', logData.id);
      savedLog = { ...logData, id: generateLocalId() }; // Generate a new ID
      logs.push(savedLog);
       operation = 'added'; // Effectively added
    }
  } else {
    // No ID provided - check if a log for this date already exists
    const existingLogIndex = logs.findIndex(log => log.date === logData.date);
    if (existingLogIndex > -1) {
        // Update the existing log for that date instead of adding a new one
        const existingId = logs[existingLogIndex].id;
        savedLog = { ...logs[existingLogIndex], ...logData, id: existingId };
        logs[existingLogIndex] = savedLog;
        console.log('[Client Action] Updated existing log found by date:', logData.date, ' ID:', existingId);
        operation = 'updated';
    } else {
        // Truly a new log for a new date
        savedLog = { ...logData, id: generateLocalId() }; // Generate a local ID
        logs.push(savedLog);
        console.log('[Client Action] Added new log with ID:', savedLog.id);
         operation = 'added';
    }
  }

  // Ensure logs remain sorted after modification
  logs.sort((a, b) => b.date.localeCompare(a.date));
  saveToLocalStorage(WORK_LOGS_KEY, logs);

  console.log(`[Client Action] Log successfully ${operation}.`);
  // Revalidation is handled by components re-fetching or state updates
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
        // Revalidation handled by component state update
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
 * Includes validation for new docsPerUnit and videosPerUnit fields.
 */
export function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): UPHTarget {
  console.log('[Client Action] addUPHTarget called with:', targetData);

  // Validation
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
    id: generateLocalId(), // Generate local ID
    isActive: false, // New targets default to inactive
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  console.log('[Client Action] Added new target with ID:', newTarget.id);
  // Revalidation handled by components
  return newTarget;
}

/**
 * Updates an existing UPH target in localStorage.
 * Includes validation for updated docsPerUnit and videosPerUnit fields.
 */
export function updateUPHTarget(targetData: UPHTarget): UPHTarget {
  console.log('[Client Action] updateUPHTarget called with:', targetData);

  // Validation
  if (!targetData.id) {
    throw new Error('Target ID is required for update.');
  }
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
  const index = targets.findIndex((t) => t.id === targetData.id);

  if (index > -1) {
    // Ensure isActive status is preserved if not explicitly changed?
    // The current implementation overwrites completely. If merging is needed:
    // targets[index] = { ...targets[index], ...targetData };
    targets[index] = targetData; // Overwrite with new data
    saveToLocalStorage(UPH_TARGETS_KEY, targets);
    console.log('[Client Action] Updated target with ID:', targetData.id);
  } else {
    console.warn('[Client Action] Target ID not found for update:', targetData.id);
    // Optionally, could add it here if desired, but update implies existence
    throw new Error(`Target with ID ${targetData.id} not found for update.`);
  }
  // Revalidation handled by components
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
    console.warn(`[Client Action] Target with ID ${id} not found for deletion.`);
    throw new Error(`Target with ID ${id} not found for deletion.`);
  }

  if (targetToDelete.isActive) {
    throw new Error('Cannot delete the currently active target. Set another target as active first.');
  }

  targets = targets.filter((t) => t.id !== id);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  console.log('[Client Action] Deleted target with ID:', id);
  // Revalidation handled by components
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
      // Ensure others are inactive
      return { ...t, isActive: false };
    }
  });

  if (!activatedTarget) {
     console.error(`[Client Action] Target with ID ${id} not found to set active.`);
    throw new Error(`Target with ID ${id} not found.`);
  }

  saveToLocalStorage(UPH_TARGETS_KEY, updatedTargets);
  console.log('[Client Action] Set active target completed for:', id);
  // Revalidation handled by components
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
    return null;
  }
}
