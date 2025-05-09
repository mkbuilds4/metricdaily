
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  isSampleDataLoaded,
  setActiveUPHTarget,
  addAuditLog,
} from '@/lib/actions';
import type { DailyWorkLog, UPHTarget, UserSettings, AuditLogActionType } from '@/types';
import { formatDateISO, calculateHoursWorked, formatDurationFromMinutes, calculateTimeAheadBehindSchedule } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Info, Trash2, BarChart, PlayCircle, Coffee, Brain, Edit3, HelpCircle, Archive, RefreshCcw, Settings as SettingsIcon, Zap } from 'lucide-react';
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
  const [sampleDataActive, setSampleDataActive] = useState(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }
  }, []);

  const loadData = useCallback((showLoadingIndicator = true) => {
    if (!isClient) return;

    if (showLoadingIndicator) {
      setIsLoading(true);
    }
    console.log('[Home Page] loadData triggered.');
    try {
      const loadedLogs = getWorkLogs();
      const loadedTargets = getUPHTargets();
      const loadedActiveTarget = getActiveUPHTarget();
      const isSampleLoaded = isSampleDataLoaded();
      const currentSettings = getDefaultSettings();

      setWorkLogs(loadedLogs);
      setUphTargets(loadedTargets);
      setActiveTarget(loadedActiveTarget);
      setHasInitialData(loadedLogs.length > 0 || loadedTargets.length > 0);
      setSampleDataActive(isSampleLoaded);
      setUserSettings(currentSettings);

      const todayDateStr = formatDateISO(new Date());
      const currentTodayLog = loadedLogs.find(log => log.date === todayDateStr && !log.isFinalized);
      setDocInputValue(currentTodayLog?.documentsCompleted?.toString() ?? '');
      setVideoInputValue(currentTodayLog?.videoSessionsCompleted?.toString() ?? '');
      console.log('[Home Page] Data loaded. Active target:', loadedActiveTarget?.name, 'Sample Data Loaded:', isSampleLoaded, 'Settings:', currentSettings);

    } catch (error) {
      console.error('[Home] Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not load work logs or targets from local storage.",
      });
      setHasInitialData(false);
      setSampleDataActive(false);
      setUserSettings(getDefaultSettings());
    } finally {
      if (showLoadingIndicator) {
        setIsLoading(false);
      }
    }
  }, [toast, isClient]);

  useEffect(() => {
     if (isClient) {
        console.log('[Home Page] useEffect triggered due to isClient change.');
        loadData();
     }
  }, [isClient, loadData]);

  // Direct calculation for todayLog instead of useMemo
  let calculatedTodayLog: DailyWorkLog | null = null;
  if (isClient) {
    const todayDateStr = formatDateISO(new Date());
    calculatedTodayLog = workLogs.find(log => log.date === todayDateStr && !log.isFinalized) || null;
  }

   useEffect(() => {
    if (!isClient) return;
    setDocInputValue(calculatedTodayLog?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(calculatedTodayLog?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs, isClient, calculatedTodayLog]);


  useEffect(() => {
    if (!isClient || !userSettings?.autoSwitchTargetBySchedule || !calculatedTodayLog || !activeTarget || !currentTime || uphTargets.length === 0) {
      return;
    }

    const displayedTargets = uphTargets.filter(t => t.isDisplayed ?? true);
    if (displayedTargets.length === 0) return;

    let bestTarget: UPHTarget | null = null;
    let minAbsDifference = Infinity;

    for (const target of displayedTargets) {
      const timeDiffSeconds = calculateTimeAheadBehindSchedule(calculatedTodayLog, target, currentTime);
      if (timeDiffSeconds !== null) {
        const absDiff = Math.abs(timeDiffSeconds);
        if (absDiff < minAbsDifference) {
          minAbsDifference = absDiff;
          bestTarget = target;
        }
      }
    }

    if (bestTarget && bestTarget.id !== activeTarget.id) {
      console.log(`[AutoSwitch] Switching to target "${bestTarget.name}" as it's closest to schedule.`);
      try {
        const newActiveTarget = setActiveUPHTarget(bestTarget.id);
        setActiveTarget(newActiveTarget);
        setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
         toast({
           title: "Target Switched",
           description: `Auto-switched to target "${newActiveTarget.name}".`,
           duration: 3000,
         });
      } catch (error) {
          console.error('[AutoSwitch] Error setting active target:', error);
          toast({
              variant: "destructive",
              title: "Auto-Switch Failed",
              description: "Could not automatically switch target.",
          });
      }
    }
  }, [isClient, userSettings, calculatedTodayLog, activeTarget, currentTime, uphTargets, toast]);


  const handleSaveWorkLog = useCallback((
      logData: Partial<Omit<DailyWorkLog, 'id' | 'hoursWorked'>> & { id?: string; hoursWorked?: number; date: string; startTime: string; endTime: string; goalMetTimes?: Record<string, string> },
      auditActionType?: AuditLogActionType
      ) => {
    if (!isClient) return {} as DailyWorkLog;

    const existingLog = workLogs.find(l => l.id === logData.id || (l.date === logData.date && !l.isFinalized));
    const isCreating = !logData.id && !workLogs.find(l => l.date === logData.date && !l.isFinalized);

    try {
        const savedLog = saveWorkLog(logData);

        setWorkLogs(prevLogs => {
            const existingIndex = prevLogs.findIndex(l => l.id === savedLog.id);
            let newLogs;
            if (existingIndex > -1) {
                newLogs = [...prevLogs];
                newLogs[existingIndex] = savedLog;
            } else {
                newLogs = [...prevLogs, savedLog];
            }
            return newLogs.sort((a, b) => b.date.localeCompare(a.date));
        });

        setHasInitialData(true);
        setSampleDataActive(false);

        const actionToLog = auditActionType || (isCreating ? 'CREATE_WORK_LOG' : 'UPDATE_WORK_LOG');
        let details = '';
        const logDetails = `Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}, Hours: ${savedLog.hoursWorked.toFixed(2)}.`;

        switch (actionToLog) {
             case 'CREATE_WORK_LOG':
                 details = `Created work log for ${savedLog.date}. ${logDetails}`;
                 break;
             case 'UPDATE_WORK_LOG_QUICK_COUNT':
                 const fieldUpdated = existingLog?.documentsCompleted !== savedLog.documentsCompleted ? 'document' : 'video';
                 const newValue = fieldUpdated === 'document' ? savedLog.documentsCompleted : savedLog.videoSessionsCompleted;
                 details = `Quick updated ${fieldUpdated} count to ${newValue} for log ${savedLog.date}.`;
                 break;
             case 'UPDATE_WORK_LOG_GOAL_MET':
                 const newTargetId = Object.keys(savedLog.goalMetTimes || {}).find(key => !(existingLog?.goalMetTimes || {})[key]);
                 const targetName = uphTargets.find(t => t.id === newTargetId)?.name || 'Unknown Target';
                 details = `Target "${targetName}" goal met time recorded for log ${savedLog.date}.`;
                 break;
             case 'UPDATE_WORK_LOG':
                 if (auditActionType !== 'UPDATE_WORK_LOG_QUICK_COUNT') {
                    details = `Updated work log for ${savedLog.date}. `;
                    if (existingLog) {
                        const changes: string[] = [];
                        if (existingLog.startTime !== savedLog.startTime) changes.push(`Start: ${existingLog.startTime} -> ${savedLog.startTime}`);
                        if (existingLog.endTime !== savedLog.endTime) changes.push(`End: ${existingLog.endTime} -> ${savedLog.endTime}`);
                        if (existingLog.breakDurationMinutes !== savedLog.breakDurationMinutes) changes.push(`Break: ${existingLog.breakDurationMinutes}m -> ${savedLog.breakDurationMinutes}m`);
                        if ((existingLog.trainingDurationMinutes || 0) !== (savedLog.trainingDurationMinutes || 0)) changes.push(`Training: ${existingLog.trainingDurationMinutes || 0}m -> ${savedLog.trainingDurationMinutes || 0}m`);
                        if (existingLog.documentsCompleted !== savedLog.documentsCompleted) changes.push(`Docs: ${existingLog.documentsCompleted} -> ${savedLog.documentsCompleted}`);
                        if (existingLog.videoSessionsCompleted !== savedLog.videoSessionsCompleted) changes.push(`Videos: ${existingLog.videoSessionsCompleted} -> ${savedLog.videoSessionsCompleted}`);
                        if (existingLog.notes !== savedLog.notes) changes.push(`Notes updated.`);
                        if (existingLog.targetId !== savedLog.targetId) changes.push(`Target ID updated.`);
                        details += changes.join(', ') || 'No specific field changes detected.';
                    } else {
                        details += logDetails;
                    }
                    addAuditLog(actionToLog, 'WorkLog', details, savedLog.id, existingLog, savedLog);
                 }
                 break;
             default:
                 addAuditLog(actionToLog, 'WorkLog', details, savedLog.id, existingLog, savedLog);
                 break;
        }

        if (actionToLog === 'UPDATE_WORK_LOG_QUICK_COUNT') {
           addAuditLog(actionToLog, 'WorkLog', details, savedLog.id, existingLog, savedLog);
        }

        return savedLog;
    } catch (error) {
        console.error('[Home] Error saving work log:', error);
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: error instanceof Error ? error.message : "Could not save the work log.",
        });
        throw error;
    }
  }, [toast, isClient, workLogs, uphTargets]);

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (!isClient) return;
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
  }, [loadData, toast, isClient]);

   const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', value: number | string) => {
      if (!isClient) return;
      // Use calculatedTodayLog here
      if (!calculatedTodayLog) {
          console.warn("[Home] Quick Update: No active log found for today to update.");
          toast({
              variant: "destructive",
              title: "Quick Update Failed",
              description: "No active work log found for today. Add one on the 'Log / Targets' page or click 'Start New Day'.",
          });
          return;
      }

      const originalLogState = { ...calculatedTodayLog };

      let newValue: number;
      const currentDocValue = calculatedTodayLog.documentsCompleted || 0;
      const currentVideoValue = calculatedTodayLog.videoSessionsCompleted || 0;
      const currentValue = field === 'documentsCompleted' ? currentDocValue : currentVideoValue;

      if (typeof value === 'string') {
         newValue = value.trim() === '' ? 0 : parseInt(value, 10);
         if (isNaN(newValue)) {
              if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
              if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
              toast({ variant: "destructive", title: "Invalid Input", description: "Please enter a valid number." });
              return;
         }
      } else {
            newValue = currentValue + value;
      }

       if (newValue < 0) {
            newValue = 0;
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
            if (typeof value === 'string') {
                 if (field === 'documentsCompleted') setDocInputValue('0');
                 if (field === 'videoSessionsCompleted') setVideoInputValue('0');
            }
           return;
       }

       const updatedLogPartial: Partial<DailyWorkLog> & { id: string; date: string; startTime: string; endTime: string; hoursWorked: number; goalMetTimes?: Record<string, string> } = {
          id: calculatedTodayLog.id,
          date: calculatedTodayLog.date,
          startTime: calculatedTodayLog.startTime,
          endTime: calculatedTodayLog.endTime,
          hoursWorked: calculatedTodayLog.hoursWorked,
          documentsCompleted: field === 'documentsCompleted' ? newValue : currentDocValue,
          videoSessionsCompleted: field === 'videoSessionsCompleted' ? newValue : currentVideoValue,
          breakDurationMinutes: calculatedTodayLog.breakDurationMinutes,
          trainingDurationMinutes: calculatedTodayLog.trainingDurationMinutes,
          targetId: calculatedTodayLog.targetId,
          notes: calculatedTodayLog.notes,
          goalMetTimes: calculatedTodayLog.goalMetTimes || {},
          isFinalized: calculatedTodayLog.isFinalized,
      };


      try {
           const savedLog = handleSaveWorkLog(updatedLogPartial as any, 'UPDATE_WORK_LOG_QUICK_COUNT');
           toast({ title: "Count Updated", description: `Today's ${field === 'documentsCompleted' ? 'document' : 'video'} count set to ${newValue}.` });

      } catch(error) {
           if (typeof value === 'string') {
                if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
                if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
           }
      }
  };

  const handleLoadSampleData = () => {
     if (!isClient) return;
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

  const handleClearSampleAndStart = () => {
    if (!isClient) return;
    try {
      clearAllData();
      toast({
        title: "Data Cleared",
        description: "Sample data removed. Starting fresh!",
      });
      loadData();
    } catch (error) {
      console.error('[Home] Error clearing sample data:', error);
      toast({
        variant: "destructive",
        title: "Clear Data Error",
        description: error instanceof Error ? error.message : "Could not clear data.",
      });
    }
  };

  const handleStartNewDay = useCallback(() => {
    if (!isClient || !userSettings) return;
    const activeTargetCheck = getActiveUPHTarget();
    if (!activeTargetCheck) {
      toast({
        variant: "destructive",
        title: "Cannot Start New Day",
        description: "No active UPH target found. Please set one on the 'Log / Targets' page.",
      });
      return;
    }

    const todayDateStr = formatDateISO(new Date());
    const existingActiveLog = workLogs.find(log => log.date === todayDateStr && !log.isFinalized);
    if (existingActiveLog) {
        toast({
            title: "Day Already Started",
            description: "An active work log already exists for today.",
        });
        return;
    }

    const defaultStartTime = userSettings.defaultStartTime || '14:00';
    const defaultEndTime = userSettings.defaultEndTime || '22:30';
    const defaultBreakMinutes = userSettings.defaultBreakMinutes ?? 0;
    const defaultTrainingMinutes = userSettings.defaultTrainingMinutes ?? 0;
    const totalNonWorkMinutes = defaultBreakMinutes + defaultTrainingMinutes;

    const defaultHoursWorked = calculateHoursWorked(todayDateStr, defaultStartTime, defaultEndTime, totalNonWorkMinutes);

    const newLog: Omit<DailyWorkLog, 'id'> & { hoursWorked: number; goalMetTimes?: Record<string, string>; isFinalized?: boolean } = {
      date: todayDateStr,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      breakDurationMinutes: defaultBreakMinutes,
      trainingDurationMinutes: defaultTrainingMinutes,
      hoursWorked: defaultHoursWorked,
      documentsCompleted: 0,
      videoSessionsCompleted: 0,
      targetId: activeTargetCheck.id,
      notes: 'New day started from dashboard.',
      goalMetTimes: {},
      isFinalized: false,
    };

    try {
      handleSaveWorkLog(newLog as any, 'CREATE_WORK_LOG');
      toast({
        title: "New Day Started",
        description: `Work log for ${todayDateStr} created with default times.`,
      });
    } catch (error) {
      // Error handling is within handleSaveWorkLog
    }
  }, [handleSaveWorkLog, toast, isClient, workLogs, userSettings]);

  const handleEndDay = useCallback(() => {
     if (!isClient) return;
    const todayLogToEnd = workLogs.find(log => log.date === formatDateISO(new Date()) && !log.isFinalized);
    if (!todayLogToEnd) {
      toast({
        variant: "destructive",
        title: "No Active Log to End",
        description: "No active work log found for today to mark as finalized.",
      });
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm("Are you sure you want to finalize today's log? You won't be able to make further quick updates or add break/training time from the dashboard.")) {
        return;
    }

    const finalizedLog = archiveTodayLog();
    if (finalizedLog) {
        toast({
            title: "Day Finalized",
            description: `Log for ${finalizedLog.date} has been finalized. View in 'Previous Logs'.`,
        });
        loadData(false);
    } else {
         toast({
            variant: "destructive",
            title: "Finalize Day Failed",
            description: "Could not finalize today's log. It might have already been processed or an error occurred.",
         });
    }
  }, [workLogs, loadData, toast, isClient]);

  const handleDocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
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

  const handleDocInputBlur = () => {
       if (!isClient) return;
       const currentValStr = calculatedTodayLog?.documentsCompleted?.toString() ?? '0';
       const inputValStr = docInputValue.trim() === '' ? '0' : docInputValue.trim();

       if (inputValStr === '') {
         setDocInputValue('0');
       }

       if (calculatedTodayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('documentsCompleted', inputValStr);
       } else if (!calculatedTodayLog && inputValStr !== '0') {
           setDocInputValue('');
       }
   };
  const handleVideoInputBlur = () => {
        if (!isClient) return;
       const currentValStr = calculatedTodayLog?.videoSessionsCompleted?.toString() ?? '0';
       const inputValStr = videoInputValue.trim() === '' ? '0' : videoInputValue.trim();

        if (inputValStr === '') {
         setVideoInputValue('0');
       }

       if (calculatedTodayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('videoSessionsCompleted', inputValStr);
       } else if (!calculatedTodayLog && inputValStr !== '0') {
            setVideoInputValue('');
       }
  };

  const handleAddBreak = useCallback((breakMinutes: number) => {
    if (!isClient) return;
    if (!calculatedTodayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Break",
        description: "No active work log found for today. Start a new day first.",
      });
      return;
    }
    try {
      const updatedLog = addBreakTimeToLog(calculatedTodayLog.id, breakMinutes);
      setWorkLogs(prevLogs => {
          const index = prevLogs.findIndex(l => l.id === updatedLog.id);
          if (index > -1) {
              const newLogs = [...prevLogs];
              newLogs[index] = updatedLog;
              return newLogs;
          }
          return prevLogs;
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
  }, [calculatedTodayLog, toast, isClient, workLogs]); // Use calculatedTodayLog

  const handleAddTraining = useCallback((trainingMinutes: number) => {
    if (!isClient) return;
    if (!calculatedTodayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Training",
        description: "No active work log found for today. Start a new day first.",
      });
      return;
    }
    try {
      const updatedLog = addTrainingTimeToLog(calculatedTodayLog.id, trainingMinutes);
        setWorkLogs(prevLogs => {
            const index = prevLogs.findIndex(l => l.id === updatedLog.id);
            if (index > -1) {
                const newLogs = [...prevLogs];
                newLogs[index] = updatedLog;
                return newLogs;
            }
            return prevLogs;
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
  }, [calculatedTodayLog, toast, isClient, workLogs]); // Use calculatedTodayLog

  const handleGoalMet = useCallback((targetId: string, metAt: Date) => {
     if (!isClient) return;
     console.log(`[Home] Received goal met notification for target ${targetId} at ${metAt.toISOString()}`);
    setWorkLogs(prevLogs => {
        const todayLogIndex = prevLogs.findIndex(log => log.date === formatDateISO(new Date()) && !log.isFinalized);

        if (todayLogIndex > -1) {
            const currentTodayLog = prevLogs[todayLogIndex]; // Use a different name to avoid conflict with outer scope calculatedTodayLog
            if (!metAt || !(metAt instanceof Date) || isNaN(metAt.getTime())) {
                console.error("[Home] Goal met handler received invalid 'metAt' date:", metAt);
                return prevLogs;
            }
            const metAtISO = metAt.toISOString();

            if (!(currentTodayLog.goalMetTimes && currentTodayLog.goalMetTimes[targetId])) {
                console.log(`[Home] Persisting goal met time for target ${targetId}...`);
                const newGoalMetTimes = { ...(currentTodayLog.goalMetTimes || {}), [targetId]: metAtISO };
                 const payloadToSave: Partial<DailyWorkLog> & { id: string; date: string; startTime: string; endTime: string; hoursWorked: number; goalMetTimes?: Record<string, string> } = {
                    id: currentTodayLog.id,
                    date: currentTodayLog.date,
                    startTime: currentTodayLog.startTime,
                    endTime: currentTodayLog.endTime,
                    breakDurationMinutes: currentTodayLog.breakDurationMinutes,
                    trainingDurationMinutes: currentTodayLog.trainingDurationMinutes,
                    hoursWorked: currentTodayLog.hoursWorked,
                    documentsCompleted: currentTodayLog.documentsCompleted,
                    videoSessionsCompleted: currentTodayLog.videoSessionsCompleted,
                    targetId: currentTodayLog.targetId,
                    notes: currentTodayLog.notes,
                    goalMetTimes: newGoalMetTimes,
                    isFinalized: currentTodayLog.isFinalized,
                 };

                try {
                    const savedLog = handleSaveWorkLog(payloadToSave, 'UPDATE_WORK_LOG_GOAL_MET');
                    const updatedLogs = [...prevLogs];
                    updatedLogs[todayLogIndex] = savedLog;
                    return updatedLogs.sort((a, b) => b.date.localeCompare(a.date));
                } catch (error) {
                    console.error(`[Home] Error saving goal met time for target ${targetId}:`, error);
                    return prevLogs;
                }
            } else {
                 console.log(`[Home] Goal met time already recorded for target ${targetId}. Ignoring redundant notification.`);
                 return prevLogs;
            }
        } else {
            console.warn("[Home] Goal met handler called, but no active log found for today.");
            return prevLogs;
        }
    });
  }, [isClient, handleSaveWorkLog]);

  const handleSetActiveTarget = useCallback((id: string) => {
     if (!isClient || activeTarget?.id === id) return {} as UPHTarget;
    try {
      const newActiveTarget = setActiveUPHTarget(id);
      setUphTargets(prev => prev.map(t => ({...t, isActive: t.id === newActiveTarget.id})));
      setActiveTarget(newActiveTarget);
      toast({ title: "Target Activated", description: `"${newActiveTarget.name}" is now the active target for dashboard progress.` });
      return newActiveTarget;
    } catch (error) {
      console.error('[Home] Error setting active target:', error);
       toast({
            variant: "destructive",
            title: "Activation Failed",
            description: error instanceof Error ? error.message : "Could not activate the target.",
       });
      throw error;
    }
  }, [toast, isClient, activeTarget]);


  if (!isClient || isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-8 p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center">Daily Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <Edit3 className="mr-2 h-5 w-5" /> Set Up &amp; Start Tracking
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
            {calculatedTodayLog && !sampleDataActive && (
                    <Button onClick={handleEndDay} variant="outline" size="sm" disabled={isLoading}>
                        <Archive className="mr-2 h-4 w-4" /> Finalize Today&apos;s Log
                    </Button>
             )}
        </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Quick Update Today&apos;s Counts</CardTitle>
                    {calculatedTodayLog ? (
                        <CardDescription>
                            Log Date: {formatDateISO(new Date())} (Active Log)
                        </CardDescription>
                     ) : (
                         <CardDescription className="text-muted-foreground">
                             No active log started for today.
                         </CardDescription>
                     )}
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center py-6">
                    <div className="flex flex-col items-center gap-2">
                        <Label htmlFor="quick-update-docs-input" className="min-w-[80px] sm:min-w-[auto]">Documents:</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                id="quick-update-docs-minus" aria-label="Decrease document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', -1)} disabled={isLoading || !calculatedTodayLog}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                id="quick-update-docs-input" type="text" inputMode="numeric" pattern="[0-9]*" value={docInputValue} onChange={handleDocInputChange} onBlur={handleDocInputBlur}
                                className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                disabled={isLoading || !calculatedTodayLog} aria-label="Document count input"
                             />
                            <Button
                                id="quick-update-docs-plus" aria-label="Increase document count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('documentsCompleted', 1)} disabled={isLoading || !calculatedTodayLog}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Label htmlFor="quick-update-videos-input" className="min-w-[80px] sm:min-w-[auto]">Videos:</Label>
                         <div className="flex items-center gap-2">
                            <Button
                                id="quick-update-videos-minus" aria-label="Decrease video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', -1)} disabled={isLoading || !calculatedTodayLog}
                            > <Minus className="h-4 w-4"/> </Button>
                             <Input
                                 id="quick-update-videos-input" type="text" inputMode="numeric" pattern="[0-9]*" value={videoInputValue} onChange={handleVideoInputChange} onBlur={handleVideoInputBlur}
                                 className="h-9 w-16 text-center tabular-nums text-lg font-medium appearance-none"
                                 disabled={isLoading || !calculatedTodayLog} aria-label="Video count input"
                              />
                            <Button
                                id="quick-update-videos-plus" aria-label="Increase video count" variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => handleQuickUpdate('videoSessionsCompleted', 1)} disabled={isLoading || !calculatedTodayLog}
                            > <Plus className="h-4 w-4"/> </Button>
                        </div>
                    </div>
                </CardContent>
                 <CardFooter className="flex flex-col items-center gap-2 pt-2 pb-4">
                    <Label className="text-sm font-medium">Log Non-Work Time</Label>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleAddBreak(15)} disabled={isLoading || !calculatedTodayLog}>
                            <Coffee className="mr-2 h-4 w-4" /> Break (15m)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleAddBreak(30)} disabled={isLoading || !calculatedTodayLog}>
                            <Coffee className="mr-2 h-4 w-4" /> Lunch (30m)
                        </Button>
                         <Button variant="outline" size="sm" onClick={() => handleAddTraining(5)} disabled={isLoading || !calculatedTodayLog}>
                            <Brain className="mr-2 h-4 w-4" /> Train (5m)
                        </Button>
                    </div>
                    {calculatedTodayLog && (
                         <p className="text-xs text-muted-foreground mt-1">
                            Current Break: {formatDurationFromMinutes(calculatedTodayLog.breakDurationMinutes * 60)}
                            {calculatedTodayLog.trainingDurationMinutes && calculatedTodayLog.trainingDurationMinutes > 0 &&
                                ` | Training: ${formatDurationFromMinutes(calculatedTodayLog.trainingDurationMinutes * 60)}`
                            }
                         </p>
                    )}
                </CardFooter>
            </Card>

             <WeeklyAverages
                allWorkLogs={workLogs}
                targets={uphTargets}
                activeTarget={activeTarget}
            />

             {!calculatedTodayLog && (
                 <Card className="border-dashed border-muted-foreground md:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground">Start Your Day</CardTitle>
                    </CardHeader>
                     <CardContent className="flex flex-col items-center justify-center min-h-[150px] py-6 text-muted-foreground gap-4">
                         <Info className="h-8 w-8" />
                         <p className="text-center max-w-xs">
                             No active work log found for today ({formatDateISO(new Date())}).
                         </p>
                         <Button onClick={handleStartNewDay} disabled={isLoading || !activeTarget}>
                            <PlayCircle className="mr-2 h-5 w-5" /> Start New Day
                         </Button>
                         {!activeTarget && <p className="text-xs text-destructive"> (Set an active target first)</p>}
                    </CardContent>
                </Card>
             )}
        </div>

         {calculatedTodayLog && activeTarget && (
             <DailyProgressIndicator
                 todayLog={calculatedTodayLog}
                 activeTarget={activeTarget}
             />
         )}

        {calculatedTodayLog && (
            <ProductivityDashboard
                initialWorkLogs={calculatedTodayLog ? [calculatedTodayLog] : []}
                initialUphTargets={uphTargets}
                initialActiveTarget={activeTarget}
                deleteWorkLogAction={handleDeleteWorkLog}
                setActiveUPHTargetAction={handleSetActiveTarget}
                onGoalMet={handleGoalMet}
            />
        )}

         {!calculatedTodayLog && hasInitialData && !isLoading && (
             <></>
        )}
    </div>
  );
}

