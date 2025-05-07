'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateCurrentMetrics, calculateRequiredUnitsForTarget, formatTimeAheadBehind, calculateTimeAheadBehindSchedule, formatFriendlyDate, formatDurationFromMinutes, calculateProjectedGoalHitTime } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { AlertCircle, Brain, CheckCircle } from 'lucide-react'; 
import { cn } from '@/lib/utils'; 

interface DailyProgressIndicatorProps {
  todayLog: DailyWorkLog | null;
  activeTarget: UPHTarget | null; 
}

const DailyProgressIndicator: React.FC<DailyProgressIndicatorProps> = ({ todayLog, activeTarget }) => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [goalMetAt, setGoalMetAt] = useState<Date | null>(null);

  // Effect 1: Update currentTime every second
  useEffect(() => {
    if (typeof window !== 'undefined') {
        setCurrentTime(new Date()); // Initial set
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timerId);
    }
  }, []); // Runs once on mount to start the timer

  // Effect 2: Update goal met status based on data changes and currentTime
  useEffect(() => {
    if (typeof window === 'undefined' || !todayLog || !activeTarget || !currentTime) {
        // If conditions aren't met, or no data, ensure goalMetAt is null if it's not already.
        if (goalMetAt !== null) {
            setGoalMetAt(null);
        }
        return;
    }

    const { currentUnits } = calculateCurrentMetrics(todayLog, activeTarget, currentTime);
    const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
    const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;
    const wasPreviouslyMet = !!goalMetAt;

    if (isCurrentlyMet && !wasPreviouslyMet) {
        setGoalMetAt(currentTime); // Record the time it was met
    } else if (!isCurrentlyMet && wasPreviouslyMet) {
        setGoalMetAt(null); // No longer met (e.g., data changed)
    }
    // If met state (isCurrentlyMet vs wasPreviouslyMet) doesn't change, do nothing to goalMetAt.
    // This ensures goalMetAt, once set, only changes if the goal becomes unmet.
  }, [todayLog, activeTarget, currentTime, goalMetAt]); // goalMetAt is included to react to its changes


  const progressData = useMemo(() => {
    if (!todayLog || !activeTarget || !currentTime) {
      return { currentUnits: 0, targetUnits: 0, percentage: 0, currentUPH: 0, timeDiff: null, projectedHitTimeFormatted: '-', unitsToGoal: 0 };
    }

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, activeTarget, currentTime);
    const targetUnitsForDuration = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
    const percentage = targetUnitsForDuration > 0 ? Math.min(100, Math.max(0, (currentUnits / targetUnitsForDuration) * 100)) : 0;
    
    let timeDiffSeconds: number | null = null;
    let projectedHitTimeFormatted: string = '-';
    const unitsToGoal = targetUnitsForDuration - currentUnits;

    if (goalMetAt) { // If goal is already met and timestamp is locked
        timeDiffSeconds = 0; // Consider on schedule or met
        projectedHitTimeFormatted = `Met at ${format(goalMetAt, 'h:mm:ss a')}`;
    } else { // If goal is not yet met
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
    };
  }, [todayLog, activeTarget, currentTime, goalMetAt]);

  if (!todayLog || !currentTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Target Progress</CardTitle>
          <CardDescription>No work log found for today yet.</CardDescription>
        </CardHeader>
        <CardContent className="h-[100px] flex items-center justify-center text-muted-foreground">
          Add today's log to see progress.
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
                    {progressData.unitsToGoal > 0 ? progressData.unitsToGoal.toFixed(2) : (
                        <>
                            <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met
                        </>
                    )}
                 </span>
             </div>
             <div className="flex flex-col sm:col-span-2">
                <span className="text-muted-foreground">Schedule</span>
                 <span className={cn(
                    "font-medium tabular-nums", 
                    goalMetAt && "text-green-600 dark:text-green-500",
                    !goalMetAt && progressData.timeDiff !== null && progressData.timeDiff > 0 && "text-green-600 dark:text-green-500",
                    !goalMetAt && progressData.timeDiff !== null && progressData.timeDiff < 0 && "text-red-600 dark:text-red-500"
                    )}>
                      {goalMetAt ? <CheckCircle className="inline-block h-4 w-4 mr-1"/> : formatTimeAheadBehind(progressData.timeDiff)} 
                      {goalMetAt && `Met at ${format(goalMetAt, 'h:mm:ss a')}`}
                 </span>
             </div>
             <div className="flex flex-col col-span-2 sm:col-span-2"> 
                <span className="text-muted-foreground">Est. Goal Hit Time</span>
                <span className="font-medium tabular-nums">{progressData.projectedHitTimeFormatted}</span>
             </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyProgressIndicator;
