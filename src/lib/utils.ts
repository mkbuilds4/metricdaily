import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, differenceInMinutes, parse } from 'date-fns';
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
export function formatDateISO(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
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
export function formatFriendlyDate(date: Date): string {
    return format(date, 'eee, MMM d');
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
export function calculateHoursWorked(date: string, startTime: string, endTime: string, breakMinutes: number): number {
  if (!date || !startTime || !endTime || breakMinutes < 0) {
    console.error("Invalid input for calculateHoursWorked:", { date, startTime, endTime, breakMinutes });
    return 0;
  }

  try {
    // Combine date and time strings to create Date objects
    // Using a reference date helps handle potential DST issues slightly better than just time strings
    const startDateTime = parse(`${date} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let endDateTime = parse(`${date} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    // Basic handling for overnight shifts: if end time is earlier than start time, assume it's the next day
    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

     // Check if parsing was successful (result is not 'Invalid Date')
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      console.error("Failed to parse date/time strings:", { date, startTime, endTime });
      return 0;
    }


    const totalMinutesWorked = differenceInMinutes(endDateTime, startDateTime);

    if (totalMinutesWorked < 0) {
        console.error("Calculated total minutes worked is negative. Check start/end times.");
        return 0; // Should not happen with overnight check, but good safety measure
    }

    const netMinutesWorked = totalMinutesWorked - breakMinutes;

    if (netMinutesWorked < 0) {
        console.warn("Net minutes worked is negative after break deduction. Returning 0 hours.");
        return 0; // Cannot have negative work hours
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
 * Calculates total units for a daily work log based on the weights defined in a UPH target.
 * Handles cases where log or target might be missing.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object containing weights.
 * @returns The total calculated units, or 0 if inputs are invalid.
 */
export function calculateDailyUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
  if (!log || !target) {
    return 0;
  }
  const docUnits = (log.documentsCompleted || 0) * (target.docWeight || 0);
  const videoUnits = (log.videoSessionsCompleted || 0) * (target.videoWeight || 0);
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
 * given the number of hours worked.
 *
 * @param hoursWorked - The number of hours worked.
 * @param targetUPH - The target Units Per Hour.
 * @returns The total required units.
 */
export function calculateRequiredUnitsForTarget(hoursWorked: number | null | undefined, targetUPH: number | null | undefined): number {
  if (hoursWorked === null || hoursWorked === undefined || hoursWorked <= 0 || targetUPH === null || targetUPH === undefined || targetUPH <= 0) {
    return 0;
  }
  return parseFloat((hoursWorked * targetUPH).toFixed(2));
}

/**
 * Calculates the difference between the required units (to meet the target)
 * and the actual units completed.
 * A positive result means the user is behind the target.
 * A negative result means the user is ahead of the target.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object.
 * @returns The difference in units, or 0 if calculation isn't possible.
 */
export function calculateRemainingUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
   // Use the calculated log.hoursWorked
   if (!log || !target || log.hoursWorked <= 0) {
    return 0; // Cannot calculate remaining if data is missing or no hours worked
  }
  const actualUnits = calculateDailyUnits(log, target);
  const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
  // Rounding difference to avoid floating point inaccuracies
  return parseFloat((requiredUnits - actualUnits).toFixed(2));
}
