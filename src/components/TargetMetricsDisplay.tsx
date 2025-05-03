
'use client';

import React, { useState, useEffect } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  calculateDailyUnits,
  calculateDailyUPH,
  calculateRequiredUnitsForTarget,
  formatDurationFromHours,
  calculateProjectedGoalHitTime,
} from '@/lib/utils'; // Assuming new utils exist

interface TargetMetricsDisplayProps {
  latestLog: DailyWorkLog;
  targets: UPHTarget[];
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  latestLog,
  targets = [],
}) => {
  // State to hold the current time, updating periodically
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Update time immediately on mount
    setCurrentTime(new Date());
    // Set up an interval to update the time every second
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    // Clear interval on component unmount
    return () => clearInterval(timerId);
  }, []);


  // Sort targets by Goal UPH ascending for display
  const sortedTargets = [...targets].sort((a, b) => a.targetUPH - b.targetUPH);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Consider adding a column for Target Name if useful */}
            {/* <TableHead>Target Name</TableHead> */}
            <TableHead className="text-right">Goal UPH</TableHead>
            <TableHead className="text-right">Total Units Needed</TableHead>
             <TableHead className="text-right">Actual UPH</TableHead>
             <TableHead className="text-right">Actual Units</TableHead>
            <TableHead className="text-right">% Completed</TableHead>
            <TableHead className="text-right">% Diff vs Goal</TableHead>
            <TableHead className="text-right">Time Left to Goal</TableHead>
            <TableHead className="text-right">Est. Goal Hit Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTargets.map((target) => {
            if (!latestLog || latestLog.hoursWorked <= 0) {
              // Display placeholder row if no valid log data yet for calculations
              return (
                 <TableRow key={target.id}>
                    {/* <TableCell>{target.name}</TableCell> */}
                    <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                 </TableRow>
              );
            }

            // Perform calculations for each target based on the latest log
            const actualUnits = calculateDailyUnits(latestLog, target);
            const actualUPH = calculateDailyUPH(latestLog, target); // UPH based on this specific target's unit definition
            const requiredUnits = calculateRequiredUnitsForTarget(latestLog.hoursWorked, target.targetUPH);

            const percentCompleted = requiredUnits > 0 ? (actualUnits / requiredUnits) * 100 : 0;
            const percentDifference = target.targetUPH > 0 ? ((actualUPH / target.targetUPH) - 1) * 100 : 0;

            const remainingUnits = requiredUnits - actualUnits;
            // Remaining hours needed AT CURRENT ACTUAL UPH for THIS TARGET'S unit definition
            const remainingWorkHours = (actualUPH > 0 && remainingUnits > 0) ? remainingUnits / actualUPH : 0;

            // Format remaining time. If goal met (remainingWorkHours <= 0), show positive indicator or 0.
            const timeLeftFormatted = remainingUnits <= 0
                                      ? `+${formatDurationFromHours(Math.abs(remainingUnits / actualUPH))}` // Show how much ahead
                                      : formatDurationFromHours(remainingWorkHours);


            const goalHitTimeFormatted = currentTime ? calculateProjectedGoalHitTime(currentTime, remainingWorkHours) : 'Calculating...';

            // Determine color coding for % Difference
             const diffColor = percentDifference < 0 ? 'text-destructive' : 'text-accent';


            return (
              <TableRow key={target.id}>
                {/* <TableCell>{target.name}</TableCell> */}
                <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
                <TableCell className="text-right">{requiredUnits.toFixed(2)}</TableCell>
                <TableCell className="text-right">{actualUPH.toFixed(2)}</TableCell>
                <TableCell className="text-right">{actualUnits.toFixed(2)}</TableCell>
                <TableCell className="text-right">{percentCompleted.toFixed(2)}%</TableCell>
                <TableCell className={`text-right font-medium ${diffColor}`}>
                    {percentDifference >= 0 ? '+' : ''}{percentDifference.toFixed(2)}%
                </TableCell>
                 <TableCell className={`text-right ${remainingUnits <= 0 ? 'text-accent' : ''}`}>
                   {timeLeftFormatted}
                 </TableCell>
                <TableCell className="text-right">
                    {actualUPH > 0 ? goalHitTimeFormatted : 'N/A'}
                </TableCell>
              </TableRow>
            );
          })}
           {sortedTargets.length === 0 && (
             <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">No UPH targets defined.</TableCell>
            </TableRow>
           )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TargetMetricsDisplay;
