'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link'; // Import Link
import ProductivityDashboard from '@/components/DashboardDisplay';
import WeeklyAverages from '@/components/WeeklyAverages';
import DailyProgressIndicator from '@/components/DailyProgressIndicator';
import {
  getWorkLogs,
  getActiveUPHTarget,
  saveWorkLog, // Now only saves data, no audit logging
  deleteWorkLog,
  getUPHTargets,
  loadSampleData,
  clearAllData,
  addBreakTimeToLog, // Still logs its specific action
  addTrainingTimeToLog, // Still logs its specific action
  archiveTodayLog,
  getDefaultSettings,
  isSampleDataLoaded, // Import check for sample data
  setActiveUPHTarget, // Import setActiveUPHTarget
  addAuditLog, // Import addAuditLog for use in page handlers
} from '@/lib/actions'; // Using client-side actions
import type { DailyWorkLog, UPHTarget, UserSettings, AuditLogActionType } from '@/types';
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Data Loading ---
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
  }, [toast, isClient]); // toast is stable, isClient triggers reload when ready

  useEffect(() => {
     if (isClient) {
        console.log('[Home Page] useEffect triggered due to isClient change.');
        loadData();
     }
   // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]); // Run when isClient becomes true

   // Effect to update input values when workLogs change (e.g., after saving)
   useEffect(() => {
    if (!isClient) return; // Only run on client
    const today = workLogs.find(log => log.date === formatDateISO(new Date()));
    setDocInputValue(today?.documentsCompleted?.toString() ?? '');
    setVideoInputValue(today?.videoSessionsCompleted?.toString() ?? '');
  }, [workLogs, isClient]);

  // --- Action Handlers ---
  const handleSaveWorkLog = useCallback((
      logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked?: number; goalMetTimes?: Record<string, string> },
      auditActionType?: AuditLogActionType // Optional parameter for specific audit logging
      ) => {
    if (!isClient) return {} as DailyWorkLog;

    const existingLog = workLogs.find(l => l.id === logData.id); // Get previous state before saving
    const isCreating = !logData.id && !workLogs.find(l => l.date === logData.date);

    try {
        // saveWorkLog now ONLY saves data, no audit logging within it
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

        // --- Audit Logging handled here in the page component ---
        const actionToLog = auditActionType || (isCreating ? 'CREATE_WORK_LOG' : 'UPDATE_WORK_LOG');
        let details = '';

        switch (actionToLog) {
             case 'CREATE_WORK_LOG':
                 details = `Created work log for ${savedLog.date}. Docs: ${savedLog.documentsCompleted}, Videos: ${savedLog.videoSessionsCompleted}, Hours: ${savedLog.hoursWorked.toFixed(2)}.`;
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
             case 'UPDATE_WORK_LOG': // Generic update
             default:
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
                 }
                 break;
        }

        // Log the action determined above
        addAuditLog(actionToLog, 'WorkLog', details, savedLog.id, existingLog, savedLog);

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
  }, [toast, isClient, workLogs, uphTargets]); // Added workLogs and uphTargets dependencies for audit context

  const handleDeleteWorkLog = useCallback((id: string) => {
     if (!isClient) return;
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
  }, [loadData, toast, isClient]);

  // --- Quick Update Handlers ---
   const handleQuickUpdate = (field: 'documentsCompleted' | 'videoSessionsCompleted', value: number | string) => {
      if (!isClient) return;
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

      const originalLogState = { ...todayLog }; // Capture state before update for audit log

      let newValue: number;
      // Preserve the other field's value
      const currentDocValue = todayLog.documentsCompleted || 0;
      const currentVideoValue = todayLog.videoSessionsCompleted || 0;
      const currentValue = field === 'documentsCompleted' ? currentDocValue : currentVideoValue;

      if (typeof value === 'string') {
         // Treat empty string as 0, otherwise parse
         newValue = value.trim() === '' ? 0 : parseInt(value, 10);
         if (isNaN(newValue)) {
              // Revert input if invalid number entered (e.g., non-numeric string)
              if (field === 'documentsCompleted') setDocInputValue(currentValue.toString());
              if (field === 'videoSessionsCompleted') setVideoInputValue(currentValue.toString());
              toast({ variant: "destructive", title: "Invalid Input", description: "Please enter a valid number." });
              return;
         }
      } else {
            // If value is a number (from +/- buttons), add it to current value
            newValue = currentValue + value;
      }

       // Ensure the result is non-negative
       if (newValue < 0) {
            newValue = 0; // Set to 0 if it goes below zero
            toast({
                variant: "default",
                title: "Limit Reached",
                description: `Cannot decrease ${field === 'documentsCompleted' ? 'documents' : 'videos'} below zero.`,
            });
            // If the original action was a text input resulting in negative, reset input
            if (typeof value === 'string') {
                 if (field === 'documentsCompleted') setDocInputValue('0');
                 if (field === 'videoSessionsCompleted') setVideoInputValue('0');
            }
           // For +/- buttons, just prevent going below 0, don't need to revert input display immediately
           return;
       }

      // Construct partial log ensuring all necessary fields are present for saveWorkLog
      // *** Include BOTH fields in the partial update ***
      const updatedLogPartial: Partial<DailyWorkLog> & { id: string; date: string; startTime: string; endTime: string; hoursWorked: number; goalMetTimes?: Record<string, string> } = {
          id: todayLog.id,
          date: todayLog.date,
          startTime: todayLog.startTime,
          endTime: todayLog.endTime,
          hoursWorked: todayLog.hoursWorked, // Pass existing hoursWorked
          // Set the updated field and preserve the other field's value
          documentsCompleted: field === 'documentsCompleted' ? newValue : currentDocValue,
          videoSessionsCompleted: field === 'videoSessionsCompleted' ? newValue : currentVideoValue,
          // Include other essential fields
          breakDurationMinutes: todayLog.breakDurationMinutes,
          trainingDurationMinutes: todayLog.trainingDurationMinutes,
          targetId: todayLog.targetId,
          notes: todayLog.notes,
          goalMetTimes: todayLog.goalMetTimes || {}, // Ensure goalMetTimes is preserved
      };


      try {
           // Pass the complete object required by saveWorkLog
           // **Pass the specific audit action type**
           const savedLog = handleSaveWorkLog(updatedLogPartial as any, 'UPDATE_WORK_LOG_QUICK_COUNT'); // Type assertion might be needed
           // Inputs will update via the useEffect watching workLogs
           toast({ title: "Count Updated", description: `Today's ${field === 'documentsCompleted' ? 'document' : 'video'} count set to ${newValue}.` });

           // Audit logging is now handled within handleSaveWorkLog using the passed type

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
     if (!isClient) return;
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
    if (!isClient) return;
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
    if (!isClient) return;
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
    const defaultBreakMinutes = 0; // Start day with 0 break
    const defaultTrainingMinutes = 0; // Start day with 0 training
    const totalNonWorkMinutes = defaultBreakMinutes + defaultTrainingMinutes; // Should be 0

    // Calculate hours based on fetched or fallback defaults
    const defaultHoursWorked = calculateHoursWorked(todayDateStr, defaultStartTime, defaultEndTime, totalNonWorkMinutes);

    const newLog: Omit<DailyWorkLog, 'id'> & { hoursWorked: number; goalMetTimes?: Record<string, string> } = {
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
      // Pass 'CREATE_WORK_LOG' as the audit action type
      handleSaveWorkLog(newLog, 'CREATE_WORK_LOG');
      toast({
        title: "New Day Started",
        description: `Work log for ${todayDateStr} created with default times.`,
      });
    } catch (error) {
      // Error handling is within handleSaveWorkLog
    }
  }, [handleSaveWorkLog, toast, isClient]); // Added handleSaveWorkLog dependency

  const handleEndDay = useCallback(() => {
     if (!isClient) return;
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
  }, [workLogs, loadData, toast, isClient]);


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
       if (!isClient) return;
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
           // (e.g., user typed something then deleted before starting day)
           setDocInputValue(''); // Clear the orphaned input
       }
   };
  const handleVideoInputBlur = () => {
        if (!isClient) return;
       const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
       const currentValStr = todayLog?.videoSessionsCompleted?.toString() ?? '0';
       const inputValStr = videoInputValue.trim() === '' ? '0' : videoInputValue.trim();

        if (inputValStr === '') {
         setVideoInputValue('0'); // Ensure '0' is displayed if cleared
       }

       if (todayLog && inputValStr !== currentValStr) {
            handleQuickUpdate('videoSessionsCompleted', inputValStr);
       } else if (!todayLog && inputValStr !== '0') {
            setVideoInputValue(''); // Clear the orphaned input
       }
  };

  // --- Break/Training Handlers ---
  const handleAddBreak = useCallback((breakMinutes: number) => {
    if (!isClient) return;
    const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
    if (!todayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Break",
        description: "No work log found for today. Start a new day first.",
      });
      return;
    }
    // Capture state before update - addBreakTimeToLog handles its own audit
    try {
      // This function logs its own specific audit action
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
  }, [workLogs, toast, isClient]); // Depends on workLogs to find todayLog

  const handleAddTraining = useCallback((trainingMinutes: number) => {
    if (!isClient) return;
    const todayLog = workLogs.find(log => log.date === formatDateISO(new Date()));
    if (!todayLog) {
      toast({
        variant: "destructive",
        title: "Cannot Add Training",
        description: "No work log found for today. Start a new day first.",
      });
      return;
    }
    // Capture state before update - addTrainingTimeToLog handles its own audit
    try {
      // This function logs its own specific audit action
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
  }, [workLogs, toast, isClient]); // Depends on workLogs to find todayLog

  // --- Goal Met Handler ---
  const handleGoalMet = useCallback((targetId: string, metAt: Date) => {
     if (!isClient) return;
     console.log(`[Home] Received goal met notification for target ${targetId} at ${metAt.toISOString()}`);
     // Use a functional update for setWorkLogs to ensure we're working with the latest state
    setWorkLogs(prevLogs => {
        const todayLogIndex = prevLogs.findIndex(log => log.date === formatDateISO(new Date()));

        if (todayLogIndex > -1) {
            const todayLog = prevLogs[todayLogIndex];
             // Ensure metAt is a valid Date object before converting to ISO string
            if (!metAt || !(metAt instanceof Date) || isNaN(metAt.getTime())) {
                console.error("[Home] Goal met handler received invalid 'metAt' date:", metAt);
                return prevLogs; // Return previous state if date is invalid
            }
            const metAtISO = metAt.toISOString();

            // Check if met time for THIS target is already recorded in the log we have
            if (!(todayLog.goalMetTimes && todayLog.goalMetTimes[targetId])) {
                console.log(`[Home] Persisting goal met time for target ${targetId}...`);
                const newGoalMetTimes = { ...(todayLog.goalMetTimes || {}), [targetId]: metAtISO };

                // Construct the payload for saving
                // Important: ensure all required fields for saveWorkLog are included
                 const payloadToSave: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number; goalMetTimes?: Record<string, string> } = {
                    id: todayLog.id, // Pass the ID for update
                    date: todayLog.date,
                    startTime: todayLog.startTime,
                    endTime: todayLog.endTime,
                    breakDurationMinutes: todayLog.breakDurationMinutes,
                    trainingDurationMinutes: todayLog.trainingDurationMinutes,
                    hoursWorked: todayLog.hoursWorked,
                    documentsCompleted: todayLog.documentsCompleted,
                    videoSessionsCompleted: todayLog.videoSessionsCompleted,
                    targetId: todayLog.targetId,
                    notes: todayLog.notes,
                    goalMetTimes: newGoalMetTimes, // The updated goalMetTimes
                 };


                try {
                    // Call handleSaveWorkLog from page context, specifying the audit type
                    const savedLog = handleSaveWorkLog(payloadToSave, 'UPDATE_WORK_LOG_GOAL_MET');

                    // Update the log within the current state array
                    const updatedLogs = [...prevLogs];
                    updatedLogs[todayLogIndex] = savedLog; // Use the log returned by saveWorkLog
                    return updatedLogs.sort((a, b) => b.date.localeCompare(a.date)); // Return the updated, sorted array
                } catch (error) {
                    console.error(`[Home] Error saving goal met time for target ${targetId}:`, error);
                    // Toast handled in handleSaveWorkLog
                    return prevLogs; // Return previous state on error
                }
            } else {
                 console.log(`[Home] Goal met time already recorded for target ${targetId}. Ignoring redundant notification.`);
                 return prevLogs; // Return previous state if no update needed
            }
        } else {
            console.warn("[Home] Goal met handler called, but no log found for today.");
            return prevLogs; // No log for today, return previous state
        }
    });
  // Depends on handleSaveWorkLog from page context now
  }, [isClient, handleSaveWorkLog]);


  // --- Set Active Target Handler ---
  const handleSetActiveTarget = useCallback((id: string) => {
     if (!isClient || activeTarget?.id === id) return {} as UPHTarget; // Prevent update if already active
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
  }, [toast, isClient, activeTarget]); // Add activeTarget dependency

  const todayLog = workLogs.find(log => log.date === formatDateISO(new Date())) || null;

  // --- Render Logic ---
  if (!isClient || isLoading) {
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
                setActiveUPHTargetAction={handleSetActiveTarget} // Pass set active action
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

