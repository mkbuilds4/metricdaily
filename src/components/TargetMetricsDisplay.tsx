
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, AlertCircle, Target as TargetIcon, CheckCircle, Brain } from 'lucide-react'; // Import icons, added Brain
import { useToast } from "@/hooks/use-toast";
import { parse, isValid, format, addMinutes, addDays, addSeconds, parseISO, isBefore, startOfDay } from 'date-fns'; // Added addSeconds, parseISO, isBefore, startOfDay
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
    calculateProjectedGoalHitTime, // Import new function
    formatDateISO,
    formatFriendlyDate,
    calculateTimeAheadBehindSchedule,
    formatTimeAheadBehind,
    formatDurationFromMinutes,
    calculateCurrentMetrics,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers
import { cn } from '@/lib/utils';


interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receives filtered and sorted logs from parent (or all logs from Home)
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  setActiveUPHTargetAction?: (id: string) => void; // Optional: Action to set active target
  onGoalMet: (targetId: string, metAt: Date) => void; // Callback prop for goal met
  showTodaySection?: boolean;
}


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [], // Receives pre-filtered and pre-sorted logs (from PreviousLogs) OR all logs (from Home)
  targets = [],
  deleteWorkLogAction,
  setActiveUPHTargetAction, // Receive the action
  onGoalMet, // Use the new prop
  showTodaySection = true, // Defaults to true (for Home page)
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

   // Active target calculation based on props
  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);

  // Derived state based on props and whether to show today's section
  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    const todayStart = startOfDay(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog> = {}; // Store only one log per date

    allWorkLogs.forEach(log => {
        const logDateObj = parseISO(log.date + 'T00:00:00');
        if (!isValid(logDateObj)) return; // Skip invalid dates

        // Check if it's today and should be shown in today section (and is not finalized)
        if (showTodaySection && log.date === todayDateStr && !log.isFinalized && !foundTodayLog) {
            foundTodayLog = log;
        }
        // Check if it's a previous day OR today but finalized (belongs in previous logs)
        else if (isBefore(logDateObj, todayStart) || (log.date === todayDateStr && log.isFinalized)) {
             if (!prevLogsMap[log.date]) { // Only add if not already added for that date
                prevLogsMap[log.date] = log;
            }
        }
    });

     // Convert map to array of { date, log } for easier mapping
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, log]) => ({ date, log })) // Use the log directly
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
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
  }, [todayLog, targets, currentTime, showTodaySection, isClient, onGoalMet]);


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
        const goalMetTime = goalMetTimeISO ? parseISO(goalMetTimeISO) : null; // Use parseISO
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
            // Calculate projected time based on SCHEDULED end time adjusted by time diff
             projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime);

        } else if (!isToday) {
             // Previous log, calculate final status
            unitsToGoal = totalRequiredUnits - totalActualUnits; // Calculate final difference if needed
            timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, null); // Full day difference
            projectedHitTimeFormatted = '-';
        }
         unitsToGoal = parseFloat(unitsToGoal.toFixed(2));


         const scheduleStatusText = isGoalMet ? (
             <> <CheckCircle className="inline-block h-4 w-4 mr-1"/> </> // Only show checkmark if met
         ) : (
             formatTimeAheadBehind(timeAheadBehindSeconds) // Includes seconds if not met
         );

         const scheduleStatusColor = isGoalMet ? "text-green-600 dark:text-green-500" :
                                      (timeAheadBehindSeconds !== null && timeAheadBehindSeconds >= 0 ? "text-green-600 dark:text-green-500" : // >= 0 for on schedule or ahead
                                      (timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 ? "text-red-600 dark:text-red-500" : ""));

        // Handler for clicking the card (only if it's today and setActiveUPHTargetAction is provided)
        const handleCardClick = () => {
             // Prevent update if the target is already active
             if (isToday && setActiveUPHTargetAction && target.id !== activeTarget?.id) {
                setActiveUPHTargetAction(target.id);
             }
        };


        return (
            <Card
                key={`${log.id}-${target.id}`}
                className={cn(
                    "flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200",
                    // Make clickable only if today and action is available AND not already active
                    isToday && setActiveUPHTargetAction && target.id !== activeTarget?.id && "cursor-pointer hover:ring-2 hover:ring-primary/50",
                    target.id === activeTarget?.id && isToday && "ring-2 ring-primary" // Highlight active target
                )}
                // Only add onClick if action is available and it's today
                {...(isToday && setActiveUPHTargetAction && { onClick: handleCardClick })}
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
                                </p>
                            </div>
                              <div>
                                <p className="text-muted-foreground">Avg Daily UPH</p>
                                <p className="font-medium tabular-nums">{dailyUPHForTarget.toFixed(2)}</p>
                              </div>
                              {/* Display Units Left/Surplus for previous logs */}
                                <div>
                                    <p className="text-muted-foreground">Units vs Goal</p>
                                    <p className={cn("font-medium tabular-nums", unitsToGoal <= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>
                                        {unitsToGoal <= 0 ? `+${Math.abs(unitsToGoal).toFixed(2)}` : `-${unitsToGoal.toFixed(2)}`}
                                    </p>
                                </div>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    };



  if (!isClient) {
     return <div className="p-4 text-center text-muted-foreground">Loading metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {showTodaySection && todayLog && (
        <div>
          {/* Pass all targets to the summary */}
          <PreviousLogTriggerSummary log={todayLog} allTargets={targets} activeTarget={activeTarget} onDelete={() => handleDeleteLog(todayLog.id, todayLog.date)} />
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
             <Accordion type="multiple" className="w-full space-y-1">
                {previousLogsByDate.map(({ date, log }) => ( // Destructure date and log
                    <AccordionItem value={log.id} key={log.id} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                        <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group data-[state=open]:bg-muted/50 hover:no-underline" hideChevron={true} asChild={false}>
                             {/* Pass activeTarget and allTargets to the trigger component */}
                             <PreviousLogTriggerSummary log={log} allTargets={targets} activeTarget={activeTarget} onDelete={() => handleDeleteLog(log.id, log.date)} />
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                            {/* Display the main summary card first */}
                             <PreviousLogTriggerSummary log={log} allTargets={targets} activeTarget={activeTarget} onDelete={() => handleDeleteLog(log.id, log.date)} isExpanded={true} />
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

