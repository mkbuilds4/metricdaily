
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TargetMetricsDisplay from '@/components/TargetMetricsDisplay'; // Re-use the display logic component
import {
  getWorkLogs,
  getUPHTargets,
  deleteWorkLog,
  // No target management actions needed here
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

export default function PreviousLogsPage() {
  const [previousLogs, setPreviousLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
   const { toast } = useToast();

  // Load data needed for this page
  const loadData = useCallback(() => {
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

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4">
        <p className="text-xl text-muted-foreground">Loading Previous Logs...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Previous Work Logs</h1>

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
    