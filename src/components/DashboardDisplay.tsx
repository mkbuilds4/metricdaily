'use client';

import type React from 'react';
import type { DailyWorkLog, UPHTarget } from '@/types'; // Assuming types are defined
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { exportWorkLogsToSheet } from '@/lib/actions'; // Assuming an action exists

// --- Helper Functions (Move to lib/utils.ts later) ---

/** Calculates total units for a log entry based on a target's weights. */
function calculateDailyUnits(log: DailyWorkLog, target: UPHTarget): number {
  return (log.documentsCompleted * target.docWeight) + (log.videoSessionsCompleted * target.videoWeight);
}

/** Calculates Units Per Hour (UPH) for a log entry. */
function calculateDailyUPH(log: DailyWorkLog, target: UPHTarget): number {
  if (log.hoursWorked <= 0) {
    return 0; // Avoid division by zero
  }
  const totalUnits = calculateDailyUnits(log, target);
  return parseFloat((totalUnits / log.hoursWorked).toFixed(2));
}

/** Calculates the number of units required to meet the target UPH for the hours worked. */
function calculateRequiredUnitsForTarget(hoursWorked: number, targetUPH: number): number {
    return parseFloat((hoursWorked * targetUPH).toFixed(2));
}

/** Calculates the difference between actual units and target units. */
function calculateRemainingUnits(log: DailyWorkLog, target: UPHTarget): number {
    const actualUnits = calculateDailyUnits(log, target);
    const requiredUnits = calculateRequiredUnitsForTarget(log.hoursWorked, target.targetUPH);
    return parseFloat((requiredUnits - actualUnits).toFixed(2));
}

// --- Component Props ---

interface ProductivityDashboardProps {
  workLogs: DailyWorkLog[];
  activeTarget: UPHTarget | null;
  // Add week selection/navigation props if needed
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({ workLogs = [], activeTarget }) => {

  const handleExport = async () => {
    if (!activeTarget) {
        alert("Please set an active target before exporting.");
        return;
    }
     if (workLogs.length === 0) {
        alert("No work logs available to export for the selected period.");
        return;
    }

    // Format data for export
    const exportData = workLogs.map(log => ({
        date: log.date,
        docs: log.documentsCompleted,
        videos: log.videoSessionsCompleted,
        hours: log.hoursWorked,
        calculatedUnits: calculateDailyUnits(log, activeTarget),
        calculatedUPH: calculateDailyUPH(log, activeTarget),
        targetUnits: calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH),
        remainingUnits: calculateRemainingUnits(log, activeTarget),
        notes: log.notes || '',
    }));

    try {
        // Assume exportWorkLogsToSheet is a server action defined in lib/actions.ts
        // You'll need to pass spreadsheetId and sheetName, perhaps from config or state
        await exportWorkLogsToSheet(exportData, 'YOUR_SPREADSHEET_ID', 'WorkLogsExport'); // Replace placeholders
        alert('Data exported successfully!');
    } catch (error) {
        console.error('Export failed:', error);
        alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Dashboard</CardTitle>
         {/* Display Active Target Info */}
         {activeTarget ? (
            <div className="text-sm text-muted-foreground mt-2 p-3 border rounded-md">
                <h4 className="font-semibold">Active Target: {activeTarget.name}</h4>
                <p>Target UPH: {activeTarget.targetUPH}</p>
                <p>Doc Weight: {activeTarget.docWeight} units</p>
                <p>Video Weight: {activeTarget.videoWeight} units</p>
            </div>
            ) : (
            <p className="text-sm text-destructive mt-2">No active UPH target set. Please set one in the Target Manager.</p>
            )}
      </CardHeader>
      <CardContent>
        {/* Daily Breakdown Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Total Units</TableHead>
              <TableHead>Actual UPH</TableHead>
              <TableHead>Target Units</TableHead>
              <TableHead>+/- Target</TableHead>
              {/* Optional: <TableHead>Progress</TableHead> */}
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workLogs.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">No work logs recorded for this period.</TableCell>
                </TableRow>
            )}
            {workLogs.map((log) => {
              const hasTarget = !!activeTarget;
              const totalUnits = hasTarget ? calculateDailyUnits(log, activeTarget) : '-';
              const actualUPH = hasTarget ? calculateDailyUPH(log, activeTarget) : '-';
              const targetUnits = hasTarget ? calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH) : '-';
              const remainingUnits = hasTarget ? calculateRemainingUnits(log, activeTarget) : '-';
              const remainingColor = typeof remainingUnits === 'number' ? (remainingUnits > 0 ? 'text-destructive' : 'text-accent') : ''; // Red if behind, Green if ahead/met

              return (
                <TableRow key={log.id || log.date}>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.documentsCompleted}</TableCell>
                  <TableCell>{log.videoSessionsCompleted}</TableCell>
                  <TableCell>{log.hoursWorked}</TableCell>
                  <TableCell>{totalUnits}</TableCell>
                  <TableCell>{actualUPH}</TableCell>
                  <TableCell>{targetUnits}</TableCell>
                  <TableCell className={remainingColor}>
                     {typeof remainingUnits === 'number' ? (remainingUnits > 0 ? `-${remainingUnits}` : `+${Math.abs(remainingUnits)}`) : '-'}
                  </TableCell>
                  {/* Optional Progress Bar Cell */}
                  <TableCell className="max-w-[200px] truncate">{log.notes || ''}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {/* Export Button */}
         <div className="mt-4 flex justify-end">
            <Button onClick={handleExport} disabled={!activeTarget || workLogs.length === 0}>
                Export to Sheet
            </Button>
         </div>
      </CardContent>
    </Card>
  );
};

export default ProductivityDashboard;
