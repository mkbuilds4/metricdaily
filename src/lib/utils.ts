
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    parseISO,
    differenceInMinutes,
    parse,
    isValid,
    addHours,
    addMinutes,
    getHours,
    getMinutes,
    getSeconds
} from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types'; // Assuming types are defined

/**
 * Combines multiple class names into a single string, merging Tailwind CSS classes intelligently.
 * @param inputs - An array of class names (strings, objects, or arrays).
 * @returns A string of combined and merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Date Utility Functions ---

/**
 * Formats a Date object or a date string into 'YYYY-MM-DD' format.
 * @param date - The date to format.
 * @returns The formatted date string.
 */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return ''; // Handle null/undefined
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return ''; // Handle invalid date input
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Gets an array of Date objects representing the current week (Sunday to Saturday).
 * @param date - The date for which to get the week (defaults to today).
 * @returns An array of Date objects for the week.
 */
export function getWeekDates(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

/**
 * Formats a Date object into a user-friendly string (e.g., "Mon, Jan 1").
 * @param date - The date to format.
 * @returns The formatted date string.
 */
export function formatFriendlyDate(date: Date | null | undefined): string {
    if (!date || !isValid(date)) return 'Invalid Date';
    return format(date, 'eee, MMM d');
}

/**
 * Formats a number of hours into a duration string (e.g., "HH:MM:SS").
 * Handles positive and negative values (prepends "-").
 * @param totalHours - The total hours (can be fractional).
 * @returns The formatted duration string.
 */
export function formatDurationFromHours(totalHours: number): string {
    if (isNaN(totalHours)) return '00:00:00';

    const sign = totalHours < 0 ? '-' : '';
    const absHours = Math.abs(totalHours);

    const hours = Math.floor(absHours);
    const remainingMinutesTotal = (absHours - hours) * 60;
    const minutes = Math.floor(remainingMinutesTotal);
    const seconds = Math.floor((remainingMinutesTotal - minutes) * 60);

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${sign}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}


/**
 * Calculates the projected time when a goal will be hit based on the current time and remaining work hours.
 * @param currentTime - The current Date object.
 * @param remainingWorkHours - The number of hours remaining to reach the goal.
 * @returns The formatted projected time string (e.g., "HH:MM:SS AM/PM") or "N/A".
 */
export function calculateProjectedGoalHitTime(currentTime: Date | null, remainingWorkHours: number): string {
  if (isNaN(remainingWorkHours)) {
      return 'N/A'; // Calculation not possible
  }
  if (remainingWorkHours <= 0) {
    return 'Goal Met'; // Or potentially calculate how long ago it was met
  }
   if (!currentTime || !isValid(currentTime)) {
       return 'Calculating...';
   }

  const totalMinutesRemaining = remainingWorkHours * 60;
  const projectedHitDate = addMinutes(currentTime, totalMinutesRemaining);

  if (!isValid(projectedHitDate)) {
    return 'Invalid Date';
  }

  return format(projectedHitDate, 'hh:mm:ss a'); // e.g., "11:40:53 PM"
}


// --- Calculation Helper Functions ---

/**
 * Calculates the total hours worked based on start time, end time, and break duration.
 * Handles time parsing and potential overnight shifts (basic handling).
 *
 * @param date The date string 'YYYY-MM-DD' for context.
 * @param startTime The start time string 'HH:mm'.
 * @param endTime The end time string 'HH:mm'.
 * @param breakMinutes The break duration in minutes.
 * @returns The calculated hours worked as a number, rounded to 2 decimal places, or 0 if inputs are invalid.
 */
export function calculateHoursWorked(date: string | Date, startTime: string, endTime: string, breakMinutes: number): number {
  const dateStr = typeof date === 'string' ? date : isValid(date) ? format(date, 'yyyy-MM-dd') : null;

  if (!dateStr || !startTime || !endTime || breakMinutes === undefined || breakMinutes === null || breakMinutes < 0) {
    console.warn("Invalid input for calculateHoursWorked:", { date: dateStr, startTime, endTime, breakMinutes });
    return 0;
  }

  try {
    // Combine date and time strings to create Date objects
    const startDateTime = parse(`${dateStr} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let endDateTime = parse(`${dateStr} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

     // Check if parsing was successful immediately after parsing
    if (!isValid(startDateTime) || !isValid(endDateTime)) {
        console.error("Failed to parse date/time strings:", { date: dateStr, startTime, endTime });
        return 0;
    }

    // Basic handling for overnight shifts: if end time is earlier than start time, assume it's the next day
    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
       // Re-validate after potential date change
      if (!isValid(endDateTime)) {
         console.error("End date became invalid after overnight adjustment:", { date: dateStr, endTime });
         return 0;
      }
    }

    const totalMinutesWorked = differenceInMinutes(endDateTime, startDateTime);

    if (totalMinutesWorked < 0) {
        console.error("Calculated total minutes worked is negative. Check start/end times.");
        return 0;
    }

    const netMinutesWorked = totalMinutesWorked - breakMinutes;

    if (netMinutesWorked < 0) {
        // Don't log error, just return 0 as it's a valid scenario (break > worked time)
        return 0;
    }

    const hoursWorked = netMinutesWorked / 60;

    // Round to 2 decimal places
    return parseFloat(hoursWorked.toFixed(2));

  } catch (error) {
    console.error("Error calculating hours worked:", error);
    return 0;
  }
}


/**
 * Calculates total units for a daily work log based on the items per unit defined in a UPH target.
 * Handles cases where log or target might be missing or itemsPerUnit is zero or invalid.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object containing items per unit.
 * @returns The total calculated units, or 0 if inputs are invalid.
 */
export function calculateDailyUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
  if (!log || !target) {
    return 0;
  }
  // Use 1 as default if docsPerUnit/videosPerUnit is missing, zero, or negative to avoid division errors
  const effectiveDocsPerUnit = (target.docsPerUnit !== null && target.docsPerUnit !== undefined && target.docsPerUnit > 0) ? target.docsPerUnit : 1;
  const effectiveVideosPerUnit = (target.videosPerUnit !== null && target.videosPerUnit !== undefined && target.videosPerUnit > 0) ? target.videosPerUnit : 1;

  const docUnits = (log.documentsCompleted || 0) / effectiveDocsPerUnit;
  const videoUnits = (log.videoSessionsCompleted || 0) / effectiveVideosPerUnit;

  return parseFloat((docUnits + videoUnits).toFixed(2)); // Use toFixed for rounding consistency
}

