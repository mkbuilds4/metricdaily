
// src/lib/actions.ts
import type { DailyWorkLog, UPHTarget, AuditLogEntry, AuditLogActionType, UserSettings, ApplicationData } from '@/types';
import { formatDateISO, calculateHoursWorked, formatDurationFromMinutes } from '@/lib/utils';
import { sampleWorkLogs, sampleUPHTargets, sampleAuditLogs } from './sample-data';
import { parseISO, isValid, startOfDay, isBefore, isSameDay } from 'date-fns';

const WORK_LOGS_KEY = 'workLogs';
const UPH_TARGETS_KEY = 'uphTargets';
const AUDIT_LOGS_KEY = 'auditLogs';
const SETTINGS_KEY = 'userSettings';
const SAMPLE_DATA_LOADED_KEY = 'sampleDataLoaded';

// --- Local Storage Helpers ---

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

// --- Audit Log Actions ---

export function getAuditLogs(): AuditLogEntry[] {
  const logs = getFromLocalStorage<AuditLogEntry[]>(AUDIT_LOGS_KEY, []);
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
  saveToLocalStorage(AUDIT_LOGS_KEY, auditLogs.slice(0, 2500)); // Increased limit to 2500
  console.log('[Audit Log] Added:', newLogEntry);
}

// --- Work Log Actions ---

export function getWorkLogs(): DailyWorkLog[] {
  const logs = getFromLocalStorage<DailyWorkLog[]>(WORK_LOGS_KEY, []);
  logs.sort((a, b) => b.date.localeCompare(a.date));
  return logs;
}

