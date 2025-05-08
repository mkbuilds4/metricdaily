
'use client';

import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import TargetMetricsDisplay from './TargetMetricsDisplay'; // The component handling the display logic
import { AlertCircle } from 'lucide-react'; // Import AlertCircle

// --- Component Props ---

interface ProductivityDashboardProps {
  initialWorkLogs: DailyWorkLog[]; // Only today's log (or empty array)
  initialUphTargets: UPHTarget[];
  initialActiveTarget: UPHTarget | null;
  deleteWorkLogAction: (id: string) => void;
  setActiveUPHTargetAction: (id: string) => void; // Action to set the active target
  onGoalMet: (targetId: string, metAt: Date) => void; // New callback prop
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  initialWorkLogs = [],
  initialUphTargets = [],
  initialActiveTarget = null,
  deleteWorkLogAction,
  setActiveUPHTargetAction, // Receive the action
  onGoalMet, // Receive the callback
}) => {

  const todayLog = initialWorkLogs.length > 0 ? initialWorkLogs[0] : null;
  // Find the target specifically associated with today's log, if it exists
  const logTarget = todayLog?.targetId
    ? initialUphTargets.find(t => t.id === todayLog.targetId)
    : null;
  // Determine the target to display: log's target if found, otherwise active target
  const displayTarget = logTarget ?? initialActiveTarget;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Metrics</CardTitle>
         {/* Display Target Info */}
         {displayTarget ? (
             <CardDescription className="text-sm mt-1">
                Metrics calculated against: <span className="font-medium">{displayTarget.name}</span> (Goal UPH: {displayTarget.targetUPH.toFixed(1)})
                {/* Clarify if fallback target is used */}
                {!logTarget && initialActiveTarget && todayLog?.targetId && (
                  <span className="text-xs text-muted-foreground ml-1">(Log's original target missing, using active)</span>
                )}
                 {!logTarget && initialActiveTarget && !todayLog?.targetId && todayLog && (
                   <span className="text-xs text-muted-foreground ml-1">(Using active target)</span>
                )}
                 <br/> <span className="text-xs italic text-muted-foreground">Click a card below to set it as the active target for the dashboard.</span>
             </CardDescription>
            ) : todayLog && initialUphTargets.length > 0 ? ( // Log exists, targets exist, but no active/associated one found
             <CardDescription className="text-sm text-destructive mt-1 flex items-center gap-1">
                 <AlertCircle className="h-4 w-4" /> No active UPH target set or target for today's log not found. Define/activate one in Log / Targets.
             </CardDescription>
            ) : !todayLog && initialUphTargets.length === 0 ? ( // No log AND no targets
                 <CardDescription className="text-sm text-muted-foreground mt-2">
                    No work log recorded for today and no UPH targets defined yet.
                </CardDescription>
            ) : !todayLog ? ( // No log but targets exist
                 <CardDescription className="text-sm text-muted-foreground mt-2">
                     No work log recorded for today yet. Add one in Log / Targets to see metrics.
                </CardDescription>
            ) : initialUphTargets.length === 0 ? ( // Log exists but no targets defined
             <CardDescription className="text-sm text-muted-foreground mt-1">
                 No UPH targets defined yet. Add one in Log / Targets.
             </CardDescription>
            ) : null
        }
      </CardHeader>
      <CardContent>
        {/* Render the TargetMetricsDisplay, passing today's log and all targets */}
        <TargetMetricsDisplay
            allWorkLogs={initialWorkLogs} // Pass only today's log
            targets={initialUphTargets} // Pass all available targets for context/comparison
            deleteWorkLogAction={deleteWorkLogAction}
            setActiveUPHTargetAction={setActiveUPHTargetAction} // Pass the action down
            onGoalMet={onGoalMet} // Pass callback
            showTodaySection={true} // Only show today's section in this instance
         />
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
