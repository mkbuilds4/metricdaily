
/**
 * Represents a single day's work log entry.
 */
export interface DailyWorkLog {
  id: string; // Unique identifier, typically generated
  date: string; // Format: 'YYYY-MM-DD'
  startTime: string; // Format: 'HH:mm' (24-hour)
  endTime: string; // Format: 'HH:mm' (24-hour)
  breakDurationMinutes: number; // Break time in minutes
  trainingDurationMinutes?: number; // Optional: Training time in minutes
  hoursWorked: number; // Calculated from startTime, endTime, break, and training
  documentsCompleted: number;
  videoSessionsCompleted: number;
  targetId?: string; // Optional: Link to the UPHTarget active when logging
  notes?: string; // Optional notes for the day
  goalMetTimes?: Record<string, string>; // Optional: Stores ISO timestamp when target goals were met { [targetId]: ISOTimestamp }
  isFinalized?: boolean; // Optional: Flag indicating the log is finalized for the day
}

/**
 * Represents a Units Per Hour (UPH) target configuration.
 * Includes how many items constitute one 'unit' for this specific target.
 */
export interface UPHTarget {
  id: string; // Unique identifier for the target
  name: string; // User-friendly name (e.g., "Standard Shift", "Peak Hours")
  targetUPH: number; // The target units per hour rate
  docsPerUnit: number; // How many documents are required to complete one unit *for this target*
  videosPerUnit: number; // How many video sessions are required to complete one unit *for this target*
  isActive: boolean; // Indicates if this is the currently active target for calculations
  isDisplayed?: boolean; // Optional: Indicates if this target should be displayed on the dashboard/metrics views
}

/**
 * Defines the types of actions that can be logged in the audit trail.
 */
export type AuditLogActionType =
  | 'CREATE_WORK_LOG'
  | 'UPDATE_WORK_LOG' // Generic update (e.g., from form)
  | 'UPDATE_WORK_LOG_QUICK_COUNT' // Specific update from dashboard quick inputs
  | 'UPDATE_WORK_LOG_BREAK' // Specific update for adding break time
  | 'UPDATE_WORK_LOG_TRAINING' // Specific update for adding training time
  | 'UPDATE_WORK_LOG_GOAL_MET' // Specific update for recording goal met time
  | 'DELETE_WORK_LOG'
  | 'CREATE_UPH_TARGET'
  | 'UPDATE_UPH_TARGET'
  | 'DELETE_UPH_TARGET'
  | 'DUPLICATE_UPH_TARGET'
  | 'SET_ACTIVE_UPH_TARGET'
  | 'SYSTEM_LOAD_SAMPLE_DATA'
  | 'SYSTEM_CLEAR_ALL_DATA'
  | 'SYSTEM_ARCHIVE_TODAY_LOG' // Renamed from SYSTEM_FINALIZE_TODAY_LOG
  | 'SYSTEM_EXPORT_DATA'
  | 'SYSTEM_EXPORT_DATA_FAILED'
  | 'SYSTEM_VIEW_AUDIT_LOG'
  | 'UPDATE_SETTINGS';


/**
 * Represents an entry in the audit log.
 */
export interface AuditLogEntry {
  id: string; // Unique ID for the audit log entry
  timestamp: string; // ISO string for the time of the action
  action: AuditLogActionType; // The type of action performed
  entityType: 'WorkLog' | 'UPHTarget' | 'System' | 'Security' | 'Settings'; // Added 'Settings' type
  entityId?: string; // The ID of the specific WorkLog or UPHTarget, if applicable
  details: string; // A human-readable description of the change
  previousState?: Partial<DailyWorkLog | UPHTarget | UserSettings>; // Allow UserSettings
  newState?: Partial<DailyWorkLog | UPHTarget | UserSettings>; // Allow UserSettings
}

/**
 * Represents user-configurable default settings.
 */
export interface UserSettings {
  defaultStartTime: string; // Format: 'HH:mm'
  defaultEndTime: string; // Format: 'HH:mm'
  defaultBreakMinutes: number; // Default break time in minutes
  defaultTrainingMinutes: number; // Default training time in minutes
  autoSwitchTargetBySchedule?: boolean; // New setting for auto-switching targets
}
