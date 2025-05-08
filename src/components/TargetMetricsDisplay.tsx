
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, AlertCircle, Target as TargetIcon, CheckCircle } from 'lucide-react'; // Import icons
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
} from '@/components/ui/table';
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDateISO,
    formatFriendlyDate,
    calculateTimeAheadBehindSchedule,
    formatTimeAheadBehind,
    formatDurationFromMinutes,
    calculateCurrentMetrics,
    calculateProjectedGoalHitTime,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers
import { cn } from '@/lib/utils';


interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receives filtered and sorted logs from parent
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  setActiveUPHTargetAction?: (id: string) => void; // Optional: Action to set active target
  onGoalMet: (targetId: string, metAt: Date) => void; // Callback prop for goal met
  showTodaySection?: boolean;
}


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [], // Receives pre-filtered and pre-sorted logs
  targets = [],
  deleteWorkLogAction,
  setActiveUPHTargetAction, // Receive the action
  onGoalMet, // Use the new prop
  showTodaySection = true,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Derived state based on props
  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog> = {}; // Store only one log per date

    allWorkLogs.forEach(log => {
      if (showTodaySection && log.date === todayDateStr && !foundTodayLog) {
        foundTodayLog = log;
      } else if (log.date !== todayDateStr) {
         // Only store the first log found for a given previous date
         // (assuming parent component provides sorted data if needed)
         if (!prevLogsMap[log.date]) {
             prevLogsMap[log.date] = log;
         }
      }
    });

     // Convert map to array of { date, log } for easier mapping
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, log]) => ({ date, log })) // Take the single log per date
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending


    return { todayLog: showTodaySection ? foundTodayLog : null, previousLogsByDate: prevLogsGrouped };
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
    }, [showTodaySection, isClient]);

  // Effect to check for goal met and notify parent
  useEffect(() => {
    if (!showTodaySection || !currentTime || !todayLog || !isClient || !onGoalMet) {
        return;
    }

    const currentGoalMetTimes = todayLog.goalMetTimes || {};

    targets.forEach(target => {
        // Check if goal is met based on current metrics
        const { currentUnits } = calculateCurrentMetrics(todayLog, target, currentTime);
        const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, target.targetUPH);
        const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;

        // Check if a met time is already recorded IN THE CURRENT STATE for this target
        const isAlreadyRecorded = !!currentGoalMetTimes[target.id];

        if (isCurrentlyMet && !isAlreadyRecorded) {
            // Goal is met now, and wasn't recorded before in the current state
            // Notify the parent component to handle saving
            console.log(`Goal met detected for ${target.name}, notifying parent.`);
            onGoalMet(target.id, currentTime);
            // Parent component will handle saving and updating the todayLog prop
        }
    });

  // Ensure dependencies are correct. Depends on todayLog (and its goalMetTimes), targets, currentTime, etc.
  }, [todayLog, targets, currentTime, showTodaySection, isClient, onGoalMet, toast]);


  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (logId: string, logDateStr: string) => {
    // Confirm deletion using window.confirm for simplicity
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete the log for ${formatFriendlyDate(parse(logDateStr, 'yyyy-MM-dd', new Date()))}?`)) {
      return;
    }

    try {
      deleteWorkLogAction(logId);
      toast({ title: "Log Deleted", description: `Work log for ${formatFriendlyDate(parse(logDateStr, 'yyyy-MM-dd', new Date()))} has been deleted.`});
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
        let unitsToGoal = 0;

        // Check persisted goal met time first
        const goalMetTimeISO = log.goalMetTimes?.[target.id];
        const goalMetTime = goalMetTimeISO ? parse(goalMetTimeISO, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", new Date()) : null;
        const isGoalMet = goalMetTime && isValid(goalMetTime); // Check if valid date

        if (isGoalMet) {
            // Goal is permanently met according to saved data
            timeAheadBehindSeconds = 0; // Effectively on schedule or ahead
            projectedHitTimeFormatted = '-'; // No projection needed
            unitsToGoal = 0; // Goal is met

        } else if (isToday && currentTime) {
            // Goal not permanently met, calculate current status
            currentMetrics = calculateCurrentMetrics(log, target, currentTime);
            unitsToGoal = totalRequiredUnits - currentMetrics.currentUnits;
            timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime);
            projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime);

        } else if (!isToday) {
             // Previous log, calculate final status
            unitsToGoal = totalRequiredUnits - totalActualUnits; // Calculate final difference if needed
            timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, null); // Full day difference
            projectedHitTimeFormatted = '-';
        }
         unitsToGoal = parseFloat(unitsToGoal.toFixed(2));


        const scheduleStatusText = isGoalMet ? (
             <> <CheckCircle className="inline-block h-4 w-4 mr-1"/> Met </>
        ) : (
            formatTimeAheadBehind(timeAheadBehindSeconds) // Includes seconds
        );

        const scheduleStatusColor = isGoalMet ? "text-green-600 dark:text-green-500" :
                                     (timeAheadBehindSeconds !== null && timeAheadBehindSeconds >= 0 ? "text-green-600 dark:text-green-500" : // >= 0 for on schedule or ahead
                                     (timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 ? "text-red-600 dark:text-red-500" : ""));

        // Handler for clicking the card (only if it's today and setActiveUPHTargetAction is provided)
        const handleCardClick = () => {
             if (isToday && setActiveUPHTargetAction) {
                setActiveUPHTargetAction(target.id);
             }
        };


        return (
            <Card
                key={`${log.id}-${target.id}`}
                className={cn(
                    "flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200",
                    isToday && setActiveUPHTargetAction && "cursor-pointer hover:ring-2 hover:ring-primary/50", // Add cursor and hover ring if clickable
                    target.id === activeTarget?.id && isToday && "ring-2 ring-primary" // Highlight active target
                )}
                onClick={handleCardClick} // Add onClick handler
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                         {/* Display Units to Goal */}
                         <span className={cn(
                            "text-base font-medium",
                             isGoalMet ? 'text-green-600 dark:text-green-500' : (unitsToGoal <= 0 ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground') // Muted if not met yet
                        )}>
                           {isGoalMet ? (
                                <> <CheckCircle className="inline-block h-4 w-4 mr-1"/> Met </>
                           ) : (
                               `${unitsToGoal > 0 ? unitsToGoal.toFixed(2) : '0.00'} Units Left`
                           )}
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
                                <p className="text-muted-foreground">Current UPH</p>
                                <p className="font-medium tabular-nums">{currentMetrics.currentUPH.toFixed(2)}</p>
                             </div>
                            <div className="col-span-1">
                                <p className="text-muted-foreground">Schedule Status</p>
                                <p className={cn("font-medium tabular-nums", scheduleStatusColor)}>
                                    {scheduleStatusText}
                                    {/* Show met time only if goal is met */}
                                    {isGoalMet && goalMetTime ? ` at ${format(goalMetTime, 'h:mm:ss a')}` : ''}
                                    {/* Removed duplicate time display: !isGoalMet && timeAheadBehindSeconds !== null ? ` (${formatTimeAheadBehind(timeAheadBehindSeconds, true)})` : '' */}
                                </p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-muted-foreground">Est. Goal Hit Time</p>
                                <p className="font-medium tabular-nums">
                                    {/* Show projection only if goal is NOT met */}
                                    {isGoalMet ? '-' : projectedHitTimeFormatted}
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
                                <p className="text-muted-foreground">Schedule Result</p>
                                <p className={cn("font-medium tabular-nums", scheduleStatusColor)}>
                                    {scheduleStatusText}
                                    {/* Show met time only if goal is met */}
                                    {isGoalMet && goalMetTime ? ` at ${format(goalMetTime, 'h:mm:ss a')}` : ''}
                                    {/* Removed duplicate time display: !isGoalMet && timeAheadBehindSeconds !== null ? ` (${formatTimeAheadBehind(timeAheadBehindSeconds, true)})` : '' */}
                                </p>
                            </div>
                             {/* Conditionally show Avg Daily UPH only if not today */}
                              <div>
                                <p className="text-muted-foreground">Avg Daily UPH</p>
                                <p className="font-medium tabular-nums">{dailyUPHForTarget.toFixed(2)}</p>
                              </div>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    };


   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean) => {
        // Determine the target to use for the summary calculation
        const logTarget = targets.find(t => t.id === log.targetId);
        const targetForSummaryCalc = logTarget ?? activeTarget; // Fallback to active if log target missing

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
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date; // Fallback to raw string if invalid

        const totalUnits = targetForSummaryCalc ? calculateDailyUnits(log, targetForSummaryCalc) : 0;
        const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
        const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;


        return (
            <Card className="mb-4 relative shadow-sm"> {/* Added relative positioning */}
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
                       {/* Display Units Completed for previous logs OR Units Now for today */}
                       {targetForSummaryCalc && (
                           <div className="flex items-center space-x-2" title={`Units ${isToday ? 'Now' : 'Completed'} (Based on ${summaryTargetName})`}>
                               <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? 'Units Now' : `Units (${summaryTargetName})`}</p>
                                 <p className="text-lg font-semibold">
                                     {isToday && currentUnitsNow !== null ? currentUnitsNow.toFixed(2) : totalUnits.toFixed(2)}
                                 </p>
                              </div>
                           </div>
                       )}
                       {/* Display Avg/Current UPH */}
                       {summaryUPH !== null && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2" title={`${isToday ? 'Current' : 'Avg'} Daily UPH (Based on ${summaryTargetName})`}>
                               <Clock className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? 'Current Daily UPH' : `Avg UPH (${summaryTargetName})`}</p>
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

      {showTodaySection && todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

       {/* Render Previous Logs using Accordion */}
       {previousLogsByDate.length > 0 && (
         <div>
            {/* No need for title if this component is only for previous logs on that page */}
             <Accordion type="multiple" className="w-full space-y-1">
                {previousLogsByDate.map(({ date, log }) => ( // Destructure date and log
                    <AccordionItem value={log.id} key={log.id} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                         <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group data-[state=open]:bg-muted/50" hideChevron={false}>
                            {/* Pass all targets for calculation flexibility within summary */}
                             {/* Ensure content within AccordionTrigger is not a button itself */}
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
       {(!showTodaySection && previousLogsByDate.length === 0) && (
           <p className="text-center text-muted-foreground py-6">No previous work logs found.</p>
       )}
        {/* Message when today's log is hidden/missing AND no previous logs exist */}
        {(showTodaySection && !todayLog && previousLogsByDate.length === 0) && (
             <p className="text-center text-muted-foreground py-6">No work logs found.</p>
        )}
    </div>
  );
};

export default TargetMetricsDisplay;

