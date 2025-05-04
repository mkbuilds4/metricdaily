
'use client'; // Make this a Client Component to use hooks and localStorage

import React, { useState, useEffect, useCallback } from 'react';
// Removed imports for WorkLogInputForm and UPHTargetManager
import ProductivityDashboard from '@/components/DashboardDisplay';
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog,
  deleteWorkLog,
  getUPHTargets,
  addUPHTarget,
  updateUPHTarget,
  deleteUPHTarget,
  setActiveUPHTarget,
} from '@/lib/actions'; // These are client-side functions using localStorage
import type { DailyWorkLog, UPHTarget } from '@/types';

export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading state

  // Function to fetch all data from localStorage
  const loadData = useCallback(() => {
    console.log('[Home] Loading data from localStorage...');
    setIsLoading(true); // Start loading
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      console.log('[Home] Data loaded successfully:', { logs: loadedLogs.length, targets: loadedTargets.length, active: !!loadedActiveTarget });
    } catch (error) {
      console.error('[Home] Error loading data from localStorage:', error);
    } finally {
       setIsLoading(false); // Finish loading
    }
  }, []);

  // Load data on initial component mount
  useEffect(() => {
    const timer = setTimeout(() => {
        loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // --- Action Handlers (Simplified as they primarily update state now) ---
  // These functions now call the client-side actions and update local state

  const handleSaveWorkLog = (logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData);
      if (logData.id) {
         setWorkLogs(prev => prev.map(log => log.id === savedLog.id ? savedLog : log));
      } else {
        const existingIndex = workLogs.findIndex(log => log.id === savedLog.id);
        if (existingIndex > -1) {
             setWorkLogs(prev => prev.map(log => log.id === savedLog.id ? savedLog : log));
        } else {
             setWorkLogs(prev => [savedLog, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        }
      }
      return savedLog;
    } catch (error) {
      console.error('[Home] Error saving work log:', error);
      throw error;
    }
  };

  const handleDeleteWorkLog = (id: string) => {
    try {
        deleteWorkLog(id);
        setWorkLogs(prev => prev.filter(log => log.id !== id));
    } catch (error) {
        console.error('[Home] Error deleting work log:', error);
        throw error;
    }
  };


  const handleAddTarget = (targetData: Omit<UPHTarget, 'id' | 'isActive'>) => {
    try {
      const newTarget = addUPHTarget(targetData);
      setUphTargets(prev => [...prev, newTarget]);
      return newTarget;
    } catch (error) {
      console.error('[Home] Error adding target:', error);
      throw error;
    }
  };

  const handleUpdateTarget = (targetData: UPHTarget) => {
    try {
      const updatedTarget = updateUPHTarget(targetData);
       setUphTargets(prev => prev.map(t => t.id === updatedTarget.id ? updatedTarget : t));
       if (updatedTarget.isActive) {
         setActiveTarget(updatedTarget);
       }
      return updatedTarget;
    } catch (error) {
      console.error('[Home] Error updating target:', error);
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
      if (activeTarget && activeTarget.id === id) {
         setActiveTarget(null);
      }
    } catch (error) {
      console.error('[Home] Error deleting target:', error);
      throw error;
    }
  };

  const handleSetActiveTarget = (id: string) => {
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
      setActiveTarget(newActiveTarget);
      return newActiveTarget;
    } catch (error) {
      console.error('[Home] Error setting active target:', error);
      throw error;
    }
  };


  // --- Render Logic ---

   // Conditionally render loading state only on the very first client-side load
   if (isLoading && typeof window !== 'undefined' && !localStorage.getItem('workLogs') && !localStorage.getItem('uphTargets')) {
     return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4"> {/* Adjust height calculation based on header/sidebar */}
            <p className="text-xl text-muted-foreground">Loading Dashboard...</p>
            {/* Spinner can go here */}
        </div>
        );
   }


  return (
    // Main content area within the SidebarInset
    <div className="w-full max-w-7xl mx-auto space-y-8"> {/* Increased max-width potentially */}
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Metric Daily Dashboard</h1>

        {/* REMOVED WorkLogInputForm */}
        {/* REMOVED UPHTargetManager */}

        {/* Productivity Dashboard remains the primary content */}
        <ProductivityDashboard
          initialWorkLogs={workLogs}
          initialUphTargets={uphTargets}
          initialActiveTarget={activeTarget}
          deleteWorkLogAction={handleDeleteWorkLog}
        />
    </div>
  );
}

