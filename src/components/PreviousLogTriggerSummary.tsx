
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon, AlertCircle } from 'lucide-react'; // Added AlertCircle

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  displayTarget: UPHTarget | null; // The target associated with this log (or active if missing)
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, displayTarget }) => {
  const logDate = new Date(log.date + 'T00:00:00');
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  // Calculate UPH based on the provided displayTarget
  const uphForTarget = displayTarget ? calculateDailyUPH(log, displayTarget) : 0;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2 text-sm">
        {/* Left side: Date and Hours */}
        <div className="flex items-center gap-2 flex-shrink-0">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formattedLogDate}</span>
             <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
             {/* Indicate if target is missing */}
             {!displayTarget && (
                <span className="flex items-center gap-1 text-xs text-destructive ml-2" title={`Target ID "${log.targetId || 'None'}" not found`}>
                    <AlertCircle className="h-3 w-3" /> Target Missing
                </span>
             )}
        </div>

        {/* Right side: Summary Stats */}
        <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-1 text-muted-foreground justify-start md:justify-end">
             <div className="flex items-center gap-1" title="Documents Completed">
                 <BookOpen className="h-4 w-4" />
                 <span>{log.documentsCompleted}</span>
             </div>
              <div className="flex items-center gap-1" title="Video Sessions Completed">
                 <Video className="h-4 w-4" />
                 <span>{log.videoSessionsCompleted}</span>
             </div>
              {/* Display Calculated UPH only if a target exists */}
             {displayTarget && (
                 <div className="flex items-center gap-1" title={`Avg UPH (${displayTarget.name})`}>
                    <Clock className="h-4 w-4" />
                    <span>{uphForTarget.toFixed(2)}</span>
                    <span className="text-xs">({displayTarget.name})</span>
                 </div>
             )}
        </div>
    </div>
  );
};

export default PreviousLogTriggerSummary;
