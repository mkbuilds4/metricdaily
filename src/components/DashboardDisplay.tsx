
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
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  initialWorkLogs = [],
  initialUphTargets = [],
  initialActiveTarget = null,
  deleteWorkLogAction,
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
                {!logTarget && initialActiveTarget && todayLog?.targetId && (
                  <span className="text-xs text-muted-foreground ml-1">(Log's original target missing, using active)</span>
                )}
             </CardDescription>
            ) : initialUphTargets.length > 0 && !displayTarget ? ( // Targets exist but none active or associated
             <CardDescription className="text-sm text-destructive mt-1 flex items-center gap-1">
                 <AlertCircle className="h-4 w-4" /> No active UPH target set and log has no target. Define/activate one.
             </CardDescription>
            ) : initialUphTargets.length === 0 ? ( // No targets defined at all
             <CardDescription className="text-sm text-muted-foreground mt-1">
                 No UPH targets defined yet. Add one in Log / Targets.
             </CardDescription>
            ) : null
        }
             {/* Message if no log exists for today */}
             {initialWorkLogs.length === 0 && (
                 <CardDescription className="text-sm text-muted-foreground mt-2">
                     No work log recorded for today yet. Add one in Log / Targets to see metrics.
                </CardDescription>
            )}
      </CardHeader>
      <CardContent>
        {/* Render the TargetMetricsDisplay, passing today's log and all targets */}
        <TargetMetricsDisplay
            allWorkLogs={initialWorkLogs} // Pass only today's log
            targets={initialUphTargets} // Pass all available targets for context/comparison
            deleteWorkLogAction={deleteWorkLogAction}
            showTodaySection={true}
         />
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
