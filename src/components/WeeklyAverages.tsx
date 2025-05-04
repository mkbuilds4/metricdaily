
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { startOfWeek, endOfWeek, parseISO, isValid, isWithinInterval, format } from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH } from '@/lib/utils'; // Import calculation utils

interface WeeklyAveragesProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[]; // Still needed to find the active one
  activeTarget: UPHTarget | null; // Now used directly
}

const WeeklyAverages: React.FC<WeeklyAveragesProps> = ({
  allWorkLogs = [],
  targets = [], // Keep targets prop for potential future use or context
  activeTarget,
}) => {

  const weeklyAverageUPH = useMemo(() => {
    if (!activeTarget || allWorkLogs.length === 0) {
      return null; // No active target or no logs, can't calculate
    }

    const today = new Date();
    // Start week on Monday (1)
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const logsThisWeek = allWorkLogs.filter(log => {
      try {
        // Ensure date is treated as local time by adding time component
        const logDate = parseISO(log.date + 'T00:00:00');
        return isValid(logDate) && isWithinInterval(logDate, { start: weekStart, end: weekEnd });
      } catch (e) {
        console.warn(`Invalid date format for log: ${log.id}, date: ${log.date}`);
        return false;
      }
    });


    if (logsThisWeek.length === 0) {
      return 0; // No logs this week to average
    }

    let totalUPHSum = 0;
    let daysWithValidUPH = 0;

    logsThisWeek.forEach(log => {
      // Calculate UPH based *only* on the active target
      const dailyUPH = calculateDailyUPH(log, activeTarget);
      if (dailyUPH > 0) { // Only average days where UPH is calculable and positive
        totalUPHSum += dailyUPH;
        daysWithValidUPH++;
      }
    });

    return daysWithValidUPH > 0 ? parseFloat((totalUPHSum / daysWithValidUPH).toFixed(2)) : 0;

  }, [allWorkLogs, activeTarget]);

  const weekStartDateFormatted = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');
  const weekEndDateFormatted = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Average UPH</CardTitle>
        <CardDescription>
           {/* Tooltip now only shows the date range */}
          {weekStartDateFormatted} - {weekEndDateFormatted}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weeklyAverageUPH === null ? (
          <p className="text-muted-foreground">No active target set or no logs available for this week.</p>
        ) : (
          <div className="text-2xl font-bold tabular-nums">
            {weeklyAverageUPH > 0 ? weeklyAverageUPH.toFixed(2) : '-'}
            {/* Unit label changed to UPH */}
            <span className="text-sm font-normal text-muted-foreground ml-1">UPH</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAverages;
