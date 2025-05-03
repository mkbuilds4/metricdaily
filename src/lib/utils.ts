import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Metric } from "@/types";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, isWithinInterval } from 'date-fns';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date object or ISO string into YYYY-MM-DD format.
 */
export function formatDateISO(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Gets the start and end dates of the current week (Monday to Sunday).
 */
export function getWeekDates(date: Date = new Date()): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Week starts on Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

/**
 * Filters metrics for the current week.
 */
export function getMetricsForCurrentWeek(metrics: Metric[], date: Date = new Date()): Metric[] {
  const { start, end } = getWeekDates(date);
  return metrics.filter(metric => {
    const metricDate = parseISO(metric.date);
    return isWithinInterval(metricDate, { start, end });
  });
}

/**
 * Calculates the weekly average for a given set of metrics.
 */
export function calculateWeeklyAverage(metrics: Metric[]): number {
  if (metrics.length === 0) {
    return 0;
  }
  const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
  return parseFloat((sum / metrics.length).toFixed(2)); // Return average rounded to 2 decimal places
}

/**
 * Get the metric value for a specific date.
 */
export function getMetricForDate(metrics: Metric[], date: Date): number | undefined {
    const formattedDate = formatDateISO(date);
    const metric = metrics.find(m => m.date === formattedDate);
    return metric?.value;
}
