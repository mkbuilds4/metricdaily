
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
 * Formats total minutes into a human-readable duration string (e.g., "X hrs Y mins").
 * Handles potential NaN or non-finite inputs.
 * @param totalMinutes - The total minutes.
 * @returns The formatted duration string, or '-' if input is invalid, zero, or negative.
 */
export function formatDurationFromMinutes(totalMinutes: number | null | undefined): string {
    if (totalMinutes === null || totalMinutes === undefined || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
        return '-';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60); // Round remaining minutes

    const parts: string[] = [];
    if (hours > 0) {
        parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0 || hours === 0) { // Show minutes if > 0 or if hours is 0
        parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);
    }
    // Handle exactly 0 case which should be covered by <=0 check, but as safeguard:
    if (parts.length === 0 && totalMinutes === 0) {
         return '0 mins';
    }
    // Handle cases where totalMinutes was small but positive, resulting in 0 mins after rounding
    if (parts.length === 0 && totalMinutes > 0) {
        return '< 1 min';
    }

    return parts.join(' ');
}


/**
 * Calculates the projected time when the shift's target units will be hit,
 * based on current progress relative to the scheduled end time and schedule status.
 * Also estimates the remaining *work* duration needed at the current pace.
 *
 * @param log - Today's DailyWorkLog object.
 * @param target - The relevant UPHTarget object.
 * @param currentTime - The current Date object.
 * @returns An object containing `projectedTime` (e.g., "hh:mm a") and `remainingDuration` (e.g., "X hrs Y mins"), or placeholder values.
 */
export function calculateProjectedGoalHitTime(
    log: DailyWorkLog | null,
    target: UPHTarget | null,
    currentTime: Date | null
): { projectedTime: string; remainingDuration: string } {
    const defaultReturn = { projectedTime: '-', remainingDuration: '-' };

    if (!log || !target || !currentTime || !isValid(currentTime)) {
        return defaultReturn;
    }

    // 1. Calculate current metrics
    const { currentUnits, currentUPH } = calculateCurrentMetrics(log, target, currentTime);

    // 2. Calculate Target Units for the Full Shift
    const targetUnitsForShift = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
    if (targetUnitsForShift <= 0) {
        return { projectedTime: 'N/A (Target)', remainingDuration: '-' };
    }

    // 3. Check if Goal Already Met
    if (currentUnits >= targetUnitsForShift) {
        return { projectedTime: 'Goal Met', remainingDuration: '0 mins' };
    }

    // 4. Calculate Time Ahead/Behind Schedule
    const timeDifferenceMinutes = calculateTimeAheadBehindSchedule(log, target, currentTime);

    // If calculation failed (e.g., zero pace before goal met), cannot project accurately using this method
    if (timeDifferenceMinutes === null) {
         // Fallback: Check pace. If zero, cannot project.
         if (currentUPH <= 0) {
             return { projectedTime: 'N/A (Pace)', remainingDuration: '-' };
         }
         // If pace is non-zero but timeDifference failed (should be rare), maybe use old method?
         // For now, return calculation error.
         return { projectedTime: 'N/A (Calc)', remainingDuration: '-' };
    }

    // 5. Get Scheduled End Time
    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
     if (!timeRegex.test(log.startTime) || !timeRegex.test(log.endTime)) {
         console.error("Invalid log start/end time format for projection:", log);
         return { projectedTime: 'Invalid Time', remainingDuration: '-' };
     }
    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(shiftStartDate) || !isValid(shiftEndDate)) {
        console.error("Invalid parsed log start/end dates for projection:", log);
        return { projectedTime: 'Invalid Date', remainingDuration: '-' };
    }
    if (shiftEndDate < shiftStartDate) {
        shiftEndDate = addDays(shiftEndDate, 1);
    }

    // 6. Project Goal Hit Time based on End Time and Schedule Status
    // If ahead by X mins (timeDifference > 0), finish X mins *before* shiftEndDate.
    // If behind by Y mins (timeDifference < 0), finish Y mins *after* shiftEndDate.
    // So, subtract timeDifferenceMinutes from shiftEndDate.
    const projectedHitDate = addMinutes(shiftEndDate, -timeDifferenceMinutes);

    if (!isValid(projectedHitDate)) {
         return { projectedTime: 'Invalid Date', remainingDuration: '-' };
    }
    const projectedTimeFormatted = format(projectedHitDate, 'hh:mm a'); // e.g., "11:40 PM"


    // 7. Calculate Remaining *Work* Duration based on *current pace* (provides a different perspective)
    let remainingWorkDurationFormatted = '-';
    if (currentUPH > 0) {
        const unitsNeeded = targetUnitsForShift - currentUnits;
        const remainingNetWorkHoursNeeded = unitsNeeded / currentUPH;
        const remainingNetWorkMinutesNeeded = remainingNetWorkHoursNeeded * 60;
        remainingWorkDurationFormatted = formatDurationFromMinutes(remainingNetWorkMinutesNeeded);
    }


    return {
        projectedTime: projectedTimeFormatted,
        remainingDuration: remainingWorkDurationFormatted,
    };
}

