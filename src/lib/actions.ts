// src/lib/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import type { DailyWorkLog, UPHTarget, GoogleSheetsData } from '@/types';
import { db } from './firebase'; // Import the initialized Firestore instance
import { exportToGoogleSheets as exportSheetService } from '@/services/google-sheets';
import { FieldValue } from 'firebase-admin/firestore'; // Needed for transactions/updates

// Firestore Collection References
const workLogsCollection = db.collection('worklogs');
const uphTargetsCollection = db.collection('uphtargets');

// --- Helper Function (No longer needed for in-memory ID generation) ---
// function generateId(prefix: string = 'id'): string {
//     return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
// }

// === Work Log Actions ===

/**
 * Fetches all work logs from Firestore, sorted by date descending.
 */
export async function getWorkLogs(): Promise<DailyWorkLog[]> {
  console.log('[Action] getWorkLogs called');
  try {
    const snapshot = await workLogsCollection.orderBy('date', 'desc').get();
    if (snapshot.empty) {
      return [];
    }
    // Map Firestore documents to DailyWorkLog type
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<DailyWorkLog, 'id'>), // Assert type after getting data
    }));
    return logs;
  } catch (error) {
    console.error("[Action] Error fetching work logs:", error);
    // Depending on requirements, you might return [] or throw the error
    throw new Error("Could not fetch work logs.");
  }
}

/**
 * Saves (adds or updates) a work log entry in Firestore.
 * Expects `hoursWorked` to be pre-calculated.
 * If `logData.id` is provided, it updates the existing document.
 * Otherwise, it adds a new document and Firestore generates the ID.
 */
export async function saveWorkLog(
    logData: Omit<DailyWorkLog, 'id'> & { id?: string; hoursWorked: number }
): Promise<DailyWorkLog> {
    console.log('[Action] saveWorkLog called with:', logData);

    // Basic validation
    if (logData.hoursWorked < 0) {
        throw new Error("Hours worked cannot be negative.");
    }
    // Firestore handles Date object conversion, but ensure format consistency if needed

    const { id, ...dataToSave } = logData; // Separate id from the rest of the data

    try {
        let savedLog: DailyWorkLog;
        if (id) {
            // Update existing log
            const logRef = workLogsCollection.doc(id);
            await logRef.set(dataToSave, { merge: true }); // Use set with merge:true to update or create if missing
            savedLog = { id, ...dataToSave };
            console.log('[Action] Updated log with ID:', id);
        } else {
            // Add new log - Firestore generates the ID
            const docRef = await workLogsCollection.add(dataToSave);
            savedLog = { id: docRef.id, ...dataToSave };
            console.log('[Action] Added new log with ID:', docRef.id);
        }

        revalidatePath('/'); // Revalidate the page after saving
        return savedLog; // Return the saved log data (including ID)
    } catch (error) {
        console.error("[Action] Error saving work log:", error);
        throw new Error("Could not save work log.");
    }
}


/**
 * Exports work log data to Google Sheets using the service.
 * (No changes needed here as it interacts with an external service)
 */
export async function exportWorkLogsToSheet(data: GoogleSheetsData[], spreadsheetId: string, sheetName: string): Promise<void> {
  console.log('[Action] exportWorkLogsToSheet called');
  if (!spreadsheetId || spreadsheetId === 'YOUR_SPREADSHEET_ID' || !sheetName) {
    throw new Error("Google Sheet ID or Sheet Name is not configured properly.");
  }
  try {
    const transformedData = data.map(item => ({
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        breakMinutes: item.breakMinutes,
        hoursWorked: item.hoursWorked,
        docs: item.docs,
        videos: item.videos,
        calculatedUnits: item.calculatedUnits,
        calculatedUPH: item.calculatedUPH,
        targetUnits: item.targetUnits,
        remainingUnits: item.remainingUnits,
        notes: item.notes || '',
    }));

    await exportSheetService(transformedData, spreadsheetId, sheetName);
  } catch (error) {
     console.error("Export to Google Sheets failed in action:", error);
     throw error;
  }
}

// === UPH Target Actions ===

/**
 * Fetches all UPH targets from Firestore.
 */
export async function getUPHTargets(): Promise<UPHTarget[]> {
  console.log('[Action] getUPHTargets called');
   try {
    const snapshot = await uphTargetsCollection.get();
    if (snapshot.empty) {
      return [];
    }
    const targets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<UPHTarget, 'id'>),
    }));
    return targets;
  } catch (error) {
    console.error("[Action] Error fetching UPH targets:", error);
    throw new Error("Could not fetch UPH targets.");
  }
}

/**
 * Adds a new UPH target to Firestore. Defaults to isActive: false.
 */
export async function addUPHTarget(targetData: Omit<UPHTarget, 'id' | 'isActive'>): Promise<UPHTarget> {
  console.log('[Action] addUPHTarget called with:', targetData);
  if (targetData.docsPerUnit <= 0 || targetData.videosPerUnit <= 0) {
    throw new Error("Items per unit must be positive numbers.");
  }

  const newTargetData = {
      ...targetData,
      isActive: false, // New targets default to inactive
  };

  try {
    const docRef = await uphTargetsCollection.add(newTargetData);
    const newTarget: UPHTarget = { id: docRef.id, ...newTargetData };
    console.log('[Action] Added new target with ID:', docRef.id);
    revalidatePath('/');
    return newTarget;
  } catch (error) {
     console.error("[Action] Error adding UPH target:", error);
     throw new Error("Could not add UPH target.");
  }
}

