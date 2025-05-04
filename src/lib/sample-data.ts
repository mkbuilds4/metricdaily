
// src/lib/sample-data.ts
import type { DailyWorkLog, UPHTarget } from '@/types';
import { format, subDays, addDays } from 'date-fns';
import { formatDateISO } from './utils'; // Use consistent date formatting

// Helper to get dates relative to today
const today = new Date();
const yesterday = subDays(today, 1);
const twoDaysAgo = subDays(today, 2);
const tomorrow = addDays(today, 1); // For potential future logs if needed

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
    hoursWorked: 7.25, // Example calculation
    documentsCompleted: 62, // Example data
    videoSessionsCompleted: 25, // Example data
    targetId: sampleUPHTargets[0].id, // Associate with the first sample target ('meeting-1')
    notes: 'Started a bit late, focused on docs.',
  },
  // Yesterday's Log
  {
    id: 'log-yesterday',
    date: formatDateISO(yesterday),
    startTime: '13:45',
    endTime: '22:15',
    breakDurationMinutes: 60,
    hoursWorked: 7.5,
    documentsCompleted: 78,
    videoSessionsCompleted: 33,
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
    hoursWorked: 7.17, // Example calculation for 8h 30m - 70m break
    documentsCompleted: 55,
    videoSessionsCompleted: 22,
    targetId: sampleUPHTargets[0].id,
    notes: 'More video calls this day.',
  },
   // Add a log from earlier in the week for Weekly Avg testing
  {
    id: 'log-earlier-week',
    date: formatDateISO(subDays(today, 4)), // 4 days ago
    startTime: '14:00',
    endTime: '22:30',
    breakDurationMinutes: 65,
    hoursWorked: 7.25,
    documentsCompleted: 70,
    videoSessionsCompleted: 28,
    targetId: sampleUPHTargets[0].id,
    notes: 'Average day.',
  },
];

// You can add more sample logs or targets as needed.
