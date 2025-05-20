// src/lib/sample-data.ts
import type { DailyWorkLog, UPHTarget, AuditLogEntry, AuditLogActionType } from '@/types';
import { format, subDays, addDays, setHours, setMinutes, setSeconds, parseISO } from 'date-fns';
import { formatDateISO } from './utils'; // Use consistent date formatting

// Helper to get dates relative to today
const today = new Date();
const yesterday = subDays(today, 1);
const twoDaysAgo = subDays(today, 2);
const threeDaysAgo = subDays(today, 3);
const fourDaysAgo = subDays(today, 4);
const fiveDaysAgo = subDays(today, 5);
const sixDaysAgo = subDays(today, 6);
const sevenDaysAgo = subDays(today, 7);


// Sample UPH Targets - Updated based on user request
// IMPORTANT: Ensure IDs are unique and simple if used directly
export const sampleUPHTargets: UPHTarget[] = [
  {
    id: 'meeting-1', // Simple ID for sample data
    name: 'Meeting',
    targetUPH: 9.0,
    docsPerUnit: 10,
    videosPerUnit: 1.5,
    isActive: true, // Make the first one active by default
    isDisplayed: true,
  },
  {
    id: 'minimum-1',
    name: 'Minimum',
    targetUPH: 7.5,
    docsPerUnit: 10,
    videosPerUnit: 1.5,
    isActive: false,
    isDisplayed: true,
  },
  {
    id: 'outstanding-1',
    name: 'Outstanding',
    targetUPH: 10.5,
    docsPerUnit: 10,
    videosPerUnit: 1.5,
    isActive: false,
    isDisplayed: true,
  },
];

// Sample Work Logs
// Ensure dates are formatted correctly using formatDateISO
// Associate logs with a target ID (using the first sample target ID here)
export const sampleWorkLogs: DailyWorkLog[] = [
  // Today's Log (will be updated by user ideally)
  {
    id: 'log-today',
    date: formatDateISO(today),
    startTime: '14:00',
    endTime: '22:30',
    breakDurationMinutes: 65,
    trainingDurationMinutes: 5, // Sample training
    hoursWorked: 7.17, // Example calculation (8.5h - 65m break - 5m train)
    documentsCompleted: 62, // Final count for today
    videoSessionsCompleted: 85, // Final count for today
    targetId: sampleUPHTargets[0].id,
    notes: 'Started a bit late, focused on docs.',
    isFinalized: false, // Today's log is not finalized initially
  },
  // Yesterday's Log
  {
    id: 'log-yesterday',
    date: formatDateISO(yesterday),
    startTime: '13:45',
    endTime: '22:15',
    breakDurationMinutes: 60,
    trainingDurationMinutes: 0,
    hoursWorked: 7.5,
    documentsCompleted: 78,
    videoSessionsCompleted: 105,
    targetId: sampleUPHTargets[0].id,
    notes: 'Good pace yesterday.',
    isFinalized: true, // Mark previous days as finalized
  },
  // Log from Two Days Ago
  {
    id: 'log-2daysago',
    date: formatDateISO(twoDaysAgo),
    startTime: '14:10',
    endTime: '22:40',
    breakDurationMinutes: 70,
    trainingDurationMinutes: 10,
    hoursWorked: 7.0, // Example calculation for 8h 30m - 70m break - 10m train
    documentsCompleted: 55,
    videoSessionsCompleted: 72,
    targetId: sampleUPHTargets[0].id,
    notes: 'More video calls this day.',
    isFinalized: true, // Mark previous days as finalized
  },
   // Log from 3 days ago
  {
    id: 'log-3daysago',
    date: formatDateISO(threeDaysAgo),
    startTime: '14:00',
    endTime: '22:00',
    breakDurationMinutes: 60,
    trainingDurationMinutes: 0,
    hoursWorked: 7.00,
    documentsCompleted: 65,
    videoSessionsCompleted: 90,
    targetId: sampleUPHTargets[0].id,
    notes: 'Standard day.',
    isFinalized: true, // Mark previous days as finalized
  },
   // Log from 4 days ago
  {
    id: 'log-4daysago',
    date: formatDateISO(fourDaysAgo),
    startTime: '14:00',
    endTime: '22:30',
    breakDurationMinutes: 65,
    trainingDurationMinutes: 0,
    hoursWorked: 7.25,
    documentsCompleted: 70,
    videoSessionsCompleted: 95,
    targetId: sampleUPHTargets[0].id,
    notes: 'Average day.',
    isFinalized: true, // Mark previous days as finalized
  },
  // Log from 5 days ago
  {
    id: 'log-5daysago',
    date: formatDateISO(fiveDaysAgo),
    startTime: '13:30',
    endTime: '22:30',
    breakDurationMinutes: 60,
    trainingDurationMinutes: 15,
    hoursWorked: 7.75, // 9h total - 60m break - 15m train
    documentsCompleted: 85,
    videoSessionsCompleted: 110,
    targetId: sampleUPHTargets[0].id,
    notes: 'Worked a full 8 hours.',
    isFinalized: true, // Mark previous days as finalized
  },
  // Log from 6 days ago
  {
    id: 'log-6daysago',
    date: formatDateISO(sixDaysAgo),
    startTime: '14:15',
    endTime: '22:00',
    breakDurationMinutes: 45,
    trainingDurationMinutes: 0,
    hoursWorked: 7.00,
    documentsCompleted: 68,
    videoSessionsCompleted: 88,
    targetId: sampleUPHTargets[0].id,
    notes: 'Shorter break.',
    isFinalized: true, // Mark previous days as finalized
  },
   // Log from 7 days ago
  {
    id: 'log-7daysago',
    date: formatDateISO(sevenDaysAgo),
    startTime: '14:00',
    endTime: '22:30',
    breakDurationMinutes: 65,
    trainingDurationMinutes: 0,
    hoursWorked: 7.25,
    documentsCompleted: 72,
    videoSessionsCompleted: 100,
    targetId: sampleUPHTargets[0].id,
    notes: 'End of the previous week.',
    isFinalized: true, // Mark previous days as finalized
  },
];


