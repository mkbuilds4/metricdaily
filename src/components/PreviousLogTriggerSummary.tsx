
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon } from 'lucide-react'; // Renamed Target icon import

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  allTargets: UPHTarget[]; // Receive all targets
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, allTargets }) => {
  const logDate = new Date(log.date + 'T00:00:00');
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2 text-sm">
        {/* Left side: Date and Hours */}
        <div className="flex items-center gap-2 flex-shrink-0">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formattedLogDate}</span>
             <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
        </div>

        {/* Right side: Summary Stats - Allow wrapping */}
        <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-1 text-muted-foreground justify-start md:justify-end">
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
                 return (
                     <div key={target.id} className="flex items-center gap-1" title={`Avg UPH (${target.name})`}>
                        <Clock className="h-4 w-4" />
                        <span>{uphForTarget.toFixed(2)}</span>
                        <span className="text-xs">({target.name})</span>
                     </div>
                 );
             })}
        </div>
    </div>
  );
};

export default PreviousLogTriggerSummary;

    