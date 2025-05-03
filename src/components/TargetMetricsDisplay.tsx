
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  calculateDailyUnits,
  calculateDailyUPH,
  calculateRequiredUnitsForTarget,
  formatDurationFromHours,
  calculateProjectedGoalHitTime,
  formatDateISO,
  formatFriendlyDate, // Import for displaying dates
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receive all logs
  targets: UPHTarget[];
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
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

  // Separate logs into today and previous days
  const { todayLog, previousLogs } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogs: DailyWorkLog[] = [];

    // Sort logs by date descending first
    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
      if (log.date === todayDateStr && !foundTodayLog) {
        foundTodayLog = log; // Take the first (most recent) log for today
      } else {
        prevLogs.push(log);
      }
    });

    return { todayLog: foundTodayLog, previousLogs: prevLogs };
  }, [allWorkLogs]);


  // Sort targets by Goal UPH ascending for display consistency
  const sortedTargets = [...targets].sort((a, b) => a.targetUPH - b.targetUPH);

  // --- Helper Function to Render a Metrics Row ---
  const renderMetricsRow = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      if (log.hoursWorked <= 0) {
          // Display placeholder row if no valid log data yet for calculations
          return (
              <TableRow key={`${log.id}-${target.id}`}>
                  {!isToday && <TableCell>{formatFriendlyDate(new Date(log.date + 'T00:00:00'))}</TableCell>} {/* Add Date for previous logs */}
                  {/* <TableCell>{target.name}</TableCell> */}
                  <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  {isToday && <TableCell className="text-right">-</TableCell>}
                  {isToday && <TableCell className="text-right">-</TableCell>}
              </TableRow>
          );
      }

      // Perform calculations for each target based on the log
      const actualUnits = calculateDailyUnits(log, target);
      const actualUPH = calculateDailyUPH(log, target); // UPH based on this specific target's unit definition
      const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);

      // Only calculate time-related metrics for today's log
      let timeLeftFormatted = '-';
      let goalHitTimeFormatted = '-';
      if (isToday && currentTime) {
          const remainingUnits = requiredUnits - actualUnits;
          // Remaining hours needed AT CURRENT ACTUAL UPH for THIS TARGET'S unit definition
          const remainingWorkHours = (actualUPH > 0 && remainingUnits > 0) ? remainingUnits / actualUPH : 0;

          // Format remaining time. If goal met (remainingUnits <= 0), show positive indicator or 0.
          timeLeftFormatted = remainingUnits <= 0
                              ? `+${formatDurationFromHours(Math.abs(remainingUnits / actualUPH))}` // Show how much ahead
                              : formatDurationFromHours(remainingWorkHours);

          goalHitTimeFormatted = calculateProjectedGoalHitTime(currentTime, remainingWorkHours);
      }

      return (
          <TableRow key={`${log.id}-${target.id}`}>
               {!isToday && <TableCell>{formatFriendlyDate(new Date(log.date + 'T00:00:00'))}</TableCell>}
              {/* <TableCell>{target.name}</TableCell> */}
              <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
              <TableCell className="text-right">{requiredUnits.toFixed(2)}</TableCell>
              <TableCell className="text-right">{actualUPH.toFixed(2)}</TableCell>
              <TableCell className="text-right">{actualUnits.toFixed(2)}</TableCell>
              {isToday && (
                   <TableCell className={`text-right ${requiredUnits - actualUnits <= 0 ? 'text-accent' : ''}`}>
                       {timeLeftFormatted}
                   </TableCell>
              )}
               {isToday && (
                 <TableCell className="text-right">
                     {actualUPH > 0 ? goalHitTimeFormatted : 'N/A'}
                 </TableCell>
              )}
          </TableRow>
      );
  };


  return (
    <div className="space-y-6">
      {/* --- Today's Metrics Section --- */}
      {todayLog && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Today's Metrics ({formatFriendlyDate(new Date(todayLog.date + 'T00:00:00'))})</h3>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* <TableHead>Target Name</TableHead> */}
                  <TableHead className="text-right">Goal UPH</TableHead>
                  <TableHead className="text-right">Total Units Needed</TableHead>
                  <TableHead className="text-right">Actual UPH</TableHead>
                  <TableHead className="text-right">Actual Units</TableHead>
                  {/* Removed % Completed and % Diff */}
                  <TableHead className="text-right">Time Left to Goal</TableHead>
                  <TableHead className="text-right">Est. Goal Hit Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTargets.length > 0 ? (
                    sortedTargets.map((target) => renderMetricsRow(todayLog, target, true))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">No UPH targets defined.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* --- Separator --- */}
       {todayLog && previousLogs.length > 0 && <Separator className="my-6" />}

      {/* --- Previous Logs Section --- */}
      {previousLogs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Previous Logs</h3>
           <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead> {/* Added Date column */}
                    {/* <TableHead>Target Name</TableHead> */}
                    <TableHead className="text-right">Goal UPH</TableHead>
                    <TableHead className="text-right">Total Units Needed</TableHead>
                    <TableHead className="text-right">Actual UPH</TableHead>
                    <TableHead className="text-right">Actual Units</TableHead>
                   {/* Removed % Completed, % Diff, Time Left, Est. Time */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTargets.length > 0 ? (
                    previousLogs.flatMap(log => // Use flatMap to handle multiple logs
                      sortedTargets.map(target => renderMetricsRow(log, target, false))
                    )
                ) : (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No UPH targets defined.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
           </div>
        </div>
      )}

       {/* Message if no logs exist at all */}
       {!todayLog && previousLogs.length === 0 && targets.length > 0 && (
           <p className="text-sm text-muted-foreground">No work logs found.</p>
       )}
       {/* Message if no targets exist */}
       {targets.length === 0 && (
           <p className="text-sm text-muted-foreground">No UPH targets defined.</p>
       )}

    </div>
  );
};

export default TargetMetricsDisplay;
