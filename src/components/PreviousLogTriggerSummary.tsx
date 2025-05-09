
import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { isValid, parse } from 'date-fns';
import { formatFriendlyDate, calculateDailyUPH, formatDurationFromMinutes } from '@/lib/utils';
import { Calendar, Clock, BookOpen, Video, Target as TargetIcon, AlertCircle, Trash2, Brain, ChevronDown, ChevronUp } from 'lucide-react'; // Added AlertCircle, Trash2, Brain
import { Button } from './ui/button'; // Import Button
import { Separator } from './ui/separator'; // Import Separator

interface PreviousLogTriggerSummaryProps {
  log: DailyWorkLog;
  allTargets: UPHTarget[];
  activeTarget: UPHTarget | null;
  onDelete?: (id: string) => void; // Made onDelete optional
  isExpanded?: boolean;
  isDashboardTodayView?: boolean; // Optional: to signal if this is the main dashboard view of today's log
}

const PreviousLogTriggerSummary: React.FC<PreviousLogTriggerSummaryProps> = ({
  log,
  allTargets = [],
  activeTarget,
  onDelete, // Now optional
  isExpanded = false,
  isDashboardTodayView = false, // Default to false
}) => {
  const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
  const formattedLogDate = isValid(logDate) ? formatFriendlyDate(logDate) : log.date;

  const logTarget = allTargets.find(t => t.id === log.targetId);
  const targetForSummaryCalc = logTarget ?? activeTarget;
  const avgUPH = targetForSummaryCalc ? calculateDailyUPH(log, targetForSummaryCalc) : null;
  const breakTimeFormatted = formatDurationFromMinutes(log.breakDurationMinutes * 60);
  const trainingTimeFormatted = log.trainingDurationMinutes && log.trainingDurationMinutes > 0 ? formatDurationFromMinutes(log.trainingDurationMinutes * 60) : null;

  const showDeleteButton = onDelete && !isDashboardTodayView; // Only show if onDelete is provided AND not the dashboard's today view

  if (isExpanded) {
    return (
      <div className="mb-4 relative">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-xl font-semibold">{formattedLogDate}</h4>
            <p className="text-sm text-muted-foreground">{log.hoursWorked.toFixed(2)} hrs ({log.startTime} - {log.endTime})</p>
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
              allTargets.length > 0 ? (
                <p className="text-xs text-destructive mt-1">(Log target missing, no active target)</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">(No targets defined)</p>
              )
            )}
          </div>
          {showDeleteButton && (
            <div onClick={(e) => e.stopPropagation()} className="absolute top-0 right-0 mt-1 mr-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) onDelete(log.id); // Call if provided
                }}
                title="Delete This Log"
                aria-label="Delete This Log"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-x-4 gap-y-2 text-sm p-4 group-hover:bg-muted/30 data-[state=open]:bg-muted/50 rounded-md">
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{formattedLogDate}</span>
        <span className="text-muted-foreground">({log.hoursWorked.toFixed(2)} hrs)</span>
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
      <div className="flex items-center gap-x-3 md:gap-x-4 gap-y-1 text-muted-foreground flex-wrap justify-start sm:justify-end">
        <div className="flex items-center gap-1" title="Documents Completed">
          <BookOpen className="h-4 w-4" />
          <span>{log.documentsCompleted}</span>
        </div>
        <div className="flex items-center gap-1" title="Video Sessions Completed">
          <Video className="h-4 w-4" />
          <span>{log.videoSessionsCompleted}</span>
        </div>
        {avgUPH !== null && avgUPH > 0 && (
          <div className="flex items-center gap-1" title={`Avg UPH (Based on ${targetForSummaryCalc?.name || 'N/A'})`}>
            <Clock className="h-4 w-4" />
            <span>{avgUPH.toFixed(2)}</span>
          </div>
        )}
        {showDeleteButton && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                if (onDelete) onDelete(log.id); // Call if provided
              }}
              title="Delete This Log"
              aria-label="Delete This Log"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviousLogTriggerSummary;
