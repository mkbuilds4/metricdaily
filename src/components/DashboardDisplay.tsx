
'use client';

import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import TargetMetricsDisplay from './TargetMetricsDisplay'; // The component handling the display logic

// --- Component Props ---

interface ProductivityDashboardProps {
  // Receive only the specific logs this instance should display
  initialWorkLogs: DailyWorkLog[]; // e.g., just today's log for the main dashboard
  initialUphTargets: UPHTarget[];
  initialActiveTarget: UPHTarget | null;
  deleteWorkLogAction: (id: string) => void; // For deleting today's log from dashboard
  // Optional: Add quick update handlers if they are implemented here
  // handleQuickUpdate?: (field: 'documentsCompleted' | 'videoSessionsCompleted', increment: number) => void;
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  initialWorkLogs = [], // Should be just today's log (or empty) when used on home page
  initialUphTargets = [],
  initialActiveTarget = null,
  deleteWorkLogAction,
}) => {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Metrics</CardTitle>
         {/* Display Active Target Info or other context */}
         {initialActiveTarget ? (
             <CardDescription className="text-sm mt-1">
                Current Active Target: <span className="font-medium">{initialActiveTarget.name}</span> (Goal UPH: {initialActiveTarget.targetUPH})
             </CardDescription>
            ) : initialUphTargets.length > 0 ? ( // Only show if targets exist but none active
            <CardDescription className="text-sm text-destructive mt-1">
                No active UPH target set. Define or activate one in Log / Targets.
            </CardDescription>
            ) : null // Don't show anything if no targets defined yet
        }
             {initialWorkLogs.length === 0 && (
                 <CardDescription className="text-sm text-muted-foreground mt-2">
                     No work log recorded for today yet. Add one in Log / Targets.
                </CardDescription>
            )}
      </CardHeader>
      <CardContent>
        {/* Render the TargetMetricsDisplay, passing only today's log */}
        {/* It will inherently only show the "Today" section based on the passed logs */}
        <TargetMetricsDisplay
            allWorkLogs={initialWorkLogs} // Pass today's log(s)
            targets={initialUphTargets}
            deleteWorkLogAction={deleteWorkLogAction} // Pass delete action down
            showTodaySection={true} // Explicitly show today section
         />
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
