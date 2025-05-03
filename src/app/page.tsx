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
  deleteWorkLog, // Add delete if you implement deletion in WorkLogInputForm/Dashboard
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
      console.log('[Home] Data loaded successfully.');
    } catch (error) {
      console.error('[Home] Error loading data from localStorage:', error);
      // Handle error state if needed
    } finally {
       setIsLoading(false); // Finish loading
    }
  }, []); // Empty dependency array ensures this is created once

  // Load data on initial component mount
  useEffect(() => {
    loadData();
  }, [loadData]); // Depend on the memoized loadData function

  // --- Action Handlers (Client-Side Wrappers) ---
  // These functions call the client-side actions and update local state

  const handleSaveWorkLog = (logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData); // Calls the client-side action
      // Optimistically update or re-fetch data
      loadData(); // Re-fetch all data to ensure consistency
      return savedLog; // Return the saved log (might have new ID)
    } catch (error) {
      console.error('[Home] Error saving work log:', error);
      // Handle error display (e.g., using toast from the form)
      throw error; // Re-throw for the form to catch
    }
  };

  const handleAddTarget = (targetData: Omit<UPHTarget, 'id' | 'isActive'>) => {
    try {
      const newTarget = addUPHTarget(targetData);
      loadData(); // Re-fetch
      return newTarget;
    } catch (error) {
      console.error('[Home] Error adding target:', error);
      throw error;
    }
  };

    const handleUpdateTarget = (targetData: UPHTarget) => {
    try {
      const updatedTarget = updateUPHTarget(targetData);
      loadData(); // Re-fetch
      return updatedTarget;
    } catch (error) {
      console.error('[Home] Error updating target:', error);
      throw error;
    }
  };

  const handleDeleteTarget = (id: string) => {
    try {
      deleteUPHTarget(id);
      loadData(); // Re-fetch
    } catch (error) {
      console.error('[Home] Error deleting target:', error);
      throw error;
    }
  };

  const handleSetActiveTarget = (id: string) => {
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      loadData(); // Re-fetch
      return newActiveTarget;
    } catch (error) {
      console.error('[Home] Error setting active target:', error);
      throw error;
    }
  };


  // --- Render Logic ---

   if (isLoading) {
     // Optional: Display a loading indicator while data is fetched initially
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
        {/* ProductivityDashboard can now be simpler if it doesn't need optimistic updates */}
        <ProductivityDashboard
          initialWorkLogs={workLogs} // Pass current logs state
          initialActiveTarget={activeTarget} // Pass current active target state
        />
      </div>
    </main>
  );
}
