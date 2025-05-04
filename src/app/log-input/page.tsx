
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import {
  getWorkLogs, // Need today's log to pass to form if exists
  getActiveUPHTarget,
  saveWorkLog,
  getUPHTargets,
  addUPHTarget,
  updateUPHTarget,
  deleteUPHTarget,
  setActiveUPHTarget,
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils';

export default function LogInputPage() {
  const [todayLog, setTodayLog] = useState<DailyWorkLog | null>(null);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null); // Keep track of active target for context maybe
  const [isLoading, setIsLoading] = useState(true);

  // Load data needed for this page
  const loadData = useCallback(() => {
    console.log('[LogInputPage] Loading data...');
    setIsLoading(true);
    try {
      const allLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      const todayDateStr = formatDateISO(new Date());
      const foundTodayLog = allLogs.find(log => log.date === todayDateStr) || null;

      setTodayLog(foundTodayLog);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);

      console.log('[LogInputPage] Data loaded:', { hasTodayLog: !!foundTodayLog, targets: loadedTargets.length, active: !!loadedActiveTarget });
    } catch (error) {
      console.error('[LogInputPage] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
     if (typeof window !== 'undefined') {
       loadData();
     }
  }, [loadData]);

  // --- Action Handlers (Pass client-side actions to components) ---

  const handleSaveWorkLog = (logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData);
      // Update local state for today's log if it was saved
      if (savedLog.date === formatDateISO(new Date())) {
        setTodayLog(savedLog);
      }
      // No need to update full logs array here, page focuses on today's input
      return savedLog;
    } catch (error) {
      console.error('[LogInputPage] Error saving work log:', error);
      throw error; // Let the form handle displaying the error
    }
  };

  const handleAddTarget = (targetData: Omit<UPHTarget, 'id' | 'isActive'>) => {
    try {
      const newTarget = addUPHTarget(targetData);
      setUphTargets(prev => [...prev, newTarget]); // Update local state
      return newTarget;
    } catch (error) {
      console.error('[LogInputPage] Error adding target:', error);
      throw error;
    }
  };

  const handleUpdateTarget = (targetData: UPHTarget) => {
    try {
      const updatedTarget = updateUPHTarget(targetData);
      setUphTargets(prev => prev.map(t => t.id === updatedTarget.id ? updatedTarget : t));
      if (updatedTarget.isActive) {
        setActiveTarget(updatedTarget); // Keep active target state synced
      }
      return updatedTarget;
    } catch (error) {
      console.error('[LogInputPage] Error updating target:', error);
      throw error;
    }
  };

   const handleDeleteTarget = (id: string) => {
    try {
       const targetToDelete = uphTargets.find(t => t.id === id);
       if (targetToDelete?.isActive) {
           throw new Error("Cannot delete the currently active target. Set another target as active first.");
       }
      deleteUPHTarget(id);
      setUphTargets(prev => prev.filter(t => t.id !== id));
       // If the deleted target was the active one (though the check above should prevent this)
       if (activeTarget && activeTarget.id === id) {
          setActiveTarget(null); // Clear active state locally
       }
    } catch (error) {
      console.error('[LogInputPage] Error deleting target:', error);
      throw error;
    }
  };

  const handleSetActiveTarget = (id: string) => {
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
      setActiveTarget(newActiveTarget); // Update local active target state
      return newActiveTarget;
    } catch (error) {
      console.error('[LogInputPage] Error setting active target:', error);
      throw error;
    }
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4">
        <p className="text-xl text-muted-foreground">Loading Input Form...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8"> {/* Adjusted max-width */}
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Log Work & Manage Targets</h1>

      {/* Work Log Input Form */}
      <WorkLogInputForm
        onWorkLogSaved={handleSaveWorkLog}
        existingLog={todayLog} // Pass today's log if it exists
      />

      {/* UPH Target Manager */}
      <UPHTargetManager
        targets={uphTargets}
        addUPHTargetAction={handleAddTarget}
        updateUPHTargetAction={handleUpdateTarget}
        deleteUPHTargetAction={handleDeleteTarget}
        setActiveUPHTargetAction={handleSetActiveTarget}
      />
    </div>
  );
}
