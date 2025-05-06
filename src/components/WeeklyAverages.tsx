
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Import Button
import { ChevronLeft, ChevronRight } from 'lucide-react'; // Import icons
import { startOfWeek, endOfWeek, parseISO, isValid, isWithinInterval, format, addWeeks, subWeeks } from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH } from '@/lib/utils'; // Import calculation utils

interface WeeklyAveragesProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[]; // Still needed to find the active one
  activeTarget: UPHTarget | null; // Now used directly
}

const WeeklyAverages: React.FC<WeeklyAveragesProps> = ({
  allWorkLogs = [],
  targets = [],
  activeTarget,
}) => {
  const [weekOffset, setWeekOffset] = useState(0); // 0 for current week, -1 for previous, etc.
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    // Ensure this runs only on the client to avoid hydration mismatch for current date
    setClientNow(new Date());
  }, []);

  const currentDisplayDate = useMemo(() => {
    if (!clientNow) return new Date(); // Default to server new Date() if clientNow not set
    return addWeeks(clientNow, weekOffset);
  }, [weekOffset, clientNow]);


  const weeklyAverageUPH = useMemo(() => {
    if (!activeTarget || allWorkLogs.length === 0 || !clientNow) {
      return null; // No active target, no logs, or clientNow not ready
    }

    const displayWeekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    const displayWeekEnd = endOfWeek(currentDisplayDate, { weekStartsOn: 1 });

    const logsThisWeek = allWorkLogs.filter(log => {
      try {
        const logDate = parseISO(log.date + 'T00:00:00');
        return isValid(logDate) && isWithinInterval(logDate, { start: displayWeekStart, end: displayWeekEnd });
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
      const dailyUPH = calculateDailyUPH(log, activeTarget);
      if (dailyUPH > 0) {
        totalUPHSum += dailyUPH;
        daysWithValidUPH++;
      }
    });

    return daysWithValidUPH > 0 ? parseFloat((totalUPHSum / daysWithValidUPH).toFixed(2)) : 0;

  }, [allWorkLogs, activeTarget, currentDisplayDate, clientNow]);

  const handlePreviousWeek = useCallback(() => {
    setWeekOffset(prev => prev - 1);
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekOffset(prev => Math.min(0, prev + 1)); // Don't go into future weeks
  }, []);

  if (!clientNow) {
    // Render a placeholder or skeleton while waiting for clientNow
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Weekly Average UPH</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-center h-[calc(100%-4.5rem)]">
          <p className="text-muted-foreground text-sm text-center">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const weekStartDateFormatted = format(startOfWeek(currentDisplayDate, { weekStartsOn: 1 }), 'MMM d');
  const weekEndDateFormatted = format(endOfWeek(currentDisplayDate, { weekStartsOn: 1 }), 'MMM d, yyyy');


  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
            <CardTitle>Weekly Average UPH</CardTitle>
            <CardDescription>
            {weekStartDateFormatted} - {weekEndDateFormatted}
            </CardDescription>
        </div>
        <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePreviousWeek} aria-label="Previous Week" className="h-7 w-7">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={weekOffset === 0} aria-label="Next Week" className="h-7 w-7">
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex items-center justify-center h-[calc(100%-4.5rem-1rem)]"> {/* Adjusted height for header with buttons */}
        {weeklyAverageUPH === null ? (
          <p className="text-muted-foreground text-sm text-center">
            No active target set or no logs available for this week.
          </p>
        ) : (
          <div className="text-2xl font-bold tabular-nums">
            {weeklyAverageUPH > 0 ? weeklyAverageUPH.toFixed(2) : '-'}
            <span className="text-sm font-normal text-muted-foreground ml-1">UPH</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAverages;

