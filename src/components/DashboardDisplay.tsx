'use client';

import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import TargetMetricsDisplay from './TargetMetricsDisplay'; // The refactored component
import { formatDateISO } from '@/lib/utils'; // Import formatDateISO (might not be needed here anymore)

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
         {/* Display Active Target Info or other context */}
         {initialActiveTarget ? (
             <CardDescription className="text-sm mt-1">
                Current Active Target: <span className="font-medium">{initialActiveTarget.name}</span> (Goal UPH: {initialActiveTarget.targetUPH})
             </CardDescription>
            ) : initialUphTargets.length > 0 ? ( // Only show if targets exist but none active
            <CardDescription className="text-sm text-destructive mt-1">
                No active UPH target set. Select one in the manager above.
            </CardDescription>
            ) : null // Don't show anything if no targets defined yet
        }
             {initialWorkLogs.length === 0 && (
                 <CardDescription className="text-sm text-muted-foreground mt-2">
                     No work logs recorded yet to calculate metrics. Add a log using the form above.
                </CardDescription>
            )}
      </CardHeader>
      <CardContent>
        {/* Render the refactored TargetMetricsDisplay */}
        <TargetMetricsDisplay
            allWorkLogs={initialWorkLogs} // Pass all logs
            targets={initialUphTargets}
            deleteWorkLogAction={deleteWorkLogAction} // Pass delete action down
         />
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;