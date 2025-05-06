
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProductivityDashboard from '@/components/DashboardDisplay';
import WeeklyAverages from '@/components/WeeklyAverages';
import DailyProgressIndicator from '@/components/DailyProgressIndicator';
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog,
  deleteWorkLog,
  getUPHTargets,
  loadSampleData, // Import sample data loader
  clearAllData, // Import clear data action
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateHoursWorked } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Info, Trash2, BarChart, PlayCircle } from 'lucide-react'; // Added icons
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
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


export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [docInputValue, setDocInputValue] = useState<string>('');
  const [videoInputValue, setVideoInputValue] = useState<string>('');
  const [hasInitialData, setHasInitialData] = useState(false); // Track if any data exists initially
  const { toast } = useToast();

  const loadData = useCallback((showLoadingIndicator = true) => {
    if (typeof window === 'undefined') return; // Don't run on server

    if (showLoadingIndicator) {
      setIsLoading(true);
    }
    console.log('[Home] Loading data...');
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      setHasInitialData(loadedLogs.length > 0 || loadedTargets.length > 0);

      const today = loadedLogs.find(log => log.date === formatDateISO(new Date()));
      setDocInputValue(today?.documentsCompleted?.toString() ?? '');
      setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');

      console.log('[Home] Data loaded:', { logs: loadedLogs.length, targets: loadedTargets.length, active: !!loadedActiveTarget });
    } catch (error) {
      console.error('[Home] Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not load work logs or targets from local storage.",
      });
      setHasInitialData(false); // Assume no data if loading fails
    } finally {
      if (showLoadingIndicator) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
     if (typeof window !== 'undefined') {
        loadData();
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

   useEffect(() => {
    const today = workLogs.find(log => log.date === formatDateISO(new Date()));
    setDocInputValue(today?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs]);

  // --- Action Handlers ---
  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }) => {
    if (typeof window === 'undefined') return {} as DailyWorkLog; // Type assertion might be needed
    try {
      const savedLog = saveWorkLog(logData);
      loadData(false); // Reload data without showing loading spinner for smoother UX
      setHasInitialData(true); // Assume data exists after saving
      return savedLog;
    } catch (error) {
      console.error('[Home] Error saving work log via quick update/dashboard:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save the work log.",
      });
      throw error;
    }
  }, [loadData, toast]);

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (typeof window === 'undefined') return;
    try {
        deleteWorkLog(id);
        loadData(false); // Reload data without spinner
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
      if (typeof window === 'undefined') return; // Guard against server-side execution
      const todayDateStr = formatDateISO(new Date());
      const todayLog = workLogs.find(log => log.date === todayDateStr);

      if (!todayLog) {
          console.warn("[Home] Quick Update: No log found for today to update.");
          toast({
              variant: "destructive",
              title: "Quick Update Failed",
              description: "No work log found for today. Add one on the 'Log / Targets' page.",
          });
          return;
      }

      let newValue: number;
      if (typeof value === 'string') {
         newValue = parseInt(value, 10);
         if (isNaN(newValue)) {
              if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
              if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
              return;
         }
      } else {
            const currentValue = todayLog[field] || 0;
            newValue = currentValue + value;
      }

       if (newValue < 0) {
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
            if (typeof value === 'string') {
                if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
            }
           return;
       }

      // Ensure targetId is included when saving
      const updatedLogData: DailyWorkLog = {
          ...todayLog,
          [field]: newValue,
          targetId: todayLog.targetId, // Keep the original targetId
      };

      try {
           handleSaveWorkLog(updatedLogData);
           // No need to update input values here, effect hook handles it
      } catch(error) {
           if (typeof value === 'string') {
                // Revert input on error
                if (field === 'documentsCompleted') setDocInputValue(todayLog.documentsCompleted.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(todayLog.videoSessionsCompleted.toString());
           }
      }
  };

  // --- Sample Data / Clear Data Handlers ---
  const handleLoadSampleData = () => {
     if (typeof window === 'undefined') return;
    console.log('[Home] handleLoadSampleData called');
    try {
      const loaded = loadSampleData();
      if (loaded) {
        toast({
          title: "Sample Data Loaded",
          description: "Sample work logs and targets have been added.",
        });
        loadData(); // Reload data to reflect changes
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

  const handleClearAllData = () => {
     if (typeof window === 'undefined') return;
    console.log('[Home] handleClearAllData called');
    try {
      clearAllData();
      toast({
        title: "Data Cleared",
        description: "All work logs and targets have been removed.",
      });
      loadData(); // Reload to show empty state
    } catch (error) {
      console.error('[Home] Error clearing data:', error);
      toast({
        variant: "destructive",
        title: "Clear Data Error",
        description: error instanceof Error ? error.message : "Could not clear data.",
      });
    }
  };

  const handleStartNewDay = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!activeTarget) {
      toast({
        variant: "destructive",
        title: "Cannot Start New Day",
        description: "No active UPH target found. Please set one on the 'Log / Targets' page.",
      });
      return;
    }

    const todayDateStr = formatDateISO(new Date());
    const defaultStartTime = '14:00';
    const defaultEndTime = '22:30';
    const defaultBreakMinutes = 65;
    const defaultHoursWorked = calculateHoursWorked(todayDateStr, defaultStartTime, defaultEndTime, defaultBreakMinutes);

    const newLog: Omit<DailyWorkLog, 'id'> & { hoursWorked: number } = {
      date: todayDateStr,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      breakDurationMinutes: defaultBreakMinutes,
      hoursWorked: defaultHoursWorked,
      documentsCompleted: 0,
      videoSessionsCompleted: 0,
      targetId: activeTarget.id,
      notes: 'New day started from dashboard.',
    };

    try {
      handleSaveWorkLog(newLog);
      toast({
        title: "New Day Started",
        description: `Work log for ${todayDateStr} created with default times.`,
      });
    } catch (error) {
      // Error handling is within handleSaveWorkLog
    }
  }, [activeTarget, handleSaveWorkLog, toast]);


  // --- Input Change/Blur Handlers (Keep as is) ---
  const handleDocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or numbers
    if (val === '' || /^\d+$/.test(val)) setDocInputValue(val);
  };
  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
      // Allow empty string or numbers
     if (val === '' || /^\d+$/.test(val)) setVideoInputValue(val);
  };
  const handleDocInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.documentsCompleted?.toString() ?? '0';
       const inputValStr = docInputValue.trim() === '' ? '0' : docInputValue.trim(); // Treat empty as 0 on blur

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('documentsCompleted', inputValStr); // Save the cleaned value
       } else if (!todayLog && docInputValue.trim() !== '') {
            setDocInputValue(''); // Clear input if no log exists
       } else if (inputValStr === '0') {
            setDocInputValue('0'); // Ensure display shows '0' if entered/blurred as empty
       }
   };
  const handleVideoInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.videoSessionsCompleted?.toString() ?? '0';
       const inputValStr = videoInputValue.trim() === '' ? '0' : videoInputValue.trim(); // Treat empty as 0 on blur

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('videoSessionsCompleted', inputValStr); // Save the cleaned value
       } else if (!todayLog && videoInputValue.trim() !== '') {
            setVideoInputValue(''); // Clear input if no log exists
       } else if (inputValStr === '0') {
           setVideoInputValue('0'); // Ensure display shows '0' if entered/blurred as empty
       }
  };

  // --- Derived State ---
  const todayLog = workLogs.find(log => log.date === formatDateISO(new Date())) || null;

  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Daily Dashboard</h1>
        {/* Show Skeleton Loaders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

   // --- No Data State ---
   if (!hasInitialData) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-8 p-4 md:p-6 lg:p-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-15rem)]">
        <BarChart className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Welcome to Metric Daily!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          It looks like you don't have any data yet. Get started by adding your first work log and UPH target, or load some sample data to explore the features.
        </p>
        <div className="flex gap-4">
          <Button onClick={handleLoadSampleData} size="lg">
            <Plus className="mr-2 h-5 w-5" /> Load Sample Data
          </Button>
        </div>
      </div>
    );
  }

  // --- Main Dashboard Render ---
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-center sm:text-left">Daily Dashboard</h1>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Clear All My Data
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all your
                            saved work logs and UPH targets from local storage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAllData} className="bg-destructive hover:bg-destructive/90">
                            Yes, delete everything
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>

        {/* Grid container for Quick Update and Weekly Averages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* --- Quick Update Section --- */}
            {todayLog ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Update Today's Counts</CardTitle>
                         <CardDescription>
                            Log Date: {formatDateISO(new Date())}
                         </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center py-6">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="quick-update-docs-input" className="min-w-[80px] sm:min-w-[auto]">Documents:</Label>
                            <Button
                                id="quick-update-docs-minus" aria-label="Decrease document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', -1)} disabled={isLoading}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                id="quick-update-docs-input" type="text" inputMode="numeric" pattern="[0-9]*" value={docInputValue} onChange={handleDocInputChange} onBlur={handleDocInputBlur}
                                className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                disabled={isLoading} aria-label="Document count input"
                             />
                            <Button
                                id="quick-update-docs-plus" aria-label="Increase document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', 1)} disabled={isLoading}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="quick-update-videos-input" className="min-w-[80px] sm:min-w-[auto]">Videos:</Label>
                            <Button
                                id="quick-update-videos-minus" aria-label="Decrease video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', -1)} disabled={isLoading}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                 id="quick-update-videos-input" type="text" inputMode="numeric" pattern="[0-9]*" value={videoInputValue} onChange={handleVideoInputChange} onBlur={handleVideoInputBlur}
                                 className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                 disabled={isLoading} aria-label="Video count input"
                              />
                            <Button
                                id="quick-update-videos-plus" aria-label="Increase video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', 1)} disabled={isLoading}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                // No todayLog, but other data (targets/previous logs) might exist
                <Card className="border-dashed border-muted-foreground">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground">Log Not Found for Today</CardTitle>
                    </CardHeader>
                     <CardContent className="flex flex-col items-center justify-center h-full py-6 text-muted-foreground gap-4">
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

            {/* Weekly Averages Component */}
            <WeeklyAverages
                allWorkLogs={workLogs}
                targets={uphTargets}
                activeTarget={activeTarget}
            />
        </div>

         {/* --- Daily Progress Indicator --- */}
         {todayLog && activeTarget && (
             <DailyProgressIndicator
                 todayLog={todayLog}
                 activeTarget={activeTarget}
             />
         )}

        {/* --- Productivity Dashboard Display (Today's Log Details) --- */}
        {/* Conditionally render only if todayLog exists, or show a message */}
        {todayLog ? (
            <ProductivityDashboard
                initialWorkLogs={[todayLog]}
                initialUphTargets={uphTargets}
                initialActiveTarget={activeTarget}
                deleteWorkLogAction={handleDeleteWorkLog}
            />
        ) : hasInitialData && !isLoading ? ( // Show if other data exists but no today log
            <Card>
                <CardHeader>
                    <CardTitle>Today's Metrics</CardTitle>
                    <CardDescription>No work log for today yet.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2" />
                    <p>Start a new day or add a log on the 'Log / Targets' page to see today's metrics.</p>
                </CardContent>
            </Card>
        ) : null}
    </div>
  );
}

