
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProductivityDashboard from '@/components/DashboardDisplay';
import WeeklyAverages from '@/components/WeeklyAverages'; // Import the new component
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog,
  deleteWorkLog,
  getUPHTargets,
  // Removed target management actions from here
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO } from '@/lib/utils'; // Import formatDateISO

export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    console.log('[Home] Loading data...');
    setIsLoading(true);
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      console.log('[Home] Data loaded:', { logs: loadedLogs.length, targets: loadedTargets.length, active: !!loadedActiveTarget });
    } catch (error) {
      console.error('[Home] Error loading data:', error);
      // Handle error appropriately (e.g., show toast)
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ensure this runs only client-side
     if (typeof window !== 'undefined') {
        loadData();
     }
  }, [loadData]);

  // --- Action Handlers ---

  // Simplified save handler needed for quick updates and dashboard interaction
  const handleSaveWorkLog = (logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData);
      // Update local state immediately for responsiveness
      const todayDateStr = formatDateISO(new Date());
      if (savedLog.date === todayDateStr) {
          // Update or add today's log
          setWorkLogs(prev => {
              const existingIndex = prev.findIndex(log => log.id === savedLog.id);
              if (existingIndex > -1) {
                  return prev.map(log => log.id === savedLog.id ? savedLog : log);
              } else {
                   // Ensure logs remain sorted if adding new ones
                   return [savedLog, ...prev.filter(l => l.id !== savedLog.id)].sort((a, b) => b.date.localeCompare(a.date));
              }
          });
      } else {
         // If saving a past log (shouldn't happen from this page ideally), reload all
         loadData();
      }
      return savedLog;
    } catch (error) {
      console.error('[Home] Error saving work log via quick update/dashboard:', error);
      throw error; // Rethrow for potential handling in components
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

  // --- Quick Update Handlers (Placeholder - needs UI implementation) ---
  const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', increment: number) => {
      const todayDateStr = formatDateISO(new Date());
      const todayLog = workLogs.find(log => log.date === todayDateStr);

      if (!todayLog) {
          console.warn("[Home] Quick Update: No log found for today to update.");
          // Optionally prompt user to create a log first or handle gracefully
          return;
      }

      const updatedValue = Math.max(0, (todayLog[field] || 0) + increment); // Ensure non-negative

      const updatedLogData = {
          ...todayLog,
          [field]: updatedValue,
      };

      // Call the save handler which updates state
      try {
           handleSaveWorkLog(updatedLogData);
           console.log(`[Home] Quick Update: Incremented ${field} by ${increment}`);
      } catch(error) {
          console.error(`[Home] Quick Update Failed for ${field}:`, error);
          // Add user feedback (e.g., toast)
      }
  };


  // --- Derived State ---
  const todayLog = workLogs.find(log => log.date === formatDateISO(new Date())) || null;

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center p-4">
        <p className="text-xl text-muted-foreground">Loading Dashboard...</p>
        {/* Optional: Add Skeleton loaders */}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Daily Dashboard</h1>

        {/* --- Quick Update Section (Example UI - Needs actual implementation) --- */}
        {/*
        {todayLog && (
            <Card>
                <CardHeader><CardTitle>Quick Update Today</CardTitle></CardHeader>
                <CardContent className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <Label>Documents:</Label>
                        <Button size="sm" onClick={() => handleQuickUpdate('documentsCompleted', -1)}>-</Button>
                        <span>{todayLog.documentsCompleted}</span>
                        <Button size="sm" onClick={() => handleQuickUpdate('documentsCompleted', 1)}>+</Button>
                    </div>
                     <div className="flex items-center gap-2">
                        <Label>Videos:</Label>
                        <Button size="sm" onClick={() => handleQuickUpdate('videoSessionsCompleted', -1)}>-</Button>
                        <span>{todayLog.videoSessionsCompleted}</span>
                        <Button size="sm" onClick={() => handleQuickUpdate('videoSessionsCompleted', 1)}>+</Button>
                    </div>
                </CardContent>
            </Card>
        )}
        */}

        {/* Productivity Dashboard - Now only shows Today's Metrics */}
        <ProductivityDashboard
          initialWorkLogs={todayLog ? [todayLog] : []} // Pass only today's log (or empty array)
          initialUphTargets={uphTargets}
          initialActiveTarget={activeTarget}
          deleteWorkLogAction={handleDeleteWorkLog} // Pass delete action
          // Add quick update handlers if implemented inside Dashboard
          // handleQuickUpdate={handleQuickUpdate}
        />

        {/* Weekly Averages Component */}
        <WeeklyAverages
            allWorkLogs={workLogs}
            targets={uphTargets}
            activeTarget={activeTarget}
        />

    </div>
  );
}