export function saveWorkLog(
  logData: Partial<Omit<DailyWorkLog, 'id' | 'hoursWorked'>> & { id?: string; hoursWorked?: number; date: string; startTime: string; endTime: string; isFinalized?: boolean; goalMetTimes?: Record<string, string> },
  passedAuditActionType?: AuditLogActionType
): DailyWorkLog {
  const totalNonWorkMinutes = (logData.breakDurationMinutes ?? 0) + (logData.trainingDurationMinutes ?? 0);
  let finalHoursWorked: number;

  const dateToUse = parseISO(logData.date + 'T00:00:00');
  if (isValid(dateToUse)) {
      finalHoursWorked = calculateHoursWorked(dateToUse, logData.startTime, logData.endTime, totalNonWorkMinutes);
  } else {
      throw new Error('Invalid date provided for work log.');
  }

  if (finalHoursWorked < 0) throw new Error('Calculated hours worked cannot be negative.');

  const documentsCompleted = (logData.documentsCompleted !== null && logData.documentsCompleted !== undefined && !isNaN(logData.documentsCompleted) && logData.documentsCompleted >= 0) ? logData.documentsCompleted : 0;
  const videoSessionsCompleted = (logData.videoSessionsCompleted !== null && logData.videoSessionsCompleted !== undefined && !isNaN(logData.videoSessionsCompleted) && logData.videoSessionsCompleted >= 0) ? logData.videoSessionsCompleted : 0;

  if (!logData.date || !/^\d{4}-\d{2}-\d{2}$/.test(logData.date)) throw new Error('Date must be in YYYY-MM-DD format.');

  if (logData.targetId) {
       const targets = getUPHTargets();
       if (!targets.some(t => t.id === logData.targetId)) {
           console.warn(`[Client Action] Target ID "${logData.targetId}" provided for log does not exist. Saving log without association.`);
       }
  }

  const logs = getWorkLogs();
  let savedLog: DailyWorkLog;
  let previousState: Partial<DailyWorkLog> | null = null;
  let isCreating = false;

  const baseLogData = {
      date: logData.date,
      startTime: logData.startTime,
      endTime: logData.endTime,
      breakDurationMinutes: logData.breakDurationMinutes ?? 0,
      trainingDurationMinutes: logData.trainingDurationMinutes ?? 0,
      hoursWorked: finalHoursWorked,
      documentsCompleted: documentsCompleted,
      videoSessionsCompleted: videoSessionsCompleted,
      targetId: logData.targetId,
      notes: logData.notes,
      goalMetTimes: logData.goalMetTimes ?? {},
  };

  if (logData.id) {
    const index = logs.findIndex((log) => log.id === logData.id);
    if (index > -1) {
      const existingLog = logs[index];
      previousState = { ...existingLog };
      savedLog = {
          ...existingLog,
          ...baseLogData,
          isFinalized: logData.isFinalized !== undefined ? logData.isFinalized : existingLog.isFinalized,
      };
      logs[index] = savedLog;
    } else {
      isCreating = true;
      savedLog = { ...baseLogData, id: generateLocalId(), isFinalized: logData.isFinalized ?? false };
      logs.push(savedLog);
    }
  } else {
     const existingLogIndex = logs.findIndex(log => log.date === logData.date && !log.isFinalized);
     if (existingLogIndex > -1) {
         const existingLog = logs[existingLogIndex];
         previousState = { ...existingLog };
         savedLog = {
             ...existingLog,
             ...baseLogData,
             isFinalized: logData.isFinalized !== undefined ? logData.isFinalized : existingLog.isFinalized,
         };
         logs[existingLogIndex] = savedLog;
     } else {
        isCreating = true;
        savedLog = { ...baseLogData, id: generateLocalId(), isFinalized: logData.isFinalized ?? false };
        logs.push(savedLog);
     }
  }

  logs.sort((a, b) => b.date.localeCompare(a.date));
  saveToLocalStorage(WORK_LOGS_KEY, logs);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

  let actionForAuditLog: AuditLogActionType;
  let auditDetails: string = '';
  const logSummaryDetails = `Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}, Hours: ${savedLog.hoursWorked.toFixed(2)}.`;

  if (passedAuditActionType) {
    actionForAuditLog = passedAuditActionType;
    // Generate specific details based on the passed action type
    switch (actionForAuditLog) {
      case 'UPDATE_WORK_LOG_QUICK_COUNT':
        const prevDocs = previousState?.documentsCompleted ?? 0;
        const prevVideos = previousState?.videoSessionsCompleted ?? 0;
        const fieldUpdated = prevDocs !== savedLog.documentsCompleted ? 'document' : 'video';
        const newValue = fieldUpdated === 'document' ? savedLog.documentsCompleted : savedLog.videoSessionsCompleted;
        auditDetails = `Quick updated ${fieldUpdated} count to ${newValue} for log ${savedLog.date}.`;
        break;
      case 'UPDATE_WORK_LOG_BREAK':
        auditDetails = `Added break time to log for ${savedLog.date}. Total break: ${formatDurationFromMinutes((savedLog.breakDurationMinutes || 0) * 60)}.`;
        break;
      case 'UPDATE_WORK_LOG_TRAINING':
        auditDetails = `Added training time to log for ${savedLog.date}. Total training: ${formatDurationFromMinutes((savedLog.trainingDurationMinutes || 0) * 60)}.`;
        break;
      case 'UPDATE_WORK_LOG_GOAL_MET':
        const newTargetId = Object.keys(savedLog.goalMetTimes || {}).find(key => !(previousState?.goalMetTimes || {})[key]);
        const targets = getUPHTargets();
        const targetName = targets.find(t => t.id === newTargetId)?.name || 'Unknown Target';
        auditDetails = `Target "${targetName}" goal met time recorded for log ${savedLog.date}.`;
        break;
      case 'SYSTEM_ARCHIVE_TODAY_LOG':
        auditDetails = `Finalized log for ${savedLog.date}. ${logSummaryDetails}`;
        break;
      // Add other specific cases if needed
      default:
        // If a specific type was passed but not handled above, create a generic message for it
        auditDetails = `Performed action ${actionForAuditLog} for log ${savedLog.date}. ${logSummaryDetails}`;
    }
  } else {
    // No specific action type passed, determine if CREATE or generic UPDATE
    actionForAuditLog = isCreating ? 'CREATE_WORK_LOG' : 'UPDATE_WORK_LOG';
    if (actionForAuditLog === 'CREATE_WORK_LOG') {
      auditDetails = `Created work log for ${savedLog.date}. ${logSummaryDetails}`;
    } else { // Generic UPDATE_WORK_LOG
      auditDetails = `Updated work log for ${savedLog.date}. `;
      if (previousState) {
        const changes: string[] = [];
        if (previousState.startTime !== savedLog.startTime) changes.push(`Start: ${previousState.startTime} -> ${savedLog.startTime}`);
        if (previousState.endTime !== savedLog.endTime) changes.push(`End: ${previousState.endTime} -> ${savedLog.endTime}`);
        if (previousState.documentsCompleted !== savedLog.documentsCompleted) changes.push(`Docs: ${previousState.documentsCompleted} -> ${savedLog.documentsCompleted}`);
        if (previousState.videoSessionsCompleted !== savedLog.videoSessionsCompleted) changes.push(`Videos: ${previousState.videoSessionsCompleted} -> ${savedLog.videoSessionsCompleted}`);
        if (previousState.breakDurationMinutes !== savedLog.breakDurationMinutes) changes.push(`Break: ${previousState.breakDurationMinutes}m -> ${savedLog.breakDurationMinutes}m`);
        if ((previousState.trainingDurationMinutes || 0) !== (savedLog.trainingDurationMinutes || 0)) changes.push(`Training: ${previousState.trainingDurationMinutes || 0}m -> ${savedLog.trainingDurationMinutes || 0}m`);
        if (previousState.notes !== savedLog.notes) changes.push(`Notes updated.`);
        if (previousState.targetId !== savedLog.targetId) changes.push(`Target ID updated.`);
        if (previousState.isFinalized !== savedLog.isFinalized) changes.push(`Finalized status changed to ${savedLog.isFinalized}.`);
        auditDetails += changes.join(', ') || 'No specific field changes detected.';
      } else {
        auditDetails += logSummaryDetails;
      }
    }
  }

  if (auditDetails && actionForAuditLog) {
    addAuditLog(actionForAuditLog, 'WorkLog', auditDetails, savedLog.id, previousState, savedLog);
  }

  return savedLog;
}


