
// src/lib/actions.ts
// Client-side actions interacting with localStorage.

import type { DailyWorkLog, UPHTarget, AuditLogEntry, AuditLogActionType } from '@/types';
import { formatDateISO, calculateHoursWorked } from '@/lib/utils'; // Import utility
import { sampleWorkLogs, sampleUPHTargets } from './sample-data'; // Import sample data

// --- Constants for localStorage keys ---
const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';
const AUDIT_LOGS_KEY = 'auditLogs'; // New key for audit logs

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
    // console.warn(`Attempted to access localStorage key "${key}" on the server.`); // Reduced console noise
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

// --- Audit Log Actions ---

/**
 * Fetches all audit logs from localStorage, sorted by timestamp descending.
 */
export function getAuditLogs(): AuditLogEntry[] {
  const logs = getFromLocalStorage<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return logs;
}

/**
 * Adds a new entry to the audit log.
 */
function addAuditLog(
  action: AuditLogActionType,
  entityType: 'WorkLog' | 'UPHTarget' | 'System',
  details: string,
  entityId?: string,
  previousState?: Partial<DailyWorkLog | UPHTarget>,
  newState?: Partial<DailyWorkLog | UPHTarget>
): void {
  const auditLogs = getAuditLogs();
  const newLogEntry: AuditLogEntry = {
    id: generateLocalId(),
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    details,
    previousState,
    newState,
  };
  auditLogs.unshift(newLogEntry); // Add to the beginning for chronological order (newest first)
  saveToLocalStorage(AUDIT_LOGS_KEY, auditLogs.slice(0, 500)); // Keep a reasonable limit, e.g., last 500 entries
  console.log('[Audit Log] Added:', newLogEntry);
}


// === Work Log Actions (Client-Side) ===

/**
 * Fetches all work logs from localStorage, sorted by date descending.
 */
export function getWorkLogs(): DailyWorkLog[] {
  // console.log('[Client Action] getWorkLogs called'); // Reduced console noise
  const logs = getFromLocalStorage<DailyWorkLog[]>(WORK_LOGS_KEY, []);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  // console.log(`[Client Action] Fetched ${logs.length} work logs from localStorage.`); // Reduced console noise
  return logs;
}

/**
 * Saves (adds or updates) a work log entry in localStorage.
 * If logData includes breakDurationMinutes or trainingDurationMinutes, it implies hoursWorked should be recalculated.
 */
