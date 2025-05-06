
// src/lib/sample-data.ts
import type { DailyWorkLog, UPHTarget } from '@/types';
import { format, subDays, addDays } from 'date-fns';
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
  },
  {
    id: 'minimum-1',
    name: 'Minimum',
    targetUPH: 7.5,
    docsPerUnit: 10,
    videosPerUnit: 1.5,
    isActive: false,
  },
  {
    id: 'outstanding-1',
    name: 'Outstanding',
    targetUPH: 10.5,
    docsPerUnit: 10,
    videosPerUnit: 1.5,
    isActive: false,
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
    documentsCompleted: 62, 
    videoSessionsCompleted: 85, 
    targetId: sampleUPHTargets[0].id, 
    notes: 'Started a bit late, focused on docs.',
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
  },
];

// You can add more sample logs or targets as needed.

