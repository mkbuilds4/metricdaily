'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, ChevronDown, ArrowUp, ArrowDown, Minus as MinusIcon, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { parse, isValid, format, addMinutes, addDays } from 'date-fns'; // Import addMinutes and addDays
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
    formatDateISO,
    formatFriendlyDate,
    calculateRemainingUnits,
    calculateCurrentMetrics,
    calculateTimeAheadBehindSchedule,
    formatTimeAheadBehind,
    // Removed calculateProjectedGoalHitTime import as we recalculate here
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary';
import { cn } from '@/lib/utils';


interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  showTodaySection?: boolean;
  paginatePreviousLogs?: boolean; // Prop to enable pagination (optional, not implemented here)
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
  showTodaySection = true,
  paginatePreviousLogs = false,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timerId);
  }, []);

  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog[]> = {};

    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
        if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
             const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
             if (isValid(logDate)) {
                if (showTodaySection && log.date === todayDateStr && !foundTodayLog) {
                    foundTodayLog = log;
                } else if (log.date !== todayDateStr) {
                    if (!prevLogsMap[log.date]) {
                        prevLogsMap[log.date] = [];
                    }
                     if (prevLogsMap[log.date].length === 0) {
                        prevLogsMap[log.date].push(log);
                     }
                }
             } else {
                 console.warn("Skipping log due to invalid parsed date:", log);
             }
        } else {
            console.warn("Skipping log due to invalid date format string:", log);
        }
    });

    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Assign log property
                                .sort((a, b) => b.date.localeCompare(a.date));

    return {
        todayLog: showTodaySection ? foundTodayLog : null,
        previousLogsByDate: prevLogsGrouped
    };
  }, [allWorkLogs, showTodaySection]);

  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  // Memoize sorted targets by UPH for consistent display order within days
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      // Toast handled by parent component
    } catch (error) {
      console.error("Failed to delete work log:", error);
      // Toast handled by parent component
    }
  };


  const renderTargetMetricCard = (log: DailyWorkLog, targetForCalculation: UPHTarget, displayTarget: UPHTarget, isToday: boolean) => {
      // Always calculate based on the targetForCalculation (either log's own target or active)
      const totalActualUnits = calculateDailyUnits(log, targetForCalculation);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, displayTarget.targetUPH); // Use display target's UPH for goal
      const totalDifferenceUnits = totalActualUnits - totalRequiredUnits; // Difference vs the display target's goal
      const dailyUPHForTarget = calculateDailyUPH(log, targetForCalculation); // UPH based on target used for calculation

      let projectedHitTimeFormatted = '-';
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };
      let timeAheadBehindMinutes: number | null = null;

       if (isToday && currentTime) {
           // Use the targetForCalculation (which should be the active one for today) for real-time projections
           currentMetrics = calculateCurrentMetrics(log, targetForCalculation, currentTime);
           timeAheadBehindMinutes = calculateTimeAheadBehindSchedule(log, targetForCalculation, currentTime);

           // --- New Est. Goal Hit Time Calculation ---
           if (timeAheadBehindMinutes !== null) {
                const dateStr = log.date;
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
                 if (timeRegex.test(log.startTime) && timeRegex.test(log.endTime)) {
                    const shiftStartDate = parse(`${dateStr} ${log.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
                    let shiftEndDate = parse(`${dateStr} ${log.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

                     if (isValid(shiftStartDate) && isValid(shiftEndDate)) {
                        if (shiftEndDate < shiftStartDate) {
                            shiftEndDate = addDays(shiftEndDate, 1);
                        }
                        // Projected Hit Time = Scheduled End Time - Time Ahead/Behind
                        // If behind (-X mins), end - (-X) = end + X
                        // If ahead (+Y mins), end - (+Y) = end - Y
                        const projectedHitDate = addMinutes(shiftEndDate, -timeAheadBehindMinutes);
                         if (isValid(projectedHitDate)) {
                            projectedHitTimeFormatted = format(projectedHitDate, 'hh:mm a');
                        } else {
                            projectedHitTimeFormatted = 'Invalid Date';
                        }
                     } else {
                          projectedHitTimeFormatted = 'Invalid Time';
                     }
                 } else {
                     projectedHitTimeFormatted = 'Invalid Time';
                 }
           } else {
               projectedHitTimeFormatted = 'N/A (Calc)';
           }
           // Check if goal is already met
           if (currentMetrics.currentUnits >= calculateRequiredUnitsForTarget(log.hoursWorked, targetForCalculation.targetUPH)) {
               projectedHitTimeFormatted = 'Goal Met';
           }
           // --- End New Calculation ---
       }

      const isBehindSchedule = timeAheadBehindMinutes !== null && timeAheadBehindMinutes < 0;
      const isAheadSchedule = timeAheadBehindMinutes !== null && timeAheadBehindMinutes > 0;
      const isOnSchedule = timeAheadBehindMinutes !== null && Math.abs(timeAheadBehindMinutes) < 0.05; // Use tolerance for float comparison


      return (
        <Card key={`${log.id}-${displayTarget.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{displayTarget.name}</CardTitle> {/* Show Display Target Name */}
                     {!isToday && (
                         <span className={`text-base font-medium ${totalDifferenceUnits < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                            {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {displayTarget.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? (
                     <>
                        {/* Today: Units Now and Current UPH are based on the active target */}
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p> {/* Required for this specific target */}
                        </div>
                         <div>
                            <p className="text-muted-foreground">Schedule Status</p>
                            <p className={cn("font-medium", isAheadSchedule && "text-green-600", isBehindSchedule && "text-red-600", isOnSchedule && "text-foreground")}>
                                {formatTimeAheadBehind(timeAheadBehindMinutes)}
                             </p>
                         </div>
                         {/* Updated Est. Goal Hit Time Display */}
                         <div className="col-span-2">
                             <p className="text-muted-foreground">Est. Goal Hit Time</p>
                             <p className="font-medium">
                                {projectedHitTimeFormatted}
                             </p>
                         </div>
                    </>
                 ) : (
                     <>
                        {/* Previous: Show completed units and avg UPH based on the log's original target context */}
                       <div>
                           <p className="text-muted-foreground">Units Completed</p>
                           <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                       </div>
                       <div>
                          <p className="text-muted-foreground">Avg Daily UPH</p>
                          <p className="font-medium">{dailyUPHForTarget.toFixed(2)}</p>
                       </div>
                       {/* Target units and +/- are always vs the *displayed* target */}
                       <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">+/- Goal</p>
                          <p className={`font-medium ${totalDifferenceUnits < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                             {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)}
                          </p>
                      </div>
                     </>
                 )}
            </CardContent>
        </Card>
      );
  };

   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean) => {
        // Determine which target to use for calculations (log's own target or active target as fallback)
        const logTarget = targets.find(t => t.id === log.targetId);
        const targetForSummaryCalc = logTarget ?? activeTarget ?? (targets.length > 0 ? targets[0] : null);

        let summaryUPH: number | null = null;
        let currentUnitsNow: number | null = null;

        if (targetForSummaryCalc) {
            if (isToday && currentTime) {
                const metrics = calculateCurrentMetrics(log, targetForSummaryCalc, currentTime);
                summaryUPH = metrics.currentUPH;
                currentUnitsNow = metrics.currentUnits; // Get current units
            } else if (!isToday) {
                summaryUPH = calculateDailyUPH(log, targetForSummaryCalc);
            }
        }

        const summaryTargetName = targetForSummaryCalc ? targetForSummaryCalc.name : 'N/A';
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

        return (
            <Card className={cn("mb-4 relative", !isToday && "shadow-none border-none bg-transparent")}>
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime}, {log.breakDurationMinutes} min break)
                                {targetForSummaryCalc && ` (Target: ${summaryTargetName})`}
                                {!targetForSummaryCalc && <span className="text-destructive ml-2">(Target Missing!)</span>}
                            </CardDescription>
                         </div>
                         {/* Delete button positioned absolutely within the summary card for previous logs */}
                          {!isToday && (
                             <Button
                                 variant="ghost"
                                 size="icon"
                                 className="absolute top-2 right-2 text-destructive hover:text-destructive h-7 w-7" // Adjust size/position
                                 onClick={(e) => { e.stopPropagation(); handleDeleteLog(log); }} // Prevent accordion toggle
                                 title="Delete This Log"
                                 aria-label="Delete This Log"
                             >
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                         )}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {/* Documents Completed */}
                     <div className="flex items-center space-x-2">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Docs</p>
                            <p className="text-lg font-semibold">{log.documentsCompleted}</p>
                        </div>
                    </div>
                     {/* Video Sessions Completed */}
                     <div className="flex items-center space-x-2">
                         <Video className="h-5 w-5 text-muted-foreground" />
                         <div>
                             <p className="text-sm text-muted-foreground">Videos</p>
                             <p className="text-lg font-semibold">{log.videoSessionsCompleted}</p>
                         </div>
                     </div>
                      {/* Today Only: Current Units Now */}
                      {isToday && currentUnitsNow !== null && (
                           <div className="flex items-center space-x-2">
                                <MinusIcon className="h-5 w-5 text-transparent" /> {/* Placeholder for alignment */}
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Now ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{currentUnitsNow.toFixed(2)}</p>
                              </div>
                           </div>
                      )}
                      {/* Previous Only: Total Units Completed */}
                       {!isToday && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                               <MinusIcon className="h-5 w-5 text-transparent" /> {/* Placeholder for alignment */}
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Completed ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{calculateDailyUnits(log, targetForSummaryCalc).toFixed(2)}</p>
                              </div>
                           </div>
                       )}
                     {/* Overall UPH (Current or Avg) */}
                     {summaryUPH !== null && (
                         <div className="flex items-center space-x-2">
                             <Clock className="h-5 w-5 text-muted-foreground" />
                             <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? `Current Daily UPH` : `Avg Daily UPH`} ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{summaryUPH.toFixed(2)}</p>
                             </div>
                         </div>
                     )}
                 </CardContent>
                 {/* Optional Notes */}
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
      {/* === Today's Log Section === */}
      {showTodaySection && todayLog && (
        <div>
          {renderLogSummaryCard(todayLog, true)}

           {targets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Today's breakdown always uses the active target for calculation */}
                {sortedTargetsByUPH.map((target) => renderTargetMetricCard(todayLog, activeTarget || target, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {/* Separator if both Today and Previous logs are shown */}
      {showTodaySection && todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

      {/* === Previous Logs Section (with Accordion) === */}
      {previousLogsByDate.length > 0 && (
        <div>
           {(!showTodaySection || (showTodaySection && todayLog)) && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           )}
           <Accordion type="multiple" className="w-full space-y-1">
               {previousLogsByDate.map(({ date, log }) => {
                    // Determine the target associated with the log, fallback to active if missing
                    const logTarget = targets.find(t => t.id === log.targetId);
                    const targetForCalc = logTarget ?? activeTarget; // Target used for UPH/Unit calculations for this log

                    return (
                    <AccordionItem value={date} key={date} className="border-b bg-muted/20 rounded-md">
                         <AccordionTrigger
                              className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50"
                              hideChevron // Use custom chevron placement
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <div className="flex-grow">
                                   {/* Pass the specific target for this log's summary */}
                                  <PreviousLogTriggerSummary log={log} displayTarget={targetForCalc} allTargets={targets} />
                                </div>
                                 {/* Chevron is now part of the trigger, controlled by hideChevron */}
                                 <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </div>
                            </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                            {/* Render detailed breakdown for all defined targets, calculated against log's context */}
                             {renderLogSummaryCard(log, false)}
                              {!targetForCalc && ( // Warning if log's target is missing
                                 <div className="mb-4 flex items-center gap-2 text-sm text-destructive px-2 py-1 bg-destructive/10 rounded-md">
                                     <AlertCircle className="h-4 w-4" />
                                     Target (ID: {log.targetId || 'None'}) associated with this log was not found. Metrics below use active target ({activeTarget?.name || 'None'}) as fallback.
                                 </div>
                             )}
                             {targets.length > 0 && targetForCalc ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {/* Iterate through all targets to show comparison cards, but use log's target for calculation */}
                                    {sortedTargetsByUPH.map(displayTarget => renderTargetMetricCard(log, targetForCalc, displayTarget, false))}
                                 </div>
                                ) : targets.length === 0 ? (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets defined.</p>
                                ) : (
                                     <p className="text-center text-destructive mt-4">Cannot calculate detailed metrics as the target for this log is missing and no active target is set.</p>
                                )}
                        </AccordionContent>
                    </AccordionItem>
                    );
                })}
           </Accordion>
        </div>
      )}

      {/* === Messages for No Data === */}
       {(!showTodaySection || !todayLog) && previousLogsByDate.length === 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
       {targets.length === 0 && (
           <p className="text-center text-muted-foreground">No UPH targets defined.</p>
       )}
    </div>
  );
};

export default TargetMetricsDisplay;
