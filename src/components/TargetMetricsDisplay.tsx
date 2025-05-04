
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'; // Added pagination icons
import { useToast } from "@/hooks/use-toast";
import { parse, addDays, addHours, format, addMinutes, isValid } from 'date-fns';
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
    calculateCurrentMetrics,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary';
import { cn } from '@/lib/utils'; // Import cn

const ITEMS_PER_PAGE = 10; // Number of previous logs to show per page

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[];
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  showTodaySection?: boolean;
  paginatePreviousLogs?: boolean; // New prop to enable/disable pagination
}

const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [],
  targets = [],
  deleteWorkLogAction,
  showTodaySection = true,
  paginatePreviousLogs = false, // Default to false
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1); // State for pagination

  useEffect(() => {
    // Defer setting current time until client-side mount
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timerId);
  }, []);


  const { todayLog, paginatedPreviousLogs, totalPages } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogsMap: Record<string, DailyWorkLog[]> = {};

    // Ensure logs are sorted consistently regardless of input order
    const sortedLogs = [...allWorkLogs].sort((a, b) => b.date.localeCompare(a.date));

    sortedLogs.forEach(log => {
        // Basic validation for date format
        if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
             const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
             if (isValid(logDate)) {
                if (showTodaySection && log.date === todayDateStr && !foundTodayLog) {
                    foundTodayLog = log;
                } else if (log.date !== todayDateStr) {
                    if (!prevLogsMap[log.date]) {
                        prevLogsMap[log.date] = [];
                    }
                     // Ensure only one log per date for previous logs (the most recent if multiple existed for a day)
                     if (prevLogsMap[log.date].length === 0) {
                        prevLogsMap[log.date].push(log);
                     }
                }
             } else {
                 console.warn("Skipping log due to invalid parsed date:", log);
             }
        } else {
            console.warn("Skipping log due to invalid date format string:", log);
        }
    });

    // Create the initial grouped array, sorted
    const allPrevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Ensure 'log' property exists
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates descending (most recent first)


    // --- Pagination Logic ---
    let paginatedLogs: typeof allPrevLogsGrouped = allPrevLogsGrouped;
    let calculatedTotalPages = 1;

    if (paginatePreviousLogs && allPrevLogsGrouped.length > 0) {
        calculatedTotalPages = Math.ceil(allPrevLogsGrouped.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        paginatedLogs = allPrevLogsGrouped.slice(startIndex, endIndex);
    } else {
         // If not paginating, still calculate total pages as 1 if there are items
         calculatedTotalPages = allPrevLogsGrouped.length > 0 ? 1 : 0;
    }


    return {
        todayLog: showTodaySection ? foundTodayLog : null,
        paginatedPreviousLogs: paginatedLogs,
        totalPages: calculatedTotalPages
    };
  }, [allWorkLogs, showTodaySection, paginatePreviousLogs, currentPage]); // Add pagination deps


  const sortedTargets = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);
  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      // No toast here, handled by the caller page
      // toast({
      //   title: "Log Deleted",
      //   description: `Work log for ${formattedLogDate} deleted successfully.`,
      // });
       // If the deleted log was on the current page, potentially adjust page number
       if (paginatedPreviousLogs.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
       }
    } catch (error) {
      console.error("Failed to delete work log:", error);
      // Let caller handle toast
      // toast({
      //   variant: "destructive",
      //   title: "Deletion Failed",
      //   description: error instanceof Error ? error.message : "Could not delete the work log.",
      // });
    }
  };


  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      const totalActualUnits = calculateDailyUnits(log, target);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      const totalDifferenceUnits = calculateRemainingUnits(log, target); // +/- goal units for the *logged duration*
      const dailyUPHForTarget = calculateDailyUPH(log, target); // Avg UPH for the *logged duration*

      let projectedTimeResult = { projectedTime: '-', remainingDuration: '-' };
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };

       if (isToday && currentTime) {
           projectedTimeResult = calculateProjectedGoalHitTime(log, target, currentTime);
           currentMetrics = calculateCurrentMetrics(log, target, currentTime); // Includes current UPH based on time elapsed
       }

      const isBehind = totalDifferenceUnits < 0;

      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                     {/* Show +/- only for previous logs card */}
                     {!isToday && (
                         <span className={`text-base font-medium ${isBehind ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                            {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)} Units
                         </span>
                     )}
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? ( // Today's view focuses on current state and projection
                     <>
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Est. Goal Hit</p>
                            <p className="font-medium">{projectedTimeResult.projectedTime}</p>
                        </div>
                         <div>
                             <p className="text-muted-foreground">Time Remaining</p>
                             <p className="font-medium">{projectedTimeResult.remainingDuration}</p>
                         </div>
                    </>
                 ) : ( // Previous log view shows summary stats for the completed day
                     <>
                       <div>
                           <p className="text-muted-foreground">Units Completed</p>
                           <p className="font-medium">{totalActualUnits.toFixed(2)}</p>
                       </div>
                       <div>
                          <p className="text-muted-foreground">Avg Daily UPH</p>
                          <p className="font-medium">{dailyUPHForTarget.toFixed(2)}</p>
                       </div>
                       <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium">{totalRequiredUnits.toFixed(2)}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">+/- Goal</p>
                          <p className={`font-medium ${isBehind ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                             {(totalDifferenceUnits >= 0 ? '+' : '') + totalDifferenceUnits.toFixed(2)}
                          </p>
                      </div>
                     </>
                 )}
            </CardContent>
        </Card>
      );
  };

   // Renders the top-level summary for a log (either Today or a Previous day trigger/content)
   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean, allTargets: UPHTarget[]) => {
        // For summary UPH, use active target or first target as context
        const summaryTarget = activeTarget ?? (allTargets.length > 0 ? allTargets[0] : null);

        let overallUPHForSummary: number | null = null;
        if (summaryTarget && isToday && currentTime) {
            // Today: show UPH based on time elapsed so far
            overallUPHForSummary = calculateCurrentMetrics(log, summaryTarget, currentTime).currentUPH;
        } else if (summaryTarget && !isToday) {
            // Previous: show average UPH for the whole logged duration
            overallUPHForSummary = calculateDailyUPH(log, summaryTarget);
        }

        const summaryTargetName = summaryTarget ? summaryTarget.name : (allTargets.length > 0 ? 'First Target' : 'N/A');
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date; // Fallback to raw string if invalid

        return (
            <Card className={cn("mb-4 relative", !isToday && "shadow-none border-none bg-transparent")}>
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime}, {log.breakDurationMinutes} min break)
                            </CardDescription>
                         </div>
                         {/* Delete button only inside previous log accordion content */}
                         {!isToday && (
                           <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive h-8 w-8 absolute top-2 right-2"
                              onClick={(e) => { e.stopPropagation(); handleDeleteLog(log); }} // Stop propagation to prevent accordion toggle
                              title="Delete This Log"
                              aria-label="Delete This Log"
                            >
                                <Trash2 className="h-4 w-4" />
                           </Button>
                         )}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {/* Documents Completed */}
                     <div className="flex items-center space-x-2">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Docs</p>
                            <p className="text-lg font-semibold">{log.documentsCompleted}</p>
                        </div>
                    </div>
                     {/* Video Sessions Completed */}
                     <div className="flex items-center space-x-2">
                         <Video className="h-5 w-5 text-muted-foreground" />
                         <div>
                             <p className="text-sm text-muted-foreground">Videos</p>
                             <p className="text-lg font-semibold">{log.videoSessionsCompleted}</p>
                         </div>
                     </div>
                     {/* Overall UPH (Current or Avg depending on context) */}
                     {overallUPHForSummary !== null && (
                         <div className="flex items-center space-x-2">
                             <Clock className="h-5 w-5 text-muted-foreground" />
                             <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? `Current Daily UPH` : `Avg UPH`} ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{overallUPHForSummary.toFixed(2)}</p>
                             </div>
                         </div>
                     )}
                     {/* Total Units Completed (Shown for both contexts now) */}
                      {summaryTarget && ( // Only show if there's a target context
                           <div className="flex items-center space-x-2">
                               {/* You can add an icon if desired, e.g., Sigma */}
                               <div>
                                 <p className="text-sm text-muted-foreground">Total Units ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{calculateDailyUnits(log, summaryTarget).toFixed(2)}</p>
                              </div>
                           </div>
                      )}
                 </CardContent>
                 {/* Optional Notes */}
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
      {/* === Today's Log Section === */}
      {showTodaySection && todayLog && (
        <div>
          {renderLogSummaryCard(todayLog, true, sortedTargets)}

           {sortedTargets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTargets.map((target) => renderTargetMetricCard(todayLog, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {/* Separator if both Today and Previous logs are shown */}
      {showTodaySection && todayLog && paginatedPreviousLogs.length > 0 && <Separator className="my-6" />}

      {/* === Previous Logs Section (with Accordion and Pagination) === */}
      {paginatedPreviousLogs.length > 0 && (
        <div>
           {/* Show Title only if needed (e.g., on previous logs page) */}
           {(!showTodaySection || (showTodaySection && todayLog)) && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
           )}
           <Accordion type="multiple" className="w-full space-y-1">
               {paginatedPreviousLogs.map(({ date, log }) => (
                    <AccordionItem value={date} key={date} className="border-b bg-muted/20 rounded-md">
                        {/* Custom Trigger using asChild */}
                        <AccordionTrigger asChild className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group hover:no-underline focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted/50">
                           <div className="flex items-center justify-between w-full gap-4">
                             <div className="flex-grow">
                               {/* Pass all targets for summary calculation */}
                               <PreviousLogTriggerSummary log={log} allTargets={sortedTargets} />
                             </div>
                             {/* Chevron managed by AccordionTrigger default rendering */}
                             <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                           </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                             {/* Render the detailed breakdown inside the content */}
                             {renderLogSummaryCard(log, false, sortedTargets)}
                             {sortedTargets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {sortedTargets.map(target => renderTargetMetricCard(log, target, false))}
                                 </div>
                                ) : (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets were defined at the time of this log.</p>
                             )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
           </Accordion>

           {/* Pagination Controls */}
           {paginatePreviousLogs && totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* === Messages for No Data === */}
       {(!showTodaySection || !todayLog) && paginatedPreviousLogs.length === 0 && (
           <p className="text-center text-muted-foreground">No work logs found.</p>
       )}
       {targets.length === 0 && (
           <p className="text-center text-muted-foreground">No UPH targets defined.</p>
       )}

    </div>
  );
};

export default TargetMetricsDisplay;

    