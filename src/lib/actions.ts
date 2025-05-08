
// src/lib/actions.ts
// Client-side actions interacting with localStorage.

import type { DailyWorkLog, UPHTarget, AuditLogEntry, AuditLogActionType, UserSettings } from '@/types';
import { formatDateISO, calculateHoursWorked } from '@/lib/utils';
import { sampleWorkLogs, sampleUPHTargets } from './sample-data';

const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';
const AUDIT_LOGS_KEY = 'auditLogs';
const SETTINGS_KEY = 'userSettings'; // Key for storing user settings
const SAMPLE_DATA_LOADED_KEY = 'sampleDataLoaded'; // Key to track if sample data is active

// --- Local Storage Helpers ---

function generateLocalId(): string {
  // Basic ID generation, consider a more robust UUID library for production
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    // console.warn(`Attempted to access localStorage key "${key}" on the server.`);
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

// --- Audit Log Actions ---

export function getAuditLogs(): AuditLogEntry[] {
  const logs = getFromLocalStorage<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
  // Sort logs by timestamp descending (most recent first)
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return logs;
}


export function addAuditLog(
  action: AuditLogActionType,
  entityType: 'WorkLog' | 'UPHTarget' | 'System' | 'Security' | 'Settings',
  details: string,
  entityId?: string,
  previousState?: Partial<DailyWorkLog | UPHTarget | UserSettings> | null,
  newState?: Partial<DailyWorkLog | UPHTarget | UserSettings> | null
): void {
  const auditLogs = getAuditLogs(); // Get currently sorted logs
  const newLogEntry: AuditLogEntry = {
    id: generateLocalId(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    details,
    previousState: previousState ?? undefined,
    newState: newState ?? undefined,
  };
  // Add new entry to the beginning (maintaining sort order)
  auditLogs.unshift(newLogEntry);
  // Save only the most recent logs (e.g., last 500)
  saveToLocalStorage(AUDIT_LOGS_KEY, auditLogs.slice(0, 500));
  console.log('[Audit Log] Added:', newLogEntry);
}

// --- Work Log Actions ---

/**
 * Retrieves all work logs from local storage, sorted by date descending.
 */
export function getWorkLogs(): DailyWorkLog[] {
  const logs = getFromLocalStorage<DailyWorkLog[]>(WORK_LOGS_KEY, []);
  // Sort by date descending AFTER retrieving all logs
  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs;
}


/**
 * Saves or updates a work log in local storage.
 * Handles CREATE_WORK_LOG, UPDATE_WORK_LOG, and UPDATE_WORK_LOG_GOAL_MET audit logs.
 * Other specific update types (QUICK_COUNT, BREAK, TRAINING) should be logged by the calling function.
 */
export function saveWorkLog(
  logData: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { id?: string; hoursWorked?: number; }
): DailyWorkLog {
  const totalNonWorkMinutes = (logData.breakDurationMinutes || 0) + (logData.trainingDurationMinutes || 0);
  let finalHoursWorked: number;

  // Calculate hours worked if possible
  if (logData.date && logData.startTime && logData.endTime && totalNonWorkMinutes !== undefined && totalNonWorkMinutes !== null) {
      finalHoursWorked = calculateHoursWorked(logData.date, logData.startTime, logData.endTime, totalNonWorkMinutes);
  } else if (logData.hoursWorked !== undefined && logData.hoursWorked !== null) {
      // Allow passing pre-calculated hours (e.g., from quick updates where times don't change)
      finalHoursWorked = logData.hoursWorked;
  } else {
       throw new Error('Could not determine hours worked. Need either start/end times and durations, or explicit hoursWorked.');
  }

  if (finalHoursWorked < 0) throw new Error('Calculated hours worked cannot be negative.');

  // Validate and sanitize document/video counts
  const documentsCompleted = Number.isFinite(logData.documentsCompleted) && logData.documentsCompleted >= 0 ? logData.documentsCompleted : 0;
  const videoSessionsCompleted = Number.isFinite(logData.videoSessionsCompleted) && logData.videoSessionsCompleted >= 0 ? logData.videoSessionsCompleted : 0;

  if (!logData.date || !/^\d{4}-\d{2}-\d{2}$/.test(logData.date)) throw new Error('Date must be in YYYY-MM-DD format.');

  if (logData.targetId) {
       const targets = getUPHTargets();
       if (!targets.some(t => t.id === logData.targetId)) {
           console.warn(`[Client Action] Target ID "${logData.targetId}" provided for log does not exist. Saving log without association.`);
       }
  }

  const logs = getWorkLogs(); // Retrieve all logs
  let savedLog: DailyWorkLog;
  // Default action type, might be changed below
  let operation: AuditLogActionType = 'CREATE_WORK_LOG';
  let previousState: DailyWorkLog | null = null;
  let details = '';

  // Base data for the log, excluding ID, using sanitized counts
  const completeLogData: Omit<DailyWorkLog, 'id'> = {
      date: logData.date,
      startTime: logData.startTime,
      endTime: logData.endTime,
      breakDurationMinutes: logData.breakDurationMinutes ?? 0,
      trainingDurationMinutes: logData.trainingDurationMinutes ?? 0,
      hoursWorked: finalHoursWorked,
      documentsCompleted: documentsCompleted, // Use sanitized value
      videoSessionsCompleted: videoSessionsCompleted, // Use sanitized value
      targetId: logData.targetId,
      notes: logData.notes,
      goalMetTimes: logData.goalMetTimes ?? {},
  };

  // Determine if it's an update or create
  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      previousState = { ...logs[index] };
      savedLog = { ...logs[index], ...completeLogData };
      logs[index] = savedLog;
      operation = 'UPDATE_WORK_LOG'; // Default update type

      // Check specifically for goal met time change
      const oldMetTimes = JSON.stringify(previousState.goalMetTimes || {});
      const newMetTimes = JSON.stringify(savedLog.goalMetTimes || {});
      if (oldMetTimes !== newMetTimes && Object.keys(savedLog.goalMetTimes || {}).length > Object.keys(previousState.goalMetTimes || {}).length) {
        operation = 'UPDATE_WORK_LOG_GOAL_MET';
        const newTargetId = Object.keys(savedLog.goalMetTimes || {}).find(key => !(previousState?.goalMetTimes || {})[key]);
        const targetName = getUPHTargets().find(t => t.id === newTargetId)?.name || 'Unknown Target';
        details = `Target "${targetName}" goal met time recorded for log ${savedLog.date}.`;
      }
    } else {
      // ID provided but not found - treat as creation
      savedLog = { ...completeLogData, id: generateLocalId() };
      logs.push(savedLog);
      operation = 'CREATE_WORK_LOG';
    }
  } else {
     // No ID provided - check if log for this date exists
     const existingLogIndex = logs.findIndex(log => log.date === logData.date);
     if (existingLogIndex > -1) {
        // Log for date exists - update it
        previousState = { ...logs[existingLogIndex] };
        savedLog = { ...logs[existingLogIndex], ...completeLogData };
        logs[existingLogIndex] = savedLog;
        operation = 'UPDATE_WORK_LOG'; // Default update type

        // Check specifically for goal met time change
        const oldMetTimes = JSON.stringify(previousState.goalMetTimes || {});
        const newMetTimes = JSON.stringify(savedLog.goalMetTimes || {});
        if (oldMetTimes !== newMetTimes && Object.keys(savedLog.goalMetTimes || {}).length > Object.keys(previousState.goalMetTimes || {}).length) {
            operation = 'UPDATE_WORK_LOG_GOAL_MET';
            const newTargetId = Object.keys(savedLog.goalMetTimes || {}).find(key => !(previousState?.goalMetTimes || {})[key]);
            const targetName = getUPHTargets().find(t => t.id === newTargetId)?.name || 'Unknown Target';
            details = `Target "${targetName}" goal met time recorded for log ${savedLog.date}.`;
        }
     } else {
        // No log for date exists - create it
        savedLog = { ...completeLogData, id: generateLocalId() };
        logs.push(savedLog);
        operation = 'CREATE_WORK_LOG';
     }
  }

  logs.sort((a, b) => b.date.localeCompare(a.date)); // Keep sorted
  saveToLocalStorage(WORK_LOGS_KEY, logs);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

  // Generate audit log details IF not handled by a specific action type already
  if (!details) {
    details = `${operation === 'CREATE_WORK_LOG' ? 'Created' : 'Updated'} work log for ${savedLog.date}. `;
    if (previousState && operation === 'UPDATE_WORK_LOG') {
        const changes: string[] = [];
        if (previousState.startTime !== savedLog.startTime) changes.push(`Start: ${previousState.startTime} -> ${savedLog.startTime}`);
        if (previousState.endTime !== savedLog.endTime) changes.push(`End: ${previousState.endTime} -> ${savedLog.endTime}`);
        if (previousState.breakDurationMinutes !== savedLog.breakDurationMinutes) changes.push(`Break: ${previousState.breakDurationMinutes}m -> ${savedLog.breakDurationMinutes}m`);
        if ((previousState.trainingDurationMinutes || 0) !== (savedLog.trainingDurationMinutes || 0)) changes.push(`Training: ${previousState.trainingDurationMinutes || 0}m -> ${savedLog.trainingDurationMinutes || 0}m`);
        if (previousState.documentsCompleted !== savedLog.documentsCompleted) changes.push(`Docs: ${previousState.documentsCompleted} -> ${savedLog.documentsCompleted}`);
        if (previousState.videoSessionsCompleted !== savedLog.videoSessionsCompleted) changes.push(`Videos: ${previousState.videoSessionsCompleted} -> ${savedLog.videoSessionsCompleted}`);
        if (previousState.notes !== savedLog.notes) changes.push(`Notes updated.`);
        if (previousState.targetId !== savedLog.targetId) changes.push(`Target ID updated.`);
        details += changes.join(', ') || 'No other specific field changes detected.';
    } else if (operation === 'CREATE_WORK_LOG') {
        details += `Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}, Hours: ${savedLog.hoursWorked.toFixed(2)}.`;
    }
  }

  // Log only for CREATE, generic UPDATE, and GOAL_MET
  if (operation === 'CREATE_WORK_LOG' || operation === 'UPDATE_WORK_LOG' || operation === 'UPDATE_WORK_LOG_GOAL_MET') {
     addAuditLog(operation, 'WorkLog', details, savedLog.id, previousState, savedLog );
  }

  return savedLog;
}


