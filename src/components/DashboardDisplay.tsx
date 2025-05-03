'use client';

import type React from 'react';
import type { DailyWorkLog, UPHTarget, GoogleSheetsData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { exportWorkLogsToSheet } from '@/lib/actions'; // Assuming an action exists
// Import calculation functions from utils
import { calculateDailyUnits, calculateDailyUPH, calculateRequiredUnitsForTarget, calculateRemainingUnits } from '@/lib/utils';

// Helper functions are now imported from lib/utils.ts

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

    // Format data for export according to GoogleSheetsData type
    const exportData: GoogleSheetsData[] = workLogs.map(log => ({
        date: log.date,
        startTime: log.startTime,
        endTime: log.endTime,
        breakMinutes: log.breakDurationMinutes,
        hoursWorked: log.hoursWorked, // Use pre-calculated hours
        docs: log.documentsCompleted,
        videos: log.videoSessionsCompleted,
        calculatedUnits: calculateDailyUnits(log, activeTarget),
        calculatedUPH: calculateDailyUPH(log, activeTarget),
        targetUnits: calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH),
        remainingUnits: calculateRemainingUnits(log, activeTarget),
        notes: log.notes || '',
    }));

    try {
        // Assume exportWorkLogsToSheet is a server action defined in lib/actions.ts
        // TODO: Replace placeholders with actual Spreadsheet ID and Sheet Name
        // These should ideally come from environment variables or configuration
        const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID || 'YOUR_SPREADSHEET_ID';
        const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME || 'WorkLogsExport';

         if (spreadsheetId === 'YOUR_SPREADSHEET_ID' || sheetName === 'WorkLogsExport') {
             console.warn("Using placeholder Spreadsheet ID or Sheet Name. Please configure environment variables NEXT_PUBLIC_SPREADSHEET_ID and NEXT_PUBLIC_SHEET_NAME.");
             // Optionally prevent export if not configured
             // alert("Export configuration missing. Please set up Spreadsheet ID and Sheet Name.");
             // return;
         }


        await exportWorkLogsToSheet(exportData, spreadsheetId, sheetName);
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
                    <TableCell colSpan={12} className="text-center text-muted-foreground">No work logs recorded for this period.</TableCell>
                </TableRow>
            )}
            {workLogs.map((log) => {
              const hasTarget = !!activeTarget;
              // Calculations now use log.hoursWorked directly
              const totalUnits = hasTarget ? calculateDailyUnits(log, activeTarget) : '-';
              const actualUPH = hasTarget ? calculateDailyUPH(log, activeTarget) : '-';
              const targetUnits = hasTarget ? calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH) : '-';
              const remainingUnits = hasTarget ? calculateRemainingUnits(log, activeTarget) : '-';
              const remainingColor = typeof remainingUnits === 'number' ? (remainingUnits > 0 ? 'text-destructive' : 'text-accent') : ''; // Red if behind, Green if ahead/met

              return (
                <TableRow key={log.id || log.date}>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.startTime}</TableCell>
                  <TableCell>{log.endTime}</TableCell>
                  <TableCell>{log.breakDurationMinutes}</TableCell>
                  <TableCell>{log.hoursWorked.toFixed(2)}</TableCell> {/* Display calculated hours */}
                  <TableCell>{log.documentsCompleted}</TableCell>
                  <TableCell>{log.videoSessionsCompleted}</TableCell>
                  <TableCell>{totalUnits}</TableCell>
                  <TableCell>{actualUPH}</TableCell>
                  <TableCell>{targetUnits}</TableCell>
                  <TableCell className={remainingColor}>
                     {typeof remainingUnits === 'number' ? (remainingUnits > 0 ? `-${remainingUnits}` : `+${Math.abs(remainingUnits)}`) : '-'}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{log.notes || ''}</TableCell>
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