export function deleteWorkLog(id: string): void {
    let logs = getWorkLogs();
    const logToDelete = logs.find(log => log.id === id);

    if (logToDelete) {
        logs = logs.filter(log => log.id !== id);
        saveToLocalStorage(WORK_LOGS_KEY, logs);
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
        addAuditLog(
          'DELETE_WORK_LOG',
          'WorkLog',
          `Deleted work log for ${logToDelete.date} (ID: ${id}). Docs: ${logToDelete.documentsCompleted}, Videos: ${logToDelete.videoSessionsCompleted}. Finalized: ${!!logToDelete.isFinalized}`,
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
    isActive: targets.length === 0, 
    isDisplayed: targetData.isDisplayed ?? true,
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
  addAuditLog(
    'CREATE_UPH_TARGET',
    'UPHTarget',
    `Created UPH target "${newTarget.name}". UPH: ${newTarget.targetUPH}, Docs/Unit: ${newTarget.docsPerUnit}, Videos/Unit: ${newTarget.videosPerUnit}, Displayed: ${newTarget.isDisplayed}.`,
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
    targets[index] = { ...targetData, isDisplayed: targetData.isDisplayed ?? previousState.isDisplayed ?? true };
    saveToLocalStorage(UPH_TARGETS_KEY, targets);
    saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

    const changes: string[] = [];
    if (previousState.name !== targetData.name) changes.push(`Name: "${previousState.name}" -> "${targetData.name}"`);
    if (previousState.targetUPH !== targetData.targetUPH) changes.push(`Target UPH: ${previousState.targetUPH} -> ${targetData.targetUPH}`);
    if (previousState.docsPerUnit !== targetData.docsPerUnit) changes.push(`Docs/Unit: ${previousState.docsPerUnit} -> ${targetData.docsPerUnit}`);
    if (previousState.videosPerUnit !== targetData.videosPerUnit) changes.push(`Videos/Unit: ${previousState.videosPerUnit} -> ${targetData.videosPerUnit}`);
    if (previousState.isActive !== targetData.isActive) changes.push(`Activation status changed to ${targetData.isActive}.`);
    if ((previousState.isDisplayed ?? true) !== (targetData.isDisplayed ?? true)) changes.push(`Display status changed to ${targetData.isDisplayed ?? true}.`);

    addAuditLog(
      'UPDATE_UPH_TARGET',
      'UPHTarget',
      `Updated UPH target "${targetData.name}". Changes: ${changes.join(', ') || 'No field changes.'}`,
      targetData.id,
      previousState,
      targets[index]
    );
  } else {
    throw new Error(`Target with ID ${targetData.id} not found for update.`);
  }
  return targets[index];
}

export function deleteUPHTarget(id: string): void {
  let targets = getUPHTargets();
  const targetToDelete = targets.find((t) => t.id === id);

  if (!targetToDelete) throw new Error(`Target with ID ${id} not found for deletion.`);
  if (targetToDelete.isActive) throw new Error('Cannot delete the currently active target. Set another target as active first.');

  targets = targets.filter((t) => t.id !== id);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
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
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
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
     console.warn("[Action] No active target found. Returning first target as fallback for display.");
     return targets.find(t => t.isDisplayed ?? true) || targets[0];
  }
  return null;
}

export function duplicateUPHTarget(id: string): UPHTarget {
  const targets = getUPHTargets();
  const originalTarget = targets.find(t => t.id === id);

  if (!originalTarget) {
    throw new Error(`Target with ID ${id} not found for duplication.`);
  }

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
    isActive: false,
    isDisplayed: true,
  };

  targets.push(newTarget);
  saveToLocalStorage(UPH_TARGETS_KEY, targets);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
  addAuditLog(
    'DUPLICATE_UPH_TARGET',
    'UPHTarget',
    `Duplicated UPH target "${originalTarget.name}" to "${newTarget.name}". Displayed: ${newTarget.isDisplayed}.`,
    newTarget.id,
    originalTarget,
    newTarget
  );
  return newTarget;
}