/**
 * Calculates the Units Per Hour (UPH) for a given daily work log and target.
 * Handles division by zero if hours worked is 0 or invalid.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object.
 * @returns The calculated UPH, or 0 if calculation is not possible.
 */
export function calculateDailyUPH(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
  // Use the calculated log.hoursWorked
  if (!log || !target || !log.hoursWorked || log.hoursWorked <= 0) {
    return 0; // Cannot calculate UPH without valid hours or data
  }
  const totalUnits = calculateDailyUnits(log, target);
  return parseFloat((totalUnits / log.hoursWorked).toFixed(2)); // Use toFixed for rounding
}

/**
 * Calculates the total number of units required to meet a specific UPH target
 * given the number of hours worked *in total for the log entry*.
 *
 * @param hoursWorked - The total number of hours worked for the log entry.
 * @param targetUPH - The target Units Per Hour.
 * @returns The total required units for the duration of the log entry.
 */
export function calculateRequiredUnitsForTarget(hoursWorked: number | null | undefined, targetUPH: number | null | undefined): number {
  if (hoursWorked === null || hoursWorked === undefined || hoursWorked <= 0 || targetUPH === null || targetUPH === undefined || targetUPH <= 0) {
    return 0;
  }
  return parseFloat((hoursWorked * targetUPH).toFixed(2));
}

/**
 * Calculates the difference between the required units (to meet the target for the total logged hours)
 * and the actual units completed so far.
 * A positive result means the user is behind the target pace FOR THE LOGGED DURATION.
 * A negative result means the user is ahead of the target pace FOR THE LOGGED DURATION.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object.
 * @returns The difference in units, or 0 if calculation isn't possible.
 */
export function calculateRemainingUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
   // Use the calculated log.hoursWorked
   if (!log || !target || !log.hoursWorked || log.hoursWorked <= 0) {
    return 0; // Cannot calculate remaining if data is missing or no hours worked
  }
  const actualUnits = calculateDailyUnits(log, target);
  const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
  // Rounding difference to avoid floating point inaccuracies
  return parseFloat((requiredUnits - actualUnits).toFixed(2));
}
