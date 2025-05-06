
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
}