// --- Time Adjustment Actions ---

export function addBreakTimeToLog(logId: string, breakMinutes: number): DailyWorkLog {
  const logs = getWorkLogs();
  const logIndex = logs.findIndex(log => log.id === logId);
  if (logIndex === -1) throw new Error(`Log with ID ${logId} not found.`);

  const updatedLog = { ...logs[logIndex] };
  updatedLog.breakDurationMinutes = (updatedLog.breakDurationMinutes || 0) + breakMinutes;
  return saveWorkLog(updatedLog, 'UPDATE_WORK_LOG_BREAK');
}

export function addTrainingTimeToLog(logId: string, trainingMinutes: number): DailyWorkLog {
  const logs = getWorkLogs();
  const logIndex = logs.findIndex(log => log.id === logId);
  if (logIndex === -1) throw new Error(`Log with ID ${logId} not found.`);

  const updatedLog = { ...logs[logIndex] };
  updatedLog.trainingDurationMinutes = (updatedLog.trainingDurationMinutes || 0) + trainingMinutes;
  return saveWorkLog(updatedLog, 'UPDATE_WORK_LOG_TRAINING');
}

// --- System Data Actions ---

export function isSampleDataLoaded(): boolean {
    return getFromLocalStorage<boolean>(SAMPLE_DATA_LOADED_KEY, false);
}

