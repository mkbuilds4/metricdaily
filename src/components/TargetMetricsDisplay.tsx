
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Clock, Calendar, BookOpen, Video, ChevronDown, Target, Gauge } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { isValid, differenceInMinutes, parse, addDays, addHours, format, addMinutes } from 'date-fns';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDurationFromHours,
    calculateProjectedGoalHitTime,
    formatDateISO,
    formatFriendlyDate,
    calculateRemainingUnits,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receive all logs
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void; // Add delete action prop
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Run only on the client after hydration
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute is sufficient for projection
    return () => clearInterval(timerId);
  }, []); // Empty dependency array ensures this runs once on mount

  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog[]> = {};

    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
        if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
            if (log.date === todayDateStr && !foundTodayLog) {
              foundTodayLog = log;
            } else if (log.date !== todayDateStr) {
                if (!prevLogsMap[log.date]) {
                    prevLogsMap[log.date] = [];
                }
                 // Only keep the first unique log for each previous date for the summary accordion
                 if (prevLogsMap[log.date].length === 0) {
                   prevLogsMap[log.date].push(log);
                 }
            }
        } else {
            console.warn("Skipping log due to invalid date format:", log);
        }
    });

    // Use only the first log found for each previous date for the accordion trigger/content
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Take the first (and only) log per date
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
  }, [allWorkLogs]);


  const sortedTargets = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);
  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDate = new Date(log.date + 'T00:00:00');
     const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      toast({
        title: "Log Deleted",
        description: `Work log for ${formattedLogDate} deleted successfully.`,
      });
    } catch (error) {
      console.error("Failed to delete work log:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Could not delete the work log.",
      });
    }
  };

  // --- Calculate Current Metrics (For Today Only) ---
  const calculateCurrentMetrics = (log: DailyWorkLog | null, target: UPHTarget | null, now: Date | null) => {
    if (!log || !target || !now || !isValid(now)) {
      return { currentUnits: 0, currentUPH: 0 };
    }

    const currentUnits = calculateDailyUnits(log, target);

    // Calculate net work minutes elapsed so far
    const dateStr = log.date;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(log.startTime)) return { currentUnits, currentUPH: 0 }; // Invalid start time

    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(shiftStartDate)) return { currentUnits, currentUPH: 0 }; // Invalid parsed start date

    let shiftEndDate; // Need end date to calculate total shift duration for break proportion
    if (timeRegex.test(log.endTime)) {
        shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
        if (shiftEndDate < shiftStartDate) {
             shiftEndDate = addDays(shiftEndDate, 1);
        }
    }
    // Estimate end date if invalid or missing for projection purposes
    if (!shiftEndDate || !isValid(shiftEndDate)) {
        shiftEndDate = addHours(shiftStartDate, log.hoursWorked + (log.breakDurationMinutes / 60));
    }
    // Final validation after potential adjustment/estimation
     if (!isValid(shiftEndDate)) return { currentUnits, currentUPH: 0 };


    const totalGrossShiftMinutes = differenceInMinutes(shiftEndDate, shiftStartDate);
    const minutesSinceShiftStart = differenceInMinutes(now, shiftStartDate);

    if (minutesSinceShiftStart <= 0 || totalGrossShiftMinutes <= 0) {
        return { currentUnits, currentUPH: 0 }; // Shift hasn't started or invalid duration
    }

    const clampedMinutesSinceStart = Math.min(minutesSinceShiftStart, totalGrossShiftMinutes);
    const proportionOfShiftElapsed = clampedMinutesSinceStart / totalGrossShiftMinutes;
    const estimatedBreakTakenSoFar = log.breakDurationMinutes * proportionOfShiftElapsed;
    const netWorkMinutesElapsed = Math.max(0, clampedMinutesSinceStart - estimatedBreakTakenSoFar);

    if (netWorkMinutesElapsed <= 0) {
      return { currentUnits, currentUPH: 0 }; // No work time yet
    }

    const netWorkHoursElapsed = netWorkMinutesElapsed / 60;
    const currentUPH = parseFloat((currentUnits / netWorkHoursElapsed).toFixed(2));

    return { currentUnits, currentUPH };
  };


  // --- Helper Function to Render a Metric Card (Used for Targets Breakdown) ---
  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      // Calculate metrics based on TOTAL logged hours for historical/comparison
      const totalActualUnits = calculateDailyUnits(log, target);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      const totalDifferenceUnits = calculateRemainingUnits(log, target);
      const totalActualUPH = calculateDailyUPH(log, target); // Total UPH for the log

      let goalHitTimeFormatted = '-';
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };

       if (isToday && currentTime) {
           goalHitTimeFormatted = calculateProjectedGoalHitTime(log, target, currentTime);
           currentMetrics = calculateCurrentMetrics(log, target, currentTime);
       }

      const isBehind = totalDifferenceUnits < 0;

      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                    {/* Show +/- vs Goal only for previous logs */}
                    {!isToday && (
                         <span className={`text-lg font-bold ${isBehind ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                            {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {/* Total Metrics (Comparison) */}
                 {isToday ? (
                     <>
                         {/* Current Metrics (Today Only) */}
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Est. Goal Hit</p>
                            <p className="font-medium">{goalHitTimeFormatted}</p>
                        </div>
                        <div>
                             <p className="text-muted-foreground">Target Units</p>
                             <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                         </div>
                    </>
                 ) : (
                     <>
                        {/* Previous Log Specific Metrics */}
                        <div>
                             <p className="text-muted-foreground">Units Completed</p>
                             <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                         </div>
                        <div>
                            <p className="text-muted-foreground">Units Needed</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                        </div>

                     </>
                 )}


            </CardContent>
        </Card>
      );
  };

   // --- Helper Function to Render a Summary Card for a Log (Used for Today) ---
   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean, allTargets: UPHTarget[]) => {
        const logDate = new Date(log.date + 'T00:00:00'); // Add time component for parsing
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date; // Fallback to raw string if invalid

        return (
            <Card className={`mb-4 relative ${!isToday ? 'shadow-none border-none bg-transparent' : ''}`}>
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime}, {log.breakDurationMinutes} min break)
                            </CardDescription>
                         </div>
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {/* Basic Info */}
                     <div className="flex items-center space-x-2">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Docs</p>
                            <p className="text-lg font-semibold">{log.documentsCompleted}</p>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2">
                         <Video className="h-5 w-5 text-muted-foreground" />
                         <div>
                             <p className="text-sm text-muted-foreground">Videos</p>
                             <p className="text-lg font-semibold">{log.videoSessionsCompleted}</p>
                         </div>
                     </div>

                     {/* UPH per Target */}
                     {allTargets.map(target => {
                         const uphForTarget = calculateDailyUPH(log, target);
                         return (
                             <div key={target.id} className="flex items-center space-x-2">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">UPH ({target.name})</p>
                                    <p className="text-lg font-semibold">{uphForTarget.toFixed(2)}</p>
                                </div>
                             </div>
                         );
                     })}
                 </CardContent>
                 {log.notes && (
                    <CardFooter className="pt-3">
                        <p className="text-sm text-muted-foreground italic">Notes: {log.notes}</p>
                    </CardFooter>
                 )}
            </Card>
        );
   }


  return (
    <div className="space-y-6">
      {/* --- Today's Metrics Section --- */}
      {todayLog && (
        <div>
           {/* Pass all targets to the summary card */}
          {renderLogSummaryCard(todayLog, true, sortedTargets)}

           {sortedTargets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Render breakdown cards for today */}
                {sortedTargets.map((target) => renderTargetMetricCard(todayLog, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {/* --- Separator --- */}
       {todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

      {/* --- Previous Logs Section (Accordion) --- */}
      {previousLogsByDate.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           <Accordion type="multiple" className="w-full space-y-1">
               {previousLogsByDate.map(({ date, log }) => (
                    <AccordionItem value={date} key={date} className="border-none">
                        {/* Use standard AccordionTrigger, containing the summary component and delete button */}
                        <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-md transition-colors w-full relative group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50">
                            <div className="flex items-center justify-between w-full"> {/* Flex container for summary and icons */}
                                {/* Pass all targets to the trigger summary */}
                                <PreviousLogTriggerSummary log={log} allTargets={sortedTargets} />
                                <div className="flex items-center space-x-2 ml-auto"> {/* Container for icons */}
                                    {/* Delete Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent accordion trigger
                                            handleDeleteLog(log);
                                        }}
                                        title="Delete This Log"
                                        aria-label="Delete This Log"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    {/* Chevron Icon */}
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                            </div>
                        </AccordionTrigger>

                        <AccordionContent className="p-4 border-t bg-muted/10 mt-1 rounded-b-md">
                             <div className="flex justify-between items-center mb-4">
                                <h4 className="text-md font-semibold">Target Breakdown for {formatFriendlyDate(new Date(date + 'T00:00:00'))}</h4>
                             </div>
                              {/* Render the detailed summary card *inside* the accordion content */}
                             {renderLogSummaryCard(log, false, sortedTargets)}
                             {sortedTargets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {/* Pass false for isToday */}
                                    {sortedTargets.map(target => renderTargetMetricCard(log, target, false))}
                                 </div>
                                ) : (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets were defined at the time of this log.</p>
                             )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
           </Accordion>
        </div>
      )}

       {/* Message if no logs exist at all */}
       {!todayLog && previousLogsByDate.length === 0 && targets.length > 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
       {/* Message if no targets exist */}
       {targets.length === 0 && (
           <p className="text-center text-muted-foreground">No UPH targets defined.</p>
       )}

    </div>
  );
};

export default TargetMetricsDisplay;