export function deleteWorkLog(id: string): void {
    let logs = getWorkLogs();
    const logToDelete = logs.find(log => log.id === id);

    if (logToDelete) {
        logs = logs.filter(log => log.id !== id);
        saveToLocalStorage(WORK_LOGS_KEY, logs);
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
        addAuditLog(
          'DELETE_WORK_LOG',
          'WorkLog',
          `Deleted work log for ${logToDelete.date} (ID: ${id}). Docs: ${logToDelete.documentsCompleted}, Videos: ${logToDelete.videoSessionsCompleted}.`,
          id,
          logToDelete,
          null
        );
    } else {
        console.warn('[Client Action] Log ID not found for deletion:', id);
        throw new Error(`Work log with ID ${id} not found for deletion.`);
    }
}

// --- UPH Target Actions ---

export function getUPHTargets(): UPHTarget[] {
  const targets = getFromLocalStorage<UPHTarget[]>(UPH_TARGETS_KEY, []);
  return targets;
}

export function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): UPHTarget {
  if (!targetData.name || targetData.name.trim() === '') throw new Error('Target name cannot be empty.');
  if (targetData.targetUPH === undefined || isNaN(targetData.targetUPH) || targetData.targetUPH <= 0) throw new Error('Target UPH must be a positive number.');
  if (targetData.docsPerUnit === undefined || isNaN(targetData.docsPerUnit) || targetData.docsPerUnit <= 0) throw new Error('Documents per unit must be a positive number.');
  if (targetData.videosPerUnit === undefined || isNaN(targetData.videosPerUnit) || targetData.videosPerUnit <= 0) throw new Error('Video sessions per unit must be a positive number.');

  const targets = getUPHTargets();
  const newTarget: UPHTarget = {
    ...targetData,
    id: generateLocalId(),
    isActive: targets.length === 0, // Activate if it's the first target
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
  addAuditLog(
    'CREATE_UPH_TARGET',
    'UPHTarget',
    `Created UPH target "${newTarget.name}". UPH: ${newTarget.targetUPH}, Docs/Unit: ${newTarget.docsPerUnit}, Videos/Unit: ${newTarget.videosPerUnit}.`,
    newTarget.id,
    null,
    newTarget
  );
  return newTarget;
}

export function updateUPHTarget(targetData: UPHTarget): UPHTarget {
  if (!targetData.id) throw new Error('Target ID is required for update.');
  if (!targetData.name || targetData.name.trim() === '') throw new Error('Target name cannot be empty.');
  if (targetData.targetUPH === undefined || isNaN(targetData.targetUPH) || targetData.targetUPH <= 0) throw new Error('Target UPH must be a positive number.');
  if (targetData.docsPerUnit === undefined || isNaN(targetData.docsPerUnit) || targetData.docsPerUnit <= 0) throw new Error('Documents per unit must be a positive number.');
  if (targetData.videosPerUnit === undefined || isNaN(targetData.videosPerUnit) || targetData.videosPerUnit <= 0) throw new Error('Video sessions per unit must be a positive number.');

  const targets = getUPHTargets();
  const index = targets.findIndex((t) => t.id === targetData.id);
  let previousState: UPHTarget | null = null;

  if (index > -1) {
    previousState = { ...targets[index] };
    targets[index] = targetData; // Replace the entire target object
    saveToLocalStorage(UPH_TARGETS_KEY, targets);
    saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists

    // Generate details for audit log
    const changes: string[] = [];
    if (previousState.name !== targetData.name) changes.push(`Name: "${previousState.name}" -> "${targetData.name}"`);
    if (previousState.targetUPH !== targetData.targetUPH) changes.push(`Target UPH: ${previousState.targetUPH} -> ${targetData.targetUPH}`);
    if (previousState.docsPerUnit !== targetData.docsPerUnit) changes.push(`Docs/Unit: ${previousState.docsPerUnit} -> ${targetData.docsPerUnit}`);
    if (previousState.videosPerUnit !== targetData.videosPerUnit) changes.push(`Videos/Unit: ${previousState.videosPerUnit} -> ${targetData.videosPerUnit}`);
    if (previousState.isActive !== targetData.isActive) changes.push(`Activation status changed to ${targetData.isActive}.`);

    addAuditLog(
      'UPDATE_UPH_TARGET',
      'UPHTarget',
      `Updated UPH target "${targetData.name}". Changes: ${changes.join(', ') || 'No field changes.'}`,
      targetData.id,
      previousState,
      targetData
    );
  } else {
    throw new Error(`Target with ID ${targetData.id} not found for update.`);
  }
  return targetData;
}

export function deleteUPHTarget(id: string): void {
  let targets = getUPHTargets();
  const targetToDelete = targets.find((t) => t.id === id);

  if (!targetToDelete) throw new Error(`Target with ID ${id} not found for deletion.`);
  if (targetToDelete.isActive) throw new Error('Cannot delete the currently active target. Set another target as active first.');

  targets = targets.filter((t) => t.id !== id);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
  addAuditLog(
    'DELETE_UPH_TARGET',
    'UPHTarget',
    `Deleted UPH target "${targetToDelete.name}" (ID: ${id}). UPH: ${targetToDelete.targetUPH}.`,
    id,
    targetToDelete,
    null
  );
}

export function setActiveUPHTarget(id: string): UPHTarget {
  let targets = getUPHTargets();
  let activatedTarget: UPHTarget | null = null;
  let previouslyActiveTarget: UPHTarget | null = targets.find(t => t.isActive) || null;

  const updatedTargets = targets.map((t) => {
    const shouldBeActive = t.id === id;
    if (shouldBeActive) {
      activatedTarget = { ...t, isActive: true };
      return activatedTarget;
    } else if (t.isActive) {
      // Deactivate previously active target
      return { ...t, isActive: false };
    }
    return t; // Keep others as they are
  });

  if (!activatedTarget) throw new Error(`Target with ID ${id} not found.`);

  saveToLocalStorage(UPH_TARGETS_KEY, updatedTargets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
  addAuditLog(
    'SET_ACTIVE_UPH_TARGET',
    'UPHTarget',
    `Set UPH target "${activatedTarget.name}" as active.${previouslyActiveTarget ? ` Previously active: "${previouslyActiveTarget.name}".` : ''}`,
    activatedTarget.id,
    previouslyActiveTarget, // Log the target that was deactivated
    activatedTarget // Log the target that was activated
  );
  return activatedTarget;
}


export function getActiveUPHTarget(): UPHTarget | null {
  const targets = getUPHTargets();
  const activeTarget = targets.find((t) => t.isActive);

  if (activeTarget) {
    return activeTarget;
  } else if (targets.length > 0) {
    // Don't automatically activate. Let the UI handle it or use a default.
    // Returning the first one allows the UI to display *something* but doesn't change state.
     console.warn("[Action] No active target found. Returning first target as fallback for display.");
     return targets[0];
  }
  return null;
}

/**
 * Duplicates an existing UPH target in localStorage.
 * The new target will have "- Copy" appended to its name and will be inactive.
 */
export function duplicateUPHTarget(id: string): UPHTarget {
  const targets = getUPHTargets();
  const originalTarget = targets.find(t => t.id === id);

  if (!originalTarget) {
    throw new Error(`Target with ID ${id} not found for duplication.`);
  }

  // Create a unique name for the duplicate
  let duplicateName = `${originalTarget.name} - Copy`;
  let counter = 1;
  while (targets.some(t => t.name === duplicateName)) {
    counter++;
    duplicateName = `${originalTarget.name} - Copy ${counter}`;
  }


  const newTarget: UPHTarget = {
    ...originalTarget,
    id: generateLocalId(),
    name: duplicateName,
    isActive: false, // Duplicated targets are inactive by default
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
  addAuditLog(
    'DUPLICATE_UPH_TARGET', // Changed action type
    'UPHTarget',
    `Duplicated UPH target "${originalTarget.name}" to "${newTarget.name}".`,
    newTarget.id,
    originalTarget, // Log original as previous state for context
    newTarget
  );
  return newTarget;
}

// --- Time Adjustment Actions ---

/**
 * Adds break time to a specific work log.
 * Returns the updated log.
 * Audit logging should be handled by the calling function.
 */
export function addBreakTimeToLog(logId: string, breakMinutes: number): DailyWorkLog {
  const logs = getWorkLogs();
  const logIndex = logs.findIndex(log => log.id === logId);
  if (logIndex === -1) throw new Error(`Log with ID ${logId} not found.`);

  const originalLog = { ...logs[logIndex] };
  const updatedLog = { ...originalLog };

  updatedLog.breakDurationMinutes = (updatedLog.breakDurationMinutes || 0) + breakMinutes;
  const totalNonWorkMinutes = updatedLog.breakDurationMinutes + (updatedLog.trainingDurationMinutes || 0);
  updatedLog.hoursWorked = calculateHoursWorked(updatedLog.date, updatedLog.startTime, updatedLog.endTime, totalNonWorkMinutes);

  logs[logIndex] = updatedLog;
  saveToLocalStorage(WORK_LOGS_KEY, logs);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

  // Removed audit log call from here
  return updatedLog;
}

/**
 * Adds training time to a specific work log.
 * Returns the updated log.
 * Audit logging should be handled by the calling function.
 */
export function addTrainingTimeToLog(logId: string, trainingMinutes: number): DailyWorkLog {
  const logs = getWorkLogs();
  const logIndex = logs.findIndex(log => log.id === logId);
  if (logIndex === -1) throw new Error(`Log with ID ${logId} not found.`);

  const originalLog = { ...logs[logIndex] };
  const updatedLog = { ...originalLog };

  updatedLog.trainingDurationMinutes = (updatedLog.trainingDurationMinutes || 0) + trainingMinutes;
  const totalNonWorkMinutes = (updatedLog.breakDurationMinutes || 0) + updatedLog.trainingDurationMinutes;
  updatedLog.hoursWorked = calculateHoursWorked(updatedLog.date, updatedLog.startTime, updatedLog.endTime, totalNonWorkMinutes);

  logs[logIndex] = updatedLog;
  saveToLocalStorage(WORK_LOGS_KEY, logs);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

  // Removed audit log call from here
  return updatedLog;
}

// --- System Data Actions ---

/** Checks if sample data has been loaded */
export function isSampleDataLoaded(): boolean {
    return getFromLocalStorage<boolean>(SAMPLE_DATA_LOADED_KEY, false);
}


export function loadSampleData(): boolean {
    const currentLogs = getWorkLogs();
    const currentTargets = getUPHTargets();

    if (currentLogs.length === 0 && currentTargets.length === 0) {
        // Make sure sample targets are set up correctly
        const processedTargets = sampleUPHTargets.map((target, index) => ({
            ...target,
            id: target.id || generateLocalId(),
            isActive: index === 0, // Activate the first one
        }));

        // Make sure sample logs reference a valid target ID and have training set
        const processedLogs = sampleWorkLogs.map(log => ({
            ...log,
            id: log.id || generateLocalId(),
            targetId: processedTargets[0]?.id || undefined, // Use the first sample target's ID
            breakDurationMinutes: log.breakDurationMinutes ?? 0, // Default break if missing
            trainingDurationMinutes: log.trainingDurationMinutes ?? 0, // Default training if missing
            goalMetTimes: {}, // Initialize empty goalMetTimes
        }));

        saveToLocalStorage(WORK_LOGS_KEY, processedLogs);
        saveToLocalStorage(UPH_TARGETS_KEY, processedTargets);
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, true); // Set sample data flag

        // Save default settings if none exist when loading sample data
        const currentSettings = getFromLocalStorage<UserSettings | null>(SETTINGS_KEY, null);
        if (!currentSettings || Object.keys(currentSettings).length === 0) {
          saveDefaultSettings({
            defaultStartTime: '14:00',
            defaultEndTime: '22:30',
            defaultBreakMinutes: 0, // Start with 0 break
            defaultTrainingMinutes: 0, // Start with 0 training
          });
          addAuditLog('UPDATE_SETTINGS', 'Settings', 'Saved initial default settings during sample data load.');
        }

        addAuditLog('SYSTEM_LOAD_SAMPLE_DATA', 'System', 'Loaded sample work logs and UPH targets.');
        return true;
    }
    return false;
}

export function clearAllData(): void {
    if (typeof window === 'undefined') {
        console.error('Attempted to clear localStorage on the server.');
        return;
    }
    saveToLocalStorage(WORK_LOGS_KEY, []);
    saveToLocalStorage(UPH_TARGETS_KEY, []);
    saveToLocalStorage(SETTINGS_KEY, {}); // Clear settings as well
    saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Reset sample data flag
    // Keep audit logs for now, could add an option to clear them too
    // saveToLocalStorage(AUDIT_LOGS_KEY, []);
    addAuditLog('SYSTEM_CLEAR_ALL_DATA', 'System', 'Cleared all work logs, UPH targets, and settings.');
}

/**
 * Archives today's log by removing it from the main work log list.
 * This effectively moves it to "previous logs" implicitly.
 */
export function archiveTodayLog(): DailyWorkLog | null {
    if (typeof window === 'undefined') return null;

    const todayDateStr = formatDateISO(new Date());
    let allLogs = getWorkLogs(); // Get all logs
    const todayLogIndex = allLogs.findIndex(log => log.date === todayDateStr);

    if (todayLogIndex > -1) {
        const logToArchive = { ...allLogs[todayLogIndex] }; // Copy the log before removing

        // Remove the log from the array
        allLogs.splice(todayLogIndex, 1);

        // Save the updated array (without today's log)
        saveToLocalStorage(WORK_LOGS_KEY, allLogs);
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Indicate real data might still exist

        addAuditLog(
            'SYSTEM_ARCHIVE_TODAY_LOG',
            'WorkLog',
            `Finalized log for ${logToArchive.date} (End Day clicked). It will now appear in Previous Logs.`,
            logToArchive.id,
            logToArchive, // Log the full archived log as previous state
            null // Log null as new state, signifying removal from active logs
        );
        return logToArchive; // Return the log that was archived
    } else {
        addAuditLog('SYSTEM_ARCHIVE_TODAY_LOG', 'System', `Attempted to finalize today's log, but no log found for ${todayDateStr}.`);
        return null; // No log found for today
    }
}


// --- User Settings Actions ---

/**
 * Gets the user's default settings from local storage.
 * Returns default values if no settings are saved.
 */
export function getDefaultSettings(): UserSettings {
  const defaultSettings: UserSettings = {
    defaultStartTime: '14:00',
    defaultEndTime: '22:30',
    defaultBreakMinutes: 0, // Default break to 0
    defaultTrainingMinutes: 0, // Default training to 0
  };
  return getFromLocalStorage<UserSettings>(SETTINGS_KEY, defaultSettings);
}

/**
 * Saves the user's default settings to local storage.
 */
export function saveDefaultSettings(settings: UserSettings): UserSettings {
  if (typeof window === 'undefined') {
    console.error('Attempted to save settings on the server.');
    return settings; // Return input on server
  }
  // Validate time formats before saving
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(settings.defaultStartTime) || !timeRegex.test(settings.defaultEndTime)) {
    throw new Error("Invalid time format. Use HH:mm.");
  }
  // Validate minutes are non-negative integers
  let breakMinutes = settings.defaultBreakMinutes;
  let trainingMinutes = settings.defaultTrainingMinutes;

   if (breakMinutes < 0 || !Number.isInteger(breakMinutes)) {
     console.warn(`Invalid default break minutes (${breakMinutes}), defaulting to 0.`);
     breakMinutes = 0;
  }
   if (trainingMinutes < 0 || !Number.isInteger(trainingMinutes)) {
      console.warn(`Invalid default training minutes (${trainingMinutes}), defaulting to 0.`);
      trainingMinutes = 0;
  }

  const validatedSettings: UserSettings = {
      ...settings,
      defaultBreakMinutes: breakMinutes,
      defaultTrainingMinutes: trainingMinutes,
  }


  const previousSettings = getDefaultSettings();
  saveToLocalStorage(SETTINGS_KEY, validatedSettings);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false); // Mark that real data exists
  addAuditLog(
    'UPDATE_SETTINGS',
    'Settings',
    `Updated default settings. Start: ${validatedSettings.defaultStartTime}, End: ${validatedSettings.defaultEndTime}, Break: ${validatedSettings.defaultBreakMinutes}m, Training: ${validatedSettings.defaultTrainingMinutes}m.`,
    undefined,
    previousSettings,
    validatedSettings
  );
  return validatedSettings;
}
