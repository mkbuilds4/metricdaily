
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateCurrentMetrics, calculateRequiredUnitsForTarget, formatTimeAheadBehind, calculateTimeAheadBehindSchedule, formatFriendlyDate, formatDurationFromMinutes, calculateProjectedGoalHitTime } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { AlertCircle } from 'lucide-react'; // Import icon
import { cn } from '@/lib/utils'; // Import cn utility

interface DailyProgressIndicatorProps {
  todayLog: DailyWorkLog | null;
  activeTarget: UPHTarget | null; // The globally active target
}

const DailyProgressIndicator: React.FC<DailyProgressIndicatorProps> = ({ todayLog, activeTarget }) => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined') {
        setCurrentTime(new Date());
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
        return () => clearInterval(timerId);
    }
  }, []);

  // The target to use for calculation is the active one for today's progress
  const targetForCalc = activeTarget;

  const progressData = useMemo(() => {
    // Require today's log, the calculated target, and current time
    if (!todayLog || !targetForCalc || !currentTime) {
      return { currentUnits: 0, targetUnits: 0, percentage: 0, currentUPH: 0, timeDiff: null, projectedHitTimeFormatted: '-' };
    }

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, targetForCalc, currentTime);
    const targetUnitsForDuration = calculateRequiredUnitsForTarget(todayLog.hoursWorked, targetForCalc.targetUPH);
    const percentage = targetUnitsForDuration > 0 ? Math.min(100, Math.max(0, (currentUnits / targetUnitsForDuration) * 100)) : 0;
    const timeDiffSeconds = calculateTimeAheadBehindSchedule(todayLog, targetForCalc, currentTime); // Now in seconds
    const projectedHitTimeFormatted = calculateProjectedGoalHitTime(todayLog, timeDiffSeconds); // Pass seconds

    return {
        currentUnits,
        targetUnits: targetUnitsForDuration,
        percentage: parseFloat(percentage.toFixed(1)),
        currentUPH,
        timeDiff: timeDiffSeconds, // Store as seconds
        projectedHitTimeFormatted
    };
  }, [todayLog, targetForCalc, currentTime]);

  if (!todayLog || !currentTime) {
    // Initial state or no log today
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
    // Log exists, but no target found (neither active nor associated)
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

  // Safe date formatting
  const logDate = parse(todayLog.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? format(logDate, 'MMM d') : todayLog.date;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Target Progress</CardTitle>
        <CardDescription>
          Tracking progress towards{' '}
          <span className="font-medium">{targetForCalc.name}</span> target (Goal UPH:{' '}
          {targetForCalc.targetUPH.toFixed(1)}) for {formattedLogDate}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
         {/* Progress Bar and Percentage */}
        <div className="flex items-center gap-3">
            <Progress value={progressData.percentage} aria-label={`${progressData.percentage}% complete towards target units`} className="h-3 flex-1" />
            <span className="font-semibold tabular-nums">{progressData.percentage}%</span>
        </div>
        {/* Metrics Grid - Adjust columns for responsiveness */}
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
                    "font-medium tabular-nums", // Added tabular-nums
                    progressData.timeDiff !== null && progressData.timeDiff > 0 && "text-green-600 dark:text-green-500",
                    progressData.timeDiff !== null && progressData.timeDiff < 0 && "text-red-600 dark:text-red-500"
                    )}>{formatTimeAheadBehind(progressData.timeDiff)} {/* timeDiff is now in seconds */}
                 </span>
             </div>
             <div className="flex flex-col col-span-2 sm:col-span-2"> {/* Span 2 cols on small, 2 on sm */}
                <span className="text-muted-foreground">Est. Goal Hit Time</span>
                <span className="font-medium tabular-nums">{progressData.projectedHitTimeFormatted}</span>
             </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyProgressIndicator;
