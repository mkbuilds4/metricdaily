'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, ChevronDown, ArrowUp, ArrowDown, Minus as MinusIcon, AlertCircle, Target as TargetIcon, Brain, CheckCircle } from 'lucide-react'; // Added CheckCircle
import { useToast } from "@/hooks/use-toast";
import { parse, isValid, format, addMinutes, addDays } from 'date-fns'; 
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
    calculateProjectedGoalHitTime,
    formatDurationFromMinutes, 
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; 
import { cn } from '@/lib/utils';


interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  showTodaySection?: boolean;
  paginatePreviousLogs?: boolean; 
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
  // Store goal met times for today's log, per target
  const [todayGoalMetTimes, setTodayGoalMetTimes] = useState<Record<string, Date | null>>({});


  useEffect(() => {
     if (typeof window !== 'undefined') {
         const now = new Date();
         setCurrentTime(now);

         // Initial check for goal met status for today's log
         const todayDateStr = formatDateISO(now);
         const currentTodayLog = allWorkLogs.find(log => log.date === todayDateStr);
         if (currentTodayLog && showTodaySection) {
            const newMetTimes: Record<string, Date | null> = {};
            targets.forEach(target => {
                if (!todayGoalMetTimes[target.id]) { // Only if not already met
                    const { currentUnits } = calculateCurrentMetrics(currentTodayLog, target, now);
                    const targetUnitsForShift = calculateRequiredUnitsForTarget(currentTodayLog.hoursWorked, target.targetUPH);
                    if (currentUnits >= targetUnitsForShift && targetUnitsForShift > 0) {
                        newMetTimes[target.id] = now;
                    } else {
                        newMetTimes[target.id] = null;
                    }
                } else {
                    newMetTimes[target.id] = todayGoalMetTimes[target.id];
                }
            });
            setTodayGoalMetTimes(newMetTimes);
         }


         const timerId = setInterval(() => {
             const newNow = new Date();
             setCurrentTime(newNow);
             // Update goal met status on interval for today's log
             const currentTodayLogForInterval = allWorkLogs.find(log => log.date === formatDateISO(newNow));
             if (currentTodayLogForInterval && showTodaySection) {
                const updatedMetTimes: Record<string, Date | null> = {...todayGoalMetTimes};
                targets.forEach(target => {
                    // Only set the met time if it hasn't been set before for this target.
                    if (!updatedMetTimes[target.id]) { 
                        const { currentUnits } = calculateCurrentMetrics(currentTodayLogForInterval, target, newNow);
                        const targetUnitsForShift = calculateRequiredUnitsForTarget(currentTodayLogForInterval.hoursWorked, target.targetUPH);
                        if (currentUnits >= targetUnitsForShift && targetUnitsForShift > 0) {
                            updatedMetTimes[target.id] = newNow; // Lock in the time
                        }
                    }
                });
                setTodayGoalMetTimes(updatedMetTimes);
             }
         }, 1000); 
         return () => clearInterval(timerId);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWorkLogs, targets, showTodaySection]); // Removed todayGoalMetTimes from deps to avoid potential loop issues, initial check handles it.


  useEffect(() => {
    // Reset goalMetTimes if the log or targets change, or if a new day starts
     setTodayGoalMetTimes({});
  }, [allWorkLogs, targets]);


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
                     // Ensure only one log per date for previous logs (the most relevant one if multiple exist, though ideally there shouldn't be)
                     if (prevLogsMap[log.date].length === 0) { // Only push if no log for this date yet
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
                                .map(([date, logsForDateArray]) => ({ date, log: logsForDateArray[0] })) // logsForDateArray[0] since we only push one
                                .sort((a, b) => b.date.localeCompare(a.date)); 

    return {
        todayLog: showTodaySection ? foundTodayLog : null,
        previousLogsByDate: prevLogsGrouped
    };
  }, [allWorkLogs, showTodaySection]);

  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      toast({ title: "Log Deleted", description: `Work log for ${formattedLogDate} has been deleted.`});
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


       if (isToday && currentTime) {
           currentMetrics = calculateCurrentMetrics(log, target, currentTime);
           unitsToGoal = totalRequiredUnits - currentMetrics.currentUnits;
           if (goalMetTimeForThisTarget) {
               timeAheadBehindSeconds = 0; // Consider on schedule or met
               projectedHitTimeFormatted = `Met at ${format(goalMetTimeForThisTarget, 'h:mm:ss a')}`;
           } else {
               timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime); 
               projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime);
           }
       } else if (!isToday) {
           unitsToGoal = totalRequiredUnits - totalActualUnits;
       }
       unitsToGoal = parseFloat(unitsToGoal.toFixed(2));


      const isBehindSchedule = !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0;
      const isAheadSchedule = !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds > 0;
      const isOnSchedule = !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && Math.abs(timeAheadBehindSeconds) < 1; 


      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle> 
                     {!isToday && (
                         <span className={cn(
                            "text-base font-medium",
                             (totalActualUnits - totalRequiredUnits) < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'
                            )}>
                            {((totalActualUnits - totalRequiredUnits) >= 0 ? '+' : '') + (totalActualUnits - totalRequiredUnits).toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? (
                     <>
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium tabular-nums">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Units to Goal</p>
                            <p className="font-medium tabular-nums">
                                {unitsToGoal > 0 ? unitsToGoal.toFixed(2) : (
                                    <>
                                        <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met
                                    </>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium tabular-nums">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Schedule Status</p>
                            <p className={cn("font-medium tabular-nums", 
                                goalMetTimeForThisTarget && "text-green-600 dark:text-green-500",
                                isAheadSchedule && "text-green-600 dark:text-green-500", 
                                isBehindSchedule && "text-red-600 dark:text-red-500", 
                                isOnSchedule && "text-foreground")}>
                                {goalMetTimeForThisTarget ? <CheckCircle className="inline-block h-4 w-4 mr-1"/> :formatTimeAheadBehind(timeAheadBehindSeconds)} 
                                {goalMetTimeForThisTarget && `at ${format(goalMetTimeForThisTarget, 'h:mm:ss a')}`}
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
                         <p className="text-muted-foreground">Units to Goal</p>
                          <p className={"font-medium tabular-nums"}>
                             {unitsToGoal > 0 ? unitsToGoal.toFixed(2) : (
                                <>
                                    <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met/Exceeded
                                </>
                             )}
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
            if (isToday && currentTime) {
                const metrics = calculateCurrentMetrics(log, targetForSummaryCalc, currentTime);
                summaryUPH = metrics.currentUPH;
                currentUnitsNow = metrics.currentUnits; 
            } else if (!isToday) {
                summaryUPH = calculateDailyUPH(log, targetForSummaryCalc);
            }
        }

        const summaryTargetName = targetForSummaryCalc ? targetForSummaryCalc.name : 'N/A';
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;
        const totalUnits = targetForSummaryCalc ? calculateDailyUnits(log, targetForSummaryCalc) : 0;
        const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
        const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;


        return (
            <Card className="mb-4 relative"> 
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
                 <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"> 
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
                      {isToday && currentUnitsNow !== null && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                                <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Now ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{currentUnitsNow.toFixed(2)}</p>
                              </div>
                           </div>
                      )}
                       {!isToday && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                               <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Completed ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{totalUnits.toFixed(2)}</p>
                              </div>
                           </div>
                       )}
                     {summaryUPH !== null && targetForSummaryCalc && (
                         <div className="flex items-center space-x-2">
                             <Clock className="h-5 w-5 text-muted-foreground" />
                             <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? `Current Daily UPH` : `Avg Daily UPH`} ({summaryTargetName})</p>
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

      {previousLogsByDate.length > 0 && (
        <div>
           {(!showTodaySection || (showTodaySection && !todayLog)) && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           )}
           <Accordion type="multiple" className="w-full space-y-1">
               {previousLogsByDate.map(({ date, log }) => {
                    const logTarget = targets.find(t => t.id === log.targetId);
                    const targetForCalc = logTarget ?? activeTarget; 

                    return (
                    <AccordionItem value={date} key={date} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                           <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50" asChild>
                               <div className="flex items-center justify-between w-full">
                                   <PreviousLogTriggerSummary log={log} allTargets={targets} onDelete={() => handleDeleteLog(log)} />
                                   <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                               </div>
                           </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                             {renderLogSummaryCard(log, false)}
                              {!logTarget && targetForCalc && ( 
                                 <div className="mb-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 px-2 py-1 bg-orange-500/10 rounded-md">
                                     <AlertCircle className="h-4 w-4" />
                                     Target (ID: {log.targetId || 'None'}) associated with this log was not found. Metrics below use {targetForCalc === activeTarget ? `active target (${activeTarget?.name || 'None'})` : 'first available target'} as fallback.
                                 </div>
                              )}
                              {!logTarget && !targetForCalc && targets.length > 0 && ( 
                                <div className="mb-4 flex items-center gap-2 text-sm text-destructive px-2 py-1 bg-destructive/10 rounded-md">
                                     <AlertCircle className="h-4 w-4" />
                                     Target (ID: {log.targetId || 'None'}) not found, and no active target set. Cannot calculate target-specific metrics accurately.
                                 </div>
                              )}
                             {targets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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

       {(!showTodaySection || !todayLog) && previousLogsByDate.length === 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
    </div>
  );
};

export default TargetMetricsDisplay;