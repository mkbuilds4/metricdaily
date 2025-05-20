import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import type { DailyWorkLog, UPHTarget, UserSettings } from '@/types';
import { getWorkLogs, getUPHTargets, getDefaultSettings } from './actions';

interface MigrationResult {
  success: boolean;
  workLogsMigrated: number;
  targetsMigrated: number;
  settingsMigrated: boolean;
  error?: string;
}

export async function migrateLocalDataToFirestore(userId: string): Promise<MigrationResult> {
  try {
    // Start a batch write
    const batch = writeBatch(db);
    let workLogsMigrated = 0;
    let targetsMigrated = 0;
    let settingsMigrated = false;

    // 1. Migrate Work Logs
    const workLogs = getWorkLogs();
    for (const log of workLogs) {
      const workLogRef = doc(collection(db, 'workLogs'));
      const firestoreLog = {
        ...log,
        userId,
        date: Timestamp.fromDate(new Date(log.date)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(workLogRef, firestoreLog);
      workLogsMigrated++;
    }

    // 2. Migrate UPH Targets
    const targets = getUPHTargets();
    for (const target of targets) {
      const targetRef = doc(collection(db, 'uphTargets'));
      const firestoreTarget = {
        ...target,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(targetRef, firestoreTarget);
      targetsMigrated++;
    }

    // 3. Migrate User Settings
    const settings = getDefaultSettings();
    if (settings) {
      const userRef = doc(db, 'users', userId);
      const firestoreSettings = {
        ...settings,
        updatedAt: serverTimestamp(),
      };
      batch.set(userRef, { settings: firestoreSettings }, { merge: true });
      settingsMigrated = true;
    }

    // Commit the batch
    await batch.commit();

    return {
      success: true,
      workLogsMigrated,
      targetsMigrated,
      settingsMigrated,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      workLogsMigrated: 0,
      targetsMigrated: 0,
      settingsMigrated: false,
      error: error instanceof Error ? error.message : 'Unknown error during migration',
    };
  }
}

// Helper function to check if migration is needed
export function shouldMigrateData(): boolean {
  if (typeof window === 'undefined') return false;
  
  const workLogs = getWorkLogs();
  const targets = getUPHTargets();
  const settings = getDefaultSettings();
  
  return workLogs.length > 0 || targets.length > 0 || settings !== null;
}

// Helper function to backup local data before migration
export function backupLocalData(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  
  const backup: Record<string, any> = {};
  const keys = ['workLogs', 'uphTargets', 'userSettings', 'auditLogs'];
  
  keys.forEach(key => {
    const data = window.localStorage.getItem(key);
    if (data) {
      backup[key] = JSON.parse(data);
    }
  });
  
  return backup;
}

// Helper function to restore local data from backup
export function restoreLocalData(backup: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  
  Object.entries(backup).forEach(([key, value]) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  });
}

export async function migrateUPHTargets(userId: string): Promise<void> {
  const targetsRef = collection(db, 'uphTargets');
  const q = query(targetsRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  
  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    if ('documentsPerHour' in data || 'videosPerHour' in data) {
      // Calculate unitsPerHour based on the existing data
      const unitsPerHour = data.documentsPerHour || 0;
      
      batch.update(doc.ref, {
        unitsPerHour,
        docsPerUnit: data.docsPerUnit || 1,
        videosPerUnit: data.videosPerUnit || 1,
        updatedAt: serverTimestamp(),
      });
      
      // Remove old fields
      batch.update(doc.ref, {
        documentsPerHour: deleteField(),
        videosPerHour: deleteField(),
      });
    }
  }
  
  await batch.commit();
} 