export function saveWorkLog(
  logData: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { id?: string; hoursWorked?: number; trainingDurationMinutes?: number }
): DailyWorkLog {
  // console.log('[Client Action] saveWorkLog called with:', logData); // Reduced console noise

  const totalNonWorkMinutes = (logData.breakDurationMinutes || 0) + (logData.trainingDurationMinutes || 0);

  let finalHoursWorked: number;
  if (logData.hoursWorked !== undefined && logData.breakDurationMinutes === undefined && logData.trainingDurationMinutes === undefined) {
      finalHoursWorked = logData.hoursWorked;
  } else {
      finalHoursWorked = calculateHoursWorked(logData.date, logData.startTime, logData.endTime, totalNonWorkMinutes);
  }


  if (finalHoursWorked < 0) {
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
   if (logData.targetId) {
       const targets = getUPHTargets();
       if (!targets.some(t => t.id === logData.targetId)) {
           console.warn(`[Client Action] Target ID "${logData.targetId}" provided for log does not exist. Saving log without association.`);
       }
   }


  const logs = getWorkLogs();
  let savedLog: DailyWorkLog;
  let operation: 'added' | 'updated' = 'added';
  let previousState: DailyWorkLog | undefined = undefined;

  const completeLogData: Omit<DailyWorkLog, 'id'> & { trainingDurationMinutes?: number } = {
      date: logData.date,
      startTime: logData.startTime,
      endTime: logData.endTime,
      breakDurationMinutes: logData.breakDurationMinutes || 0,
      trainingDurationMinutes: logData.trainingDurationMinutes || 0,
      documentsCompleted: logData.documentsCompleted,
      videoSessionsCompleted: logData.videoSessionsCompleted,
      targetId: logData.targetId,
      notes: logData.notes,
  };


  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      previousState = { ...logs[index] };
      savedLog = { ...logs[index], ...completeLogData, hoursWorked: finalHoursWorked };
      logs[index] = savedLog;
      operation = 'updated';
    } else {
      savedLog = { ...completeLogData, id: generateLocalId(), hoursWorked: finalHoursWorked };
      logs.push(savedLog);
       operation = 'added';
    }
  } else {
    const existingLogIndex = logs.findIndex(log => log.date === logData.date);
    if (existingLogIndex > -1) {
        const existingId = logs[existingLogIndex].id;
        previousState = { ...logs[existingLogIndex] };
        const targetIdToKeep = logData.targetId ?? logs[existingLogIndex].targetId;
        const trainingToKeep = logData.trainingDurationMinutes ?? logs[existingLogIndex].trainingDurationMinutes ?? 0;
        savedLog = { ...logs[existingLogIndex], ...completeLogData, id: existingId, targetId: targetIdToKeep, trainingDurationMinutes: trainingToKeep, hoursWorked: finalHoursWorked };
        logs[existingLogIndex] = savedLog;
        operation = 'updated';
    } else {
        savedLog = { ...completeLogData, id: generateLocalId(), hoursWorked: finalHoursWorked };
        logs.push(savedLog);
         operation = 'added';
    }
  }

  logs.sort((a, b) => b.date.localeCompare(a.date));
  saveToLocalStorage(WORK_LOGS_KEY, logs);

  addAuditLog(
    operation === 'added' ? 'CREATE_WORK_LOG' : 'UPDATE_WORK_LOG',
    'WorkLog',
    `${operation === 'added' ? 'Created' : 'Updated'} work log for ${savedLog.date}. Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}.`,
    savedLog.id,
    previousState,
    savedLog
  );
  return savedLog;
}

/**
 * Deletes a work log entry from localStorage by ID.
 */
export function deleteWorkLog(id: string): void {
    let logs = getWorkLogs();
    const initialLength = logs.length;
    const logToDelete = logs.find(log => log.id === id);

    if (logToDelete) {
        logs = logs.filter(log => log.id !== id);
        saveToLocalStorage(WORK_LOGS_KEY, logs);
        addAuditLog(
          'DELETE_WORK_LOG',
          'WorkLog',
          `Deleted work log for ${logToDelete.date} (ID: ${id}).`,
          id,
          logToDelete
        );
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
  const targets = getFromLocalStorage<UPHTarget[]>(UPH_TARGETS_KEY, []);
  return targets;
}

/**
 * Adds a new UPH target to localStorage. Defaults to isActive: false.
 */
export function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): UPHTarget {
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
    isActive: targets.length === 0, 
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  addAuditLog(
    'CREATE_UPH_TARGET',
    'UPHTarget',
    `Created UPH target "${newTarget.name}" with UPH ${newTarget.targetUPH}.`,
    newTarget.id,
    undefined,
    newTarget
  );
  return newTarget;
}

/**
 * Updates an existing UPH target in localStorage.
 */
export function updateUPHTarget(targetData: UPHTarget): UPHTarget {
  if (!targetData.id) throw new Error('Target ID is required for update.');
  if (!targetData.name || targetData.name.trim() === '') throw new Error('Target name cannot be empty.');
  if (targetData.targetUPH === undefined || isNaN(targetData.targetUPH) || targetData.targetUPH <= 0) throw new Error('Target UPH must be a positive number.');
  if (targetData.docsPerUnit === undefined || isNaN(targetData.docsPerUnit) || targetData.docsPerUnit <= 0) throw new Error('Documents per unit must be a positive number.');
  if (targetData.videosPerUnit === undefined || isNaN(targetData.videosPerUnit) || targetData.videosPerUnit <= 0) throw new Error('Video sessions per unit must be a positive number.');

  const targets = getUPHTargets();
  const index = targets.findIndex((t) => t.id === targetData.id);
  let previousState: UPHTarget | undefined = undefined;

  if (index > -1) {
    previousState = { ...targets[index] };
    targets[index] = targetData;
    saveToLocalStorage(UPH_TARGETS_KEY, targets);
    addAuditLog(
      'UPDATE_UPH_TARGET',
      'UPHTarget',
      `Updated UPH target "${targetData.name}".`,
      targetData.id,
      previousState,
      targetData
    );
  } else {
    throw new Error(`Target with ID ${targetData.id} not found for update.`);
  }
  return targetData;
}

