'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DailyWorkLog, UPHTarget, AuditLogActionType } from '@/types'; // Added AuditLogActionType
import { Button } from '@/components/ui/button';
import { Trash2, BookOpen, Video, Clock, AlertCircle, Target as TargetIcon, CheckCircle, ArrowUpDown } from 'lucide-react'; // Added ArrowUpDown
import { useToast } from "@/hooks/use-toast";
import { parse, isValid, format, addMinutes, addDays } from 'date-fns';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'; // Import Table components
import {
    calculateDailyUnits,
    calculateDailyUPH,
    calculateRequiredUnitsForTarget,
    formatDateISO,
    formatFriendlyDate,
    calculateRemainingUnits,
    calculateTimeAheadBehindSchedule,
    formatTimeAheadBehind,
    calculateProjectedGoalHitTime,
    formatDurationFromMinutes,
    calculateCurrentMetrics,
} from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import PreviousLogTriggerSummary from './PreviousLogTriggerSummary';
import { cn } from '@/lib/utils';

// Define sortable columns type locally if needed or import from page
type SortableColumn = keyof Pick<DailyWorkLog, 'date' | 'hoursWorked' | 'documentsCompleted' | 'videoSessionsCompleted'> | 'avgUPH';
type SortDirection = 'asc' | 'desc';

interface TargetMetricsDisplayProps {
  allWorkLogs: DailyWorkLog[]; // Now receives filtered and sorted logs
  targets: UPHTarget[];
  deleteWorkLogAction: (id: string) => void;
  showTodaySection?: boolean;
  paginatePreviousLogs?: boolean; // Keep this? Likely false if handled by parent
  showSortingHeaders?: boolean; // New prop to control header visibility/functionality
  currentSortColumn?: SortableColumn | null; // Pass current sort state from parent
  currentSortDirection?: SortDirection; // Pass current sort state from parent
  onSort?: (column: SortableColumn) => void; // Pass sort handler from parent
  renderSortIcon?: (column: SortableColumn) => React.ReactNode; // Pass icon renderer from parent
}


