
'use client';

import React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TargetMetricsDisplay from './TargetMetricsDisplay'; // Import the new component

// --- Component Props ---

interface ProductivityDashboardProps {
  // Receive current data as props from the parent client component
  initialWorkLogs: DailyWorkLog[];
  initialUphTargets: UPHTarget[]; // Receive all targets
  initialActiveTarget: UPHTarget | null; // Still useful for context maybe?
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  initialWorkLogs = [],
  initialUphTargets = [],
  initialActiveTarget = null, // Kept for potential future use or context display
}) => {
  // Find the latest work log based on date and potentially end time
  const findLatestWorkLog = (): DailyWorkLog | null => {
    if (initialWorkLogs.length === 0) {
      return null;
    }
    // Sort by date descending, then end time descending
    const sortedLogs = [...initialWorkLogs].sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) {
        return dateComparison;
      }
      // If dates are the same, sort by end time (latest first)
      return b.endTime.localeCompare(a.endTime);
    });
    return sortedLogs[0];
  };

  const latestWorkLog = findLatestWorkLog();

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
            ) : (
            <p className="text-sm text-destructive mt-2 p-3 border border-destructive/50 rounded-md bg-destructive/10">No active UPH target set.</p>
            )}
             {!latestWorkLog && (
                <p className="text-sm text-muted-foreground mt-2">No work logs recorded yet to calculate metrics.</p>
            )}
      </CardHeader>
      <CardContent>
        {/* Render the new TargetMetricsDisplay */}
        {latestWorkLog && initialUphTargets.length > 0 ? (
          <TargetMetricsDisplay
            latestLog={latestWorkLog}
            targets={initialUphTargets}
          />
        ) : latestWorkLog ? (
           <p className="text-sm text-muted-foreground">No UPH targets defined. Please add targets in the manager above.</p>
        ) : null /* Message handled in header */
        }
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;

