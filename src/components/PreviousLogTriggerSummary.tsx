
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid, parse } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH, formatDurationFromMinutes } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon, AlertCircle, Trash2, Brain } from 'lucide-react'; // Added AlertCircle, Trash2, Brain
import { Button } from './ui/button'; // Import Button
import { Separator } from './ui/separator'; // Import Separator

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  allTargets: UPHTarget[]; // Pass all targets to find the correct one
  activeTarget: UPHTarget | null; // Pass active target for fallback calculation
  onDelete: (id: string) => void; // Add delete handler prop
  isExpanded?: boolean; // Optional: To render the full card instead of the trigger
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, allTargets = [], activeTarget, onDelete, isExpanded = false }) => {
  const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  // Find the specific target associated with this log
  const logTarget = allTargets.find(t => t.id === log.targetId);

  // Determine the target to use for summary calculation (log's target or active target)
  const targetForSummaryCalc = logTarget ?? activeTarget;

  // Calculate Avg UPH based on the determined target
  const avgUPH = targetForSummaryCalc ? calculateDailyUPH(log, targetForSummaryCalc) : null;
  const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
  const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;

  if (isExpanded) {
      // Render the full summary card for expanded view
      return (
         <div className="mb-4 relative"> {/* Added relative positioning */}
             <div className="flex justify-between items-start mb-3">
                 <div>
                    <h4 className="text-xl font-semibold">
                        {formattedLogDate}
                    </h4>
                     <p className="text-sm text-muted-foreground">
                        {log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime})
                     </p>
                     <p className="text-sm text-muted-foreground mt-1" title={`Break: ${breakTimeFormatted}`}>
                        <Clock className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" /> {breakTimeFormatted}
                         {trainingTimeFormatted && (
                            <span className="ml-2" title={`Training: ${trainingTimeFormatted}`}>
                                <Brain className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom" /> {trainingTimeFormatted}
                            </span>
                        )}
                     </p>
                     {targetForSummaryCalc ? (
                        <p className="text-xs text-muted-foreground mt-1" title={`Metrics context: ${targetForSummaryCalc.name}`}>
                            (Context: {targetForSummaryCalc.name}{!logTarget && activeTarget ? ' - Active' : ''})
                        </p>
                     ) : (
                         targets.length > 0 ? (
                            <p className="text-xs text-destructive mt-1">(Log target missing, no active target)</p>
                         ) : (
                             <p className="text-xs text-muted-foreground mt-1">(No targets defined)</p>
                         )
                     )}
                 </div>
                  <div onClick={(e) => e.stopPropagation()} className="absolute top-0 right-0 mt-1 mr-1">
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-7 w-7" // Adjusted size
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent accordion toggle
                            onDelete(log.id);
                        }}
                        title="Delete This Log"
                        aria-label="Delete This Log"
                     >
                        <Trash2 className="h-4 w-4" />
                     </Button>
                  </div>
            </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                 <div className="flex items-center space-x-2" title="Documents Completed">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm text-muted-foreground">Docs</p>
                        <p className="text-lg font-semibold">{log.documentsCompleted}</p>
                    </div>
                </div>
                 <div className="flex items-center space-x-2" title="Video Sessions Completed">
                     <Video className="h-5 w-5 text-muted-foreground" />
                     <div>
                         <p className="text-sm text-muted-foreground">Videos</p>
                         <p className="text-lg font-semibold">{log.videoSessionsCompleted}</p>
                     </div>
                 </div>
                   {/* Display Avg/Current UPH */}
                   {avgUPH !== null && targetForSummaryCalc && (
                       <div className="flex items-center space-x-2" title={`Avg Daily UPH (Based on ${targetForSummaryCalc.name})`}>
                           <Clock className="h-5 w-5 text-muted-foreground" />
                           <div>
                             <p className="text-sm text-muted-foreground">Avg Daily UPH</p>
                             <p className="text-lg font-semibold">{avgUPH.toFixed(2)}</p>
                          </div>
                       </div>
                   )}
             </div>
             {log.notes && (
                <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground italic">Notes: {log.notes}</p>
                </div>
             )}
        </div>
      );
  }


  // Render the compact trigger summary
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-x-4 gap-y-2 text-sm">
        {/* Left side: Date, Hours, and Target Info */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formattedLogDate}</span>
             <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
             {/* Indicate target used for calculation */}
             {targetForSummaryCalc ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Calculated with: ${targetForSummaryCalc.name}`}>
                    (<TargetIcon className="h-3 w-3" /> {targetForSummaryCalc.name}{!logTarget && activeTarget ? ' (Active)' : ''})
                </span>
             ) : (
                <span className="flex items-center gap-1 text-xs text-destructive ml-2" title={`Target ID "${log.targetId || 'None'}" not found`}>
                    <AlertCircle className="h-3 w-3" /> Target Missing
                </span>
             )}
        </div>

        {/* Right side: Summary Stats and Delete Button */}
        <div className="flex items-center gap-x-3 md:gap-x-4 gap-y-1 text-muted-foreground flex-wrap justify-start sm:justify-end">
             <div className="flex items-center gap-1" title="Documents Completed">
                 <BookOpen className="h-4 w-4" />
                 <span>{log.documentsCompleted}</span>
             </div>
              <div className="flex items-center gap-1" title="Video Sessions Completed">
                 <Video className="h-4 w-4" />
                 <span>{log.videoSessionsCompleted}</span>
              </div>
              {/* Display SINGLE Average UPH based on the determined target */}
             {avgUPH !== null && avgUPH > 0 && (
                <div className="flex items-center gap-1" title={`Avg UPH (Based on ${targetForSummaryCalc?.name || 'N/A'})`}>
                    <Clock className="h-4 w-4" />
                    <span>{avgUPH.toFixed(2)}</span>
                </div>
             )}
            {/* Delete Button */}
            {/* Wrap Button in a div to prevent it being direct child of button-like AccordionTrigger */}
            <div onClick={(e) => e.stopPropagation()}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-7 w-7 ml-2" // Adjust size/margin
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent accordion toggle
                        onDelete(log.id);
                    }}
                    title="Delete This Log"
                    aria-label="Delete This Log"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );
};

export default PreviousLogTriggerSummary;

