
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video } from 'lucide-react'; // Removed unused icons
import { useToast } from "@/hooks/use-toast";
import { isValid, differenceInMinutes, parse, addDays, addHours, format, addMinutes } from 'date-fns';
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
    calculateRemainingUnits,
    calculateCurrentMetrics, // Import the new function
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary'; // Import the component for previous log triggers

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Receive all logs
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void; // Add delete action prop
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Run only on the client after hydration
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute is sufficient for projection
    return () => clearInterval(timerId);
  }, []); // Empty dependency array ensures this runs once on mount

  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog[]> = {};

    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
        if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
            if (log.date === todayDateStr && !foundTodayLog) {
              foundTodayLog = log;
            } else if (log.date !== todayDateStr) {
                if (!prevLogsMap[log.date]) {
                    prevLogsMap[log.date] = [];
                }
                 // Only keep the first unique log for each previous date for the summary accordion
                 if (prevLogsMap[log.date].length === 0) {
                   prevLogsMap[log.date].push(log);
                 }
            }
        } else {
            console.warn("Skipping log due to invalid date format:", log);
        }
    });

    // Use only the first log found for each previous date for the accordion trigger/content
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Take the first (and only) log per date
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
  }, [allWorkLogs]);


  const sortedTargets = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);
  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDate = new Date(log.date + 'T00:00:00');
     const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      toast({
        title: "Log Deleted",
        description: `Work log for ${formattedLogDate} deleted successfully.`,
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


  // --- Helper Function to Render a Metric Card (Used for Targets Breakdown) ---
  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      // Calculate metrics based on TOTAL logged hours for historical/comparison
      const totalActualUnits = calculateDailyUnits(log, target);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      const totalDifferenceUnits = calculateRemainingUnits(log, target);
      const totalActualUPH = calculateDailyUPH(log, target); // Total UPH for the log

      let goalHitTimeFormatted = '-';
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };

       if (isToday && currentTime) {
           goalHitTimeFormatted = calculateProjectedGoalHitTime(log, target, currentTime);
           currentMetrics = calculateCurrentMetrics(log, target, currentTime);
       }

      const isBehind = totalDifferenceUnits < 0;

      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                    {/* Show +/- vs Goal only for previous logs */}
                    {!isToday && (
                         <span className={`text-lg font-bold ${isBehind ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                            {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? (
                     <>
                         {/* Current Metrics (Today Only) */}
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Est. Goal Hit</p>
                            <p className="font-medium">{goalHitTimeFormatted}</p>
                        </div>
                        <div>
                             <p className="text-muted-foreground">Target Units</p>
                             <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                         </div>
                         {/* Added Units Completed display for today as well */}
                         <div>
                            <p className="text-muted-foreground">Units Completed</p>
                            <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                         </div>
                    </>
                 ) : (
                     <>
                        {/* Previous Log Specific Metrics */}
                        <div>
                            <p className="text-muted-foreground">Units Completed</p>
                            <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Units Needed</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                        </div>
                     </>
                 )}
            </CardContent>
        </Card>
      );
  };

   // --- Helper Function to Render a Summary Card for a Log (Used for Today and Previous Log Content) ---
   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean, allTargets: UPHTarget[]) => {
        // Use the active target for summary UPH, or the first if none active/available
        const summaryTarget = activeTarget ?? (allTargets.length > 0 ? allTargets[0] : null);
        const overallUPHForSummaryTarget = summaryTarget ? calculateDailyUPH(log, summaryTarget) : null;
        const summaryTargetName = summaryTarget ? summaryTarget.name : (allTargets.length > 0 ? 'First Target' : 'N/A');
        const logDate = new Date(log.date + 'T00:00:00'); // Add time component for parsing
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date; // Fallback to raw string if invalid

        return (
            <Card className={`mb-4 relative ${!isToday ? 'shadow-none border-none bg-transparent' : ''}`}>
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime}, {log.breakDurationMinutes} min break)
                                {overallUPHForSummaryTarget !== null && ` | Avg UPH (${summaryTargetName}): ${overallUPHForSummaryTarget.toFixed(2)}`}
                            </CardDescription>
                         </div>
                         {/* Conditionally render delete button ONLY for previous logs inside the card header */}
                         {!isToday && (
                           <Button
                             variant="ghost"
                             size="icon"
                             className="text-destructive hover:text-destructive h-8 w-8 absolute top-2 right-2" // Position delete button
                             onClick={(e) => {
                               e.stopPropagation(); // Prevent accordion trigger if inside one
                               handleDeleteLog(log);
                             }}
                             title="Delete This Log"
                             aria-label="Delete This Log"
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         )}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {/* Basic Info - Always shown */}
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
                 </CardContent>
                 {log.notes && (
                    <CardFooter className="pt-3">
                        <p className="text-sm text-muted-foreground italic">Notes: {log.notes}</p>
                    </CardFooter>
                 )}
            </Card>
        );
   }


  return (
    <div className="space-y-6">
      {/* --- Today's Metrics Section --- */}
      {todayLog && (
        <div>
           {/* Pass all targets to the summary card */}
          {renderLogSummaryCard(todayLog, true, sortedTargets)}

           {sortedTargets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Render breakdown cards for today */}
                {sortedTargets.map((target) => renderTargetMetricCard(todayLog, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {/* --- Separator --- */}
       {todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

      {/* --- Previous Logs Section (Accordion) --- */}
      {previousLogsByDate.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           <Accordion type="multiple" className="w-full space-y-1">
               {previousLogsByDate.map(({ date, log }) => (
                    <AccordionItem value={date} key={date} className="border-none">
                        {/* Use standard AccordionTrigger */}
                        <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-md transition-colors w-full relative group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50">
                            <div className="flex items-center justify-between w-full"> {/* Flex container */}
                                {/* Pass all targets to the trigger summary */}
                                <PreviousLogTriggerSummary log={log} allTargets={sortedTargets} />
                                {/* Delete Button - Positioned absolutely within the relative trigger */}
                                <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive h-8 w-8" // Style as needed
                                        onClick={(e) => {
                                            e.stopPropagation(); // VERY IMPORTANT: Prevent accordion toggle
                                            handleDeleteLog(log);
                                        }}
                                        title="Delete This Log"
                                        aria-label="Delete This Log"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                {/* Chevron is handled by the base AccordionTrigger */}
                            </div>
                        </AccordionTrigger>

                        <AccordionContent className="p-4 border-t bg-muted/10 mt-1 rounded-b-md">
                             {/* Render the detailed summary card *inside* the accordion content */}
                             {/* Note: Delete button is NOT rendered inside the summary card for previous logs anymore */}
                             {renderLogSummaryCard(log, false, sortedTargets)}
                             {sortedTargets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {/* Pass false for isToday */}
                                    {sortedTargets.map(target => renderTargetMetricCard(log, target, false))}
                                 </div>
                                ) : (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets were defined at the time of this log.</p>
                             )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
           </Accordion>
        </div>
      )}

       {/* Message if no logs exist at all */}
       {!todayLog && previousLogsByDate.length === 0 && targets.length > 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
       {/* Message if no targets exist */}
       {targets.length === 0 && (
           <p className="text-center text-muted-foreground">No UPH targets defined.</p>
       )}

    </div>
  );
};

export default TargetMetricsDisplay;

