
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid, parse } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon, AlertCircle, Trash2 } from 'lucide-react'; // Added AlertCircle, Trash2
import { Button } from './ui/button'; // Import Button

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  allTargets: UPHTarget[]; // Pass all targets to find the correct one
  onDelete: (id: string) => void; // Add delete handler prop
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, allTargets, onDelete }) => {
  const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  // Find the specific target associated with this log, or fallback to active if necessary
  const displayTarget = allTargets.find(t => t.id === log.targetId) ?? allTargets.find(t => t.isActive);


  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-x-4 gap-y-2 text-sm">
        {/* Left side: Date, Hours, and Target Info */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formattedLogDate}</span>
             <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
             {/* Indicate target used for calculation */}
             {displayTarget ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Calculated with: ${displayTarget.name}`}>
                    (<TargetIcon className="h-3 w-3" /> {displayTarget.name})
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
              {/* Display Calculated UPH for each target */}
             {allTargets.map(target => {
                 const uphForTarget = calculateDailyUPH(log, target);
                 // Only show UPH if it's calculable and positive
                 if (uphForTarget > 0) {
                    return (
                        <div key={target.id} className="flex items-center gap-1" title={`Avg UPH (${target.name})`}>
                            <Clock className="h-4 w-4" />
                            <span>{uphForTarget.toFixed(2)}</span>
                            <span className="text-xs">({target.name})</span>
                        </div>
                    );
                 }
                 return null; // Don't render if UPH is not calculable
             })}
            {/* Delete Button */}
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
  );
};

export default PreviousLogTriggerSummary;