/**
 * Updates an existing UPH target in Firestore.
 */
export async function updateUPHTarget(targetData: UPHTarget): Promise<UPHTarget> {
  console.log('[Action] updateUPHTarget called with:', targetData);
  if (targetData.docsPerUnit <= 0 || targetData.videosPerUnit <= 0) {
    throw new Error("Items per unit must be positive numbers.");
  }
  if (!targetData.id) {
    throw new Error("Target ID is required for update.");
  }

  const { id, ...dataToUpdate } = targetData;
  const targetRef = uphTargetsCollection.doc(id);

  try {
    // Check if document exists before update (optional, set overwrites)
    // const docSnap = await targetRef.get();
    // if (!docSnap.exists) {
    //   throw new Error(`Target with ID ${id} not found.`);
    // }
    await targetRef.set(dataToUpdate, { merge: true }); // Use set with merge to update
    console.log('[Action] Updated target with ID:', id);
    revalidatePath('/');
    return targetData; // Return the data that was passed in (now saved)
  } catch (error) {
      console.error("[Action] Error updating UPH target:", error);
      throw new Error("Could not update UPH target.");
  }
}

/**
 * Deletes a UPH target from Firestore. Cannot delete the active target.
 */
export async function deleteUPHTarget(id: string): Promise<void> {
  console.log('[Action] deleteUPHTarget called for ID:', id);
  const targetRef = uphTargetsCollection.doc(id);

  try {
    const docSnap = await targetRef.get();
    if (!docSnap.exists) {
      console.warn(`[Action] Target with ID ${id} not found for deletion.`);
      return; // Or throw if needed
    }

    const targetData = docSnap.data() as UPHTarget;
    if (targetData.isActive) {
      throw new Error("Cannot delete the currently active target.");
    }

    await targetRef.delete();
    console.log('[Action] Deleted target with ID:', id);
    revalidatePath('/');
  } catch (error) {
    console.error("[Action] Error deleting UPH target:", error);
    // Don't rethrow the "cannot delete active" error, let the client handle it via toast
    if (error instanceof Error && error.message === "Cannot delete the currently active target.") {
       throw error;
    }
    throw new Error("Could not delete UPH target.");
  }
}

/**
 * Sets a specific target as active in Firestore and deactivates all others using a transaction.
 */
export async function setActiveUPHTarget(id: string): Promise<UPHTarget> {
  console.log('[Action] setActiveUPHTarget called for ID:', id);
  const targetToActivateRef = uphTargetsCollection.doc(id);

  try {
    let activeTargetData: UPHTarget | null = null;

    await db.runTransaction(async (transaction) => {
      // 1. Verify the target to activate exists
      const targetSnap = await transaction.get(targetToActivateRef);
      if (!targetSnap.exists) {
        throw new Error(`Target with ID ${id} not found.`);
      }
      const currentTargetData = { id: targetSnap.id, ...targetSnap.data() } as UPHTarget;

        // If already active, no need to proceed with transaction
        if (currentTargetData.isActive) {
             console.log('[Action] Target already active:', id);
             activeTargetData = currentTargetData;
             return; // Exit transaction early
        }


      // 2. Find the currently active target (if any)
      const activeQuery = uphTargetsCollection.where('isActive', '==', true).limit(1);
      const activeSnapshot = await transaction.get(activeQuery);

      // 3. Deactivate the current active target
      if (!activeSnapshot.empty) {
        const currentActiveRef = activeSnapshot.docs[0].ref;
         // Avoid deactivating the target if it's the one we're activating
        if (currentActiveRef.id !== id) {
            transaction.update(currentActiveRef, { isActive: false });
             console.log('[Action] Deactivating previous target:', currentActiveRef.id);
        }
      }

      // 4. Activate the new target
      transaction.update(targetToActivateRef, { isActive: true });
      activeTargetData = { ...currentTargetData, isActive: true }; // Prepare the return data
       console.log('[Action] Activating target:', id);
    });

     if (!activeTargetData) {
       // This should only happen if the target was already active and the transaction exited early
        const snap = await targetToActivateRef.get(); // Re-fetch to be sure
        if (!snap.exists) throw new Error(`Target with ID ${id} disappeared.`);
        activeTargetData = { id: snap.id, ...snap.data() } as UPHTarget;
     }


    console.log('[Action] Set active target completed for:', id);
    revalidatePath('/');
    return activeTargetData;

  } catch (error) {
    console.error("[Action] Error setting active UPH target:", error);
     if (error instanceof Error && error.message.startsWith("Target with ID")) {
        throw error; // Rethrow specific known errors
     }
    throw new Error("Could not set active UPH target.");
  }
}


/**
 * Fetches the currently active UPH target from Firestore.
 */
export async function getActiveUPHTarget(): Promise<UPHTarget | null> {
  console.log('[Action] getActiveUPHTarget called');
  try {
    const query = uphTargetsCollection.where('isActive', '==', true).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return null; // No active target found
    }

    const doc = snapshot.docs[0];
    const activeTarget = {
      id: doc.id,
      ...(doc.data() as Omit<UPHTarget, 'id'>),
    };
    return activeTarget;
  } catch (error) {
     console.error("[Action] Error fetching active UPH target:", error);
     // It might be acceptable to return null on error, depending on how the UI handles it
     // throw new Error("Could not fetch active UPH target.");
     return null;
  }
}
