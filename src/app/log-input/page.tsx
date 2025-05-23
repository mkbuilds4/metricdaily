
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import {
  getWorkLogs, 
  getActiveUPHTarget,
  saveWorkLog,
  getUPHTargets,
  addUPHTarget,
  updateUPHTarget,
  deleteUPHTarget,
  setActiveUPHTarget,
  duplicateUPHTarget, // Import new action
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

export default function LogInputPage() {
  const [todayLog, setTodayLog] = useState<DailyWorkLog | null>(null);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(() => {
    if (typeof window === 'undefined') return; 
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
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not load work logs or targets from local storage.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); 

  useEffect(() => {
     if (typeof window !== 'undefined') {
       loadData();
     }
  }, [loadData]);

  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    if (typeof window === 'undefined') return {} as DailyWorkLog; 
    try {
      const savedLog = saveWorkLog(logData);
      if (savedLog.date === formatDateISO(new Date())) {
        setTodayLog(savedLog);
      }
      return savedLog;
    } catch (error) {
      console.error('[LogInputPage] Error saving work log:', error);
      throw error; 
    }
  }, []); 

  const handleAddTarget = useCallback((targetData: Omit<UPHTarget, 'id' | 'isActive'>) => {
    if (typeof window === 'undefined') return {} as UPHTarget;
    try {
      const newTarget = addUPHTarget(targetData);
      setUphTargets(prev => [...prev, newTarget]); 
      return newTarget;
    } catch (error) {
      console.error('[LogInputPage] Error adding target:', error);
      toast({
        variant: "destructive",
        title: "Add Target Failed",
        description: error instanceof Error ? error.message : "Could not add the target.",
      });
      throw error;
    }
  }, [toast]); 

  const handleUpdateTarget = useCallback((targetData: UPHTarget) => {
    if (typeof window === 'undefined') return {} as UPHTarget;
    try {
      const updatedTarget = updateUPHTarget(targetData);
      setUphTargets(prev => prev.map(t => t.id === updatedTarget.id ? updatedTarget : t));
      if (updatedTarget.isActive) {
        setActiveTarget(updatedTarget); 
      }
      return updatedTarget;
    } catch (error) {
      console.error('[LogInputPage] Error updating target:', error);
      toast({
        variant: "destructive",
        title: "Update Target Failed",
        description: error instanceof Error ? error.message : "Could not update the target.",
      });
      throw error;
    }
  }, [toast]); 

   const handleDeleteTarget = useCallback((id: string) => {
     if (typeof window === 'undefined') return;
    try {
       const targetToDelete = uphTargets.find(t => t.id === id);
       if (targetToDelete?.isActive) {
           toast({
                variant: "destructive",
                title: "Deletion Blocked",
                description: "Cannot delete the currently active target. Set another target as active first.",
           });
           throw new Error("Cannot delete the currently active target. Set another target as active first.");
       }
      deleteUPHTarget(id);
      setUphTargets(prev => prev.filter(t => t.id !== id));
       if (activeTarget && activeTarget.id === id) {
          setActiveTarget(null); 
       }
       toast({ title: "Target Deleted", description: "UPH Target deleted successfully." });
    } catch (error) {
      console.error('[LogInputPage] Error deleting target:', error);
      if (!(error instanceof Error && error.message.includes("Cannot delete"))) {
           toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: error instanceof Error ? error.message : "Could not delete the target.",
            });
      }
      throw error;
    }
  }, [uphTargets, activeTarget, toast]); 

  const handleSetActiveTarget = useCallback((id: string) => {
     if (typeof window === 'undefined') return {} as UPHTarget;
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
      setActiveTarget(newActiveTarget); 
      toast({ title: "Target Activated", description: `"${newActiveTarget.name}" is now the active target.` });
      return newActiveTarget;
    } catch (error) {
      console.error('[LogInputPage] Error setting active target:', error);
       toast({
            variant: "destructive",
            title: "Activation Failed",
            description: error instanceof Error ? error.message : "Could not activate the target.",
       });
      throw error;
    }
  }, [toast]); 

  const handleDuplicateTarget = useCallback((id: string) => {
    if (typeof window === 'undefined') return {} as UPHTarget;
    try {
      const duplicatedTarget = duplicateUPHTarget(id);
      setUphTargets(prev => [...prev, duplicatedTarget]);
      return duplicatedTarget;
    } catch (error) {
      console.error('[LogInputPage] Error duplicating target:', error);
      toast({
        variant: "destructive",
        title: "Duplication Failed",
        description: error instanceof Error ? error.message : "Could not duplicate the target.",
      });
      throw error;
    }
  }, [toast]);


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <p className="text-xl text-muted-foreground">Loading Input Form...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Log Work & Manage Targets</h1>

      <WorkLogInputForm
        onWorkLogSaved={handleSaveWorkLog}
        existingLog={todayLog}
      />

      <UPHTargetManager
        targets={uphTargets}
        addUPHTargetAction={handleAddTarget}
        updateUPHTargetAction={handleUpdateTarget}
        deleteUPHTargetAction={handleDeleteTarget}
        setActiveUPHTargetAction={handleSetActiveTarget}
        duplicateUPHTargetAction={handleDuplicateTarget} // Pass new action
      />
    </div>
  );
}
