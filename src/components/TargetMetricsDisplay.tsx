
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, ChevronDown, ArrowUp, ArrowDown, Minus as MinusIcon, AlertCircle, Target as TargetIcon } from 'lucide-react';
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
    calculateCurrentMetrics, // Import the new function
    calculateTimeAheadBehindSchedule, // Import the schedule calculation function
    formatTimeAheadBehind, // Import the formatting function
    calculateProjectedGoalHitTime, // Use the updated calculation
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers
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
    // Ensure this runs only on the client
     if (typeof window !== 'undefined') {
         setCurrentTime(new Date());
         const timerId = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
         return () => clearInterval(timerId);
     }
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
                     // Ensure only one log per date is stored for previous logs summary/accordion
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

    // Group previous logs by date, taking only the first log entry for that date
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logsForDate]) => ({ date, log: logsForDate[0] })) // Assign the first log to 'log' property
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending

    return {
        todayLog: showTodaySection ? foundTodayLog : null,
        previousLogsByDate: prevLogsGrouped
    };
  }, [allWorkLogs, showTodaySection]);

  // Memoize active target finding
  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  // Memoize sorted targets by UPH for consistent display order within days
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;

    // Replace confirm with ShadCN AlertDialog if needed
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


  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      // Always calculate based on the specific target for this card
      const totalActualUnits = calculateDailyUnits(log, target);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      const totalDifferenceUnits = totalActualUnits - totalRequiredUnits;
      const dailyUPHForTarget = calculateDailyUPH(log, target);

      let projectedHitTimeFormatted = '-';
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };
      let timeAheadBehindMinutes: number | null = null;

       if (isToday && currentTime) {
           // Use the target FOR THIS CARD for real-time projections
           currentMetrics = calculateCurrentMetrics(log, target, currentTime);
           // Calculate schedule status relative to THIS card's target
           timeAheadBehindMinutes = calculateTimeAheadBehindSchedule(log, target, currentTime);
           projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, timeAheadBehindMinutes);

           // Check if goal is already met relative to THIS card's target
           if (currentMetrics.currentUnits >= totalRequiredUnits) {
               projectedHitTimeFormatted = 'Goal Met';
           }
       }

      const isBehindSchedule = timeAheadBehindMinutes !== null && timeAheadBehindMinutes < 0;
      const isAheadSchedule = timeAheadBehindMinutes !== null && timeAheadBehindMinutes > 0;
      const isOnSchedule = timeAheadBehindMinutes !== null && Math.abs(timeAheadBehindMinutes) < 0.05; // Use tolerance for float comparison


      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle> {/* Show Target Name */}
                    {/* Previous Days: Show +/- vs Goal */}
                     {!isToday && (
                         <span className={cn(
                            "text-base font-medium",
                             totalDifferenceUnits < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'
                            )}>
                            {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? (
                     <>
                        {/* Today: Units Now and Schedule */}
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Schedule Status</p>
                            <p className={cn("font-medium", isAheadSchedule && "text-green-600 dark:text-green-500", isBehindSchedule && "text-red-600 dark:text-red-500", isOnSchedule && "text-foreground")}>
                                {formatTimeAheadBehind(timeAheadBehindMinutes)}
                             </p>
                         </div>
                         {/* Est. Goal Hit Time Display */}
                         <div className="col-span-2">
                             <p className="text-muted-foreground">Est. Goal Hit Time</p>
                             <p className="font-medium">
                                {projectedHitTimeFormatted}
                             </p>
                         </div>
                    </>
                 ) : (
                     <>
                        {/* Previous: Show completed units and avg UPH */}
                       <div>
                           <p className="text-muted-foreground">Units Completed</p>
                           <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                       </div>
                       <div>
                            <p className="text-muted-foreground">Avg Daily UPH</p>
                            <p className="font-medium">{dailyUPHForTarget.toFixed(2)}</p>
                       </div>
                       <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">+/- Goal</p>
                          <p className={cn(
                            "font-medium",
                             totalDifferenceUnits < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'
                          )}>
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
        // Find the specific target associated with this log
        const logTarget = targets.find(t => t.id === log.targetId);
        // Use the log's own target if available, otherwise use the active one for context
        const targetForSummaryCalc = logTarget ?? activeTarget;

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
        const totalUnits = targetForSummaryCalc ? calculateDailyUnits(log, targetForSummaryCalc) : 0;


        return (
            <Card className="mb-4 relative"> {/* Added relative positioning for delete button */}
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime}, {log.breakDurationMinutes} min break)
                                {/* Indicate which target is being used for the overall summary calculation */}
                                {targetForSummaryCalc && ` (Context: ${summaryTargetName})`}
                                {/* Warning if NO target could be determined for summary */}
                                {!targetForSummaryCalc && targets.length > 0 && <span className="text-destructive ml-2">(Log target missing, no active target)</span>}
                                {!targetForSummaryCalc && targets.length === 0 && <span className="text-muted-foreground ml-2">(No targets defined)</span>}
                            </CardDescription>
                         </div>
                          {/* Delete button only shown for previous logs inside the Accordion content */}
                           {!isToday && (
                             <div className="absolute top-2 right-2">
                                 <Button
                                     variant="ghost"
                                     size="icon"
                                     className="text-destructive hover:text-destructive h-7 w-7"
                                     onClick={(e) => { e.stopPropagation(); handleDeleteLog(log); }}
                                     title="Delete This Log"
                                     aria-label="Delete This Log"
                                 >
                                     <Trash2 className="h-4 w-4" />
                                 </Button>
                             </div>
                           )}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"> {/* Responsive grid */}
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
                                <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Now ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{currentUnitsNow.toFixed(2)}</p>
                              </div>
                           </div>
                      )}
                      {/* Previous Only: Total Units Completed */}
                       {!isToday && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                               <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Completed ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{totalUnits.toFixed(2)}</p>
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
                {/* Today's breakdown: Pass today's log and each target */}
                {sortedTargetsByUPH.map((target) => renderTargetMetricCard(todayLog, target, true))}
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
           {/* Conditional title based on whether today's section is shown */}
           {(!showTodaySection || (showTodaySection && !todayLog)) && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           )}
           <Accordion type="multiple" className="w-full space-y-1">
               {previousLogsByDate.map(({ date, log }) => {
                    // Determine the target associated with the log, fallback to active if missing
                    const logTarget = targets.find(t => t.id === log.targetId);
                    const targetForCalc = logTarget ?? activeTarget; // Target used for UPH/Unit calculations for this log's context

                    return (
                    <AccordionItem value={date} key={date} className="border-none bg-muted/20 rounded-md overflow-hidden">
                           <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50" asChild>
                               <div className="flex items-center justify-between w-full">
                                   <PreviousLogTriggerSummary log={log} allTargets={targets} onDelete={handleDeleteLog} />
                                   <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                               </div>
                           </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                            {/* Render detailed breakdown for all defined targets, calculated against log's context */}
                             {renderLogSummaryCard(log, false)}
                              {!logTarget && targetForCalc && ( // Warning if log's specific target is missing, but we have a fallback
                                 <div className="mb-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 px-2 py-1 bg-orange-500/10 rounded-md">
                                     <AlertCircle className="h-4 w-4" />
                                     Target (ID: {log.targetId || 'None'}) associated with this log was not found. Metrics below use {targetForCalc === activeTarget ? `active target (${activeTarget?.name || 'None'})` : 'first available target'} as fallback.
                                 </div>
                             )}
                              {!logTarget && !targetForCalc && targets.length > 0 && ( // Warning if log target missing AND no fallback
                                <div className="mb-4 flex items-center gap-2 text-sm text-destructive px-2 py-1 bg-destructive/10 rounded-md">
                                     <AlertCircle className="h-4 w-4" />
                                     Target (ID: {log.targetId || 'None'}) not found, and no active target set. Cannot calculate target-specific metrics accurately.
                                 </div>
                              )}
                             {targets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {/* Iterate through all targets to show comparison cards, using targetForCalc for calculations */}
                                    {sortedTargetsByUPH.map(displayTarget => renderTargetMetricCard(log, displayTarget, false))}
                                 </div>
                                ) : (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets defined.</p>
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
    </div>
  );
};

export default TargetMetricsDisplay;
