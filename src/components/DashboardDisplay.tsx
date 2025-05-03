'use client';

import React, { useState, useEffect } from 'react';
import type { DailyWorkLog, UPHTarget, GoogleSheetsData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { exportWorkLogsToSheet } from '@/lib/actions'; // Assuming an action exists
// Import calculation functions from utils
import { calculateDailyUnits, calculateDailyUPH, calculateRequiredUnitsForTarget, calculateRemainingUnits } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast"; // Import useToast


// --- Component Props ---

interface ProductivityDashboardProps {
  // Receive initial data from the server component
  initialWorkLogs: DailyWorkLog[];
  initialActiveTarget: UPHTarget | null;
  // Add week selection/navigation props if needed (future)
}

// --- Component ---

const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
    initialWorkLogs = [],
    initialActiveTarget = null,
}) => {
  const { toast } = useToast();
  // Manage work logs and active target in local state for optimistic updates
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>(initialWorkLogs);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(initialActiveTarget);

  // Sync local state when initial props change (e.g., after server revalidation from target manager)
   useEffect(() => {
    setWorkLogs(initialWorkLogs);
   }, [initialWorkLogs]);

   useEffect(() => {
    setActiveTarget(initialActiveTarget);
   }, [initialActiveTarget]);


   // Function to handle optimistic updates from the WorkLogInputForm (if passed down)
   // Note: In the current setup, WorkLogInputForm doesn't directly update the Dashboard.
   // Revalidation from the server action is the primary way Dashboard gets updated logs.
   // This function remains as a potential pattern if direct optimistic updates were needed.
  /*
   const handleOptimisticLogUpdate = (
     updatedLog: DailyWorkLog | null,
     action: 'add' | 'update' | 'delete' | 'revert',
     previousLog?: DailyWorkLog | null
   ) => {
       setWorkLogs(currentLogs => {
           let newLogs = [...currentLogs];
           switch (action) {
               case 'add':
                   if (updatedLog) {
                       newLogs.push(updatedLog);
                   }
                   break;
               case 'update':
                   if (updatedLog) {
                       const index = newLogs.findIndex(log => log.id === updatedLog.id);
                       if (index > -1) {
                           newLogs[index] = updatedLog;
                       } else if (previousLog?.id && previousLog.id.startsWith('temp-')) {
                            // Handle replacing temp ID with actual ID after add confirmation
                           const tempIndex = newLogs.findIndex(log => log.id === previousLog.id);
                           if (tempIndex > -1) {
                               newLogs[tempIndex] = updatedLog;
                           }
                       }
                   }
                   break;
               case 'delete':
                    if (updatedLog) { // updatedLog here is the one to be deleted (e.g., the temp one)
                        newLogs = newLogs.filter(log => log.id !== updatedLog.id);
                    }
                   break;
               case 'revert': // Not explicitly used in form logic, but pattern for reverting
                   // This case would typically involve finding the log by ID and setting it back
                   // For add revert, it means removing the temp item (handled by 'delete' case above)
                   // For edit revert, it means setting the item back to 'previousLog'
                   if (previousLog) {
                       const index = newLogs.findIndex(log => log.id === previousLog.id);
                       if (index > -1) {
                           newLogs[index] = previousLog;
                       } else {
                            // If the item to revert wasn't found (e.g., add failed), do nothing specific here
                            // The 'delete' case for the temp item handles failed adds
                       }
                   }
                   break;
           }
           // Sort logs after any modification
           return newLogs.sort((a, b) => b.date.localeCompare(a.date));
       });
   };
  */


  const handleExport = async () => {
    if (!activeTarget) {
        toast({ variant: "destructive", title: "Export Error", description: "Please set an active target before exporting." });
        return;
    }
     if (workLogs.length === 0) {
        toast({ variant: "destructive", title: "Export Error", description: "No work logs available to export for the selected period." });
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
              toast({
                variant: "default", // Use default variant for warnings
                title: "Export Configuration Note",
                description: "Using placeholder Sheet ID/Name. Configure environment variables for actual export.",
            });
             // Optionally prevent export if not configured - currently allows export with warning
             // return;
         }


        await exportWorkLogsToSheet(exportData, spreadsheetId, sheetName);
        toast({ title: "Export Successful", description: "Data exported to Google Sheet." });
    } catch (error) {
        console.error('Export failed:', error);
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: error instanceof Error ? error.message : 'Could not export data to Google Sheet.'
        });
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Dashboard</CardTitle>
         {/* Display Active Target Info */}
         {activeTarget ? (
            <div className="text-sm text-muted-foreground mt-2 p-3 border rounded-md bg-muted/50">
                <h4 className="font-semibold">Active Target: {activeTarget.name}</h4>
                <p>Target UPH: {activeTarget.targetUPH}</p>
                <p>Doc Weight: {activeTarget.docWeight} units</p>
                <p>Video Weight: {activeTarget.videoWeight} units</p>
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
              // Calculations now use log.hoursWorked directly
              const totalUnits = hasTarget ? calculateDailyUnits(log, activeTarget) : '-';
              const actualUPH = hasTarget ? calculateDailyUPH(log, activeTarget) : '-';
              const targetUnits = hasTarget ? calculateRequiredUnitsForTarget(log.hoursWorked, activeTarget.targetUPH) : '-';
              const remainingUnitsValue = hasTarget ? calculateRemainingUnits(log, activeTarget) : null; // Get the numeric value
              const remainingDisplay = remainingUnitsValue !== null
                ? (remainingUnitsValue > 0 ? `-${remainingUnitsValue}` : `+${Math.abs(remainingUnitsValue)}`)
                : '-';
              const remainingColor = remainingUnitsValue !== null
                    ? (remainingUnitsValue > 0 ? 'text-destructive' : 'text-accent')
                    : ''; // Red if behind, Green if ahead/met


              return (
                <TableRow key={log.id /* Use guaranteed unique ID */}>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>{log.startTime}</TableCell>
                  <TableCell>{log.endTime}</TableCell>
                  <TableCell>{log.breakDurationMinutes}</TableCell>
                  <TableCell>{log.hoursWorked.toFixed(2)}</TableCell> {/* Display calculated hours */}
                  <TableCell>{log.documentsCompleted}</TableCell>
                  <TableCell>{log.videoSessionsCompleted}</TableCell>
                  <TableCell>{totalUnits === '-' ? '-' : totalUnits.toFixed(2)}</TableCell>
                  <TableCell>{actualUPH === '-' ? '-' : actualUPH.toFixed(2)}</TableCell>
                  <TableCell>{targetUnits === '-' ? '-' : targetUnits.toFixed(2)}</TableCell>
                  <TableCell className={remainingColor}>
                     {remainingDisplay}
                  </TableCell>
                   <TableCell className="max-w-[150px] truncate" title={log.notes}>{log.notes || ''}</TableCell>
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
