"use server";

import { revalidatePath } from 'next/cache';
import { type Metric, type GoogleSheetsData } from '@/types';
import { exportToGoogleSheets } from '@/services/google-sheets';
import { formatDateISO } from '@/lib/utils';

// --- Data Storage (In-memory for demonstration) ---
// TODO: Replace this with a proper database implementation (e.g., Firestore, Supabase, Prisma)
let metricsStore: Metric[] = [
    // Example initial data (optional)
     { id: '1', date: '2024-07-15', value: 10 },
     { id: '2', date: '2024-07-16', value: 12 },
     { id: '3', date: '2024-07-17', value: 11 },
     { id: '4', date: '2024-07-22', value: 15 },
     { id: '5', date: '2024-07-23', value: 14 },
];
let nextId = metricsStore.length + 1;

// --- Server Actions ---

/**
 * Fetches all metrics, sorted by date descending.
 */
export async function getMetrics(): Promise<Metric[]> {
  // Simulate async operation (e.g., database query)
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate DB delay
  // Sort by date descending before returning
  return [...metricsStore].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Adds a new metric or updates an existing one for the same date.
 */
export async function addMetric(metricData: Omit<Metric, 'id'>): Promise<Metric> {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50));

  // Ensure date is in YYYY-MM-DD format
   const formattedDate = formatDateISO(metricData.date);

  // Check if a metric already exists for this date
  const existingMetricIndex = metricsStore.findIndex(m => m.date === formattedDate);

  let savedMetric: Metric;

  if (existingMetricIndex > -1) {
    // Update existing metric
    metricsStore[existingMetricIndex] = {
        ...metricsStore[existingMetricIndex],
        value: metricData.value,
        notes: metricData.notes,
    };
    savedMetric = metricsStore[existingMetricIndex];
     console.log(`Updated metric for date: ${formattedDate}`);

  } else {
     // Add new metric
    const newMetric: Metric = {
        ...metricData,
        id: String(nextId++),
        date: formattedDate, // Use the formatted date
    };
    metricsStore.push(newMetric);
    savedMetric = newMetric;
    console.log(`Added new metric for date: ${formattedDate}`);
  }


  // Revalidate the path to update the UI on the client-side
  revalidatePath('/');

  return savedMetric;
}


/**
 * Exports metrics data to Google Sheets.
 * Expects data in { date: string, value: number, notes?: string } format.
 */
export async function exportMetricsToSheet(data: GoogleSheetsData[]): Promise<void> {
  // Replace with your actual Spreadsheet ID and Sheet Name
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "YOUR_SPREADSHEET_ID"; // Use environment variable or placeholder
  const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "MetricsData"; // Use environment variable or placeholder

   if (SPREADSHEET_ID === "YOUR_SPREADSHEET_ID") {
        console.warn("Google Sheet ID is not configured. Skipping export.");
        // Optionally throw an error or return a specific status
        throw new Error("Google Sheet ID not configured.");
        // return;
    }

  console.log(`Attempting to export ${data.length} metrics to Sheet ID: ${SPREADSHEET_ID}, Sheet Name: ${SHEET_NAME}`);


  try {
    await exportToGoogleSheets(data, SPREADSHEET_ID, SHEET_NAME);
    console.log("Successfully exported data to Google Sheets.");
    revalidatePath('/'); // Revalidate if export success needs UI feedback immediately
  } catch (error) {
    console.error("Error exporting to Google Sheets:", error);
    // Rethrow the error so the client component can catch it
    throw new Error("Failed to export data to Google Sheets.");
  }
}

