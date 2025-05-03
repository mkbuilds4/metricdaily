
'use client'; // Make this a Client Component to use hooks and localStorage

import React, { useState, useEffect, useCallback } from 'react';
import WorkLogInputForm from '@/components/WorkLogInputForm';
import UPHTargetManager from '@/components/UPHTargetManager';
import ProductivityDashboard from '@/components/DashboardDisplay';
// Import client-side actions that interact with localStorage
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog,
  deleteWorkLog, // Assuming deleteWorkLog exists for future use
  getUPHTargets,
  addUPHTarget,
  updateUPHTarget,
  deleteUPHTarget,
  setActiveUPHTarget,
} from '@/lib/actions'; // These are now client-side functions
import type { DailyWorkLog, UPHTarget } from '@/types';

export default function Home() {
  // State to hold data fetched from localStorage
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading state

  // --- Data Fetching and Updating ---

  // Function to fetch all data from localStorage
  const loadData = useCallback(() => {
    console.log('[Home] Loading data from localStorage...');
    setIsLoading(true); // Start loading
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget(); // Already gets from localStorage

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      console.log('[Home] Data loaded successfully:', { logs: loadedLogs.length, targets: loadedTargets.length, active: !!loadedActiveTarget });
    } catch (error) {
      console.error('[Home] Error loading data from localStorage:', error);
      // Handle error state if needed
    } finally {
       setIsLoading(false); // Finish loading
    }
  }, []); // Empty dependency array ensures this is created once

  // Load data on initial component mount
  useEffect(() => {
    // Defer initial load slightly to avoid potential hydration issues
    // although with client-side storage, it might be less of a concern.
    // Still, good practice.
    const timer = setTimeout(() => {
        loadData();
    }, 0);
    return () => clearTimeout(timer); // Cleanup timeout
  }, [loadData]); // Depend on the memoized loadData function

  // --- Action Handlers (Client-Side Wrappers) ---
  // These functions call the client-side actions and update local state

  const handleSaveWorkLog = (logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData); // Calls the client-side action
      // Re-fetch all data to ensure consistency - simplest approach for now
      loadData();
      return savedLog; // Return the saved log (might have new ID)
    } catch (error) {
      console.error('[Home] Error saving work log:', error);
      // Error handled by toast in the form component
      throw error; // Re-throw for the form to catch if needed
    }
  };

  const handleAddTarget = (targetData: Omit<UPHTarget, 'id' | 'isActive'>) => {
    try {
      const newTarget = addUPHTarget(targetData);
      // Instead of full reload, update state directly (optimistic)
      setUphTargets(prev => [...prev, newTarget]);
       // If this is the first target added, make it active automatically?
       // Decide based on UX preference. For now, manual activation.
      // loadData(); // Re-fetch (safer but less performant)
      return newTarget;
    } catch (error) {
      console.error('[Home] Error adding target:', error);
      throw error; // Let the caller (UPHTargetManager) handle toast
    }
  };

  const handleUpdateTarget = (targetData: UPHTarget) => {
    try {
      const updatedTarget = updateUPHTarget(targetData);
       // Optimistic update
       setUphTargets(prev => prev.map(t => t.id === updatedTarget.id ? updatedTarget : t));
       // Update active target if the edited one was active
       if (updatedTarget.isActive) {
         setActiveTarget(updatedTarget);
       }
      // loadData(); // Re-fetch
      return updatedTarget;
    } catch (error) {
      console.error('[Home] Error updating target:', error);
      throw error;
    }
  };

  const handleDeleteTarget = (id: string) => {
    try {
       // Check if the target being deleted is the active one
       if (activeTarget && activeTarget.id === id) {
            // Optionally: Prevent deletion or set another target active first
            // For now, we allow deletion but clear the active target state
            setActiveTarget(null);
            // Note: deleteUPHTarget action itself should prevent deletion of active target
       }
      deleteUPHTarget(id);
      // Optimistic update
      setUphTargets(prev => prev.filter(t => t.id !== id));
      // loadData(); // Re-fetch
    } catch (error) {
      console.error('[Home] Error deleting target:', error);
      throw error;
    }
  };

  const handleSetActiveTarget = (id: string) => {
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      // Optimistic update
      setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
      setActiveTarget(newActiveTarget);
      // loadData(); // Re-fetch
      return newActiveTarget;
    } catch (error) {
      console.error('[Home] Error setting active target:', error);
      throw error;
    }
  };


  // --- Render Logic ---

   if (isLoading && typeof window !== 'undefined' && !localStorage.getItem('workLogs')) {
     // Show loading only on the very first load before localStorage is populated
     return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-12">
            <p className="text-xl text-muted-foreground">Loading Dashboard...</p>
            {/* You could add a spinner here */}
        </main>
        );
   }


  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Metric Daily Dashboard</h1>
      <div className="w-full max-w-5xl space-y-8">
        {/* Pass the client-side save function */}
        <WorkLogInputForm
          onWorkLogSaved={handleSaveWorkLog}
          // No initial data needed from props, form manages its state
        />

        {/* Pass client-side action functions and current state */}
        <UPHTargetManager
          targets={uphTargets} // Pass current targets state
          addUPHTargetAction={handleAddTarget}
          updateUPHTargetAction={handleUpdateTarget}
          deleteUPHTargetAction={handleDeleteTarget}
          setActiveUPHTargetAction={handleSetActiveTarget}
        />

        {/* Pass current state */}
        <ProductivityDashboard
          initialWorkLogs={workLogs} // Pass current logs state
          initialUphTargets={uphTargets} // Pass ALL targets
          initialActiveTarget={activeTarget} // Pass current active target state
        />
      </div>
    </main>
  );
}
