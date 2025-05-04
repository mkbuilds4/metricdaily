
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { calculateCurrentMetrics, calculateRequiredUnitsForTarget } from '@/lib/utils';
import { format } from 'date-fns';

interface DailyProgressIndicatorProps {
  todayLog: DailyWorkLog | null;
  activeTarget: UPHTarget | null;
}

const DailyProgressIndicator: React.FC<DailyProgressIndicatorProps> = ({ todayLog, activeTarget }) => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Defer setting current time until client-side mount
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timerId);
  }, []);

  const progressData = useMemo(() => {
    if (!todayLog || !activeTarget || !currentTime) {
      return { currentUnits: 0, targetUnits: 0, percentage: 0, currentUPH: 0 };
    }

    const { currentUnits, currentUPH } = calculateCurrentMetrics(todayLog, activeTarget, currentTime);
    const targetUnits = calculateRequiredUnitsForTarget(todayLog.hoursWorked, activeTarget.targetUPH);
    const percentage = targetUnits > 0 ? Math.min(100, Math.max(0, (currentUnits / targetUnits) * 100)) : 0;

    return { currentUnits, targetUnits, percentage: parseFloat(percentage.toFixed(1)), currentUPH };
  }, [todayLog, activeTarget, currentTime]);

  if (!todayLog || !activeTarget || !currentTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Target Progress</CardTitle>
          <CardDescription>No data available yet.</CardDescription>
        </CardHeader>
        <CardContent className="h-[100px] flex items-center justify-center text-muted-foreground">
          Waiting for log and target data...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Target Progress</CardTitle>
        <CardDescription>
          Tracking progress towards{' '}
          <span className="font-medium">{activeTarget.name}</span> target (Goal UPH:{' '}
          {activeTarget.targetUPH.toFixed(1)}) for {format(currentTime, 'MMM d')}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-2"> {/* Adjusted padding */}
        <div className="flex justify-between items-baseline text-sm">
           <span className="text-muted-foreground">Units Completed:</span>
           <span className="font-medium tabular-nums">{progressData.currentUnits.toFixed(2)} / {progressData.targetUnits.toFixed(2)}</span>
        </div>
         <div className="flex items-center gap-3">
             <Progress value={progressData.percentage} aria-label={`${progressData.percentage}% complete`} className="h-3 flex-1" />
             <span className="font-semibold tabular-nums">{progressData.percentage}%</span>
         </div>
         <div className="text-xs text-muted-foreground text-right">
            Current UPH: {progressData.currentUPH.toFixed(2)}
         </div>
      </CardContent>
    </Card>
  );
};

export default DailyProgressIndicator;
