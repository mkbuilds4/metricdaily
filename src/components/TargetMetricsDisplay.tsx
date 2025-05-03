
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Button } from '@/components/ui/button'; // Import Button
import { Trash2, Clock, Calendar, BookOpen, Video } from 'lucide-react'; // Import icons
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { isValid } from 'date-fns'; // Import isValid
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"; // Import Accordion components
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"; // Import Card components
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDurationFromHours,
    calculateProjectedGoalHitTime,
    formatDateISO,
    formatFriendlyDate,
    calculateRemainingUnits, // Import the difference calculator
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
        // Ensure the log has a valid date format before comparing
        if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
            if (log.date === todayDateStr && !foundTodayLog) {
              foundTodayLog = log;
            } else if (log.date !== todayDateStr) {
                if (!prevLogsMap[log.date]) {
                    prevLogsMap[log.date] = [];
                }
                // Store the first unique log for each previous date
                 if (prevLogsMap[log.date].length === 0) {
                   prevLogsMap[log.date].push(log);
                }
            }
        } else {
            console.warn("Skipping log due to invalid date format:", log);
        }
    });

     // Convert map to array and sort by date descending
    const prevLogsGrouped = Object.entries(prevLogsMap)
                                .map(([date, logs]) => ({ date, log: logs[0] })) // Take the first log found for that date
                                .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date string descending

    return { todayLog: foundTodayLog, previousLogsByDate: prevLogsGrouped };
  }, [allWorkLogs]);


  const sortedTargets = [...targets].sort((a, b) => a.targetUPH - b.targetUPH);
  const activeTarget = targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDate = new Date(log.date + 'T00:00:00'); // Add time component for safer parsing
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

  // --- Helper Function to Render a Metric Card (Used for Targets) ---
  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      const actualUnits = calculateDailyUnits(log, target);
      const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      // Use calculateRemainingUnits which calculates Actual - Required
      const differenceUnits = calculateRemainingUnits(log, target);

      let goalHitTimeFormatted = '-';
       if (isToday && currentTime) {
           // Use the updated calculation function
           goalHitTimeFormatted = calculateProjectedGoalHitTime(log, target, currentTime);
       }

      const isBehind = differenceUnits < 0;

      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                    {/* Display +/- Target in the header */}
                     {/* Positive means ahead, Negative means behind */}
                    <span className={`text-lg font-bold ${isBehind ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                        {(differenceUnits >= 0 ? '+' : '') + differenceUnits.toFixed(2)} Units
                    </span>
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {/* Only show Actual Units once per day in the summary card */}
                {!isToday && (
                    <div>
                        <p className="text-muted-foreground">Actual Units</p>
                        <p className="font-medium">{actualUnits.toFixed(2)}</p>
                    </div>
                )}
                 <div>
                    <p className="text-muted-foreground">Units Needed</p>
                    <p className="font-medium">{requiredUnits.toFixed(2)}</p>
                </div>
                {/* Removed Actual UPH from here as requested */}

                {isToday && (
                     <div>
                        <p className="text-muted-foreground">Est. Goal Hit</p>
                        <p className="font-medium">{goalHitTimeFormatted}</p>
                    </div>
                )}
            </CardContent>
        </Card>
      );
  };

   // --- Helper Function to Render a Summary Card for a Log ---
   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean) => {
        // Calculate Actual UPH using the active target (or first if none active)
        const summaryUPH = activeTarget && log.hoursWorked > 0 ? calculateDailyUPH(log, activeTarget) : 0;
        const summaryTargetName = activeTarget ? activeTarget.name : (targets.length > 0 ? 'First Target' : 'N/A');
        const logDate = new Date(log.date + 'T00:00:00'); // Add time component for parsing
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date; // Fallback to raw string if invalid

        return (
            <Card className="mb-4 relative group w-full"> {/* Added w-full */}
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
                           {/* Delete Button - Positioned absolutely within the CardHeader */}
                           <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10" // Ensure z-index
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
                </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Actual UPH</p>
                            <p className="text-lg font-semibold">{summaryUPH.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                         <Calendar className="h-5 w-5 text-muted-foreground" />
                         <div>
                             <p className="text-sm text-muted-foreground">vs. Target</p>
                             <p className="text-lg font-semibold">{summaryTargetName}</p>
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
          {renderLogSummaryCard(todayLog, true)}

           {/* Grid for Target Metric Cards */}
           {sortedTargets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
           <Accordion type="multiple" className="w-full space-y-4">
               {previousLogsByDate.map(({ date, log }) => (
                    <AccordionItem value={date} key={date} className="border-none rounded-lg overflow-hidden shadow-sm"> {/* Removed border, added shadow */}
                        <AccordionTrigger asChild className="p-0 data-[state=open]:bg-muted/30 transition-colors w-full text-left rounded-t-lg cursor-pointer"> {/* Use asChild and add cursor-pointer */}
                            {/* Render summary card inside a div */}
                             <div className="w-full"> {/* Ensure the div takes full width */}
                                {renderLogSummaryCard(log, false)}
                             </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-lg"> {/* Add border-t */}
                             {/* Detailed breakdown inside the content */}
                            <h4 className="text-md font-semibold mb-3">Target Breakdown for {formatFriendlyDate(new Date(date + 'T00:00:00'))}</h4>
                             {sortedTargets.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedTargets.map(target => renderTargetMetricCard(log, target, false))}
                                 </div>
                                ) : (
                                    <p className="text-center text-muted-foreground">No UPH targets were defined at the time of this log.</p>
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

