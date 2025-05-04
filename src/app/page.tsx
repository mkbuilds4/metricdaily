
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
import { Input } from '@/components/ui/input'; // Import Input
import { Minus, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // State to manage input values locally for immediate feedback
  const [docInputValue, setDocInputValue] = useState<string>('');
  const [videoInputValue, setVideoInputValue] = useState<string>('');
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

      // Initialize input values from today's log if it exists
      const today = loadedLogs.find(log => log.date === formatDateISO(new Date()));
      setDocInputValue(today?.documentsCompleted?.toString() ?? '');
      setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');

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

   // Update input values when workLogs change (e.g., after save)
   useEffect(() => {
    const today = workLogs.find(log => log.date === formatDateISO(new Date()));
    setDocInputValue(today?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs]);


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

  // --- Quick Update Handlers --- Refactored
   const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', value: number | string) => {
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

      let newValue: number;
      if (typeof value === 'string') {
         // If value is string, it comes from input, parse it
         newValue = parseInt(value, 10);
         if (isNaN(newValue)) {
              console.warn("[Home] Quick Update: Invalid input value:", value);
              // Optionally reset input to current value or show specific toast
              // For now, just ignore invalid input
                if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
              return;
         }
      } else {
           // If value is number, it comes from +/- buttons (increment)
            const currentValue = todayLog[field] || 0;
            newValue = currentValue + value; // Apply increment
      }


       // Prevent negative values
       if (newValue < 0) {
           console.warn(`[Home] Quick Update: Attempted to set ${field} below zero.`);
            // Optionally show a different toast or just do nothing
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
            // Reset input value if coming from input
            if (typeof value === 'string') {
                if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
            }
           return;
       }

      const updatedLogData: DailyWorkLog = { // Ensure full DailyWorkLog type
          ...todayLog,
          [field]: newValue,
      };

      // Call the save handler which updates state
      try {
           handleSaveWorkLog(updatedLogData);
           console.log(`[Home] Quick Update: Updated ${field} to ${newValue}`);
           // Update local input state ONLY if the change came from buttons
           if (typeof value !== 'string') {
                if (field === 'documentsCompleted') setDocInputValue(newValue.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(newValue.toString());
           }
           // Optional success toast (might be too noisy)
           // toast({ title: "Quick Update", description: `${field === 'documentsCompleted' ? 'Documents' : 'Videos'} updated to ${newValue}.` });
      } catch(error) {
          console.error(`[Home] Quick Update Failed for ${field}:`, error);
          // Error toast is handled within handleSaveWorkLog
          // Revert input value on save error if coming from input
           if (typeof value === 'string') {
                if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
           }
      }
  };

  // Specific handlers for input changes
  const handleDocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty input for clearing, otherwise only digits
    if (val === '' || /^\d+$/.test(val)) {
      setDocInputValue(val);
    }
  };

  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     if (val === '' || /^\d+$/.test(val)) {
       setVideoInputValue(val);
     }
  };

  // Handlers for when input loses focus (onBlur) to trigger save
   const handleDocInputBlur = () => {
       // Only save if the value is a valid number and different from the current log
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       if (todayLog && docInputValue !== todayLog.documentsCompleted.toString() && docInputValue !== '') {
           handleQuickUpdate('documentsCompleted', docInputValue);
       } else if (docInputValue === '' && todayLog && todayLog.documentsCompleted !== 0) {
           // Handle clearing the input - set to 0
           handleQuickUpdate('documentsCompleted', '0');
       } else if (docInputValue === '' && todayLog) {
           // If input is cleared but value was already 0, reset display just in case
           setDocInputValue('0');
       } else if (!todayLog) {
            setDocInputValue(''); // Clear if no log exists
       }
   };

  const handleVideoInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       if (todayLog && videoInputValue !== todayLog.videoSessionsCompleted.toString() && videoInputValue !== '') {
            handleQuickUpdate('videoSessionsCompleted', videoInputValue);
        } else if (videoInputValue === '' && todayLog && todayLog.videoSessionsCompleted !== 0) {
            handleQuickUpdate('videoSessionsCompleted', '0');
        } else if (videoInputValue === '' && todayLog) {
           setVideoInputValue('0');
       } else if (!todayLog) {
            setVideoInputValue('');
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

        {/* Grid container for Quick Update and Weekly Averages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* --- Quick Update Section --- */}
            {todayLog ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Update Today's Counts</CardTitle>
                    </CardHeader>
                    {/* Make CardContent a flex container to center items */}
                    <CardContent className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center py-6"> {/* Added padding and centering */}
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
                             {/* Replace span with Input */}
                             <Input
                                id="quick-update-docs-input"
                                type="number" // Use number type for better mobile experience potentially
                                value={docInputValue}
                                onChange={handleDocInputChange}
                                onBlur={handleDocInputBlur} // Save on blur
                                className="h-9 w-16 text-center tabular-nums text-lg font-medium" // Adjusted width and height
                                disabled={isLoading}
                                min="0" // Prevent negative input via browser
                                aria-label="Document count input"
                             />
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
                             {/* Replace span with Input */}
                             <Input
                                 id="quick-update-videos-input"
                                 type="number"
                                 value={videoInputValue}
                                 onChange={handleVideoInputChange}
                                 onBlur={handleVideoInputBlur} // Save on blur
                                 className="h-9 w-16 text-center tabular-nums text-lg font-medium" // Adjusted width and height
                                 disabled={isLoading}
                                 min="0"
                                 aria-label="Video count input"
                              />
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
                     {/* Center content vertically and horizontally */}
                     <CardContent className="flex items-center justify-center h-full py-6">
                         <p className="text-muted-foreground text-center">
                             No work log found for today. Add one on the 'Log / Targets' page to enable quick updates.
                         </p>
                    </CardContent>
                </Card>
            )}

            {/* Weekly Averages Component */}
            <WeeklyAverages
                allWorkLogs={workLogs}
                targets={uphTargets}
                activeTarget={activeTarget}
            />
        </div>

        {/* --- Productivity Dashboard --- */}
        {/* This remains below the grid */}
        <ProductivityDashboard
          initialWorkLogs={todayLog ? [todayLog] : []} // Pass only today's log (or empty array)
          initialUphTargets={uphTargets}
          initialActiveTarget={activeTarget}
          deleteWorkLogAction={handleDeleteWorkLog} // Pass delete action
        />

    </div>
  );
}


    