export function loadSampleData(): boolean {
    const currentLogsRaw = typeof window !== 'undefined' ? window.localStorage.getItem(WORK_LOGS_KEY) : null;
    const currentTargetsRaw = typeof window !== 'undefined' ? window.localStorage.getItem(UPH_TARGETS_KEY) : null;

    const hasExistingLogs = currentLogsRaw !== null && currentLogsRaw !== '[]';
    const hasExistingTargets = currentTargetsRaw !== null && currentTargetsRaw !== '[]';

    if (!hasExistingLogs && !hasExistingTargets) {
        console.log("[Action] Loading sample data...");

        const processedTargets = sampleUPHTargets.map((target, index) => ({
            ...target,
            id: target.id || generateLocalId(),
            isActive: index === 0,
            isDisplayed: target.isDisplayed !== undefined ? target.isDisplayed : true,
        }));

        const todayDateStr = formatDateISO(new Date());
        const processedLogs = sampleWorkLogs.map(log => ({
            ...log,
            id: log.id || generateLocalId(),
            targetId: processedTargets[0]?.id || undefined,
            breakDurationMinutes: log.breakDurationMinutes ?? 0,
            trainingDurationMinutes: log.trainingDurationMinutes ?? 0,
            goalMetTimes: {},
            isFinalized: log.date !== todayDateStr,
        }));

        saveToLocalStorage(AUDIT_LOGS_KEY, sampleAuditLogs);
        console.log(`[Action] Cleared existing audit logs and saved ${sampleAuditLogs.length} sample audit logs.`);

        saveToLocalStorage(WORK_LOGS_KEY, processedLogs);
        saveToLocalStorage(UPH_TARGETS_KEY, processedTargets);
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, true);

        const currentSettings = getFromLocalStorage<UserSettings | null>(SETTINGS_KEY, null);
        if (!currentSettings || Object.keys(currentSettings).length === 0) {
          saveDefaultSettings({
            defaultStartTime: '14:00',
            defaultEndTime: '22:30',
            defaultBreakMinutes: 0,
            defaultTrainingMinutes: 0,
            autoSwitchTargetBySchedule: false,
          });
        }

        addAuditLog('SYSTEM_LOAD_SAMPLE_DATA', 'System', 'Loaded sample work logs, UPH targets, and audit logs.');
        return true;
    } else {
        console.log("[Action] Existing work logs or UPH targets found in localStorage. Skipping sample data load.");
        saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
        return false;
    }
}

export function clearAllData(): void {
    if (typeof window === 'undefined') {
        console.error('Attempted to clear localStorage on the server.');
        return;
    }
    saveToLocalStorage(WORK_LOGS_KEY, []);
    saveToLocalStorage(UPH_TARGETS_KEY, []);
    saveToLocalStorage(SETTINGS_KEY, {});
    saveToLocalStorage(AUDIT_LOGS_KEY, []);
    saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);
    addAuditLog('SYSTEM_CLEAR_ALL_DATA', 'System', 'Cleared all work logs, UPH targets, settings, and audit logs.');
}

export function archiveTodayLog(): DailyWorkLog | null {
    if (typeof window === 'undefined') return null;

    const todayDateStr = formatDateISO(new Date());
    let allLogs = getWorkLogs();
    const todayLogIndex = allLogs.findIndex(log => log.date === todayDateStr && !log.isFinalized);

    if (todayLogIndex > -1) {
        const finalizedLogData = { ...allLogs[todayLogIndex], isFinalized: true };
        const savedFinalizedLog = saveWorkLog(finalizedLogData, 'SYSTEM_ARCHIVE_TODAY_LOG');
        console.log(`[Action] Finalized log for ${savedFinalizedLog.date}`);
        return savedFinalizedLog;
    } else {
        console.warn(`[Action] Attempted to finalize today's log, but no active log found for ${todayDateStr}.`);
        addAuditLog('SYSTEM_ARCHIVE_TODAY_LOG', 'System', `Attempt to finalize log for ${todayDateStr}: No active log found.`);
        return null;
    }
}

// --- User Settings Actions ---

export function getDefaultSettings(): UserSettings {
  const defaultSettings: UserSettings = {
    defaultStartTime: '14:00',
    defaultEndTime: '22:30',
    defaultBreakMinutes: 0,
    defaultTrainingMinutes: 0,
    autoSwitchTargetBySchedule: false,
  };
  return getFromLocalStorage<UserSettings>(SETTINGS_KEY, defaultSettings);
}

