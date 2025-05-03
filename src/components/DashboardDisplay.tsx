
'use client';

import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TargetMetricsDisplay from './TargetMetricsDisplay'; // Import the new component
import { formatDateISO } from '@/lib/utils'; // Import formatDateISO

// --- Component Props ---

interface ProductivityDashboardProps {
  // Receive current data as props from the parent client component
  initialWorkLogs: DailyWorkLog[]; // Receive ALL work logs
  initialUphTargets: UPHTarget[]; // Receive all targets
  initialActiveTarget: UPHTarget | null; // Still useful for context maybe?
  deleteWorkLogAction: (id: string) => void; // Add delete action prop
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  initialWorkLogs = [],
  initialUphTargets = [],
  initialActiveTarget = null, // Kept for potential future use or context display
  deleteWorkLogAction, // Destructure delete action
}) => {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Dashboard</CardTitle>
         {/* Optional: Display Active Target Info or other context */}
         {initialActiveTarget ? (
            <div className="text-sm text-muted-foreground mt-2 p-3 border rounded-md bg-muted/50">
                <h4 className="font-semibold">Current Active Target: {initialActiveTarget.name} (UPH: {initialActiveTarget.targetUPH})</h4>
                 {/* <p>Docs per Unit: {initialActiveTarget.docsPerUnit}</p>
                 <p>Videos per Unit: {initialActiveTarget.videosPerUnit}</p> */}
            </div>
            ) : initialUphTargets.length > 0 ? ( // Only show if targets exist
            <p className="text-sm text-destructive mt-2 p-3 border border-destructive/50 rounded-md bg-destructive/10">No active UPH target set.</p>
            ) : null // Don't show anything if no targets defined yet
        }
             {initialWorkLogs.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">No work logs recorded yet to calculate metrics.</p>
            )}
      </CardHeader>
      <CardContent>
        {/* Render the new TargetMetricsDisplay, passing all logs and delete action */}
        {(initialWorkLogs.length > 0 && initialUphTargets.length > 0) ? (
          <TargetMetricsDisplay
            allWorkLogs={initialWorkLogs} // Pass all logs
            targets={initialUphTargets}
            deleteWorkLogAction={deleteWorkLogAction} // Pass delete action down
          />
        ) : initialWorkLogs.length > 0 && initialUphTargets.length === 0 ? (
           <p className="text-sm text-muted-foreground">No UPH targets defined. Please add targets in the manager above.</p>
        ) : null /* Message handled in header */
        }
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
