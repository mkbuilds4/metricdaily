'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, TrendingUp, CalendarDays } from 'lucide-react'; // Added icons
import { startOfWeek, endOfWeek, parseISO, isValid, isWithinInterval, format, subDays, startOfDay, endOfDay } from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH, formatFriendlyDate } from '@/lib/utils'; // Import formatFriendlyDate

interface WeeklyAveragesProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[]; // Still needed to find the active one
  activeTarget: UPHTarget | null; // Now used directly
}

interface DailyUPHEntry {
    date: string; // YYYY-MM-DD
    uph: number;
    formattedDate: string; // e.g., 'Mon', 'Tue'
}

const WeeklyAverages: React.FC<WeeklyAveragesProps> = ({
  allWorkLogs = [],
  targets = [],
  activeTarget,
}) => {
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    // Ensure this runs only on the client to avoid hydration mismatch for current date
    setClientNow(new Date());
  }, []);

  const weeklyData = useMemo(() => {
    if (!activeTarget || allWorkLogs.length === 0 || !clientNow) {
      return { averageUPH: null, dailyBreakdown: [] }; // No active target, no logs, or clientNow not ready
    }

    // Calculate the start and end of the *current* week (Monday to Sunday)
    const currentWeekStart = startOfWeek(clientNow, { weekStartsOn: 1 }); // Monday
    // End date is the *current* day, not the end of the week
    const currentWeekEnd = endOfDay(clientNow);

    const logsThisWeekSoFar = allWorkLogs.filter(log => {
      try {
        const logDate = parseISO(log.date + 'T00:00:00'); // Ensure time component for accurate ISO parsing
        // Check if log date is valid and within the interval from Monday to Today
        return isValid(logDate) && isWithinInterval(logDate, { start: currentWeekStart, end: currentWeekEnd });
      } catch (e) {
        console.warn(`Invalid date format for log: ${log.id}, date: ${log.date}`);
        return false;
      }
    });

    if (logsThisWeekSoFar.length === 0) {
      return { averageUPH: 0, dailyBreakdown: [] }; // No logs this week so far to average
    }

    let totalUPHSum = 0;
    let daysWithValidUPH = 0;
    const dailyBreakdown: DailyUPHEntry[] = [];

    logsThisWeekSoFar.forEach(log => {
      // Use the target associated with the log, fallback to active target if missing
      const targetForLog = targets.find(t => t.id === log.targetId) ?? activeTarget;
      if (targetForLog) {
        const dailyUPH = calculateDailyUPH(log, targetForLog);
        if (dailyUPH > 0 && Number.isFinite(dailyUPH)) { // Only include days where UPH could be calculated and is finite
            totalUPHSum += dailyUPH;
            daysWithValidUPH++;
            try {
                 const logDateObj = parseISO(log.date + 'T00:00:00');
                 if (isValid(logDateObj)) {
                     dailyBreakdown.push({
                        date: log.date,
                        uph: parseFloat(dailyUPH.toFixed(2)),
                        formattedDate: format(logDateObj, 'EEE') // Format as 'Mon', 'Tue' etc.
                     });
                 }
            } catch (e) {
                 console.warn(`Could not parse date for daily breakdown: ${log.date}`);
            }
        }
      }
    });

    // Sort daily breakdown by date ascending (Mon -> Sun)
    dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

    const averageUPH = daysWithValidUPH > 0 ? parseFloat((totalUPHSum / daysWithValidUPH).toFixed(2)) : 0;

    return { averageUPH, dailyBreakdown };

  }, [allWorkLogs, activeTarget, clientNow, targets]); // Added clientNow and targets as dependencies


  if (!clientNow) {
    // Render a placeholder or skeleton while waiting for clientNow
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Current Week Avg UPH</CardTitle>
           <CardDescription>Mon - Today</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-center h-[calc(100%-4.5rem)]"> {/* Adjust height if needed */}
          <p className="text-muted-foreground text-sm text-center">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Format start and end dates for display
  const currentWeekStartDateFormatted = format(startOfWeek(clientNow, { weekStartsOn: 1 }), 'MMM d');
  const currentDayFormatted = format(clientNow, 'MMM d');


  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
            <CardTitle>Current Week Avg UPH</CardTitle>
            {/* Display Mon - Today range */}
            <CardDescription className="whitespace-nowrap text-xs" title={`Average UPH calculated from ${currentWeekStartDateFormatted} to ${currentDayFormatted}`}>
                {currentWeekStartDateFormatted} - {currentDayFormatted}
            </CardDescription>
        </div>
        {/* Removed navigation buttons */}
      </CardHeader>
      <CardContent className="pt-2 flex flex-col justify-center h-[calc(100%-4rem)]"> {/* Adjusted height */}
        {weeklyData.averageUPH === null ? (
          <p className="text-muted-foreground text-sm text-center flex items-center gap-1 mx-auto"> {/* Centered message */}
            <AlertCircle className="h-4 w-4" /> No active target.
          </p>
        ) : (
          <>
            <div className="text-center mb-2"> {/* Centered main average */}
              <div className="text-2xl font-bold tabular-nums">
                {weeklyData.averageUPH > 0 ? weeklyData.averageUPH.toFixed(2) : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">UPH</span>
              </div>
              {activeTarget && (
                <p className="text-xs text-muted-foreground mt-0.5" title={`Calculated based on Active Target: ${activeTarget.name}`}>
                    (Target: {activeTarget.name})
                </p>
              )}
            </div>

             {/* Daily Breakdown Section */}
            {weeklyData.dailyBreakdown.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50">
                 <p className="text-xs font-medium text-muted-foreground text-center mb-1">Daily UPH</p>
                 <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {weeklyData.dailyBreakdown.map(day => (
                        <div key={day.date} className="text-xs flex items-center gap-1 text-muted-foreground" title={`${formatFriendlyDate(day.date)}: ${day.uph}`}>
                            <span className="font-medium">{day.formattedDate}:</span>
                            <span className="font-semibold text-foreground tabular-nums">{day.uph}</span>
                        </div>
                    ))}
                 </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAverages;