const TargetMetricsDisplay: React.FC<TargetMetricsDisplayProps> = ({
  allWorkLogs = [], // Receives pre-filtered and pre-sorted logs
  targets = [],
  deleteWorkLogAction,
  showTodaySection = true,
  paginatePreviousLogs = false, // Likely unused now
  showSortingHeaders = false, // Default to false
  currentSortColumn,
  currentSortDirection,
  onSort,
  renderSortIcon,
}) => {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [todayGoalMetTimes, setTodayGoalMetTimes] = useState<Record<string, Date | null>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Derived state based on props (logs are already filtered/sorted)
  const { todayLog, previousLogsByDate } = useMemo(() => {
    const todayDateStr = formatDateISO(new Date());
    let foundTodayLog: DailyWorkLog | null = null;
    const prevLogs: DailyWorkLog[] = []; // Simple array, no need for grouping by date here

    // Use the passed-in logs directly
    allWorkLogs.forEach(log => {
      if (showTodaySection && log.date === todayDateStr && !foundTodayLog) {
        foundTodayLog = log;
      } else if (log.date !== todayDateStr) {
        prevLogs.push(log);
      }
    });

    // No need to sort again here, assuming parent sorted
    return {
      todayLog: showTodaySection ? foundTodayLog : null,
      previousLogsByDate: prevLogs // Now just an array of previous logs
    };
  }, [allWorkLogs, showTodaySection]);

  // Timer effect remains the same
  useEffect(() => {
    if (typeof window !== 'undefined' && showTodaySection && isClient) {
        setCurrentTime(new Date());
        const timerId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timerId);
    }
  }, [showTodaySection, isClient]);

  // Goal met time logic remains the same
  useEffect(() => {
    if (typeof window === 'undefined' || !showTodaySection || !currentTime || !todayLog || !isClient) {
        if (Object.keys(todayGoalMetTimes).length > 0) {
            setTodayGoalMetTimes({});
        }
        return;
    }

    const newMetTimes = { ...todayGoalMetTimes };
    let changed = false;

    targets.forEach(target => {
        const { currentUnits } = calculateCurrentMetrics(todayLog, target, currentTime);
        const targetUnitsForShift = calculateRequiredUnitsForTarget(todayLog.hoursWorked, target.targetUPH);
        const isCurrentlyMet = currentUnits >= targetUnitsForShift && targetUnitsForShift > 0;
        const wasPreviouslyMet = !!newMetTimes[target.id];

        if (isCurrentlyMet && !wasPreviouslyMet) {
            newMetTimes[target.id] = currentTime;
            changed = true;
        } else if (!isCurrentlyMet && wasPreviouslyMet) {
            // Keep the existing met time if it was already set
        }
    });

    if (changed) {
        setTodayGoalMetTimes(newMetTimes);
    }
  }, [todayLog, targets, currentTime, showTodaySection, todayGoalMetTimes, isClient]);


  const activeTarget = useMemo(() => targets.find(t => t.isActive) ?? (targets.length > 0 ? targets[0] : null), [targets]);
  const sortedTargetsByUPH = useMemo(() => [...targets].sort((a, b) => a.targetUPH - b.targetUPH), [targets]);


  const handleDeleteLog = (log: DailyWorkLog) => {
     const logDateObj = parse(log.date, 'yyyy-MM-dd', new Date());
     const formattedLogDate = isValid(logDateObj) ? formatFriendlyDate(logDateObj) : log.date;

    if (!confirm(`Are you sure you want to delete the log for ${formattedLogDate}?`)) {
      return;
    }
    try {
      deleteWorkLogAction(log.id);
      toast({ title: "Log Deleted", description: `Work log for ${formattedLogDate} has been deleted.`});
      // Parent component will reload data and pass updated logs
    } catch (error) {
      console.error("Failed to delete work log:", error);
      toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the work log." });
    }
  };

   // No internal pagination needed


  const renderTargetMetricCard = (log: DailyWorkLog, target: UPHTarget, isToday: boolean) => {
      const totalActualUnits = calculateDailyUnits(log, target);
      const totalRequiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
      const dailyUPHForTarget = calculateDailyUPH(log, target);

      let projectedHitTimeFormatted = '-';
      let currentMetrics = { currentUnits: 0, currentUPH: 0 };
      let timeAheadBehindSeconds: number | null = null;
      const goalMetTimeForThisTarget = isToday && todayGoalMetTimes[target.id] ? todayGoalMetTimes[target.id] : null;
      let unitsToGoal = 0;

       if (isToday && currentTime) {
           currentMetrics = calculateCurrentMetrics(log, target, currentTime);
           unitsToGoal = totalRequiredUnits - currentMetrics.currentUnits;
           if (goalMetTimeForThisTarget) {
               timeAheadBehindSeconds = 0; // Indicate met
               projectedHitTimeFormatted = '-';
           } else {
               timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, currentTime);
               projectedHitTimeFormatted = calculateProjectedGoalHitTime(log, target, timeAheadBehindSeconds, currentTime, shiftEndDate); // Pass shift end date
           }
       } else if (!isToday) {
           unitsToGoal = totalRequiredUnits - totalActualUnits;
           timeAheadBehindSeconds = calculateTimeAheadBehindSchedule(log, target, null); // Calculate difference for the full day log
           projectedHitTimeFormatted = '-'; // No projection for past days
       }
       unitsToGoal = parseFloat(unitsToGoal.toFixed(2));

      // Determine shift end date once for the log if needed for projected time
      let shiftEndDate: Date | null = null;
      if (isToday && log) {
            const parsedEndTime = parse(log.endTime, 'HH:mm', new Date());
            if (isValid(parsedEndTime)) {
                 const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
                 if (isValid(logDate)) {
                    shiftEndDate = new Date(logDate);
                    shiftEndDate.setHours(parsedEndTime.getHours());
                    shiftEndDate.setMinutes(parsedEndTime.getMinutes());
                    // Basic overnight handling - might need refinement
                    const parsedStartTime = parse(log.startTime, 'HH:mm', new Date());
                    if (isValid(parsedStartTime) && parsedEndTime < parsedStartTime) {
                        shiftEndDate = addDays(shiftEndDate, 1);
                    }
                 }
            }
      }


      return (
        <Card key={`${log.id}-${target.id}`} className="flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{target.name}</CardTitle>
                     {/* Show units difference for both today and previous, but format differently */}
                     <span className={cn(
                        "text-base font-medium",
                         unitsToGoal > 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500' // Red if short, Green if met/ahead
                        )}>
                        {unitsToGoal > 0 ? `-${unitsToGoal.toFixed(2)}` : (unitsToGoal === 0 ? 'Met' : `+${Math.abs(unitsToGoal).toFixed(2)}`)} Units
                     </span>
                 </div>
                <CardDescription>Goal UPH: {target.targetUPH.toFixed(1)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                 {isToday ? (
                     <>
                        <div>
                            <p className="text-muted-foreground">Units Now</p>
                            <p className="font-medium tabular-nums">{currentMetrics.currentUnits.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Units to Goal</p>
                            <p className="font-medium tabular-nums">
                                {unitsToGoal > 0 ? unitsToGoal.toFixed(2) : (
                                    <>
                                        <CheckCircle className="inline-block h-4 w-4 mr-1 text-green-600 dark:text-green-500"/> Met
                                    </>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Current UPH</p>
                            <p className="font-medium tabular-nums">{currentMetrics.currentUPH.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-muted-foreground">Schedule Status</p>
                             <p className={cn("font-medium tabular-nums",
                                goalMetTimeForThisTarget && "text-green-600 dark:text-green-500",
                                !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds > 0 && "text-green-600 dark:text-green-500",
                                !goalMetTimeForThisTarget && timeAheadBehindSeconds !== null && timeAheadBehindSeconds < 0 && "text-red-600 dark:text-red-500"
                                )}>
                                {goalMetTimeForThisTarget ? (
                                    <>
                                        <CheckCircle className="inline-block h-4 w-4 mr-1"/>
                                        {/* Met at {format(goalMetTimeForThisTarget, 'h:mm:ss a')} */}
                                    </>
                                ) : (
                                    formatTimeAheadBehind(timeAheadBehindSeconds)
                                )}
                             </p>
                         </div>
                         <div className="col-span-2">
                             <p className="text-muted-foreground">Est. Goal Hit Time</p>
                             <p className="font-medium tabular-nums">
                                {goalMetTimeForThisTarget ? `Met at ${format(goalMetTimeForThisTarget, 'h:mm:ss a')}` : projectedHitTimeFormatted}
                             </p>
                         </div>
                    </>
                 ) : ( // Previous Logs
                     <>
                       <div>
                           <p className="text-muted-foreground">Units Completed</p>
                           <p className="font-medium tabular-nums">{totalActualUnits.toFixed(2)}</p>
                       </div>
                       <div>
                            <p className="text-muted-foreground">Avg Daily UPH</p>
                            <p className="font-medium tabular-nums">{dailyUPHForTarget.toFixed(2)}</p>
                       </div>
                       <div>
                            <p className="text-muted-foreground">Target Units</p>
                            <p className="font-medium tabular-nums">{totalRequiredUnits.toFixed(2)}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Schedule Result</p>
                          <p className={cn(
                            "font-medium tabular-nums",
                            timeAheadBehindSeconds === null ? "text-muted-foreground" :
                            timeAheadBehindSeconds > 0 ? "text-green-600 dark:text-green-500" :
                            timeAheadBehindSeconds < 0 ? "text-red-600 dark:text-red-500" : ""
                          )}>
                             {formatTimeAheadBehind(timeAheadBehindSeconds)}
                          </p>
                      </div>
                     </>
                 )}
            </CardContent>
        </Card>
      );
  };

   const renderLogSummaryCard = (log: DailyWorkLog, isToday: boolean) => {
        const logTarget = targets.find(t => t.id === log.targetId);
        // Use the log's target if available, otherwise fallback to active for calculations
        const targetForSummaryCalc = logTarget ?? activeTarget;

        let summaryUPH: number | null = null;
        let currentUnitsNow: number | null = null;
        let currentUPHNow: number | null = null;

        if (targetForSummaryCalc) {
            if (isToday && currentTime && isClient) {
                const metrics = calculateCurrentMetrics(log, targetForSummaryCalc, currentTime);
                summaryUPH = metrics.currentUPH; // UPH based on time elapsed so far
                currentUnitsNow = metrics.currentUnits;
            } else if (!isToday) {
                summaryUPH = calculateDailyUPH(log, targetForSummaryCalc); // Avg UPH for the whole day
            }
        }

        const summaryTargetName = targetForSummaryCalc ? targetForSummaryCalc.name : 'N/A';
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;
        const totalUnits = targetForSummaryCalc ? calculateDailyUnits(log, targetForSummaryCalc) : 0;
        const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
        const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;


        return (
            <Card className="mb-4 relative shadow-sm">
                 <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-xl">
                                {isToday ? `Today (${formattedLogDate})` : formattedLogDate}
                            </CardTitle>
                             <CardDescription>
                                {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime})
                                <br/>
                                Break: {breakTimeFormatted}
                                {trainingTimeFormatted && ` | Training: ${trainingTimeFormatted}`}
                                {targetForSummaryCalc && ` (Context: ${summaryTargetName})`}
                                {!targetForSummaryCalc && targets.length > 0 && <span className="text-destructive ml-2">(Log target missing, no active target)</span>}
                                {!targetForSummaryCalc && targets.length === 0 && <span className="text-muted-foreground ml-2">(No targets defined)</span>}
                            </CardDescription>
                         </div>
                           {/* No delete button here for today's log */}
                    </div>
                </CardHeader>
                 <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      {isToday && currentUnitsNow !== null && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                                <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Now ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{currentUnitsNow.toFixed(2)}</p>
                              </div>
                           </div>
                      )}
                       {!isToday && targetForSummaryCalc && (
                           <div className="flex items-center space-x-2">
                               <TargetIcon className="h-5 w-5 text-muted-foreground" />
                               <div>
                                 <p className="text-sm text-muted-foreground">Units Completed ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{totalUnits.toFixed(2)}</p>
                              </div>
                           </div>
                       )}
                     {summaryUPH !== null && targetForSummaryCalc && (
                         <div className="flex items-center space-x-2">
                             <Clock className="h-5 w-5 text-muted-foreground" />
                             <div>
                                 <p className="text-sm text-muted-foreground">{isToday ? `Current Daily UPH` : `Avg Daily UPH`} ({summaryTargetName})</p>
                                 <p className="text-lg font-semibold">{summaryUPH.toFixed(2)}</p>
                             </div>
                         </div>
                     )}
                 </CardContent>
                 {log.notes && (
                    <CardFooter className="pt-3">
                        <p className="text-sm text-muted-foreground italic">Notes: {log.notes}</p>
                    </CardFooter>
                 )}
            </Card>
        );
   }

  if (!isClient) {
     return <div className="p-4 text-center text-muted-foreground">Loading metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {showTodaySection && todayLog && (
        <div>
          {renderLogSummaryCard(todayLog, true)}

           {targets.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTargetsByUPH.map((target) => renderTargetMetricCard(todayLog, target, true))}
             </div>
            ) : (
                <p className="text-center text-muted-foreground mt-4">No UPH targets defined to calculate metrics.</p>
            )}
        </div>
      )}

      {showTodaySection && todayLog && previousLogsByDate.length > 0 && <Separator className="my-6" />}

       {previousLogsByDate.length > 0 && (
         <div>
             {/* Conditional Title for Previous Logs */}
            {(!showTodaySection || (showTodaySection && !todayLog)) && !showSortingHeaders && (
                <h3 className="text-xl font-semibold mb-3">Previous Logs</h3>
            )}

             {/* Render Previous Logs - Use Table for sortable view */}
             {showSortingHeaders && onSort && renderSortIcon ? (
                 <Card>
                    <CardHeader>
                         <CardTitle>Previous Log Details</CardTitle>
                         <CardDescription>Detailed view of past work logs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => onSort('date')} className="px-0 hover:bg-transparent">
                                            Date {renderSortIcon('date')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => onSort('hoursWorked')} className="px-0 hover:bg-transparent">
                                            Hours {renderSortIcon('hoursWorked')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => onSort('documentsCompleted')} className="px-0 hover:bg-transparent">
                                            Docs {renderSortIcon('documentsCompleted')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                         <Button variant="ghost" onClick={() => onSort('videoSessionsCompleted')} className="px-0 hover:bg-transparent">
                                            Videos {renderSortIcon('videoSessionsCompleted')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => onSort('avgUPH')} className="px-0 hover:bg-transparent">
                                            Avg UPH {renderSortIcon('avgUPH')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previousLogsByDate.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{formatFriendlyDate(log.date)}</TableCell>
                                        <TableCell>{log.hoursWorked.toFixed(2)}</TableCell>
                                        <TableCell>{log.documentsCompleted}</TableCell>
                                        <TableCell>{log.videoSessionsCompleted}</TableCell>
                                        <TableCell>{activeTarget ? calculateDailyUPH(log, activeTarget).toFixed(2) : '-'}</TableCell>
                                        <TableCell className="text-right">
                                             {/* Add delete button or other actions */}
                                             <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive h-7 w-7"
                                                onClick={() => handleDeleteLog(log)}
                                                title="Delete This Log"
                                                aria-label="Delete This Log"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                 </Card>
             ) : (
                 <Accordion type="multiple" className="w-full space-y-1">
                    {previousLogsByDate.map((log) => {
                        const logTarget = targets.find(t => t.id === log.targetId);
                        const targetForCalc = logTarget ?? activeTarget;

                        return (
                        <AccordionItem value={log.id} key={log.id} className="border-none bg-card rounded-md overflow-hidden shadow-sm">
                            <AccordionTrigger className="p-4 hover:bg-muted/30 rounded-t-md transition-colors w-full group data-[state=open]:bg-muted/50" hideChevron>
                                <PreviousLogTriggerSummary log={log} allTargets={targets} onDelete={() => handleDeleteLog(log)} />
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border-t bg-muted/10 rounded-b-md">
                                {renderLogSummaryCard(log, false)}
                                {!logTarget && targetForCalc && (
                                    <div className="mb-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 px-2 py-1 bg-orange-500/10 rounded-md">
                                        <AlertCircle className="h-4 w-4" />
                                        Target (ID: {log.targetId || 'None'}) associated with this log was not found. Metrics below use {targetForCalc === activeTarget ? `active target (${activeTarget?.name || 'None'})` : 'first available target'} as fallback.
                                    </div>
                                )}
                                {!logTarget && !targetForCalc && targets.length > 0 && (
                                    <div className="mb-4 flex items-center gap-2 text-sm text-destructive px-2 py-1 bg-destructive/10 rounded-md">
                                        <AlertCircle className="h-4 w-4" />
                                        Target (ID: {log.targetId || 'None'}) not found, and no active target set. Cannot calculate target-specific metrics accurately.
                                    </div>
                                )}
                                {targets.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                        {sortedTargetsByUPH.map(displayTarget => renderTargetMetricCard(log, displayTarget, false))}
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground mt-4">No UPH targets defined.</p>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        );
                    })}
                </Accordion>
             )}
         </div>
       )}

       {(!showTodaySection || !todayLog) && previousLogsByDate.length === 0 && !showSortingHeaders && (
           <p className="text-center text-muted-foreground py-6">No previous work logs found.</p>
       )}
    </div>
  );
};

export default TargetMetricsDisplay;