// Sample Audit Logs for 'log-today' to populate the hourly chart
const todayLogId = 'log-today';
const todayLogDate = parseISO(formatDateISO(today));
const baseLogState = sampleWorkLogs.find(log => log.id === todayLogId)!;

export const sampleAuditLogs: AuditLogEntry[] = [
    // 14:00 - Start of shift (implicit state is 0 docs, 0 videos)
    // 14:55 - First update
    {
        id: 'audit-1',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 14), 55), 10).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated document count to 8 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 0, videoSessionsCompleted: 0 },
        newState: { ...baseLogState, documentsCompleted: 8, videoSessionsCompleted: 0 },
    },
    // 15:30 - Second update
    {
        id: 'audit-2',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 15), 30), 25).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated video count to 12 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 8, videoSessionsCompleted: 0 },
        newState: { ...baseLogState, documentsCompleted: 8, videoSessionsCompleted: 12 },
    },
     // 16:15 - Third update
    {
        id: 'audit-3',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 16), 15), 5).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated document count to 15 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 8, videoSessionsCompleted: 12 },
        newState: { ...baseLogState, documentsCompleted: 15, videoSessionsCompleted: 12 },
    },
     // 17:40 - Fourth update
    {
        id: 'audit-4',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 17), 40), 0).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated video count to 30 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 15, videoSessionsCompleted: 12 },
        newState: { ...baseLogState, documentsCompleted: 15, videoSessionsCompleted: 30 },
    },
      // 18:05 - Fifth update
    {
        id: 'audit-5',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 18), 5), 15).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated document count to 25 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 15, videoSessionsCompleted: 30 },
        newState: { ...baseLogState, documentsCompleted: 25, videoSessionsCompleted: 30 },
    },
      // 19:20 - Sixth update
    {
        id: 'audit-6',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 19), 20), 40).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated video count to 55 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 25, videoSessionsCompleted: 30 },
        newState: { ...baseLogState, documentsCompleted: 25, videoSessionsCompleted: 55 },
    },
      // 20:10 - Seventh update
    {
        id: 'audit-7',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 20), 10), 55).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated document count to 40 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 25, videoSessionsCompleted: 55 },
        newState: { ...baseLogState, documentsCompleted: 40, videoSessionsCompleted: 55 },
    },
       // 21:35 - Eighth update
    {
        id: 'audit-8',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 21), 35), 5).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated video count to 70 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 40, videoSessionsCompleted: 55 },
        newState: { ...baseLogState, documentsCompleted: 40, videoSessionsCompleted: 70 },
    },
       // 22:25 - Final update (reaching the target numbers)
    {
        id: 'audit-9',
        timestamp: setSeconds(setMinutes(setHours(todayLogDate, 22), 25), 0).toISOString(),
        action: 'UPDATE_WORK_LOG_QUICK_COUNT' as const,
        entityType: 'WorkLog' as const,
        entityId: todayLogId,
        details: `Quick updated document count to 62 and video count to 85 for log ${formatDateISO(today)}.`,
        previousState: { ...baseLogState, documentsCompleted: 40, videoSessionsCompleted: 70 },
        newState: { ...baseLogState, documentsCompleted: 62, videoSessionsCompleted: 85 }, // Match final counts
    },
].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Ensure sorted chronologically


// You can add more sample logs or targets as needed.
