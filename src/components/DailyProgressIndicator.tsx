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

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const now = new Date();
        setCurrentTime(now);
        
        // Initial check for goal met status
        if (todayLog && activeTarget && !goalMetAt) { // Only check if not already met
            const { currentUnits } = calculateCurrentMetrics(todayLog, activeTarget, now);
            const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
            if (currentUnits >= targetUnitsForShift && targetUnitsForShift > 0) {
                setGoalMetAt(now); // Lock in the time
            }
        }

        const timerId = setInterval(() => {
            const newNow = new Date();
            setCurrentTime(newNow);
            // Update goal met status on interval, only if not already met
            if (todayLog && activeTarget && !goalMetAt) { 
                const { currentUnits } = calculateCurrentMetrics(todayLog, activeTarget, newNow);
                const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
                if (currentUnits >= targetUnitsForShift && targetUnitsForShift > 0) {
                    setGoalMetAt(newNow); // Lock in the time
                }
            }
        }, 1000); 
        return () => clearInterval(timerId);
    }
  }, [todayLog, activeTarget, goalMetAt]); // Include goalMetAt here to stop interval updates once met


  useEffect(() => {
    // Reset goalMetAt if the log or target changes, or if a new day starts
    setGoalMetAt(null);
  }, [todayLog, activeTarget]);


  const targetForCalc = activeTarget;

  const progressData = useMemo(() => {
    if (!todayLog || !targetForCalc || !currentTime) {
      return { currentUnits: 0, targetUnits: 0, percentage: 0, currentUPH: 0, timeDiff: null, projectedHitTimeFormatted: '-' };
    }

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, targetForCalc, currentTime);
    const targetUnitsForDuration = calculateRequiredUnitsForTarget(todayLog.hoursWorked, targetForCalc.targetUPH);
    const percentage = targetUnitsForDuration > 0 ? Math.min(100, Math.max(0, (currentUnits / targetUnitsForDuration) * 100)) : 0;
    
    let timeDiffSeconds: number | null = null;
    let projectedHitTimeFormatted: string = '-';

    if (goalMetAt) {
        timeDiffSeconds = 0; // Consider on schedule or met
        projectedHitTimeFormatted = `Met at ${format(goalMetAt, 'h:mm:ss a')}`;
    } else {
        timeDiffSeconds = calculateTimeAheadBehindSchedule(todayLog, targetForCalc, currentTime); 
        projectedHitTimeFormatted = calculateProjectedGoalHitTime(todayLog, targetForCalc, timeDiffSeconds, currentTime); 
    }


    return {
        currentUnits,
        targetUnits: targetUnitsForDuration,
        percentage: parseFloat(percentage.toFixed(1)),
        currentUPH,
        timeDiff: timeDiffSeconds, 
        projectedHitTimeFormatted
    };
  }, [todayLog, targetForCalc, currentTime, goalMetAt]);

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

  if (!targetForCalc) {
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
          <span className="font-medium">{targetForCalc.name}</span> target (Goal UPH:{' '}
          {targetForCalc.targetUPH.toFixed(1)}) for {formattedLogDate}.
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
                <span className="text-muted-foreground">Schedule</span>
                 <span className={cn(
                    "font-medium tabular-nums", 
                    goalMetAt && "text-green-600 dark:text-green-500",
                    !goalMetAt && progressData.timeDiff !== null && progressData.timeDiff > 0 && "text-green-600 dark:text-green-500",
                    !goalMetAt && progressData.timeDiff !== null && progressData.timeDiff < 0 && "text-red-600 dark:text-red-500"
                    )}>
                      {goalMetAt ? <CheckCircle className="inline-block h-4 w-4 mr-1"/> : formatTimeAheadBehind(progressData.timeDiff)} 
                      {goalMetAt && `at ${format(goalMetAt, 'h:mm:ss a')}`}
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