/**
 * Calculates how far ahead or behind schedule the user is in minutes.
 * Positive value means ahead, negative means behind.
 *
 * @param log - Today's DailyWorkLog object.
 * @param target - The relevant UPHTarget object.
 * @param currentTime - The current Date object.
 * @returns The time difference in minutes, or null if calculation is not possible.
 */
export function calculateTimeAheadBehindSchedule(
    log: DailyWorkLog | null,
    target: UPHTarget | null,
    currentTime: Date | null
): number | null {
    if (!log || !target || !currentTime || !isValid(currentTime)) {
        return null;
    }

    // 1. Calculate Net Work Time Elapsed So Far
    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(log.startTime) || !timeRegex.test(log.endTime)) return null;

    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (!isValid(shiftStartDate) || !isValid(shiftEndDate)) return null;
    if (shiftEndDate < shiftStartDate) shiftEndDate = addDays(shiftEndDate, 1);

    const totalGrossShiftMinutes = differenceInMinutes(shiftEndDate, shiftStartDate);
    const totalNetShiftMinutes = Math.max(0, totalGrossShiftMinutes - log.breakDurationMinutes); // Planned net minutes
    if (totalGrossShiftMinutes <= 0 || totalNetShiftMinutes <= 0) return null; // Need positive shift/work duration

    const minutesSinceShiftStart = differenceInMinutes(currentTime, shiftStartDate);
    if (minutesSinceShiftStart <= 0) return 0; // Not started yet or exactly at start

    const clampedMinutesSinceStart = Math.min(minutesSinceShiftStart, totalGrossShiftMinutes);
    // Estimate proportion of break taken more linearly relative to gross time elapsed
    const proportionOfShiftElapsed = totalGrossShiftMinutes > 0 ? clampedMinutesSinceStart / totalGrossShiftMinutes : 0;
    const estimatedBreakTakenSoFar = Math.min(log.breakDurationMinutes, log.breakDurationMinutes * proportionOfShiftElapsed); // Cap break taken at total break

    const netWorkMinutesElapsed = Math.max(0, clampedMinutesSinceStart - estimatedBreakTakenSoFar);

    // If shift is technically over, use the planned total net shift minutes
    if (currentTime >= shiftEndDate) {
       const finalNetMinutes = Math.max(0, totalGrossShiftMinutes - log.breakDurationMinutes);
       const unitsCompleted = calculateDailyUnits(log, target);
       if (target.targetUPH <= 0) return null;
       const netMinutesNeededForUnits = (unitsCompleted / target.targetUPH) * 60;
       return parseFloat((netMinutesNeededForUnits - finalNetMinutes).toFixed(1));
    }


    // 2. Calculate Units Completed So Far
    const unitsCompletedSoFar = calculateDailyUnits(log, target);

    // 3. Calculate How Much Net Work Time *Should* Have Elapsed to complete these units at target pace
    if (target.targetUPH <= 0) return null; // Avoid division by zero/invalid pace
    const netHoursNeededForUnitsCompleted = unitsCompletedSoFar / target.targetUPH;
    const netMinutesNeededForUnitsCompleted = netHoursNeededForUnitsCompleted * 60;

    // 4. Calculate the difference
    // Time Ahead = Time that *should* have passed - Time that *actually* passed (net)
    const timeDifferenceMinutes = netMinutesNeededForUnitsCompleted - netWorkMinutesElapsed;

    return parseFloat(timeDifferenceMinutes.toFixed(1)); // Round to one decimal place for minutes
}

/**
 * Formats the time ahead/behind schedule into a human-readable string.
 * @param timeDifferenceMinutes - The time difference in minutes (positive means ahead, negative means behind).
 * @returns A formatted string (e.g., "Ahead 15 mins", "Behind 1 hr 5 mins", "On Schedule"), or '-' if input is null.
 */
