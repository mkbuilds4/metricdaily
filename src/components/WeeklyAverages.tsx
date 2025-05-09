
'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { startOfWeek, endOfWeek, parseISO, isValid, isWithinInterval, format, addWeeks } from 'date-fns';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateDailyUPH, formatFriendlyDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'; // Import Combobox

interface WeeklyAveragesProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  activeTarget: UPHTarget | null;
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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedTargetIdForAverage, setSelectedTargetIdForAverage] = useState<string | undefined>(activeTarget?.id);

  useEffect(() => {
    // Ensure this runs only on the client to avoid hydration mismatch for current date
    setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    // Initialize or update selected target ID based on activeTarget or available targets
    if (activeTarget?.id && targets.some(t => t.id === activeTarget.id && (t.isDisplayed ?? true))) {
        setSelectedTargetIdForAverage(activeTarget.id);
    } else {
        const firstDisplayedTarget = targets.find(t => t.isDisplayed ?? true);
        if (firstDisplayedTarget) {
            setSelectedTargetIdForAverage(firstDisplayedTarget.id);
        } else if (targets.length > 0) {
            setSelectedTargetIdForAverage(targets[0].id); // Fallback to first target if none are 'displayed' but list exists
        }
         else {
            setSelectedTargetIdForAverage(undefined);
        }
    }
  }, [activeTarget, targets]);


  const targetForAverageCalculation = useMemo(() => {
    return targets.find(t => t.id === selectedTargetIdForAverage);
  }, [targets, selectedTargetIdForAverage]);

  const handlePreviousWeek = () => {
    setCurrentDate(prev => addWeeks(prev, -1));
  };

  const handleNextWeek = () => {
    const nextWeekStart = startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
    if (nextWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })) {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const weeklyData = useMemo(() => {
    if (!targetForAverageCalculation || allWorkLogs.length === 0) {
      return { averageUPH: null, dailyBreakdown: [] };
    }

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const logsThisWeek = allWorkLogs.filter(log => {
      try {
        const logDate = parseISO(log.date + 'T00:00:00');
        return isValid(logDate) && isWithinInterval(logDate, { start: weekStart, end: weekEnd });
      } catch (e) {
        console.warn(`Invalid date format for log: ${log.id}, date: ${log.date}`);
        return false;
      }
    });

    if (logsThisWeek.length === 0) {
      return { averageUPH: 0, dailyBreakdown: [] };
    }

    let totalUPHSum = 0;
    let daysWithValidUPH = 0;
    const dailyBreakdown: DailyUPHEntry[] = [];

    logsThisWeek.forEach(log => {
      // Use the target associated with the log, fallback to the selected target for average calculation
      const targetForLogDay = targets.find(t => t.id === log.targetId) ?? targetForAverageCalculation;
      if (targetForLogDay) { // Ensure a target is available for calculation for this log
        const dailyUPH = calculateDailyUPH(log, targetForLogDay);
        if (dailyUPH > 0 && Number.isFinite(dailyUPH)) {
          totalUPHSum += dailyUPH;
          daysWithValidUPH++;
          try {
            const logDateObj = parseISO(log.date + 'T00:00:00');
            if (isValid(logDateObj)) {
              dailyBreakdown.push({
                date: log.date,
                uph: parseFloat(dailyUPH.toFixed(2)),
                formattedDate: format(logDateObj, 'EEE')
              });
            }
          } catch (e) {
            console.warn(`Could not parse date for daily breakdown: ${log.date}`);
          }
        }
      }
    });

    dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));
    const averageUPH = daysWithValidUPH > 0 ? parseFloat((totalUPHSum / daysWithValidUPH).toFixed(2)) : 0;
    return { averageUPH, dailyBreakdown };
  }, [allWorkLogs, targetForAverageCalculation, currentDate, targets]);

  const weekStartDateFormatted = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d');
  const weekEndDateFormatted = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d');
  const isCurrentWeekSelected = startOfWeek(currentDate, { weekStartsOn: 1 }).getTime() === startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();

  const targetOptions: ComboboxOption[] = useMemo(() => {
    return targets
        .filter(t => t.isDisplayed ?? true)
        .map(t => ({ value: t.id, label: `${t.name} (Goal: ${t.targetUPH.toFixed(1)})` }));
  }, [targets]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle>Weekly Avg UPH</CardTitle>
                 <CardDescription
                    className="whitespace-nowrap text-xs"
                    title={`Average UPH calculated from ${weekStartDateFormatted} to ${weekEndDateFormatted}`}
                 >
                    {weekStartDateFormatted} - {weekEndDateFormatted}
                 </CardDescription>
            </div>
             <div className="flex items-center gap-1 self-start sm:self-center">
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={handlePreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Previous Week</span>
                </Button>
                 <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleNextWeek} disabled={isCurrentWeekSelected}>
                    <ChevronRight className="h-4 w-4" />
                     <span className="sr-only">Next Week</span>
                </Button>
            </div>
        </div>
        {targetOptions.length > 0 && (
            <div className="mt-3">
                <Combobox
                    options={targetOptions}
                    value={selectedTargetIdForAverage}
                    onSelect={(value) => setSelectedTargetIdForAverage(value)}
                    placeholder="Select Target for Avg UPH"
                    searchPlaceholder='Search targets...'
                    notFoundText='No targets found.'
                    triggerClassName="h-8 text-xs w-full sm:w-[200px]" // Adjusted width
                    disabled={targetOptions.length === 0}
                />
            </div>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex flex-col justify-center h-[calc(100%-6rem)]"> {/* Adjusted height for combobox */}
        {weeklyData.averageUPH === null || !targetForAverageCalculation ? (
          <p className="text-muted-foreground text-sm text-center flex items-center gap-1 mx-auto">
            <AlertCircle className="h-4 w-4" /> No target selected or available.
          </p>
        ) : (
          <>
            <div className="text-center mb-2">
                <div
                    className={cn(
                        "text-2xl font-bold tabular-nums",
                        targetForAverageCalculation && weeklyData.averageUPH !== 0 && weeklyData.averageUPH !== null && (
                            weeklyData.averageUPH >= targetForAverageCalculation.targetUPH
                                ? "text-green-600 dark:text-green-500"
                                : "text-red-600 dark:text-red-500"
                        )
                    )}
                >
                {weeklyData.averageUPH > 0 ? weeklyData.averageUPH.toFixed(2) : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">UPH</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5" title={`Calculated based on Target: ${targetForAverageCalculation?.name || 'N/A'}`}>
                    (Target: {targetForAverageCalculation?.name || 'N/A'})
              </p>
            </div>

            {weeklyData.dailyBreakdown.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50">
                 <p className="text-xs font-medium text-muted-foreground text-center mb-1">Daily UPH</p>
                 <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {weeklyData.dailyBreakdown.map(day => (
                        <div key={day.date} className="text-xs flex items-center gap-1 text-muted-foreground" title={`${formatFriendlyDate(parseISO(day.date + 'T00:00:00'))}: ${day.uph}`}>
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

