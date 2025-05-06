
// src/lib/actions.ts
// Client-side actions interacting with localStorage.

import type { DailyWorkLog, UPHTarget, AuditLogEntry, AuditLogActionType } from '@/types';
import { formatDateISO, calculateHoursWorked } from '@/lib/utils'; 
import { sampleWorkLogs, sampleUPHTargets } from './sample-data'; 

const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';
const AUDIT_LOGS_KEY = 'auditLogs'; 

function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
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

export function getAuditLogs(): AuditLogEntry[] {
  const logs = getFromLocalStorage<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return logs;
}

function addAuditLog(
  action: AuditLogActionType,
  entityType: 'WorkLog' | 'UPHTarget' | 'System',
  details: string,
  entityId?: string,
  previousState?: Partial<DailyWorkLog | UPHTarget> | null, 
  newState?: Partial<DailyWorkLog | UPHTarget> | null 
): void {
  const auditLogs = getAuditLogs();
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
  auditLogs.unshift(newLogEntry); 
  saveToLocalStorage(AUDIT_LOGS_KEY, auditLogs.slice(0, 500)); 
  console.log('[Audit Log] Added:', newLogEntry);
}

export function getWorkLogs(): DailyWorkLog[] {
  const logs = getFromLocalStorage<DailyWorkLog[]>(WORK_LOGS_KEY, []);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs;
}

export function saveWorkLog(
  logData: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { id?: string; hoursWorked?: number; trainingDurationMinutes?: number }
): DailyWorkLog {
  const totalNonWorkMinutes = (logData.breakDurationMinutes || 0) + (logData.trainingDurationMinutes || 0);
  let finalHoursWorked: number;

  if (logData.hoursWorked !== undefined && logData.breakDurationMinutes === undefined && logData.trainingDurationMinutes === undefined) {
      finalHoursWorked = logData.hoursWorked;
  } else {
      finalHoursWorked = calculateHoursWorked(logData.date, logData.startTime, logData.endTime, totalNonWorkMinutes);
  }

  if (finalHoursWorked < 0) throw new Error('Calculated hours worked cannot be negative.');
  if (logData.documentsCompleted === undefined || isNaN(logData.documentsCompleted) || logData.documentsCompleted < 0) throw new Error('Documents completed must be a non-negative number.');
  if (logData.videoSessionsCompleted === undefined || isNaN(logData.videoSessionsCompleted) || logData.videoSessionsCompleted < 0) throw new Error('Video sessions completed must be a non-negative number.');
  if (!logData.date || !/^\d{4}-\d{2}-\d{2}$/.test(logData.date)) throw new Error('Date must be in YYYY-MM-DD format.');
  if (logData.targetId) {
       const targets = getUPHTargets();
       if (!targets.some(t => t.id === logData.targetId)) {
           console.warn(`[Client Action] Target ID "${logData.targetId}" provided for log does not exist. Saving log without association.`);
       }
  }

  const logs = getWorkLogs();
  let savedLog: DailyWorkLog;
  let operation: 'CREATE_WORK_LOG' | 'UPDATE_WORK_LOG' = 'CREATE_WORK_LOG';
  let previousState: DailyWorkLog | null = null;

  const completeLogData: Omit<DailyWorkLog, 'id'> = {
      date: logData.date,
      startTime: logData.startTime,
      endTime: logData.endTime,
      breakDurationMinutes: logData.breakDurationMinutes || 0,
      trainingDurationMinutes: logData.trainingDurationMinutes || 0,
      hoursWorked: finalHoursWorked, 
      documentsCompleted: logData.documentsCompleted,
      videoSessionsCompleted: logData.videoSessionsCompleted,
      targetId: logData.targetId,
      notes: logData.notes,
  };

  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      previousState = { ...logs[index] };
      savedLog = { ...logs[index], ...completeLogData };
      logs[index] = savedLog;
      operation = 'UPDATE_WORK_LOG';
    } else {
      savedLog = { ...completeLogData, id: generateLocalId() };
      logs.push(savedLog);
    }
  } else {
    const existingLogIndex = logs.findIndex(log => log.date === logData.date);
    if (existingLogIndex > -1) {
        previousState = { ...logs[existingLogIndex] };
        const targetIdToKeep = logData.targetId ?? logs[existingLogIndex].targetId;
        const trainingToKeep = logData.trainingDurationMinutes ?? logs[existingLogIndex].trainingDurationMinutes ?? 0;
        savedLog = { ...logs[existingLogIndex], ...completeLogData, targetId: targetIdToKeep, trainingDurationMinutes: trainingToKeep };
        logs[existingLogIndex] = savedLog;
        operation = 'UPDATE_WORK_LOG'; 
    } else {
        savedLog = { ...completeLogData, id: generateLocalId() };
        logs.push(savedLog);
    }
  }

  logs.sort((a, b) => b.date.localeCompare(a.date));
  saveToLocalStorage(WORK_LOGS_KEY, logs);

  let details = `${operation === 'CREATE_WORK_LOG' ? 'Created' : 'Updated'} work log for ${savedLog.date}. `;
  if (previousState) {
    const changes: string[] = [];
    if (previousState.startTime !== savedLog.startTime) changes.push(`Start: ${previousState.startTime} -> ${savedLog.startTime}`);
    if (previousState.endTime !== savedLog.endTime) changes.push(`End: ${previousState.endTime} -> ${savedLog.endTime}`);
    if (previousState.breakDurationMinutes !== savedLog.breakDurationMinutes) changes.push(`Break: ${previousState.breakDurationMinutes}m -> ${savedLog.breakDurationMinutes}m`);
    if ((previousState.trainingDurationMinutes || 0) !== (savedLog.trainingDurationMinutes || 0)) changes.push(`Training: ${previousState.trainingDurationMinutes || 0}m -> ${savedLog.trainingDurationMinutes || 0}m`);
    if (previousState.documentsCompleted !== savedLog.documentsCompleted) changes.push(`Docs: ${previousState.documentsCompleted} -> ${savedLog.documentsCompleted}`);
    if (previousState.videoSessionsCompleted !== savedLog.videoSessionsCompleted) changes.push(`Videos: ${previousState.videoSessionsCompleted} -> ${savedLog.videoSessionsCompleted}`);
    if (previousState.notes !== savedLog.notes) changes.push(`Notes updated.`);
    if (previousState.targetId !== savedLog.targetId) changes.push(`Target ID updated.`);
    details += changes.join(', ') || 'No specific field changes detected (likely quick update of same value).';
  } else {
    details += `Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}, Hours: ${savedLog.hoursWorked.toFixed(2)}.`;
  }

  addAuditLog(operation, 'WorkLog', details, savedLog.id, previousState, savedLog );
  return savedLog;
}

