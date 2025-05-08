'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TargetMetricsDisplay from '@/components/TargetMetricsDisplay'; // Re-use the display logic component
import {
  getWorkLogs,
  getUPHTargets,
  deleteWorkLog,
  addAuditLog, // Ensure addAuditLog is correctly imported
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateDailyUPH, calculateDailyUnits } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';

export default function PreviousLogsPage() {
  const [previousLogs, setPreviousLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load data needed for this page
  const loadData = useCallback(() => {
     if (typeof window === 'undefined') return; // Don't run on server
    console.log('[PreviousLogsPage] Loading data...');
    setIsLoading(true);
    try {
      const allLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();

      const todayDateStr = formatDateISO(new Date());
      // Filter out today's log
      const filteredPreviousLogs = allLogs.filter(log => log.date !== todayDateStr);

      setPreviousLogs(filteredPreviousLogs);
      setUphTargets(loadedTargets);

      console.log('[PreviousLogsPage] Data loaded:', { logs: filteredPreviousLogs.length, targets: loadedTargets.length });
    } catch (error) {
      console.error('[PreviousLogsPage] Error loading data:', error);
       toast({
            variant: "destructive",
            title: "Error Loading Data",
            description: "Could not load previous work logs or targets.",
       });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Add toast dependency

  useEffect(() => {
    if (typeof window !== 'undefined') {
        loadData();
    }
  }, [loadData]);

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (typeof window === 'undefined') return;
    try {
      deleteWorkLog(id);
      setPreviousLogs(prev => prev.filter(log => log.id !== id)); // Update local state
      toast({ title: "Log Deleted", description: "Previous work log deleted successfully." });
    } catch (error) {
      console.error('[PreviousLogsPage] Error deleting work log:', error);
      toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error instanceof Error ? error.message : "Could not delete the work log.",
      });
      throw error; // Let the component handle toast/feedback if needed elsewhere
    }
  }, [toast]); // Add toast dependency


  const escapeCSVField = (field: any): string => {
    if (field === null || field === undefined) {
      return '';
    }
    let stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      stringField = stringField.replace(/"/g, '""');
      return `"${stringField}"`;
    }
    return stringField;
  };

  const generateCSVContent = useCallback((logs: DailyWorkLog[], targets: UPHTarget[]): string => {
    const headers = [
      'Date', 'Start Time', 'End Time', 'Break Duration (min)', 'Training Duration (min)', 'Net Hours Worked',
      'Documents Completed', 'Video Sessions Completed', 'Notes',
      'Logged Target ID', 'Logged Target Name', 'Logged Target UPH (Goal)', 'Logged Target Docs/Unit', 'Logged Target Videos/Unit'
    ];

    targets.forEach(target => {
      headers.push(`${target.name} - Calculated Units`);
      headers.push(`${target.name} - Calculated UPH`);
    });

    const rows = logs.map(log => {
      const loggedTarget = targets.find(t => t.id === log.targetId);
      const row = [
        escapeCSVField(log.date),
        escapeCSVField(log.startTime),
        escapeCSVField(log.endTime),
        escapeCSVField(log.breakDurationMinutes),
        escapeCSVField(log.trainingDurationMinutes || 0),
        escapeCSVField(log.hoursWorked.toFixed(2)),
        escapeCSVField(log.documentsCompleted),
        escapeCSVField(log.videoSessionsCompleted),
        escapeCSVField(log.notes || ''),
        escapeCSVField(log.targetId || 'N/A'),
        escapeCSVField(loggedTarget?.name || 'N/A'),
        escapeCSVField(loggedTarget?.targetUPH?.toFixed(2) || 'N/A'),
        escapeCSVField(loggedTarget?.docsPerUnit?.toString() || 'N/A'), // Keep precision for per unit values
        escapeCSVField(loggedTarget?.videosPerUnit?.toString() || 'N/A'),// Keep precision for per unit values
      ];

      targets.forEach(target => {
        const units = calculateDailyUnits(log, target, target);
        const uph = calculateDailyUPH(log, target);
        row.push(escapeCSVField(units.toFixed(2)));
        row.push(escapeCSVField(uph.toFixed(2)));
      });
      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }, []);

  const downloadCSV = useCallback((csvString: string, filename: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Your browser does not support direct CSV downloads."
      });
    }
  }, [toast]);

  const handleExportData = useCallback(() => {
    if (previousLogs.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no previous logs to export.",
      });
      return;
    }
    try {
      const csvData = generateCSVContent(previousLogs, uphTargets);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCSV(csvData, `metric_daily_previous_logs_${timestamp}.csv`);
      toast({
        title: "Export Successful",
        description: "Previous logs data has been exported to CSV.",
      });
      // Add audit log for export
      addAuditLog('SYSTEM_EXPORT_DATA', 'System', 'Exported previous work logs to CSV.');
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "An error occurred while preparing the data for export.",
      });
       addAuditLog('SYSTEM_EXPORT_DATA_FAILED', 'System', `Failed to export previous work logs to CSV. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [previousLogs, uphTargets, generateCSVContent, downloadCSV, toast]);


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8"> {/* Added padding */}
        <p className="text-xl text-muted-foreground">Loading Previous Logs...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8"> {/* Added padding */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center sm:text-left">Previous Work Logs</h1>
        <Button onClick={handleExportData} disabled={previousLogs.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export All to CSV
        </Button>
      </div>

      {/* Use TargetMetricsDisplay to show the list of previous logs */}
      {/* Pass only previous logs and ensure delete action is wired up */}
      <TargetMetricsDisplay
        allWorkLogs={previousLogs} // Pass only previous logs
        targets={uphTargets}
        deleteWorkLogAction={handleDeleteWorkLog}
        showTodaySection={false} // Add a prop to hide the "Today" section
        paginatePreviousLogs={true} // Enable pagination for this page
      />

       {previousLogs.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground">No previous work logs found.</p>
       )}
    </div>
  );
}
