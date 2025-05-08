'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link'; // Import Link
import ProductivityDashboard from '@/components/DashboardDisplay';
import WeeklyAverages from '@/components/WeeklyAverages';
import DailyProgressIndicator from '@/components/DailyProgressIndicator';
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog,
  deleteWorkLog,
  getUPHTargets,
  loadSampleData,
  clearAllData,
  addBreakTimeToLog,
  addTrainingTimeToLog,
  archiveTodayLog,
  getDefaultSettings,
  isSampleDataLoaded, // Import check for sample data
} from '@/lib/actions'; // Using client-side actions
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateHoursWorked, formatDurationFromMinutes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Info, Trash2, BarChart, PlayCircle, Coffee, Brain, Edit3, HelpCircle, Archive, RefreshCcw } from 'lucide-react'; // Added RefreshCcw
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import TutorialDialog from '@/components/TutorialDialog';


export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [docInputValue, setDocInputValue] = useState<string>('');
  const [videoInputValue, setVideoInputValue] = useState<string>('');
  const [hasInitialData, setHasInitialData] = useState(false);
  const [sampleDataActive, setSampleDataActive] = useState(false); // State to track if sample data is loaded
  const { toast } = useToast();

  // --- Data Loading ---
  const loadData = useCallback((showLoadingIndicator = true) => {
    if (typeof window === 'undefined') return;

    if (showLoadingIndicator) {
      setIsLoading(true);
    }
    console.log('[Home Page] loadData triggered.');
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();
      const isSampleLoaded = isSampleDataLoaded(); // Check if sample data flag is set

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      setHasInitialData(loadedLogs.length > 0 || loadedTargets.length > 0);
      setSampleDataActive(isSampleLoaded); // Update sample data state

      const today = loadedLogs.find(log => log.date === formatDateISO(new Date()));
      setDocInputValue(today?.documentsCompleted?.toString() ?? '');
      setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
      console.log('[Home Page] Data loaded. Active target:', loadedActiveTarget?.name, 'Sample Data Loaded:', isSampleLoaded);

    } catch (error) {
      console.error('[Home] Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not load work logs or targets from local storage.",
      });
      setHasInitialData(false);
      setSampleDataActive(false); // Assume no sample data on error
    } finally {
      if (showLoadingIndicator) {
        setIsLoading(false);
      }
    }
  }, [toast]); // toast is stable

  useEffect(() => {
     if (typeof window !== 'undefined') {
        console.log('[Home Page] useEffect triggered due to mount.');
        loadData();
     }
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

   // Effect to update input values when workLogs change (e.g., after saving)
   useEffect(() => {
    const today = workLogs.find(log => log.date === formatDateISO(new Date()));
    setDocInputValue(today?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs]);

  // --- Action Handlers ---
  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { id?: string; hoursWorked?: number }) => {
    if (typeof window === 'undefined') return {} as DailyWorkLog;
    try {
        // The saveWorkLog itself will now handle detailed audit logging
        const savedLog = saveWorkLog(logData);
        // Update local state immediately with the returned saved log
        setWorkLogs(prevLogs => {
            const existingIndex = prevLogs.findIndex(l => l.id === savedLog.id);
            let newLogs;
            if (existingIndex > -1) {
                newLogs = [...prevLogs];
                newLogs[existingIndex] = savedLog;
            } else {
                newLogs = [...prevLogs, savedLog];
            }
            // Ensure logs remain sorted by date descending
            return newLogs.sort((a, b) => b.date.localeCompare(a.date));
        });

        setHasInitialData(true); // Assume data exists after save
        setSampleDataActive(false); // Any save operation clears sample data status
        // Toast moved to the specific actions calling this handler for better context
        return savedLog; // Return the saved log
    } catch (error) {
        console.error('[Home] Error saving work log:', error);
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: error instanceof Error ? error.message : "Could not save the work log.",
        });
        throw error;
    }
  }, [toast]); // Depends on toast

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (typeof window === 'undefined') return;
    try {
        deleteWorkLog(id);
        loadData(false); // Reload data without main loading indicator
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
  }, [loadData, toast]);

  // --- Quick Update Handlers ---
   const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', value: number | string) => {
      if (typeof window === 'undefined') return;
      const todayDateStr = formatDateISO(new Date());
      const todayLog = workLogs.find(log => log.date === todayDateStr);

      if (!todayLog) {
          console.warn("[Home] Quick Update: No log found for today to update.");
          toast({
              variant: "destructive",
              title: "Quick Update Failed",
              description: "No work log found for today. Add one on the 'Log / Targets' page or click 'Start New Day'.",
          });
          return;
      }

      let newValue: number;
      const currentValue = todayLog[field] || 0;

      if (typeof value === 'string') {
         newValue = parseInt(value, 10);
         if (isNaN(newValue)) {
              // Revert input if invalid number entered
              if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
              if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
              toast({ variant: "destructive", title: "Invalid Input", description: "Please enter a valid number." });
              return;
         }
      } else {
            newValue = currentValue + value;
      }

       if (newValue < 0) {
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
            if (typeof value === 'string') { // Revert input if it was direct text entry
                if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
            }
           return;
       }

      const updatedLogPartial: Partial<DailyWorkLog> & { id: string; date: string; startTime: string; endTime: string } = {
          id: todayLog.id,
          date: todayLog.date,
          startTime: todayLog.startTime,
          endTime: todayLog.endTime,
          [field]: newValue,
          breakDurationMinutes: todayLog.breakDurationMinutes,
          trainingDurationMinutes: todayLog.trainingDurationMinutes,
          // Crucially include goalMetTimes so they are not overwritten
          goalMetTimes: todayLog.goalMetTimes || {},
      };


      try {
           const saved = handleSaveWorkLog(updatedLogPartial as any);
           // Inputs will update via the useEffect watching workLogs
           toast({ title: "Count Updated", description: `Today's ${field === 'documentsCompleted' ? 'document' : 'video'} count set to ${newValue}.` });
      } catch(error) {
           // Revert input on error if it was direct text entry
           if (typeof value === 'string') {
                if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
           }
           // Error toast is handled within handleSaveWorkLog
      }
  };

  // --- Sample Data / Clear Data Handlers ---
  const handleLoadSampleData = () => {
     if (typeof window === 'undefined') return;
    try {
      const loaded = loadSampleData(); // This action now handles its own audit log
      if (loaded) {
        toast({
          title: "Sample Data Loaded",
          description: "Sample work logs and targets have been added.",
        });
        loadData(); // Reload data after loading samples
      } else {
        toast({
          title: "Sample Data Skipped",
          description: "Existing data found. Sample data was not loaded.",
        });
      }
    } catch (error) {
      console.error('[Home] Error loading sample data:', error);
      toast({
        variant: "destructive",
        title: "Sample Data Error",
        description: error instanceof Error ? error.message : "Could not load sample data.",
      });
    }
  };

   // Handler for the "Clear Sample Data & Start Fresh" button
  const handleClearSampleAndStart = () => {
    if (typeof window === 'undefined') return;
    try {
      clearAllData(); // Clears logs, targets, settings, and the sample data flag
      toast({
        title: "Data Cleared",
        description: "Sample data removed. Starting fresh!",
      });
      // Immediately try to start a new day after clearing
      // Note: handleStartNewDay depends on having an active target.
      // Since clearAllData removes targets, we need to guide the user.
      // It's better to reload and let the "No Active Target" state guide them.
      loadData(); // Reload to show the initial state after clearing

      // Instead of auto-starting, prompt user:
      // setTimeout(() => { // Delay slightly for UI update
      //   toast({
      //     title: "Next Step",
      //     description: "Please go to 'Log / Targets' to set up your first UPH target.",
      //     duration: 5000,
      //   });
      // }, 500);
       // Or directly navigate, though letting the user control is better UX
       // router.push('/log-input');

    } catch (error) {
      console.error('[Home] Error clearing sample data:', error);
      toast({
        variant: "destructive",
        title: "Clear Data Error",
        description: error instanceof Error ? error.message : "Could not clear data.",
      });
    }
  };


  // --- Start/End Day Handlers ---
  const handleStartNewDay = useCallback(() => {
    if (typeof window === 'undefined') return;
    const activeTargetCheck = getActiveUPHTarget(); // Re-fetch active target state directly
    if (!activeTargetCheck) {
      toast({
        variant: "destructive",
        title: "Cannot Start New Day",
        description: "No active UPH target found. Please set one on the 'Log / Targets' page.",
      });
      return;
    }

    const todayDateStr = formatDateISO(new Date());
    // Get user-defined defaults or fallback defaults
    const userSettings = getDefaultSettings();
    const defaultStartTime = userSettings.defaultStartTime || '14:00';
    const defaultEndTime = userSettings.defaultEndTime || '22:30';
    // Start with 0 break/training minutes for a new day
    const defaultBreakMinutes = userSettings.defaultBreakMinutes ?? 0;
    const defaultTrainingMinutes = userSettings.defaultTrainingMinutes ?? 0;
    const totalNonWorkMinutes = defaultBreakMinutes + defaultTrainingMinutes;

    // Calculate hours based on fetched or fallback defaults
    const defaultHoursWorked = calculateHoursWorked(todayDateStr, defaultStartTime, defaultEndTime, totalNonWorkMinutes);

    const newLog: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { hoursWorked: number } = {
      date: todayDateStr,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      breakDurationMinutes: defaultBreakMinutes,
      trainingDurationMinutes: defaultTrainingMinutes,
      hoursWorked: defaultHoursWorked,
      documentsCompleted: 0,
      videoSessionsCompleted: 0,
      targetId: activeTargetCheck.id, // Use the fetched active target ID
      notes: 'New day started from dashboard.',
      goalMetTimes: {}, // Initialize empty goal met times
    };

    try {
      handleSaveWorkLog(newLog); // saveWorkLog will log as CREATE_WORK_LOG
      toast({
        title: "New Day Started",
        description: `Work log for ${todayDateStr} created with default times. Break/Training starts at ${defaultBreakMinutes}/${defaultTrainingMinutes} mins.`,
      });
    } catch (error) {
      // Error handling is within handleSaveWorkLog
    }
  }, [handleSaveWorkLog, toast]);

  const handleEndDay = useCallback(() => {
     if (typeof window === 'undefined') return;
    const todayLogToEnd = workLogs.find(log => log.date === formatDateISO(new Date()));
    if (!todayLogToEnd) {
      toast({
        variant: "destructive",
        title: "No Log to End",
        description: "No work log found for today to mark as ended.",
      });
      return;
    }

    const archivedLog = archiveTodayLog(); // This function is in actions.ts
    if (archivedLog) {
        toast({
            title: "Day Ended",
            description: `Log for ${archivedLog.date} has been finalized. You can view it in 'Previous Logs'.`,
        });
        loadData(false); // Reload data to reflect the change
    } else {
         toast({
            variant: "destructive",
            title: "End Day Failed",
            description: "Could not finalize today's log. It might have already been processed or an error occurred.",
         });
    }
  }, [workLogs, loadData, toast]);


  // --- Input Handlers ---
  const handleDocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or only digits
    if (/^\d*$/.test(val)) {
       setDocInputValue(val);
    }
  };
  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     if (/^\d*$/.test(val)) {
         setVideoInputValue(val);
     }
  };

   // Handle saving when input loses focus (onBlur)
  const handleDocInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.documentsCompleted?.toString() ?? '0';
       // Treat empty input as 0 for comparison and saving
       const inputValStr = docInputValue.trim() === '' ? '0' : docInputValue.trim();

       if (inputValStr === '') {
         setDocInputValue('0'); // Ensure '0' is displayed if cleared
       }

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('documentsCompleted', inputValStr);
       } else if (!todayLog && inputValStr !== '0') {
           // Don't attempt update if no log exists and input is not 0
       }
   };
  const handleVideoInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.videoSessionsCompleted?.toString() ?? '0';
       const inputValStr = videoInputValue.trim() === '' ? '0' : videoInputValue.trim();

        if (inputValStr === '') {
         setVideoInputValue('0'); // Ensure '0' is displayed if cleared
       }

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('videoSessionsCompleted', inputValStr);
       } else if (!todayLog && inputValStr !== '0') {
           // Don't attempt update if no log exists
       }
  };

  // --- Break/Training Handlers ---
  const handleAddBreak = useCallback((breakMinutes: number) => {
    if (typeof window === 'undefined') return;
    const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
    if (!todayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Break",
        description: "No work log found for today. Start a new day first.",
      });
      return;
    }
    try {
      const updatedLog = addBreakTimeToLog(todayLog.id, breakMinutes);
      // Update local state immediately
      setWorkLogs(prevLogs => {
          const index = prevLogs.findIndex(l => l.id === updatedLog.id);
          if (index > -1) {
              const newLogs = [...prevLogs];
              newLogs[index] = updatedLog;
              return newLogs;
          }
          return prevLogs; // Should always find the log
      });
      toast({
        title: "Break Added",
        description: `${breakMinutes} minutes added to your break time. Total break: ${formatDurationFromMinutes(updatedLog.breakDurationMinutes * 60)}.`,
      });
    } catch (error) {
      console.error('[Home] Error adding break:', error);
      toast({
        variant: "destructive",
        title: "Add Break Failed",
        description: error instanceof Error ? error.message : "Could not add break time.",
      });
    }
  }, [workLogs, toast]); // Depends on workLogs to find todayLog

  const handleAddTraining = useCallback((trainingMinutes: number) => {
    if (typeof window === 'undefined') return;
    const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
    if (!todayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Training",
        description: "No work log found for today. Start a new day first.",
      });
      return;
    }
    try {
      const updatedLog = addTrainingTimeToLog(todayLog.id, trainingMinutes);
      // Update local state immediately
        setWorkLogs(prevLogs => {
            const index = prevLogs.findIndex(l => l.id === updatedLog.id);
            if (index > -1) {
                const newLogs = [...prevLogs];
                newLogs[index] = updatedLog;
                return newLogs;
            }
            return prevLogs; // Should always find the log
        });
      toast({
        title: "Training Time Added",
        description: `${trainingMinutes} minutes added to your training time. Total training: ${formatDurationFromMinutes((updatedLog.trainingDurationMinutes || 0) * 60)}.`,
      });
    } catch (error) {
      console.error('[Home] Error adding training:', error);
      toast({
        variant: "destructive",
        title: "Add Training Failed",
        description: error instanceof Error ? error.message : "Could not add training time.",
      });
    }
  }, [workLogs, toast]); // Depends on workLogs to find todayLog

  // --- Goal Met Handler ---
  const handleGoalMet = useCallback((targetId: string, metAt: Date) => {
     if (typeof window === 'undefined') return;
     console.log(`[Home] Received goal met notification for target ${targetId} at ${metAt.toISOString()}`);
     // Use a functional update for setWorkLogs to ensure we're working with the latest state
    setWorkLogs(prevLogs => {
        const todayLog = prevLogs.find(log => log.date === formatDateISO(new Date()));

        if (todayLog && !(todayLog.goalMetTimes && todayLog.goalMetTimes[targetId])) {
            console.log(`[Home] Persisting goal met time for target ${targetId}...`);
            const newGoalMetTimes = { ...(todayLog.goalMetTimes || {}), [targetId]: metAt.toISOString() };

            const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked?: number } = {
                ...todayLog,
                goalMetTimes: newGoalMetTimes,
                hoursWorked: todayLog.hoursWorked,
            };

            try {
                // Call saveWorkLog (which is synchronous for localStorage)
                // NOTE: This saveWorkLog updates localStorage but doesn't directly cause the state update here.
                // The state update happens via the return value of this functional update.
                const savedLog = saveWorkLog(payloadToSave);

                // Update the log within the current state array
                const index = prevLogs.findIndex(l => l.id === savedLog.id);
                if (index > -1) {
                    const updatedLogs = [...prevLogs];
                    updatedLogs[index] = savedLog; // Use the log returned by saveWorkLog
                    return updatedLogs.sort((a, b) => b.date.localeCompare(a.date)); // Return the updated, sorted array
                }
                // If somehow the log wasn't found by ID, return previous state unchanged
                return prevLogs;
            } catch (error) {
                console.error(`[Home] Error saving goal met time for target ${targetId}:`, error);
                // Toast handled in saveWorkLog
                return prevLogs; // Return previous state on error
            }
        } else {
            console.log(`[Home] Goal met time already recorded or no log found for target ${targetId}.`);
            return prevLogs; // Return previous state if no update needed
        }
    });
  }, [toast]); // Removed handleSaveWorkLog from dependencies as it's called internally now


  const todayLog = workLogs.find(log => log.date === formatDateISO(new Date())) || null;

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Daily Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Adjust skeleton spans */}
          <Skeleton className="h-[250px] md:col-span-2 lg:col-span-2 w-full" />
          <Skeleton className="h-[250px] w-full" />
        </div>
        <Skeleton className="h-[180px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

   if (!hasInitialData) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-8 p-4 md:p-6 lg:p-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-15rem)]">
        <BarChart className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Welcome to Metric Daily!</h1>
        <p className="text-lg text-muted-foreground mb-6">
          It looks like you don&apos;t have any data yet. You can load sample data to explore, or follow the guide to set up your own tracking.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button onClick={handleLoadSampleData} size="lg">
            <Plus className="mr-2 h-5 w-5" /> Load Sample Data
          </Button>
           <Button asChild size="lg" variant="outline">
            <Link href="/log-input">
                <Edit3 className="mr-2 h-5 w-5" /> Set Up & Start Tracking
            </Link>
          </Button>
        </div>
         <div className="mt-8">
           <TutorialDialog contextualTriggerText="View App Guide" />
        </div>
         <p className="text-sm text-muted-foreground mt-4">
            To start tracking, you&apos;ll need to define at least one UPH Target and log your first day&apos;s work on the &apos;Log / Targets&apos; page.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-center sm:text-left">Daily Dashboard</h1>
             {/* Conditionally render "Clear Sample Data" button */}
             {sampleDataActive && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline">
                            <RefreshCcw className="mr-2 h-4 w-4" /> Clear Sample Data &amp; Start Fresh
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Ready to track your own data?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all sample work logs and targets. Are you sure you want to continue?
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearSampleAndStart}>
                            Yes, Clear and Start
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
             )}
             {/* Keep the end day button if today's log exists */}
            {todayLog && !sampleDataActive && ( // Only show End Day if not in sample mode
                    <Button onClick={handleEndDay} variant="outline" size="sm" disabled={isLoading}>
                        <Archive className="mr-2 h-4 w-4" /> End Today&apos;s Log
                    </Button>
             )}
        </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start"> {/* Use items-start */}
             {/* Quick Update Card - span 2 columns */}
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Quick Update Today&apos;s Counts</CardTitle>
                    {todayLog ? (
                        <CardDescription>
                            Log Date: {formatDateISO(new Date())}
                        </CardDescription>
                     ) : (
                         <CardDescription className="text-muted-foreground">
                             No log started for today.
                         </CardDescription>
                     )}
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center py-6"> {/* Centered items */}
                    <div className="flex flex-col items-center gap-2">
                        <Label htmlFor="quick-update-docs-input" className="min-w-[80px] sm:min-w-[auto]">Documents:</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                id="quick-update-docs-minus" aria-label="Decrease document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', -1)} disabled={isLoading || !todayLog}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                id="quick-update-docs-input" type="text" inputMode="numeric" pattern="[0-9]*" value={docInputValue} onChange={handleDocInputChange} onBlur={handleDocInputBlur}
                                className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                disabled={isLoading || !todayLog} aria-label="Document count input"
                             />
                            <Button
                                id="quick-update-docs-plus" aria-label="Increase document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', 1)} disabled={isLoading || !todayLog}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Label htmlFor="quick-update-videos-input" className="min-w-[80px] sm:min-w-[auto]">Videos:</Label>
                         <div className="flex items-center gap-2">
                            <Button
                                id="quick-update-videos-minus" aria-label="Decrease video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', -1)} disabled={isLoading || !todayLog}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                 id="quick-update-videos-input" type="text" inputMode="numeric" pattern="[0-9]*" value={videoInputValue} onChange={handleVideoInputChange} onBlur={handleVideoInputBlur}
                                 className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                 disabled={isLoading || !todayLog} aria-label="Video count input"
                              />
                            <Button
                                id="quick-update-videos-plus" aria-label="Increase video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', 1)} disabled={isLoading || !todayLog}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                    </div>
                </CardContent>
                 <CardFooter className="flex flex-col items-center gap-2 pt-2 pb-4">
                    <Label className="text-sm font-medium">Log Non-Work Time</Label>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleAddBreak(15)} disabled={isLoading || !todayLog}>
                            <Coffee className="mr-2 h-4 w-4" /> Break (15m)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleAddBreak(30)} disabled={isLoading || !todayLog}>
                            <Coffee className="mr-2 h-4 w-4" /> Lunch (30m)
                        </Button>
                         <Button variant="outline" size="sm" onClick={() => handleAddTraining(5)} disabled={isLoading || !todayLog}>
                            <Brain className="mr-2 h-4 w-4" /> Train (5m)
                        </Button>
                    </div>
                    {todayLog && (
                         <p className="text-xs text-muted-foreground mt-1">
                            Current Break: {formatDurationFromMinutes(todayLog.breakDurationMinutes * 60)}
                            {todayLog.trainingDurationMinutes && todayLog.trainingDurationMinutes > 0 &&
                                ` | Training: ${formatDurationFromMinutes(todayLog.trainingDurationMinutes * 60)}`
                            }
                         </p>
                    )}
                </CardFooter>
            </Card>


            {/* Weekly Average Card */}
             <WeeklyAverages
                allWorkLogs={workLogs}
                targets={uphTargets}
                activeTarget={activeTarget}
            />

             {/* Start New Day Card - Conditionally Rendered */}
             {!todayLog && (
                 <Card className="border-dashed border-muted-foreground md:col-span-3"> {/* Span all columns */}
                    <CardHeader>
                        <CardTitle className="text-muted-foreground">Start Your Day</CardTitle>
                    </CardHeader>
                     <CardContent className="flex flex-col items-center justify-center min-h-[150px] py-6 text-muted-foreground gap-4"> {/* Adjusted height */}
                         <Info className="h-8 w-8" />
                         <p className="text-center max-w-xs">
                             No work log found for today ({formatDateISO(new Date())}).
                         </p>
                         <Button onClick={handleStartNewDay} disabled={isLoading || !activeTarget}>
                            <PlayCircle className="mr-2 h-5 w-5" /> Start New Day
                         </Button>
                         {!activeTarget && <p className="text-xs text-destructive"> (Set an active target first)</p>}
                    </CardContent>
                </Card>
             )}
        </div>

         {/* Daily Progress Indicator - Only show if todayLog exists */}
         {todayLog && activeTarget && (
             <DailyProgressIndicator
                 todayLog={todayLog}
                 activeTarget={activeTarget}
             />
         )}

        {/* Productivity Dashboard (Today's Metrics Breakdown) - Only show if todayLog exists */}
        {todayLog && (
            <ProductivityDashboard
                initialWorkLogs={todayLog ? [todayLog] : []} // Pass only today's log
                initialUphTargets={uphTargets}
                initialActiveTarget={activeTarget} // Pass active target for context
                deleteWorkLogAction={handleDeleteWorkLog} // Pass delete action
                onGoalMet={handleGoalMet} // Pass the callback
            />
        )}

         {/* Message if no log for today but data exists and log hasn't been created yet */}
         {!todayLog && hasInitialData && !isLoading && (
             // This message might be redundant now with the "Start New Day" card
             <></>
        )}
    </div>
  );
}
