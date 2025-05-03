/**
 * Represents a single day's work log entry.
 */
export interface DailyWorkLog {
  id: string; // Unique identifier, could be date or a generated ID
  date: string; // Format: 'YYYY-MM-DD'
  startTime: string; // Format: 'HH:mm' (24-hour)
  endTime: string; // Format: 'HH:mm' (24-hour)
  breakDurationMinutes: number; // Break time in minutes
  hoursWorked: number; // Calculated from startTime, endTime, and breakDurationMinutes
  documentsCompleted: number;
  videoSessionsCompleted: number;
  notes?: string; // Optional notes for the day
}

/**
 * Represents a Units Per Hour (UPH) target configuration.
 */
export interface UPHTarget {
  id: string; // Unique identifier for the target
  name: string; // User-friendly name (e.g., "Standard Shift", "Peak Hours")
  targetUPH: number; // The target units per hour rate
  docsPerUnit: number; // How many documents are required to complete one unit
  videosPerUnit: number; // How many video sessions are required to complete one unit
  isActive: boolean; // Indicates if this is the currently active target for calculations
}


/**
 * Represents the structure of data expected by the Google Sheets export function.
 * This should align with the columns you want in your sheet.
 */
export interface GoogleSheetsData {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hoursWorked: number; // Display the calculated hours
  docs: number;
  videos: number;
  calculatedUnits: number | string; // Use string if displaying '-' for invalid data
  calculatedUPH: number | string;   // Use string if displaying '-'
  targetUnits: number | string;     // Use string if displaying '-'
  remainingUnits: number | string;  // Use string if displaying '+/-' or '-'
  notes?: string;
  // Add other relevant fields if needed
}
