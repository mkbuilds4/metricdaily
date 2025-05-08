'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, TrendingUp, CalendarDays } from 'lucide-react'; // Added icons
import { startOfWeek, endOfWeek, parseISO, isValid, isWithinInterval, format, subDays, startOfDay, endOfDay, addWeeks } from 'date-fns'; // Added addWeeks
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH, formatFriendlyDate } from '@/lib/utils'; // Import formatFriendlyDate
import { cn } from '@/lib/utils'; // Import cn

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
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); // Start with today

  useEffect(() => {
    // Ensure this runs only on the client to avoid hydration mismatch for current date
    setCurrentDate(new Date());
  }, []);

  const handlePreviousWeek = () => {
    setCurrentDate(prev => addWeeks(prev, -1));
  };

  const handleNextWeek = () => {
    // Only allow navigating to the week containing the current actual date
    const nextWeekStart = startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
    if (nextWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })) {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const weeklyData = useMemo(() => {
    if (!activeTarget || allWorkLogs.length === 0) {
      return { averageUPH: null, dailyBreakdown: [] }; // No active target or no logs
    }

    // Calculate the start and end of the *selected* week (Monday to Sunday)
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday

    const logsThisWeek = allWorkLogs.filter(log => {
      try {
        const logDate = parseISO(log.date + 'T00:00:00'); // Ensure time component
        return isValid(logDate) && isWithinInterval(logDate, { start: weekStart, end: weekEnd });
      } catch (e) {
        console.warn(`Invalid date format for log: ${log.id}, date: ${log.date}`);
        return false;
      }
    });

    if (logsThisWeek.length === 0) {
      return { averageUPH: 0, dailyBreakdown: [] }; // No logs this week to average
    }

    let totalUPHSum = 0;
    let daysWithValidUPH = 0;
    const dailyBreakdown: DailyUPHEntry[] = [];

    logsThisWeek.forEach(log => {
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

  }, [allWorkLogs, activeTarget, currentDate, targets]); // Added currentDate and targets as dependencies

  // Format start and end dates for display
  const weekStartDateFormatted = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d');
  const weekEndDateFormatted = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d');

  // Determine if the "Next Week" button should be disabled
  const isCurrentWeekSelected = startOfWeek(currentDate, { weekStartsOn: 1 }).getTime() === startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();


  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
            <CardTitle>Weekly Avg UPH</CardTitle>
            {/* Display Mon - Sun range */}
             <CardDescription
                className="whitespace-nowrap text-xs"
                title={`Average UPH calculated from ${weekStartDateFormatted} to ${weekEndDateFormatted}`}
             >
                {weekStartDateFormatted} - {weekEndDateFormatted}
             </CardDescription>
        </div>
         <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={handlePreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous Week</span>
            </Button>
             <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleNextWeek} disabled={isCurrentWeekSelected}>
                <ChevronRight className="h-4 w-4" />
                 <span className="sr-only">Next Week</span>
            </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex flex-col justify-center h-[calc(100%-4rem)]">
        {weeklyData.averageUPH === null ? (
          <p className="text-muted-foreground text-sm text-center flex items-center gap-1 mx-auto">
            <AlertCircle className="h-4 w-4" /> No active target.
          </p>
        ) : (
          <>
            <div className="text-center mb-2">
               {/* Conditional coloring for the average UPH */}
                <div
                    className={cn(
                        "text-2xl font-bold tabular-nums",
                        activeTarget && weeklyData.averageUPH !== 0 && weeklyData.averageUPH !== null && (
                            weeklyData.averageUPH >= activeTarget.targetUPH
                                ? "text-green-600 dark:text-green-500"
                                : "text-red-600 dark:text-red-500"
                        )
                    )}
                >
                {weeklyData.averageUPH > 0 ? weeklyData.averageUPH.toFixed(2) : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">UPH</span>
              </div>
              {/* Tooltip remains the same */}
              <p className="text-xs text-muted-foreground mt-0.5" title={`Calculated based on Target: ${activeTarget?.name || 'N/A'}`}>
                    (Target: {activeTarget?.name || 'N/A'})
              </p>
            </div>

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
