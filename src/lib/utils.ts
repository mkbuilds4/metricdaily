
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
    getSeconds,
    addDays,
    differenceInSeconds,
    addSeconds, 
} from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';

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
  // Attempt parsing if string, otherwise use directly if Date
  const dateObj = typeof date === 'string' ? parse(date, 'yyyy-MM-dd', new Date()) : date;
  if (!isValid(dateObj)) return ''; // Handle invalid date input after potential parse
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
    const dateObj = typeof date === 'string' ? parse(date, 'yyyy-MM-dd', new Date()) : date;
     if (!isValid(dateObj)) return 'Invalid Date';
    return format(dateObj, 'eee, MMM d');
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
 * Formats total minutes into a human-readable duration string (e.g., "X hrs Y mins Z secs").
 * Handles potential NaN or non-finite inputs.
 * @param totalSeconds - The total seconds.
 * @returns The formatted duration string, or '-' if input is invalid, zero, or negative.
 */
export function formatDurationFromMinutes(totalSeconds: number | null | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return '-';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);


    const parts: string[] = [];
    if (hours > 0) {
        parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);
    }
     if (seconds > 0 || (hours === 0 && minutes === 0)) { // Show seconds if > 0 or if hours and minutes are 0
        parts.push(`${seconds} sec${seconds !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0 && totalSeconds === 0) {
         return '0 secs';
    }
    if (parts.length === 0 && totalSeconds > 0) {
        return '< 1 sec';
    }

    return parts.join(' ');
}


/**
 * Calculates how far ahead or behind schedule the user is in seconds, relative to the target pace.
 * Positive value means ahead (targetNetSecondsForUnits > actualNetSecondsElapsed).
 * Negative value means behind (targetNetSecondsForUnits < actualNetSecondsElapsed).
 *
 * @param log - Today's DailyWorkLog object.
 * @param target - The relevant UPHTarget object.
 * @param currentTime - The current Date object.
 * @returns The time difference in seconds, or null if calculation is not possible.
 */
export function calculateTimeAheadBehindSchedule(
    log: DailyWorkLog | null,
    target: UPHTarget | null,
    currentTime: Date | null
): number | null {
    if (!log || !target || !currentTime || !isValid(currentTime)) {
        return null;
    }

    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(log.startTime) || !timeRegex.test(log.endTime)) return null;

    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(shiftStartDate) || !isValid(shiftEndDate)) return null;
    if (shiftEndDate < shiftStartDate) shiftEndDate = addDays(shiftEndDate, 1);

    const totalGrossShiftSeconds = differenceInSeconds(shiftEndDate, shiftStartDate);
    if (totalGrossShiftSeconds <= 0) return null;

    const secondsSinceShiftStart = differenceInSeconds(currentTime, shiftStartDate);
    if (secondsSinceShiftStart <= 0) return 0; // No time elapsed yet, so on schedule by default (0 difference)


    const totalNonWorkMinutesPlanned = (log.breakDurationMinutes || 0) + (log.trainingDurationMinutes || 0);

    // If current time is past or at the shift end time, calculate based on full shift
    if (currentTime >= shiftEndDate) {
        const finalNetSecondsPlanned = Math.max(0, totalGrossShiftSeconds - (totalNonWorkMinutesPlanned * 60));
        const totalUnitsCompleted = calculateDailyUnits(log, target);
        if (target.targetUPH <= 0) return null; 

        const targetNetSecondsNeededForUnits = (totalUnitsCompleted / target.targetUPH) * 3600;
        // Positive: time planned was MORE than time needed (ahead)
        // Negative: time planned was LESS than time needed (behind)
        const finalDifferenceSeconds = finalNetSecondsPlanned - targetNetSecondsNeededForUnits;
        return parseFloat(finalDifferenceSeconds.toFixed(1)); 
    }


    // Current time is within the shift
    const clampedSecondsSinceStart = Math.min(secondsSinceShiftStart, totalGrossShiftSeconds);
    const proportionOfShiftElapsed = clampedSecondsSinceStart / totalGrossShiftSeconds;

    const estimatedNonWorkSecondsTakenSoFar = Math.min(
        (totalNonWorkMinutesPlanned * 60), 
        (totalNonWorkMinutesPlanned * 60) * proportionOfShiftElapsed
    );

    const actualNetWorkSecondsElapsed = Math.max(0, clampedSecondsSinceStart - estimatedNonWorkSecondsTakenSoFar);
    const unitsCompletedSoFar = calculateDailyUnits(log, target); // These are the units ACTUALLY done
    if (unitsCompletedSoFar < 0) return null; // Should not happen

    if (target.targetUPH <= 0) return null; 


    if (unitsCompletedSoFar === 0 && actualNetWorkSecondsElapsed > 0) { // Changed condition
        // If no units completed, user is behind by the amount of net work time elapsed
        return parseFloat((0 - actualNetWorkSecondsElapsed).toFixed(1)); 
    }
    if (unitsCompletedSoFar === 0 && actualNetWorkSecondsElapsed === 0) {
        return 0; // Not started, no units, no time elapsed, so on schedule
    }


    // Time that *should* have been taken to complete these units at target pace
    const targetNetSecondsNeededForUnitsCompleted = (unitsCompletedSoFar / target.targetUPH) * 3600;

    // Positive diff means actual time < target time (ahead of schedule)
    // Negative diff means actual time > target time (behind schedule)
    const timeDifferenceSeconds = actualNetWorkSecondsElapsed - targetNetSecondsNeededForUnitsCompleted; // Corrected logic
    
    return parseFloat((-timeDifferenceSeconds).toFixed(1)); // Invert for "ahead/behind" convention (positive = ahead)
}


/**
 * Formats the time ahead/behind schedule status (Ahead, Behind, On Schedule).
 * @param timeDifferenceSeconds - The time difference in seconds (positive means ahead, negative means behind).
 * @returns A formatted string ("Ahead", "Behind", "On Schedule"), or '-' if input is null.
 */
export function formatTimeAheadBehind(timeDifferenceSeconds: number | null): string {
    if (timeDifferenceSeconds === null || !Number.isFinite(timeDifferenceSeconds)) {
        return '-';
    }

    const ON_SCHEDULE_THRESHOLD_SECONDS = 1; // Within 1 second is "On Schedule"

    if (Math.abs(timeDifferenceSeconds) < ON_SCHEDULE_THRESHOLD_SECONDS) {
         return 'On Schedule';
    }

    if (timeDifferenceSeconds > 0) {
        return `Ahead`;
    } else { 
        return `Behind`;
    }
}

/**
 * Calculates the projected time the target goal will be hit based on current progress and time ahead/behind.
 * This function is intended for projecting *future* hit time if the goal is not yet met.
 * The "Met at..." display logic is handled by the calling component.
 *
 * @param log - Today's DailyWorkLog object.
 * @param target - The relevant UPHTarget object.
 * @param timeDifferenceSeconds - The result from `calculateTimeAheadBehindSchedule` (positive if ahead, negative if behind).
 * @param currentTime - The current Date object.
 * @returns Formatted time string (e.g., "10:45:30 PM") or specific status like '-' or 'Pace too low'.
 */
export function calculateProjectedGoalHitTime(
    log: DailyWorkLog | null,
    target: UPHTarget | null,
    timeDifferenceSeconds: number | null,
    currentTime: Date | null
): string {
    if (!log || !target || timeDifferenceSeconds === null || !Number.isFinite(timeDifferenceSeconds) || !currentTime || !isValid(currentTime)) {
        return '-';
    }

    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(log.endTime) || !timeRegex.test(log.startTime)) {
        console.error("calculateProjectedGoalHitTime: Invalid log times", {startTime: log.startTime, endTime: log.endTime });
        return '-';
    }

    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(shiftEndDate) || !isValid(shiftStartDate)) {
        console.error("calculateProjectedGoalHitTime: Invalid parsed dates for shift", {dateStr, startTime: log.startTime, endTime: log.endTime });
        return '-';
    }
    if (shiftEndDate < shiftStartDate) {
        shiftEndDate = addDays(shiftEndDate, 1);
    }

    // Check if goal is already met by looking at current metrics
    const { currentUnits, currentUPH } = calculateCurrentMetrics(log, target, currentTime);
    const targetUnitsForShift = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);

    if (currentUnits >= targetUnitsForShift && targetUnitsForShift > 0) {
        // If goal is already met, this function isn't strictly for *projecting*.
        // The component should use its own `goalMetAt` state for display.
        // However, if forced to calculate, it would be current time.
        return format(currentTime, 'h:mm:ss a');
    }
    
    if (currentUnits < targetUnitsForShift && target.targetUPH > 0 && currentUPH <= 0 && currentUnits > 0) { // Check currentUnits > 0
        return 'Pace too low';
    }
    if (currentUPH <= 0 && currentUnits === 0) { // If no work done yet
        return '-';
    }

    // timeDifferenceSeconds positive means ahead, negative means behind.
    // Projected hit time is shift end time adjusted by how much user is ahead or behind.
    // If ahead by X seconds, goal will be met X seconds *before* scheduled end time.
    // If behind by Y seconds, goal will be met Y seconds *after* scheduled end time.
    const projectedTime = addSeconds(shiftEndDate, -timeDifferenceSeconds);
    
    return format(projectedTime, 'h:mm:ss a');
}


// --- Calculation Helper Functions ---

/**
 * Calculates the total hours worked based on start time, end time, and total non-work duration (break + training).
 * Handles time parsing and potential overnight shifts (basic handling).
 *
 * @param date The date string 'YYYY-MM-DD' or Date object for context.
 * @param startTime The start time string 'HH:mm'.
 * @param endTime The end time string 'HH:mm'.
 * @param totalNonWorkMinutes The total non-work duration in minutes (break + training).
 * @returns The calculated hours worked as a number, rounded to 2 decimal places, or 0 if inputs are invalid.
 */
export function calculateHoursWorked(date: string | Date, startTime: string, endTime: string, totalNonWorkMinutes: number): number {
  const dateStr = typeof date === 'string' ? date : isValid(date) ? format(date, 'yyyy-MM-dd') : null;

  if (!dateStr || !startTime || !endTime || totalNonWorkMinutes === undefined || totalNonWorkMinutes === null || totalNonWorkMinutes < 0) {
    console.warn("Invalid input for calculateHoursWorked:", { date: dateStr, startTime, endTime, totalNonWorkMinutes });
    return 0;
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
     console.error("Invalid time format for calculateHoursWorked:", { startTime, endTime });
     return 0;
  }


  try {
    const startDateTime = parse(`${dateStr} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let endDateTime = parse(`${dateStr} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(startDateTime) || !isValid(endDateTime)) {
        console.error("Failed to parse date/time strings:", { date: dateStr, startTime, endTime });
        return 0;
    }

    if (endDateTime < startDateTime) {
      endDateTime = addDays(endDateTime, 1); 
      if (!isValid(endDateTime)) {
         console.error("End date became invalid after overnight adjustment:", { date: dateStr, endTime });
         return 0;
      }
    }

    const totalGrossMinutesWorked = differenceInMinutes(endDateTime, startDateTime);

    if (totalGrossMinutesWorked < 0) {
        console.error("Calculated total minutes worked is negative. Check start/end times.");
        return 0;
    }

    const netMinutesWorked = totalGrossMinutesWorked - totalNonWorkMinutes;

    if (netMinutesWorked < 0) {
        return 0;
    }

    const hoursWorked = netMinutesWorked / 60;
    return parseFloat(hoursWorked.toFixed(2));

  } catch (error) {
    console.error("Error calculating hours worked:", error);
    return 0;
  }
}


/**
 * Calculates total units for a daily work log based on the items per unit defined in a UPH target.
 * Handles cases where log or target might be missing or itemsPerUnit is zero or invalid.
 * Uses target.docsPerUnit and target.videosPerUnit for the calculation.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object containing items per unit.
 * @returns The total calculated units, or 0 if inputs are invalid.
 */
export function calculateDailyUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
  if (!log || !target) {
    return 0;
  }
  const effectiveDocsPerUnit = (target.docsPerUnit !== null && target.docsPerUnit !== undefined && target.docsPerUnit > 0) ? target.docsPerUnit : 1;
  const effectiveVideosPerUnit = (target.videosPerUnit !== null && target.videosPerUnit !== undefined && target.videosPerUnit > 0) ? target.videosPerUnit : 1;

  const docUnits = (log.documentsCompleted || 0) / effectiveDocsPerUnit;
  const videoUnits = (log.videoSessionsCompleted || 0) / effectiveVideosPerUnit;

  return parseFloat((docUnits + videoUnits).toFixed(2)); 
}

/**
 * Calculates the Units Per Hour (UPH) for a given daily work log and target,
 * based on the *total logged duration* (log.hoursWorked).
 * Handles division by zero if hours worked is 0 or invalid.
 * Uses target-specific docsPerUnit and videosPerUnit via calculateDailyUnits.
 * NOTE: This reflects the average UPH over the entire logged shift duration.
 * For real-time UPH based on time elapsed *so far*, use `calculateCurrentMetrics`.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object.
 * @returns The calculated UPH for the logged duration, or 0 if calculation is not possible.
 */
export function calculateDailyUPH(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
  if (!log || !target || !log.hoursWorked || log.hoursWorked <= 0) {
    return 0; 
  }
  const totalUnits = calculateDailyUnits(log, target); 
  return parseFloat((totalUnits / log.hoursWorked).toFixed(2)); 
}

/**
 * Calculates the total number of units required to meet a specific UPH target
 * given the *total planned net hours worked* for the log entry.
 *
 * @param hoursWorked - The total planned net hours worked for the log entry (from log.hoursWorked).
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
 * Calculates the difference between the actual units completed and the required units for the *total logged hours*.
 * A positive result means the user was ahead of the target pace FOR THE LOGGED DURATION.
 * A negative result means the user was behind the target pace FOR THE LOGGED DURATION.
 * Uses target-specific unit calculations.
 *
 * @param log - The DailyWorkLog object.
 * @param target - The UPHTarget object.
 * @returns The difference in units, or 0 if calculation isn't possible.
 */
export function calculateRemainingUnits(log: DailyWorkLog | null | undefined, target: UPHTarget | null | undefined): number {
   if (!log || !target || !log.hoursWorked || log.hoursWorked <= 0) {
    return 0; 
  }
  const actualUnits = calculateDailyUnits(log, target); 
  const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
  return parseFloat((actualUnits - requiredUnits).toFixed(2));
}

/**
 * Calculates the current actual units completed and the current UPH based on the time elapsed
 * *so far* in the shift, accounting for estimated break and training time taken.
 * Uses target-specific unit calculations.
 *
 * @param log - Today's DailyWorkLog object.
 * @param target - The relevant UPHTarget object.
 * @param currentTime - The current Date object.
 * @returns An object containing `currentUnits` and `currentUPH`, or { currentUnits: 0, currentUPH: 0 } if invalid.
 */
export function calculateCurrentMetrics(
    log: DailyWorkLog | null,
    target: UPHTarget | null,
    currentTime: Date | null
): { currentUnits: number; currentUPH: number } {
    const defaultReturn = { currentUnits: 0, currentUPH: 0 };

    if (!log || !target || !currentTime || !isValid(currentTime)) {
        return defaultReturn;
    }

    const actualUnitsSoFar = calculateDailyUnits(log, target);

    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(log.startTime) || !timeRegex.test(log.endTime)) {
        console.error("Invalid log start/end time format for current metrics:", log);
        return defaultReturn;
    }
    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(shiftStartDate) || !isValid(shiftEndDate)) {
        console.error("Invalid parsed log start/end dates for current metrics:", log);
        return defaultReturn;
    }

    if (shiftEndDate < shiftStartDate) {
        shiftEndDate = addDays(shiftEndDate, 1); 
    }

    const totalGrossShiftSeconds = differenceInSeconds(shiftEndDate, shiftStartDate);
    if (totalGrossShiftSeconds <= 0) return defaultReturn;


    const secondsSinceShiftStart = differenceInSeconds(currentTime, shiftStartDate);
    if (secondsSinceShiftStart <= 0) {
        // If current time is before shift start, UPH is 0, but units completed might be pre-logged.
        return { currentUnits: actualUnitsSoFar, currentUPH: 0 }; 
    }
    const clampedSecondsSinceStart = Math.min(secondsSinceShiftStart, totalGrossShiftSeconds);


    const totalNonWorkMinutesPlanned = (log.breakDurationMinutes || 0) + (log.trainingDurationMinutes || 0);
    const proportionOfShiftElapsed = totalGrossShiftSeconds > 0 ? clampedSecondsSinceStart / totalGrossShiftSeconds : 0;
    const estimatedNonWorkTakenSoFarSeconds = Math.min(totalNonWorkMinutesPlanned * 60, (totalNonWorkMinutesPlanned * 60) * proportionOfShiftElapsed);

    const netWorkSecondsElapsed = Math.max(0, clampedSecondsSinceStart - estimatedNonWorkTakenSoFarSeconds);

    let currentActualUPH = 0;
    if (netWorkSecondsElapsed > 0) {
        const netWorkHoursElapsed = netWorkSecondsElapsed / 3600;
        currentActualUPH = parseFloat((actualUnitsSoFar / netWorkHoursElapsed).toFixed(2));
    }

    return {
        currentUnits: actualUnitsSoFar, 
        currentUPH: currentActualUPH,
    };
}

