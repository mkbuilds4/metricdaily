
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH, calculateDailyUnits } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Gauge } from 'lucide-react'; // Added Gauge icon

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  activeTarget: UPHTarget | null;
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({ log, activeTarget }) => {
  const logDate = new Date(log.date + 'T00:00:00');
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;
  const summaryUPH = activeTarget && log.hoursWorked > 0 ? calculateDailyUPH(log, activeTarget) : 0;
  const summaryUnits = activeTarget ? calculateDailyUnits(log, activeTarget) : 0; // Calculate units

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2 text-sm">
        {/* Left side: Date and Hours */}
        <div className="flex items-center gap-2">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formattedLogDate}</span>
             <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
        </div>

        {/* Right side: Summary Stats */}
        <div className="flex items-center gap-3 md:gap-4 text-muted-foreground flex-wrap justify-start md:justify-end"> {/* Added flex-wrap and justify-start */}
             <div className="flex items-center gap-1" title="Documents Completed">
                 <BookOpen className="h-4 w-4" />
                 <span>{log.documentsCompleted}</span>
             </div>
              <div className="flex items-center gap-1" title="Video Sessions Completed">
                 <Video className="h-4 w-4" />
                 <span>{log.videoSessionsCompleted}</span>
             </div>
              {/* Display Calculated Units */}
             {activeTarget && (
                <div className="flex items-center gap-1" title={`Units (${activeTarget?.name})`}>
                    <Gauge className="h-4 w-4" />
                    <span>{summaryUnits.toFixed(2)}</span>
                </div>
             )}
             {/* Display Calculated UPH */}
             {activeTarget && (
                 <div className="flex items-center gap-1" title={`UPH (${activeTarget?.name})`}>
                    <Clock className="h-4 w-4" />
                    <span>{summaryUPH.toFixed(2)} UPH</span>
                 </div>
             )}
        </div>
    </div>
  );
};

export default PreviousLogTriggerSummary;