export function deleteWorkLog(id: string): void {
    let logs = getWorkLogs();
    const logToDelete = logs.find(log => log.id === id);

    if (logToDelete) {
        logs = logs.filter(log => log.id !== id);
        saveToLocalStorage(WORK_LOGS_KEY, logs);
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
    isActive: targets.length === 0, 
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
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
    targets[index] = targetData;
    saveToLocalStorage(UPH_TARGETS_KEY, targets);

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
      return { ...t, isActive: false };
    }
    return t; 
  });

  if (!activatedTarget) throw new Error(`Target with ID ${id} not found.`);

  saveToLocalStorage(UPH_TARGETS_KEY, updatedTargets);
  addAuditLog(
    'SET_ACTIVE_UPH_TARGET',
    'UPHTarget',
    `Set UPH target "${activatedTarget.name}" as active.${previouslyActiveTarget ? ` Previously active: "${previouslyActiveTarget.name}".` : ''}`,
    activatedTarget.id,
    previouslyActiveTarget,
    activatedTarget
  );
  return activatedTarget;
}

export function getActiveUPHTarget(): UPHTarget | null {
  const targets = getUPHTargets();
  const activeTarget = targets.find((t) => t.isActive);

  if (activeTarget) {
    return activeTarget;
  } else if (targets.length > 0) {
    return setActiveUPHTarget(targets[0].id);
  }
  return null;
}

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
    addAuditLog('SYSTEM_CLEAR_ALL_DATA', 'System', 'Cleared all work logs and UPH targets.');
}

export function archiveTodayLog(): DailyWorkLog | null {
    if (typeof window === 'undefined') return null;
    const todayDateStr = formatDateISO(new Date());
    const logs = getWorkLogs();
    const todayLog = logs.find(log => log.date === todayDateStr);

    if (todayLog) {
        addAuditLog('SYSTEM_ARCHIVE_TODAY_LOG', 'WorkLog', `Today's log for ${todayLog.date} archived (day ended).`, todayLog.id, todayLog, todayLog);
        return todayLog;
    }
    addAuditLog('SYSTEM_ARCHIVE_TODAY_LOG', 'System', `Attempted to archive today's log, but no log found for ${todayDateStr}.`);
    return null;
}

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

  addAuditLog(
    'UPDATE_WORK_LOG_BREAK',
    'WorkLog',
    `Added ${breakMinutes}m break to log for ${updatedLog.date}. Total break: ${updatedLog.breakDurationMinutes}m.`,
    updatedLog.id,
    { breakDurationMinutes: originalLog.breakDurationMinutes, hoursWorked: originalLog.hoursWorked },
    { breakDurationMinutes: updatedLog.breakDurationMinutes, hoursWorked: updatedLog.hoursWorked }
  );
  return updatedLog;
}

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

  addAuditLog(
    'UPDATE_WORK_LOG_TRAINING',
    'WorkLog',
    `Added ${trainingMinutes}m training to log for ${updatedLog.date}. Total training: ${updatedLog.trainingDurationMinutes}m.`,
    updatedLog.id,
    { trainingDurationMinutes: originalLog.trainingDurationMinutes || 0, hoursWorked: originalLog.hoursWorked },
    { trainingDurationMinutes: updatedLog.trainingDurationMinutes, hoursWorked: updatedLog.hoursWorked }
  );
  return updatedLog;
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

  const newTarget: UPHTarget = {
    ...originalTarget,
    id: generateLocalId(),
    name: `${originalTarget.name} - Copy`,
    isActive: false, // Duplicated targets are inactive by default
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  addAuditLog(
    'CREATE_UPH_TARGET', // Logged as create because it's a new entity
    'UPHTarget',
    `Duplicated UPH target "${originalTarget.name}" to "${newTarget.name}".`,
    newTarget.id,
    null, // No previous state for a new entity
    newTarget
  );
  return newTarget;
}
