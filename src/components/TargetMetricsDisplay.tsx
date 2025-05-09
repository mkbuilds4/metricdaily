
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, AlertCircle, Target as TargetIcon, CheckCircle, Brain, ChevronDown, ChevronUp } from 'lucide-react'; // Import icons, added Brain
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
    calculateProjectedGoalHitTime,
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
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  setActiveUPHTargetAction?: (id: string) => void;
  onGoalMet: (targetId: string, metAt: Date) => void;
  showTodaySection?: boolean;
}


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
  setActiveUPHTargetAction,
  onGoalMet,
  showTodaySection = true,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);

  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    const todayStart = startOfDay(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog> = {};

    allWorkLogs.forEach(log => {
      const logDateObj = parseISO(log.date + 'T00:00:00');
      if (!isValid(logDateObj)) return;

      if (showTodaySection && log.date === todayDateStr && !log.isFinalized && !foundTodayLog) {
        foundTodayLog = log;
      } else if (isBefore(logDateObj, todayStart) || (log.date === todayDateStr && log.isFinalized)) {
        // For previous logs, ensure we only take one log per date.
        // If multiple logs exist for the same past date (e.g. one finalized, one not - though this shouldn't happen for past days),
        // prioritize the finalized one, or simply the one encountered.
        if (!prevLogsMap[log.date] || (prevLogsMap[log.date] && !prevLogsMap[log.date].isFinalized && log.isFinalized)) {
             prevLogsMap[log.date] = log;
        } else if (prevLogsMap[log.date] && prevLogsMap[log.date].isFinalized && !log.isFinalized) {
            // Do nothing, keep the finalized one.
        } else if (!prevLogsMap[log.date]) { // If no entry for this date yet
            prevLogsMap[log.date] = log;
        }
      }
    });
    
    const prevLogsGrouped = Object.values(prevLogsMap) // Use Object.values to get the single log per date
                              .map(log => ({ date: log.date, log })) // Create the structure expected
                              .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
  }, [allWorkLogs, showTodaySection]);

  useEffect(() => {
    if (typeof window !== 'undefined' && showTodaySection && isClient) {
      const timerId = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      setCurrentTime(new Date()); // Initialize once
      return () => clearInterval(timerId);
    }
  }, [showTodaySection, isClient]);

  useEffect(() => {
    if (!showTodaySection || !currentTime || !todayLog || !isClient || !onGoalMet) {
      return;
    }
    const currentGoalMetTimes = todayLog.goalMetTimes || {};
    targets.forEach(target => {
      const { currentUnits } = calculateCurrentMetrics(todayLog, target, currentTime);
      const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, target.targetUPH);
      const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;
      const isAlreadyRecorded = !!currentGoalMetTimes[target.id];
      if (isCurrentlyMet && !isAlreadyRecorded) {
        onGoalMet(target.id, currentTime);
      }
    });
  }, [todayLog, targets, currentTime, showTodaySection, isClient, onGoalMet]);

  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);

  const handleDeleteLog = (logId: string, logDateStr: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete the log for ${formatFriendlyDate(parse(logDateStr, 'yyyy-MM-dd', new Date()))}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(logId);
      toast({ title: "Log Deleted", description: `Work log for ${formatFriendlyDate(parse(logDateStr, 'yyyy-MM-dd', new Date()))} has been deleted.`});
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

    const goalMetTimeISO = log.goalMetTimes?.[target.id];
    const goalMetTime = goalMetTimeISO ? parseISO(goalMetTimeISO) : null;
    const isGoalMet = goalMetTime && isValid(goalMetTime);

    if (isGoalMet) {
      timeAheadBehindSeconds = 0;
      projectedHitTimeFormatted = '-';
      unitsToGoal = 0;
    } else if (isToday && currentTime) {
      currentMetrics = calculateCurrentMetrics(log, target, currentTime);
      unitsToGoal = totalRequiredUnits - currentMetrics.currentUnits;
      timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime);
      projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime);
    } else if (!isToday) {
      unitsToGoal = totalRequiredUnits - totalActualUnits;
      timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, null);
      projectedHitTimeFormatted = '-';
    }
    unitsToGoal = parseFloat(unitsToGoal.toFixed(2));

    const scheduleStatusText = isGoalMet ? (
      <>
        <CheckCircle className="inline-block h-4 w-4 mr-1"/>
        {goalMetTime ? `Met at ${format(goalMetTime, 'h:mm:ss a')}` : 'Met'}
      </>
    ) : (
      formatTimeAheadBehind(timeAheadBehindSeconds)
    );

    const scheduleStatusColor = isGoalMet ? "text-green-600 dark:text-green-500" :
                                  (timeAheadBehindSeconds !== null && timeAheadBehindSeconds >= 0 ? "text-green-600 dark:text-green-500" :
                                  (timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 ? "text-red-600 dark:text-red-500" : ""));

    const handleCardClick = () => {
      if (isToday && setActiveUPHTargetAction && target.id !== activeTarget?.id) {
        setActiveUPHTargetAction(target.id);
      }
    };

    return (
      <Card
        key={`${log.id}-${target.id}`}
        className={cn(
          "flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200",
          isToday && setActiveUPHTargetAction && target.id !== activeTarget?.id && "cursor-pointer hover:ring-2 hover:ring-primary/50",
          target.id === activeTarget?.id && isToday && "ring-2 ring-primary"
        )}
        {...(isToday && setActiveUPHTargetAction && { onClick: handleCardClick })}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
            <span className={cn(
              "text-base font-medium",
              isGoalMet ? 'text-green-600 dark:text-green-500' : (unitsToGoal <= 0 ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground')
            )}>
              {isGoalMet ? (
                <><CheckCircle className="inline-block h-4 w-4 mr-1"/> Met</>
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
                </p>
              </div>
              <div className="col-span-1">
                <p className="text-muted-foreground">Est. Goal Hit Time</p>
                <p className="font-medium tabular-nums">
                  {isGoalMet ? '-' : projectedHitTimeFormatted}
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
                <p className="text-muted-foreground">Schedule Result</p>
                <p className={cn("font-medium tabular-nums", scheduleStatusColor)}>
                  {scheduleStatusText}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Daily UPH</p>
                <p className="font-medium tabular-nums">{dailyUPHForTarget.toFixed(2)}</p>
              </div>
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
          <PreviousLogTriggerSummary
            log={todayLog}
            allTargets={targets}
            activeTarget={activeTarget}
            onDelete={undefined} // Do not allow deleting today's active log from dashboard view
            isDashboardTodayView={true}
          />
          {targets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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
          <Accordion
            type="single"
            collapsible
            className="w-full space-y-1"
            value={expandedLogId}
            onValueChange={setExpandedLogId}
          >
            {previousLogsByDate.map(({ date, log }) => (
              <AccordionItem value={log.id} key={log.id} className="border-b border-border bg-card rounded-md overflow-hidden shadow-sm">
                 <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group data-[state=open]:bg-muted/50 hover:no-underline" asChild={false} hideChevron>
                  <PreviousLogTriggerSummary
                    log={log}
                    allTargets={targets}
                    activeTarget={activeTarget}
                    onDelete={() => handleDeleteLog(log.id, log.date)}
                    isExpanded={expandedLogId === log.id}
                  />
                   <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 ml-auto" />
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                  {/* Content for previous logs is now more detailed within PreviousLogTriggerSummary when expanded */}
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

      {(!showTodaySection && previousLogsByDate.length === 0) && (
        <p className="text-center text-muted-foreground py-6">No previous work logs found.</p>
      )}
      {(showTodaySection && !todayLog && previousLogsByDate.length === 0) && (
        <p className="text-center text-muted-foreground py-6">No work logs found.</p>
      )}
    </div>
  );
};

export default TargetMetricsDisplay;