export function saveDefaultSettings(settings: UserSettings): UserSettings {
  if (typeof window === 'undefined') {
    console.error('Attempted to save settings on the server.');
    return settings;
  }
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(settings.defaultStartTime) || !timeRegex.test(settings.defaultEndTime)) {
    throw new Error("Invalid time format. Use HH:mm.");
  }
  let breakMinutes = settings.defaultBreakMinutes;
  let trainingMinutes = settings.defaultTrainingMinutes;

   if (breakMinutes < 0 || !Number.isInteger(breakMinutes)) {
     console.warn(`Invalid default break minutes (${breakMinutes}), defaulting to 0.`);
     breakMinutes = 0;
  }
   if (trainingMinutes === undefined || trainingMinutes === null || trainingMinutes < 0 || !Number.isInteger(trainingMinutes)) {
      console.warn(`Invalid default training minutes (${trainingMinutes}), defaulting to 0.`);
      trainingMinutes = 0;
  }

  const validatedSettings: UserSettings = {
      ...settings,
      defaultBreakMinutes: breakMinutes,
      defaultTrainingMinutes: trainingMinutes,
      autoSwitchTargetBySchedule: settings.autoSwitchTargetBySchedule ?? false,
  };

  const previousSettings = getDefaultSettings();
  saveToLocalStorage(SETTINGS_KEY, validatedSettings);
  saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, false);

  const changes: string[] = [];
  if (previousSettings.defaultStartTime !== validatedSettings.defaultStartTime) changes.push(`Start Time: ${previousSettings.defaultStartTime} -> ${validatedSettings.defaultStartTime}`);
  if (previousSettings.defaultEndTime !== validatedSettings.defaultEndTime) changes.push(`End Time: ${previousSettings.defaultEndTime} -> ${validatedSettings.defaultEndTime}`);
  if (previousSettings.defaultBreakMinutes !== validatedSettings.defaultBreakMinutes) changes.push(`Break: ${previousSettings.defaultBreakMinutes}m -> ${validatedSettings.defaultBreakMinutes}m`);
  if (previousSettings.defaultTrainingMinutes !== validatedSettings.defaultTrainingMinutes) changes.push(`Training: ${previousSettings.defaultTrainingMinutes}m -> ${validatedSettings.defaultTrainingMinutes}m`);
  if ((previousSettings.autoSwitchTargetBySchedule ?? false) !== (validatedSettings.autoSwitchTargetBySchedule ?? false)) changes.push(`Auto Switch Target: ${(previousSettings.autoSwitchTargetBySchedule ?? false)} -> ${(validatedSettings.autoSwitchTargetBySchedule ?? false)}`);

  addAuditLog(
    'UPDATE_SETTINGS',
    'Settings',
    `Updated default settings. ${changes.join(', ') || 'No changes.'}`,
    undefined,
    previousSettings,
    validatedSettings
  );
  return validatedSettings;
}

// --- Data Import/Export Actions ---
export function importApplicationData(jsonData: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Data import can only be done on the client-side.' };
  }

  try {
    const parsedData = JSON.parse(jsonData) as Partial<ApplicationData>;

    // Basic validation of the imported data structure
    if (
      !parsedData ||
      typeof parsedData !== 'object' ||
      !Array.isArray(parsedData.workLogs) ||
      !Array.isArray(parsedData.uphTargets) ||
      !Array.isArray(parsedData.auditLogs) ||
      typeof parsedData.userSettings !== 'object' ||
      parsedData.userSettings === null ||
      typeof parsedData.sampleDataLoaded !== 'boolean'
    ) {
      throw new Error('Invalid JSON structure. Required keys: workLogs, uphTargets, auditLogs, userSettings, sampleDataLoaded.');
    }

    // TODO: Add more granular validation for each array/object item if necessary

    saveToLocalStorage(WORK_LOGS_KEY, parsedData.workLogs);
    saveToLocalStorage(UPH_TARGETS_KEY, parsedData.uphTargets);
    
    // Sort audit logs by timestamp descending after import and truncate
    const sortedAuditLogs = parsedData.auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    saveToLocalStorage(AUDIT_LOGS_KEY, sortedAuditLogs.slice(0, 2500)); // Increased limit

    saveToLocalStorage(SETTINGS_KEY, parsedData.userSettings);
    saveToLocalStorage(SAMPLE_DATA_LOADED_KEY, parsedData.sampleDataLoaded);

    addAuditLog('SYSTEM_IMPORT_DATA', 'System', 'Imported all application data from a JSON file.');
    
    // Trigger a refresh or notify user to refresh for changes to take full effect across all components
    // For example, if settings changed, components relying on those settings might need a reload.
    // This can be handled by a toast message prompting the user.
    
    return { success: true };

  } catch (error) {
    console.error("Error importing application data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during data import.";
    addAuditLog('SYSTEM_IMPORT_DATA', 'System', `Failed to import application data. Error: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
