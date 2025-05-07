'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, ChevronDown, ArrowUp, ArrowDown, Minus as MinusIcon, AlertCircle, Target as TargetIcon, Brain, CheckCircle } from 'lucide-react';
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
    calculateTimeAheadBehindSchedule, 
    formatTimeAheadBehind, 
    calculateProjectedGoalHitTime,
    formatDurationFromMinutes, 
    calculateCurrentMetrics,
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

const ITEMS_PER_PAGE_PREVIOUS = 5;


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
  showTodaySection = true,
  paginatePreviousLogs = false,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [todayGoalMetTimes, setTodayGoalMetTimes] = useState<Record<string, Date | null>>({});
  const [previousLogsCurrentPage, setPreviousLogsCurrentPage] = useState(1);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
                     // Ensure only one log per date for previous logs display structure
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

    // Convert map to array of {date, log} objects
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logsForDateArray]) => ({ date, log: logsForDateArray[0] })) 
                                .sort((a, b) => b.date.localeCompare(a.date)); 

    return {
        todayLog: showTodaySection ? foundTodayLog : null,
        previousLogsByDate: prevLogsGrouped
    };
  }, [allWorkLogs, showTodaySection]);


  useEffect(() => {
    if (typeof window !== 'undefined' && showTodaySection && isClient) {
        setCurrentTime(new Date()); 
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timerId);
    }
  }, [showTodaySection, isClient]);

  useEffect(() => {
    if (typeof window === 'undefined' || !showTodaySection || !currentTime || !todayLog || !isClient) {
        if (Object.keys(todayGoalMetTimes).length > 0) {
            setTodayGoalMetTimes({});
        }
        return;
    }

    const newMetTimes = { ...todayGoalMetTimes };
    let changed = false;

    targets.forEach(target => {
        const { currentUnits } = calculateCurrentMetrics(todayLog, target, currentTime);
        const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, target.targetUPH);
        const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;
        const wasPreviouslyMet = !!newMetTimes[target.id];

        if (isCurrentlyMet && !wasPreviouslyMet) {
            newMetTimes[target.id] = currentTime; 
            changed = true;
        } else if (!isCurrentlyMet && wasPreviouslyMet) {
            newMetTimes[target.id] = null;
            changed = true;
        }
    });

    if (changed) {
        setTodayGoalMetTimes(newMetTimes);
    }
  }, [todayLog, targets, currentTime, showTodaySection, todayGoalMetTimes, isClient]);


  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;

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


  const paginatedPreviousLogs = useMemo(() => {
    if (!paginatePreviousLogs) {
      return previousLogsByDate;
    }
    const startIndex = (previousLogsCurrentPage - 1) * ITEMS_PER_PAGE_PREVIOUS;
    const endIndex = startIndex + ITEMS_PER_PAGE_PREVIOUS;
    return previousLogsByDate.slice(startIndex, endIndex);
  }, [previousLogsByDate, previousLogsCurrentPage, paginatePreviousLogs]);

  const totalPreviousLogPages = paginatePreviousLogs ? Math.ceil(previousLogsByDate.length / ITEMS_PER_PAGE_PREVIOUS) : 1;


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
               timeAheadBehindSeconds = 0; 
               projectedHitTimeFormatted = '-'; // Show '-' when goal is met
           } else {
               timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime); 
               projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime);
           }
       } else if (!isToday) {
           unitsToGoal = totalRequiredUnits - totalActualUnits;
       }
       unitsToGoal = parseFloat(unitsToGoal.toFixed(2));


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
                                !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds > 0 && "text-green-600 dark:text-green-500", 
                                !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 && "text-red-600 dark:text-red-500"
                                )}>
                                {goalMetTimeForThisTarget ? (
                                    <>
                                        <CheckCircle className="inline-block h-4 w-4 mr-1"/> 
                                        {`Met at ${format(goalMetTimeForThisTarget, 'h:mm:ss a')}`}
                                    </>
                                ) : (
                                    formatTimeAheadBehind(timeAheadBehindSeconds)
                                )}
                             </p>
                         </div>
                         <div className="col-span-2">
                             <p className="text-muted-foreground">Est. Goal Hit Time</p>
                             <p className="font-medium tabular-nums">
                                {projectedHitTimeFormatted}
                             </p>
                         </div>
                    </>
                 ) : ( 
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
                         <p className="text-muted-foreground">Units vs Goal</p>
                          <p className={cn(
                            "font-medium tabular-nums",
                            unitsToGoal > 0 && "text-red-600 dark:text-red-500", // Behind, need more units
                            unitsToGoal <= 0 && "text-green-600 dark:text-green-500" // Met or ahead
                          )}>
                             {unitsToGoal > 0 ? `-${unitsToGoal.toFixed(2)}` : ( // If positive, means user is short
                                <>
                                    <CheckCircle className="inline-block h-4 w-4 mr-1"/> {unitsToGoal === 0 ? 'Met' : `+${Math.abs(unitsToGoal).toFixed(2)}`}
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
            if (isToday && currentTime && isClient) {
                const metrics = calculateCurrentMetrics(log, targetForSummaryCalc, currentTime);
                summaryUPH = metrics.currentUPH;
                currentUnitsNow = metrics.currentUnits; 
            } else if (!isToday) {
                summaryUPH = calculateDailyUPH(log, targetForSummaryCalc);
            }
        }

        const summaryTargetName = targetForSummaryCalc ? targetForSummaryCalc.name : 'N/A';
        const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;
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

      {paginatedPreviousLogs.length > 0 && (
        <div>
           {(!showTodaySection || (showTodaySection && !todayLog)) && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           )}
           <Accordion type="multiple" className="w-full space-y-1">
               {paginatedPreviousLogs.map(({ date, log }) => {
                    const logTarget = targets.find(t => t.id === log.targetId);
                    const targetForCalc = logTarget ?? activeTarget; 

                    return (
                    <AccordionItem value={date} key={date} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                           <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50" asChild>
                                <div className="flex items-center justify-between w-full">
                                   <PreviousLogTriggerSummary log={log} allTargets={targets} onDelete={() => handleDeleteLog(log)} />
                                   {/* Remove the default chevron, PreviousLogTriggerSummary will show its own or none */}
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
           {paginatePreviousLogs && totalPreviousLogPages > 1 && (
             <div className="flex justify-between items-center mt-4">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setPreviousLogsCurrentPage(prev => Math.max(1, prev - 1))}
                 disabled={previousLogsCurrentPage === 1}
               >
                 Previous
               </Button>
               <span className="text-sm text-muted-foreground">
                 Page {previousLogsCurrentPage} of {totalPreviousLogPages}
               </span>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setPreviousLogsCurrentPage(prev => Math.min(totalPreviousLogPages, prev + 1))}
                 disabled={previousLogsCurrentPage === totalPreviousLogPages}
               >
                 Next
               </Button>
             </div>
           )}
        </div>
      )}

       {(!showTodaySection || !todayLog) && previousLogsByDate.length === 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
    </div>
  );
};

export default TargetMetricsDisplay;