
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button'; // Import Button
import { Trash2 } from 'lucide-react'; // Import Trash icon
import { useToast } from "@/hooks/use-toast"; // Import useToast
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"; // Import Accordion components
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDurationFromHours,
    calculateProjectedGoalHitTime,
    formatDateISO,
    formatFriendlyDate,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receive all logs
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void; // Add delete action prop
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction, // Destructure delete action
}) => {
  const { toast } = useToast(); // Initialize toast hook
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

  // Separate logs into today and previous days, grouped by date for previous logs
  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog[]> = {};

    // Sort logs by date descending first
    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
        // Find the SINGLE log matching today's date
      if (log.date === todayDateStr && !foundTodayLog) {
        foundTodayLog = log;
      } else if (log.date !== todayDateStr) {
          // Group previous logs by date
          if (!prevLogsMap[log.date]) {
              prevLogsMap[log.date] = [];
          }
          // For simplicity, still assuming one log per previous date after saveWorkLog update
          if (prevLogsMap[log.date].length === 0) {
             prevLogsMap[log.date].push(log);
          }
      }
    });

    // Convert map to array of {date, log} for easier rendering
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Take the first log for that date
                                .sort((a, b) => b.date.localeCompare(a.date)); // Ensure dates are descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
  }, [allWorkLogs]);


  // Sort targets by Goal UPH ascending for display consistency
  const sortedTargets = [...targets].sort((a, b) => a.targetUPH - b.targetUPH);

  // --- Delete Handler ---
  const handleDeleteLog = (log: DailyWorkLog) => {
    if (!confirm(`Are you sure you want to delete the log for ${formatFriendlyDate(new Date(log.date + 'T00:00:00'))}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      toast({
        title: "Log Deleted",
        description: `Work log for ${formatFriendlyDate(new Date(log.date + 'T00:00:00'))} deleted successfully.`,
      });
    } catch (error) {
      console.error("Failed to delete work log:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Could not delete the work log.",
      });
    }
  };

  // --- Helper Function to Render a Metrics Row (Shared by Today and Previous) ---
  const renderMetricsRow = (log: DailyWorkLog, target: UPHTarget, isToday: boolean, showDate: boolean = false) => {
      if (log.hoursWorked <= 0) {
          // Display placeholder row if no valid log data yet for calculations
          return (
              <TableRow key={`${log.id}-${target.id}`}>
                  {showDate && <TableCell>{formatFriendlyDate(new Date(log.date + 'T00:00:00'))}</TableCell>}
                  <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{log.documentsCompleted}</TableCell>
                  <TableCell className="text-right">{log.videoSessionsCompleted}</TableCell>
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
               {showDate && <TableCell>{formatFriendlyDate(new Date(log.date + 'T00:00:00'))}</TableCell>}
              <TableCell className="text-right">{target.targetUPH.toFixed(1)}</TableCell>
              <TableCell className="text-right">{log.documentsCompleted}</TableCell>
              <TableCell className="text-right">{log.videoSessionsCompleted}</TableCell>
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
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Today's Metrics ({formatFriendlyDate(new Date(todayLog.date + 'T00:00:00'))})</h3>
               <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => handleDeleteLog(todayLog)}
                  title="Delete Today's Log"
                  aria-label="Delete Today's Log"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Goal UPH</TableHead>
                  <TableHead className="text-right">Docs Done</TableHead>
                  <TableHead className="text-right">Videos Done</TableHead>
                  <TableHead className="text-right">Total Units Needed</TableHead>
                  <TableHead className="text-right">Actual UPH</TableHead>
                  <TableHead className="text-right">Actual Units</TableHead>
                  <TableHead className="text-right">Time Left to Goal</TableHead>
                  <TableHead className="text-right">Est. Goal Hit Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTargets.length > 0 ? (
                    sortedTargets.map((target) => renderMetricsRow(todayLog, target, true))
                ) : (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">No UPH targets defined.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* --- Separator --- */}
       {todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

      {/* --- Previous Logs Section (Accordion) --- */}
      {previousLogsByDate.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Previous Logs</h3>
           <Accordion type="multiple" className="w-full">
               {previousLogsByDate.map(({ date, log }) => (
                    <AccordionItem value={date} key={date}>
                        <AccordionTrigger className="text-base hover:no-underline">
                            <div className="flex justify-between items-center w-full pr-2">
                                <span>{formatFriendlyDate(new Date(date + 'T00:00:00'))}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive h-7 w-7 shrink-0 data-[state=open]:opacity-0 data-[state=closed]:opacity-100 transition-opacity" // Hide when open
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent accordion toggle
                                        handleDeleteLog(log);
                                    }}
                                    title="Delete This Log"
                                    aria-label="Delete This Log"
                                    >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="overflow-x-auto border rounded-md mt-2">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                    {/* No Date column needed here */}
                                    <TableHead className="text-right">Goal UPH</TableHead>
                                    <TableHead className="text-right">Docs Done</TableHead>
                                    <TableHead className="text-right">Videos Done</TableHead>
                                    <TableHead className="text-right">Total Units Needed</TableHead>
                                    <TableHead className="text-right">Actual UPH</TableHead>
                                    <TableHead className="text-right">Actual Units</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTargets.length > 0 ? (
                                        sortedTargets.map(target => renderMetricsRow(log, target, false)) // Pass false for isToday
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground">No UPH targets defined for this day.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                </Table>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
               ))}
           </Accordion>
        </div>
      )}

       {/* Message if no logs exist at all */}
       {!todayLog && previousLogsByDate.length === 0 && targets.length > 0 && (
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
