
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
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget } from '@/types';
import { formatDateISO, calculateHoursWorked, formatDurationFromMinutes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Info, Trash2, BarChart, PlayCircle, Coffee, Brain, Edit3, HelpCircle } from 'lucide-react'; // Added Edit3, HelpCircle
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
import TutorialDialog from '@/components/TutorialDialog'; // Import TutorialDialog


export default function Home() {
  const [workLogs, setWorkLogs] = useState<DailyWorkLog[]>([]);
  const [uphTargets, setUphTargets] = useState<UPHTarget[]>([]);
  const [activeTarget, setActiveTarget] = useState<UPHTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [docInputValue, setDocInputValue] = useState<string>('');
  const [videoInputValue, setVideoInputValue] = useState<string>('');
  const [hasInitialData, setHasInitialData] = useState(false); 
  const { toast } = useToast();

  const loadData = useCallback((showLoadingIndicator = true) => {
    if (typeof window === 'undefined') return; 

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
      setHasInitialData(false); 
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
  }, []); 

   useEffect(() => {
    const today = workLogs.find(log => log.date === formatDateISO(new Date()));
    setDocInputValue(today?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs]);

  // --- Action Handlers ---
  const handleSaveWorkLog = useCallback((logData: Omit<DailyWorkLog, 'id' | 'hoursWorked'> & { id?: string; hoursWorked?: number }) => {
    if (typeof window === 'undefined') return {} as DailyWorkLog;
    try {
      const savedLog = saveWorkLog(logData);
      loadData(false); 
      setHasInitialData(true); 
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
        loadData(false); 
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

      const updatedLogData: DailyWorkLog = {
          ...todayLog,
          [field]: newValue,
          targetId: todayLog.targetId, 
      };

      try {
           handleSaveWorkLog(updatedLogData);
      } catch(error) {
           if (typeof value === 'string') {
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
        loadData(); 
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
      loadData(); 
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
    const defaultTrainingMinutes = 0; // Initialize training to 0
    const totalNonWorkMinutes = defaultBreakMinutes + defaultTrainingMinutes;
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


  const handleDocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) setDocInputValue(val);
  };
  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     if (val === '' || /^\d+$/.test(val)) setVideoInputValue(val);
  };
  const handleDocInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.documentsCompleted?.toString() ?? '0';
       const inputValStr = docInputValue.trim() === '' ? '0' : docInputValue.trim(); 

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('documentsCompleted', inputValStr); 
       } else if (!todayLog && docInputValue.trim() !== '') {
            setDocInputValue(''); 
       } else if (inputValStr === '0') {
            setDocInputValue('0'); 
       }
   };
  const handleVideoInputBlur = () => {
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.videoSessionsCompleted?.toString() ?? '0';
       const inputValStr = videoInputValue.trim() === '' ? '0' : videoInputValue.trim(); 

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('videoSessionsCompleted', inputValStr); 
       } else if (!todayLog && videoInputValue.trim() !== '') {
            setVideoInputValue(''); 
       } else if (inputValStr === '0') {
           setVideoInputValue('0'); 
       }
  };

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

    const newBreakDuration = todayLog.breakDurationMinutes + breakMinutes;
    const totalNonWorkMinutes = newBreakDuration + (todayLog.trainingDurationMinutes || 0);
    const newHoursWorked = calculateHoursWorked(todayLog.date, todayLog.startTime, todayLog.endTime, totalNonWorkMinutes);

    const updatedLogData: DailyWorkLog = {
      ...todayLog,
      breakDurationMinutes: newBreakDuration,
      hoursWorked: newHoursWorked, 
    };

    try {
      handleSaveWorkLog(updatedLogData);
      toast({
        title: "Break Added",
        description: `${breakMinutes} minutes added to your break time. Total break: ${formatDurationFromMinutes(newBreakDuration * 60)}.`,
      });
    } catch (error) {
      // Error handled by handleSaveWorkLog
    }
  }, [workLogs, handleSaveWorkLog, toast]);

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

    const newTrainingDuration = (todayLog.trainingDurationMinutes || 0) + trainingMinutes;
    const totalNonWorkMinutes = todayLog.breakDurationMinutes + newTrainingDuration;
    const newHoursWorked = calculateHoursWorked(todayLog.date, todayLog.startTime, todayLog.endTime, totalNonWorkMinutes);

    const updatedLogData: DailyWorkLog = {
      ...todayLog,
      trainingDurationMinutes: newTrainingDuration,
      hoursWorked: newHoursWorked,
    };

    try {
      handleSaveWorkLog(updatedLogData);
      toast({
        title: "Training Time Added",
        description: `${trainingMinutes} minutes added to your training time. Total training: ${formatDurationFromMinutes(newTrainingDuration * 60)}.`,
      });
    } catch (error) {
      // Error handled by handleSaveWorkLog
    }
  }, [workLogs, handleSaveWorkLog, toast]);


  const todayLog = workLogs.find(log => log.date === formatDateISO(new Date())) || null;

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Daily Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
        <Skeleton className="h-[100px] w-full" />
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
          <TutorialDialog />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8"> 
            {todayLog ? (
                <Card className="md:col-span-2"> 
                    <CardHeader>
                        <CardTitle>Quick Update Today&apos;s Counts</CardTitle>
                         <CardDescription>
                            Log Date: {formatDateISO(new Date())}
                         </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start justify-center py-6">
                        <div className="flex flex-col items-center gap-2">
                            <Label htmlFor="quick-update-docs-input" className="min-w-[80px] sm:min-w-[auto]">Documents:</Label>
                            <div className="flex items-center gap-2">
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
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <Label htmlFor="quick-update-videos-input" className="min-w-[80px] sm:min-w-[auto]">Videos:</Label>
                             <div className="flex items-center gap-2">
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
                                {todayLog.breakDurationMinutes === 5 && " (Grace Period)"}
                                {todayLog.trainingDurationMinutes && todayLog.trainingDurationMinutes > 0 && 
                                    ` | Training: ${formatDurationFromMinutes(todayLog.trainingDurationMinutes * 60)}`
                                }
                             </p>
                        )}
                    </CardFooter>
                </Card>
            ) : (
                <Card className="border-dashed border-muted-foreground md:col-span-2">
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

            <WeeklyAverages
                allWorkLogs={workLogs}
                targets={uphTargets}
                activeTarget={activeTarget}
            />
        </div>

         {todayLog && activeTarget && (
             <DailyProgressIndicator
                 todayLog={todayLog}
                 activeTarget={activeTarget}
             />
         )}

        {todayLog ? (
            <ProductivityDashboard
                initialWorkLogs={[todayLog]}
                initialUphTargets={uphTargets}
                initialActiveTarget={activeTarget}
                deleteWorkLogAction={handleDeleteWorkLog}
            />
        ) : hasInitialData && !isLoading ? ( 
            <Card>
                <CardHeader>
                    <CardTitle>Today&apos;s Metrics</CardTitle>
                    <CardDescription>No work log for today yet.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2" />
                    <p>Start a new day or add a log on the &apos;Log / Targets&apos; page to see today&apos;s metrics.</p>
                </CardContent>
            </Card>
        ) : null}
    </div>
  );
}


    
