import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid, parse } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon, AlertCircle, Trash2 } from 'lucide-react'; // Added AlertCircle, Trash2
import { Button } from './ui/button'; // Import Button

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  allTargets: UPHTarget[]; // Pass all targets to find the correct one
  activeTarget: UPHTarget | null; // Pass active target for fallback calculation
  onDelete: (id: string) => void; // Add delete handler prop
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, allTargets = [], activeTarget, onDelete }) => {
  const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  // Find the specific target associated with this log
  const logTarget = allTargets.find(t => t.id === log.targetId);

  // Determine the target to use for summary calculation (log's target or active target)
  const targetForSummaryCalc = logTarget ?? activeTarget;

  // Calculate Avg UPH based on the determined target
  const avgUPH = targetForSummaryCalc ? calculateDailyUPH(log, targetForSummaryCalc) : null;


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
