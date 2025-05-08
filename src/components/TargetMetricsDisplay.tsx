
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget, AuditLogActionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, AlertCircle, Target as TargetIcon, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'; // Import icons
import { useToast } from "@/hooks/use-toast";
import { parse, isValid, format, addMinutes, addDays, addSeconds } from 'date-fns'; // Added addSeconds
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'; // Keep Table components for potential future use or other contexts
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDateISO,
    formatFriendlyDate,
    calculateRemainingUnits,
    calculateTimeAheadBehindSchedule,
    formatTimeAheadBehind,
    calculateProjectedGoalHitTime,
    formatDurationFromMinutes,
    calculateCurrentMetrics,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers
import { cn } from '@/lib/utils';

// Define sortable columns type locally if needed or import from page
type SortableColumn = keyof Pick<DailyWorkLog, 'date' | 'hoursWorked' | 'documentsCompleted' | 'videoSessionsCompleted'> | 'avgUPH';
type SortDirection = 'asc' | 'desc';

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receives filtered and sorted logs from parent
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  showTodaySection?: boolean;
  // Removed sorting/table specific props as previous logs will use Accordion now
  // showSortingHeaders?: boolean;
  // currentSortColumn?: SortableColumn | null;
  // currentSortDirection?: SortDirection;
  // onSort?: (column: SortableColumn) => void;
  // renderSortIcon?: (column: SortableColumn) => React.ReactNode;
}


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [], // Receives pre-filtered and pre-sorted logs
  targets = [],
  deleteWorkLogAction,
  showTodaySection = true,
  // Removed sorting/table props from destructuring
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [todayGoalMetTimes, setTodayGoalMetTimes] = useState<Record<string, Date | null>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Derived state based on props
  const { todayLog, previousLogs } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogs: DailyWorkLog[] = [];

    allWorkLogs.forEach(log => {
      if (showTodaySection && log.date === todayDateStr && !foundTodayLog) {
        foundTodayLog = log;
      } else if (log.date !== todayDateStr) {
        prevLogs.push(log);
      }
    });

    // Parent component handles filtering and sorting, so we just use the passed logs.
    return {
      todayLog: showTodaySection ? foundTodayLog : null,
      previousLogs: prevLogs // Renamed from previousLogsByDate as it's just an array now
    };
  }, [allWorkLogs, showTodaySection]);


   // Timer effect to update currentTime every second
    useEffect(() => {
        if (typeof window !== 'undefined' && showTodaySection && isClient) {
            const timerId = setInterval(() => {
                setCurrentTime(new Date());
            }, 1000); // Update every second

            // Initial set
            setCurrentTime(new Date());

            return () => clearInterval(timerId); // Cleanup on unmount
        }
    }, [showTodaySection, isClient]); // Dependencies: only run when section visibility changes or on mount

  // Goal met time logic
  useEffect(() => {
    if (typeof window === 'undefined' || !showTodaySection || !currentTime || !todayLog || !isClient) {
        if (Object.keys(todayGoalMetTimes).length > 0) {
             setTodayGoalMetTimes({});
        }
        return;
    }

    let changed = false;
    const newMetTimes = { ...todayGoalMetTimes };

    targets.forEach(target => {
        const { currentUnits } = calculateCurrentMetrics(todayLog, target, currentTime);
        const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, target.targetUPH);
        const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;
        const wasPreviouslyMet = !!newMetTimes[target.id];

        if (isCurrentlyMet && !wasPreviouslyMet) {
            newMetTimes[target.id] = currentTime;
            changed = true;
        } else if (!isCurrentlyMet && wasPreviouslyMet) {
             // Keep the original met time even if data changes later
        }
    });

    if (changed) {
        setTodayGoalMetTimes(newMetTimes);
    }
  }, [todayLog, targets, currentTime, showTodaySection, isClient, todayGoalMetTimes]);


  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (logId: string, logDateStr: string) => {
    const formattedLogDate = formatFriendlyDate(parse(logDateStr, 'yyyy-MM-dd', new Date()));

    // Confirm deletion (optional, but good practice)
    // if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
    //   return;
    // }

    try {
      deleteWorkLogAction(logId);
      toast({ title: "Log Deleted", description: `Work log for ${formattedLogDate} has been deleted.`});
      // Parent component (PreviousLogsPage or Home) should handle reloading data.
    } catch (error) {
      console.error("Failed to delete work log:", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the work log." });
    }
  };


   const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
        const totalActualUnits = calculateDailyUnits(log, target);
        const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
        const dailyUPHForTarget = calculateDailyUPH(log, target);

        let projectedHitTimeFormatted = '-';
        let currentMetrics = { currentUnits: 0, currentUPH: 0 };
        let timeAheadBehindSeconds: number | null = null;
        const goalMetTimeForThisTarget = isToday && todayGoalMetTimes[target.id] ? todayGoalMetTimes[target.id] : null;
        let unitsToGoal = 0;

        let shiftEndDate: Date | null = null;
        if (log) {
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (timeRegex.test(log.startTime) && timeRegex.test(log.endTime)) {
                const parsedEndTime = parse(log.endTime, 'HH:mm', new Date());
                if (isValid(parsedEndTime)) {
                    const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
                    if (isValid(logDate)) {
                        shiftEndDate = new Date(logDate);
                        shiftEndDate.setHours(parsedEndTime.getHours());
                        shiftEndDate.setMinutes(parsedEndTime.getMinutes());
                        const parsedStartTime = parse(log.startTime, 'HH:mm', new Date());
                        if (isValid(parsedStartTime) && parsedEndTime < parsedStartTime) {
                            shiftEndDate = addDays(shiftEndDate, 1);
                        }
                    }
                }
            }
        }


        if (isToday && currentTime) {
            currentMetrics = calculateCurrentMetrics(log, target, currentTime);
            unitsToGoal = totalRequiredUnits - currentMetrics.currentUnits;
            timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime);

            if (goalMetTimeForThisTarget) {
                projectedHitTimeFormatted = '-'; // Goal met
            } else if (shiftEndDate) {
                projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, shiftEndDate);
            } else {
                 projectedHitTimeFormatted = 'Invalid Shift Times';
            }

        } else if (!isToday) {
            unitsToGoal = totalRequiredUnits - totalActualUnits;
            timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, null); // Full day difference
            projectedHitTimeFormatted = '-';
        }
        unitsToGoal = parseFloat(unitsToGoal.toFixed(2));

        const scheduleStatusText = goalMetTimeForThisTarget ? (
            <> <CheckCircle className="inline-block h-4 w-4 mr-1"/> Met at {format(goalMetTimeForThisTarget, 'h:mm:ss a')} </>
        ) : (
            formatTimeAheadBehind(timeAheadBehindSeconds)
        );
        const scheduleStatusColor = goalMetTimeForThisTarget ? "text-green-600 dark:text-green-500" :
                                     (timeAheadBehindSeconds !== null && timeAheadBehindSeconds > 0 ? "text-green-600 dark:text-green-500" :
                                     (timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 ? "text-red-600 dark:text-red-500" : ""));


        return (
            <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                        <span className={cn(
                            "text-base font-medium",
                            goalMetTimeForThisTarget ? 'text-green-600 dark:text-green-500' : (unitsToGoal <= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')
                        )}>
                           {goalMetTimeForThisTarget ? (
                                <> <CheckCircle className="inline-block h-4 w-4 mr-1"/> Met </>
                           ) : (
                               unitsToGoal > 0 ? `-${unitsToGoal.toFixed(2)}` : `+${Math.abs(unitsToGoal).toFixed(2)}`
                           )} Units
                        </span>
                    </div>
                    <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-0">
                    {isToday ? (
                        <>
                            <div>
                                <p className="text-muted-foreground">Units Now</p>
                                <p className="font-medium tabular-nums">{currentMetrics.currentUnits.toFixed(2)}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">Units to Goal</p>
                                <p className="font-medium tabular-nums">
                                     {goalMetTimeForThisTarget ? (
                                         <> <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met </>
                                     ) : (
                                         unitsToGoal > 0 ? unitsToGoal.toFixed(2) : '0.00'
                                     )}
                                 </p>
                             </div>
                             <div>
                                <p className="text-muted-foreground">Current UPH</p>
                                <p className="font-medium tabular-nums">{currentMetrics.currentUPH.toFixed(2)}</p>
                             </div>
                            <div>
                                <p className="text-muted-foreground">Schedule Status</p>
                                <p className={cn("font-medium tabular-nums", scheduleStatusColor)}>
                                    {scheduleStatusText}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-muted-foreground">Est. Goal Hit Time</p>
                                <p className="font-medium tabular-nums">
                                    {projectedHitTimeFormatted}
                                </p>
                            </div>
                        </>
                    ) : ( // Previous Logs
                        <>
                            <div>
                                <p className="text-muted-foreground">Units Completed</p>
                                <p className="font-medium tabular-nums">{totalActualUnits.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Avg Daily UPH</p>
                                <p className="font-medium tabular-nums">{dailyUPHForTarget.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Target Units</p>
                                <p className="font-medium tabular-nums">{totalRequiredUnits.toFixed(2)}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">Schedule Result</p>
                                <p className={cn("font-medium tabular-nums", scheduleStatusColor)}>
                                    {scheduleStatusText}
                                </p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    };


   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean) => {
        const logTarget = targets.find(t => t.id === log.targetId);
        const targetForSummaryCalc = logTarget ?? activeTarget;

        let summaryUPH: number | null = null;
        let currentUnitsNow: number | null = null;

        if (targetForSummaryCalc) {
            if (isToday && currentTime && isClient) {
                const metrics = calculateCurrentMetrics(log, targetForSummaryCalc, currentTime);
                summaryUPH = metrics.currentUPH; // UPH based on time elapsed so far
                currentUnitsNow = metrics.currentUnits;
            } else if (!isToday) {
                summaryUPH = calculateDailyUPH(log, targetForSummaryCalc); // Avg UPH for the whole day
            }
        }

        const summaryTargetName = targetForSummaryCalc ? targetForSummaryCalc.name : 'N/A';
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;
        const totalUnits = targetForSummaryCalc ? calculateDailyUnits(log, targetForSummaryCalc) : 0;
        const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
        const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;


        return (
            <Card className="mb-4 relative shadow-sm">
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime})
                                <br/>
                                Break: {breakTimeFormatted}
                                {trainingTimeFormatted && ` | Training: ${trainingTimeFormatted}`}
                                {targetForSummaryCalc && ` (Context: ${summaryTargetName})`}
                                {!targetForSummaryCalc && targets.length > 0 && <span className="text-destructive ml-2">(Log target missing, no active target)</span>}
                                {!targetForSummaryCalc && targets.length === 0 && <span className="text-muted-foreground ml-2">(No targets defined)</span>}
                            </CardDescription>
                         </div>
                         {/* Delete button moved to AccordionTrigger/Summary component */}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                     <div className="flex items-center space-x-2" title="Documents Completed">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Docs</p>
                            <p className="text-lg font-semibold">{log.documentsCompleted}</p>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2" title="Video Sessions Completed">
                         <Video className="h-5 w-5 text-muted-foreground" />
                         <div>
                             <p className="text-sm text-muted-foreground">Videos</p>
                             <p className="text-lg font-semibold">{log.videoSessionsCompleted}</p>
                         </div>
                     </div>
                      {/* Display Units Completed for previous logs */}
                       {!isToday && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2" title={`Units Completed (Based on ${summaryTargetName})`}>
                               <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{totalUnits.toFixed(2)}</p>
                              </div>
                           </div>
                       )}
                       {/* Display Avg Daily UPH for previous logs */}
                       {!isToday && summaryUPH !== null && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2" title={`Avg Daily UPH (Based on ${summaryTargetName})`}>
                               <Clock className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Avg UPH ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{summaryUPH.toFixed(2)}</p>
                              </div>
                           </div>
                       )}
                       {/* Display Current Daily UPH for today's log */}
                      {isToday && summaryUPH !== null && targetForSummaryCalc && (
                         <div className="flex items-center space-x-2" title={`Current Daily UPH (Based on ${summaryTargetName})`}>
                             <Clock className="h-5 w-5 text-muted-foreground" />
                             <div>
                                 <p className="text-sm text-muted-foreground">Current Daily UPH</p>
                                 <p className="text-lg font-semibold">{summaryUPH.toFixed(2)}</p>
                             </div>
                         </div>
                     )}
                 </CardContent>
                 {log.notes && (
                    <CardFooter className="pt-3">
                        <p className="text-sm text-muted-foreground italic">Notes: {log.notes}</p>
                    </CardFooter>
                 )}
            </Card>
        );
   }

  if (!isClient) {
     return <div className="p-4 text-center text-muted-foreground">Loading metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {showTodaySection && todayLog && (
        <div>
          {renderLogSummaryCard(todayLog, true)}
           {targets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTargetsByUPH.map((target) => renderTargetMetricCard(todayLog, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {showTodaySection && todayLog && previousLogs.length > 0 && <Separator className="my-6" />}

       {/* Render Previous Logs using Accordion */}
       {previousLogs.length > 0 && (
         <div>
            {/* No need for title if this component is only for previous logs on that page */}
             <Accordion type="multiple" className="w-full space-y-1">
                {previousLogs.map((log) => (
                    <AccordionItem value={log.id} key={log.id} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                        <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group data-[state=open]:bg-muted/50" hideChevron={false}>
                            {/* Pass all targets for calculation flexibility within summary */}
                            <PreviousLogTriggerSummary log={log} allTargets={targets} onDelete={() => handleDeleteLog(log.id, log.date)} />
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                            {/* Display the main summary card first */}
                            {renderLogSummaryCard(log, false)}
                            {/* Then display breakdown against each target */}
                            {targets.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {sortedTargetsByUPH.map(displayTarget => renderTargetMetricCard(log, displayTarget, false))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground mt-4">No UPH targets defined.</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
         </div>
       )}

       {/* Message when no logs are available AT ALL (excluding today if showTodaySection is true) */}
       {(!showTodaySection && previousLogs.length === 0) && (
           <p className="text-center text-muted-foreground py-6">No previous work logs found.</p>
       )}
        {/* Message when today's log is hidden/missing AND no previous logs exist */}
        {(showTodaySection && !todayLog && previousLogs.length === 0) && (
             <p className="text-center text-muted-foreground py-6">No work logs found.</p>
        )}
    </div>
  );
};

export default TargetMetricsDisplay;