/**
 * Deletes a UPH target from localStorage. Cannot delete the active target.
 */
export function deleteUPHTarget(id: string): void {
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
  addAuditLog(
    'DELETE_UPH_TARGET',
    'UPHTarget',
    `Deleted UPH target "${targetToDelete.name}" (ID: ${id}).`,
    id,
    targetToDelete
  );
}

/**
 * Sets a specific target as active in localStorage and deactivates all others.
 */
export function setActiveUPHTarget(id: string): UPHTarget {
  let targets = getUPHTargets();
  let activatedTarget: UPHTarget | null = null;
  let previousActiveTarget: UPHTarget | undefined = targets.find(t => t.isActive);


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
  addAuditLog(
    'SET_ACTIVE_UPH_TARGET',
    'UPHTarget',
    `Set UPH target "${activatedTarget.name}" as active.`,
    activatedTarget.id,
    previousActiveTarget, // Log the previously active target
    activatedTarget
  );
  return activatedTarget;
}

/**
 * Fetches the currently active UPH target from localStorage.
 */
export function getActiveUPHTarget(): UPHTarget | null {
  const targets = getUPHTargets();
  const activeTarget = targets.find((t) => t.isActive);

  if (activeTarget) {
    return activeTarget;
  } else {
    if (targets.length > 0) {
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
    const currentLogs = getWorkLogs();
    const currentTargets = getUPHTargets();

    if (currentLogs.length === 0 && currentTargets.length === 0) {
        const processedTargets = sampleUPHTargets.map((target, index) => ({
            ...target,
            id: target.id || generateLocalId(), 
            isActive: index === 0, 
        }));

        const processedLogs = sampleWorkLogs.map(log => ({
            ...log,
            id: log.id || generateLocalId(), 
            targetId: processedTargets[0]?.id || undefined, 
            trainingDurationMinutes: log.trainingDurationMinutes || 0, 
        }));

        saveToLocalStorage(WORK_LOGS_KEY, processedLogs);
        saveToLocalStorage(UPH_TARGETS_KEY, processedTargets);
        addAuditLog('LOAD_SAMPLE_DATA', 'System', 'Loaded sample work logs and UPH targets.');
        return true;
    } else {
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
    saveToLocalStorage(WORK_LOGS_KEY, []);
    saveToLocalStorage(UPH_TARGETS_KEY, []);
    // Optionally clear audit logs too, or keep them for history
    // saveToLocalStorage(AUDIT_LOGS_KEY, []); 
    addAuditLog('CLEAR_ALL_DATA', 'System', 'Cleared all work logs and UPH targets.');
}

/**
 * Archives today's work log by simply ensuring it's saved.
 */
export function archiveTodayLog(): DailyWorkLog | null {
    if (typeof window === 'undefined') return null;
    const todayDateStr = formatDateISO(new Date());
    const logs = getWorkLogs();
    const todayLog = logs.find(log => log.date === todayDateStr);

    if (todayLog) {
        addAuditLog('ARCHIVE_TODAY_LOG', 'WorkLog', `Archived today's log for ${todayLog.date}.`, todayLog.id, todayLog, todayLog);
        return todayLog;
    } else {
        addAuditLog('ARCHIVE_TODAY_LOG', 'System', `Attempted to archive today's log, but no log found for ${todayDateStr}.`);
        return null;
    }
}
