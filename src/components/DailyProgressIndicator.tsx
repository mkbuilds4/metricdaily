
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateCurrentMetrics, calculateRequiredUnitsForTarget, formatTimeAheadBehind, calculateTimeAheadBehindSchedule, formatFriendlyDate, formatDurationFromMinutes, calculateProjectedGoalHitTime } from '@/lib/utils';
import { format, parse, isValid, parseISO } from 'date-fns';
import { AlertCircle, Brain, CheckCircle } from 'lucide-react'; // Added Brain icon
import { cn } from '@/lib/utils'; // Import cn utility

interface DailyProgressIndicatorProps {
  todayLog: DailyWorkLog | null;
  activeTarget: UPHTarget | null;
  currentTime: Date | null; // Receive currentTime as a prop
}

const DailyProgressIndicator: React.FC<DailyProgressIndicatorProps> = ({ todayLog, activeTarget, currentTime }) => {
  // Removed internal currentTime state and useEffect that managed it

  const progressData = useMemo(() => {
    if (!todayLog || !activeTarget || !currentTime) { // currentTime now comes from prop
      return { currentUnits: 0, targetUnits: 0, percentage: 0, currentUPH: 0, timeDiff: null, projectedHitTimeFormatted: '-', unitsToGoal: 0, goalMetTime: null };
    }

    const goalMetTimeISO = todayLog.goalMetTimes?.[activeTarget.id];
    const goalMetTime = goalMetTimeISO ? parseISO(goalMetTimeISO) : null;
    const isGoalMet = goalMetTime && isValid(goalMetTime);

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, activeTarget, currentTime);
    const targetUnitsForDuration = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
    const percentage = targetUnitsForDuration > 0 ? Math.min(100, Math.max(0, (currentUnits / targetUnitsForDuration) * 100)) : 0;

    let timeDiffSeconds: number | null = null;
    let projectedHitTimeFormatted: string = '-';
    const unitsToGoal = targetUnitsForDuration - currentUnits;

    if (isGoalMet) {
        timeDiffSeconds = 0; 
        projectedHitTimeFormatted = '-'; 
    } else {
        timeDiffSeconds = calculateTimeAheadBehindSchedule(todayLog, activeTarget, currentTime);
        projectedHitTimeFormatted = calculateProjectedGoalHitTime(todayLog, activeTarget, timeDiffSeconds, currentTime);
    }


    return {
        currentUnits,
        targetUnits: targetUnitsForDuration,
        percentage: parseFloat(percentage.toFixed(1)),
        currentUPH,
        timeDiff: timeDiffSeconds,
        projectedHitTimeFormatted,
        unitsToGoal: parseFloat(unitsToGoal.toFixed(2)),
        goalMetTime: isGoalMet ? goalMetTime : null, 
    };
  }, [todayLog, activeTarget, currentTime]); 

  if (!todayLog || !currentTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Target Progress</CardTitle>
          <CardDescription>Loading or no log for today...</CardDescription>
        </CardHeader>
        <CardContent className="h-[100px] flex items-center justify-center text-muted-foreground">
          Waiting for data...
        </CardContent>
      </Card>
    );
  }

  if (!activeTarget) {
     return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Target Progress</CardTitle>
          <CardDescription className="text-destructive flex items-center gap-1">
             <AlertCircle className="h-4 w-4" /> No active UPH target found.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[100px] flex items-center justify-center text-muted-foreground">
           Activate a target to track progress.
        </CardContent>
      </Card>
    );
  }

  const logDate = parse(todayLog.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? format(logDate, 'MMM d') : todayLog.date; 
  const trainingTimeFormatted = todayLog.trainingDurationMinutes && todayLog.trainingDurationMinutes > 0
                                ? formatDurationFromMinutes(todayLog.trainingDurationMinutes * 60)
                                : null;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Target Progress</CardTitle>
        <CardDescription>
          Tracking progress towards{' '}
          <span className="font-medium">{activeTarget.name}</span> target (Goal UPH:{' '}
          {activeTarget.targetUPH.toFixed(1)}) for {formattedLogDate}.
          {trainingTimeFormatted && (
            <span className="block text-xs text-muted-foreground">
              <Brain className="inline-block h-3 w-3 mr-1" /> Includes {trainingTimeFormatted} of training.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
            <Progress value={progressData.percentage} aria-label={`${progressData.percentage}% complete towards target units`} className="h-3 flex-1" />
            <span className="font-semibold tabular-nums">{progressData.percentage}%</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
             <div className="flex flex-col">
                 <span className="text-muted-foreground">Units Now</span>
                 <span className="font-medium tabular-nums">{progressData.currentUnits.toFixed(2)}</span>
             </div>
             <div className="flex flex-col">
                 <span className="text-muted-foreground">Target Units</span>
                 <span className="font-medium tabular-nums">{progressData.targetUnits.toFixed(2)}</span>
             </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Current UPH</span>
                 <span className="font-medium tabular-nums">{progressData.currentUPH.toFixed(2)}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-muted-foreground">Units to Goal</span>
                 <span className="font-medium tabular-nums">
                    {progressData.goalMetTime ? (
                        <>
                            <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met
                        </>
                     ) : progressData.unitsToGoal > 0 ? (
                         progressData.unitsToGoal.toFixed(2)
                     ) : (
                         '0.00' 
                     )}
                 </span>
             </div>
             <div className="flex flex-col sm:col-span-2">
                <span className="text-muted-foreground">Schedule Status</span>
                 <span className={cn(
                    "font-medium tabular-nums",
                    progressData.goalMetTime && "text-green-600 dark:text-green-500", 
                    !progressData.goalMetTime && progressData.timeDiff !== null && progressData.timeDiff >= 0 && "text-green-600 dark:text-green-500", 
                    !progressData.goalMetTime && progressData.timeDiff !== null && progressData.timeDiff < 0 && "text-red-600 dark:text-red-500"
                    )}>
                    {progressData.goalMetTime ? (
                        <>
                            <CheckCircle className="inline-block h-4 w-4 mr-1"/>
                            {`Met at ${format(progressData.goalMetTime, 'h:mm:ss a')}`}
                        </>
                    ) : (
                        formatTimeAheadBehind(progressData.timeDiff) 
                    )}
                 </span>
             </div>
             <div className="flex flex-col col-span-2 sm:col-span-2">
                <span className="text-muted-foreground">Est. Goal Hit Time</span>
                 <span className="font-medium tabular-nums">
                     {(progressData.goalMetTime) ? '-' : progressData.projectedHitTimeFormatted}
                 </span>
             </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyProgressIndicator;

