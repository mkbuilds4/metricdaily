
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not load work logs or targets from local storage.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Add toast to dependency array

  useEffect(() => {
    // Ensure this runs only client-side
     if (typeof window !== 'undefined') {
        loadData();
     }
  }, [loadData]);

  // --- Action Handlers ---

  // Simplified save handler needed for quick updates and dashboard interaction
  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    try {
      const savedLog = saveWorkLog(logData);
      // Update local state immediately for responsiveness
      const todayDateStr = formatDateISO(new Date());
      if (savedLog.date === todayDateStr) {
          // Update or add today's log
          setWorkLogs(prev => {
              const existingIndex = prev.findIndex(log => log.id === savedLog.id);
              if (existingIndex > -1) {
                  // Update existing log in place
                  const newLogs = [...prev];
                  newLogs[existingIndex] = savedLog;
                   return newLogs;
              } else {
                   // Ensure logs remain sorted if adding new ones (shouldn't happen via quick update)
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
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the work log.",
      });
      throw error; // Rethrow for potential handling in components
    }
  }, [loadData, toast]); // Add loadData and toast

  const handleDeleteWorkLog = useCallback((id: string) => {
    try {
        deleteWorkLog(id);
        setWorkLogs(prev => prev.filter(log => log.id !== id));
         toast({ title: "Log Deleted", description: "Work log deleted successfully." });
    } catch (error) {
        console.error('[Home] Error deleting work log:', error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error instanceof Error ? error.message : "Could not delete the work log.",
        });
        throw error;
    }
  }, [toast]); // Add toast

  // --- Quick Update Handlers ---
  const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', increment: number) => {
      const todayDateStr = formatDateISO(new Date());
      const todayLog = workLogs.find(log => log.date === todayDateStr);

      if (!todayLog) {
          console.warn("[Home] Quick Update: No log found for today to update.");
          toast({
            variant: "destructive",
            title: "Quick Update Failed",
            description: "No work log found for today. Please add one first.",
          });
          return;
      }

      const currentValue = todayLog[field] || 0;
      const updatedValue = currentValue + increment;

       // Prevent negative values
       if (updatedValue < 0) {
           console.warn(`[Home] Quick Update: Attempted to decrement ${field} below zero.`);
            // Optionally show a different toast or just do nothing
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
           return;
       }

      const updatedLogData: DailyWorkLog = { // Ensure full DailyWorkLog type
          ...todayLog,
          [field]: updatedValue,
      };

      // Call the save handler which updates state
      try {
           handleSaveWorkLog(updatedLogData);
           console.log(`[Home] Quick Update: Updated ${field} to ${updatedValue}`);
           // Optional success toast (might be too noisy)
           // toast({ title: "Quick Update", description: `${field === 'documentsCompleted' ? 'Documents' : 'Videos'} updated to ${updatedValue}.` });
      } catch(error) {
          console.error(`[Home] Quick Update Failed for ${field}:`, error);
          // Error toast is handled within handleSaveWorkLog
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

        {/* --- Quick Update Section --- */}
        {todayLog ? (
            <Card>
                <CardHeader>
                    <CardTitle>Quick Update Today's Counts</CardTitle>
                 </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                    {/* Document Count */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="quick-update-docs" className="min-w-[80px] sm:min-w-[auto]">Documents:</Label>
                        <Button
                            id="quick-update-docs-minus"
                            aria-label="Decrease document count"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuickUpdate('documentsCompleted', -1)}
                            disabled={isLoading} // Disable while saving potentially
                        >
                            <Minus className="h-4 w-4"/>
                        </Button>
                        <span className="text-lg font-medium w-10 text-center tabular-nums">
                            {todayLog.documentsCompleted}
                        </span>
                        <Button
                             id="quick-update-docs-plus"
                             aria-label="Increase document count"
                             variant="outline"
                             size="icon"
                             className="h-8 w-8"
                            onClick={() => handleQuickUpdate('documentsCompleted', 1)}
                            disabled={isLoading}
                        >
                             <Plus className="h-4 w-4"/>
                        </Button>
                    </div>
                    {/* Video Count */}
                     <div className="flex items-center gap-2">
                        <Label htmlFor="quick-update-videos" className="min-w-[80px] sm:min-w-[auto]">Videos:</Label>
                        <Button
                            id="quick-update-videos-minus"
                            aria-label="Decrease video count"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuickUpdate('videoSessionsCompleted', -1)}
                             disabled={isLoading}
                         >
                            <Minus className="h-4 w-4"/>
                        </Button>
                         <span className="text-lg font-medium w-10 text-center tabular-nums">
                            {todayLog.videoSessionsCompleted}
                        </span>
                        <Button
                            id="quick-update-videos-plus"
                            aria-label="Increase video count"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuickUpdate('videoSessionsCompleted', 1)}
                            disabled={isLoading}
                        >
                            <Plus className="h-4 w-4"/>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ) : (
             <Card className="border-dashed border-muted-foreground">
                <CardHeader>
                    <CardTitle className="text-muted-foreground">Log Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No work log found for today. Add one on the 'Log / Targets' page to enable quick updates.</p>
                 </CardContent>
            </Card>
        )}


        {/* Productivity Dashboard - Now only shows Today's Metrics */}
        <ProductivityDashboard
          initialWorkLogs={todayLog ? [todayLog] : []} // Pass only today's log (or empty array)
          initialUphTargets={uphTargets}
          initialActiveTarget={activeTarget}
          deleteWorkLogAction={handleDeleteWorkLog} // Pass delete action
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

      