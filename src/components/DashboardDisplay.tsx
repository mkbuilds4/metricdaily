'use client';

import React, { useState, useEffect } from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Import calculation functions from utils
import { calculateDailyUnits, calculateDailyUPH, calculateRequiredUnitsForTarget, calculateRemainingUnits } from '@/lib/utils';

// --- Component Props ---

interface ProductivityDashboardProps {
  // Receive current data as props from the parent client component
  initialWorkLogs: DailyWorkLog[];
  initialActiveTarget: UPHTarget | null;
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
    initialWorkLogs = [],
    initialActiveTarget = null,
}) => {
  // Use props directly, no need for local state if parent manages updates
  // Or keep local state if this component needs to perform actions itself

  // Example: Using props directly
  const workLogs = initialWorkLogs;
  const activeTarget = initialActiveTarget;

  // If keeping local state (less common if parent loads all):
  // const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>(initialWorkLogs);
  // const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(initialActiveTarget);
  // useEffect(() => { setWorkLogs(initialWorkLogs); }, [initialWorkLogs]);
  // useEffect(() => { setActiveTarget(initialActiveTarget); }, [initialActiveTarget]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Dashboard</CardTitle>
         {/* Display Active Target Info */}
         {activeTarget ? (
            <div className="text-sm text-muted-foreground mt-2 p-3 border rounded-md bg-muted/50">
                <h4 className="font-semibold">Active Target: {activeTarget.name}</h4>
                <p>Target UPH: {activeTarget.targetUPH}</p>
                <p>Docs per Unit: {activeTarget.docsPerUnit}</p>
                <p>Videos per Unit: {activeTarget.videosPerUnit}</p>
            </div>
            ) : (
            <p className="text-sm text-destructive mt-2 p-3 border border-destructive/50 rounded-md bg-destructive/10">No active UPH target set. Please set one in the Target Manager.</p>
            )}
      </CardHeader>
      <CardContent>
        {/* Daily Breakdown Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Break (m)</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Total Units</TableHead>
              <TableHead>Actual UPH</TableHead>
              <TableHead>Target Units</TableHead>
              <TableHead>+/- Target</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workLogs.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-4">No work logs recorded yet.</TableCell>
                </TableRow>
            )}
            {workLogs.map((log) => {
              const hasTarget = !!activeTarget;
              const totalUnits = hasTarget ? calculateDailyUnits(log, activeTarget) : '-';
              const actualUPH = hasTarget ? calculateDailyUPH(log, activeTarget) : '-';
              const targetUnits = hasTarget ? calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH) : '-';
              const remainingUnitsValue = hasTarget ? calculateRemainingUnits(log, activeTarget) : null;
              const remainingDisplay = remainingUnitsValue !== null
                ? (remainingUnitsValue > 0 ? `-${remainingUnitsValue}` : `+${Math.abs(remainingUnitsValue)}`)
                : '-';
              const remainingColor = remainingUnitsValue !== null
                    ? (remainingUnitsValue > 0 ? 'text-destructive' : 'text-accent')
                    : '';


              return (
                <TableRow key={log.id}>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.startTime}</TableCell>
                  <TableCell>{log.endTime}</TableCell>
                  <TableCell>{log.breakDurationMinutes}</TableCell>
                  <TableCell>{log.hoursWorked.toFixed(2)}</TableCell>
                  <TableCell>{log.documentsCompleted}</TableCell>
                  <TableCell>{log.videoSessionsCompleted}</TableCell>
                  <TableCell>{totalUnits === '-' ? '-' : totalUnits.toFixed(2)}</TableCell>
                  <TableCell>{actualUPH === '-' ? '-' : actualUPH.toFixed(2)}</TableCell>
                  <TableCell>{targetUnits === '-' ? '-' : targetUnits.toFixed(2)}</TableCell>
                  <TableCell className={remainingColor}>
                     {remainingDisplay}
                  </TableCell>
                   <TableCell className="max-w-[150px] truncate" title={log.notes ?? ''}>{log.notes || ''}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
         {/* Removed Export Button */}
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