export function formatTimeAheadBehind(timeDifferenceMinutes: number | null): string {
    if (timeDifferenceMinutes === null || !Number.isFinite(timeDifferenceMinutes)) {
        return '-';
    }

    const absMinutes = Math.abs(timeDifferenceMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60);

    let durationString = '';
    if (hours > 0) {
        durationString += `${hours} hr${hours !== 1 ? 's' : ''} `;
    }
    if (minutes > 0 || hours === 0) { // Show minutes if > 0 or if hours is 0
         durationString += `${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
    // Handle cases where the total duration is less than a minute but not zero
    if (durationString.trim() === '' && absMinutes > 0) {
        durationString = '< 1 min';
    }
     // Handle exactly zero case - check the input directly
    if (Math.abs(timeDifferenceMinutes) < 0.05) { // Use a small tolerance for floating point
         return 'On Schedule';
    }


    if (timeDifferenceMinutes > 0) {
        return `Ahead ${durationString.trim()}`;
    } else if (timeDifferenceMinutes < 0) {
        return `Behind ${durationString.trim()}`;
    } else {
         return 'On Schedule'; // Fallback if tolerance check failed somehow
    }
}


// --- Calculation Helper Functions ---

/**
 * Calculates the total hours worked based on start time, end time, and break duration.
 * Handles time parsing and potential overnight shifts (basic handling).
 *
 * @param date The date string 'YYYY-MM-DD' or Date object for context.
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

  // Validate time formats explicitly before parsing
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
     console.error("Invalid time format for calculateHoursWorked:", { startTime, endTime });
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
      endDateTime = addDays(endDateTime, 1); // Corrected: Use addDays
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
 * NOTE: Uses the log.hoursWorked field, which typically represents the *planned* shift duration.
 * For real-time UPH based on time elapsed *so far*, use `calculateCurrentMetrics`.
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
 * Calculates the difference between the actual units completed and the required units (to meet the target for the total logged hours).
 * A positive result means the user is ahead of the target pace FOR THE LOGGED DURATION.
 * A negative result means the user is behind the target pace FOR THE LOGGED DURATION.
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
  // Difference = Actual - Required. Positive = Ahead, Negative = Behind
  return parseFloat((actualUnits - requiredUnits).toFixed(2));
}

/**
 * Calculates the current actual units completed and the current UPH based on the time elapsed
 * *so far* in the shift, accounting for estimated break time taken.
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

    // 1. Calculate Actual Units Completed So Far (using the full log data)
    const actualUnitsSoFar = calculateDailyUnits(log, target);

    // 2. Parse shift start/end times
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

    // Handle overnight shift
    if (shiftEndDate < shiftStartDate) {
        shiftEndDate = addDays(shiftEndDate, 1); // Corrected: Use addDays
    }

    // 3. Calculate Planned Total Shift Duration
    const totalGrossShiftMinutes = differenceInMinutes(shiftEndDate, shiftStartDate);
    if (totalGrossShiftMinutes <= 0) return defaultReturn;


    // 4. Calculate Effective Work Time Elapsed *so far*
    const minutesSinceShiftStart = differenceInMinutes(currentTime, shiftStartDate);
    // If current time is before shift start, no time has elapsed
    if (minutesSinceShiftStart <= 0) {
        return { currentUnits: actualUnitsSoFar, currentUPH: 0 }; // Units might be pre-entered
    }
     // Clamp elapsed time to the planned shift duration
    const clampedMinutesSinceStart = Math.min(minutesSinceShiftStart, totalGrossShiftMinutes);


    // Estimate proportion of break taken based on time elapsed
    const proportionOfShiftElapsed = totalGrossShiftMinutes > 0 ? clampedMinutesSinceStart / totalGrossShiftMinutes : 0;
    const estimatedBreakTakenSoFar = log.breakDurationMinutes * proportionOfShiftElapsed;


    // Calculate net work minutes elapsed so far
    const netWorkMinutesElapsed = Math.max(0, clampedMinutesSinceStart - estimatedBreakTakenSoFar);

    // 5. Calculate Current UPH
    let currentActualUPH = 0;
    if (netWorkMinutesElapsed > 0) {
        const netWorkHoursElapsed = netWorkMinutesElapsed / 60;
        currentActualUPH = parseFloat((actualUnitsSoFar / netWorkHoursElapsed).toFixed(2));
    }

    return {
        currentUnits: actualUnitsSoFar, // Return the total units completed as entered in the log
        currentUPH: currentActualUPH,
    };
}
