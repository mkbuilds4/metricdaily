import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';

// Types
export interface UserProfile {
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
}

export interface WorkLog {
  userId: string;
  date: Timestamp;
  documentsProcessed: number;
  videosProcessed: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UPHTarget {
  userId: string;
  documentsPerHour: number;
  videosPerHour: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  updatedAt: Timestamp;
}

// User Profile Operations
export const createUserProfile = async (userId: string, email: string) => {
  const userRef = doc(db, 'users', userId);
  const userData: UserProfile = {
    email,
    createdAt: Timestamp.now(),
    lastLogin: Timestamp.now(),
  };
  await setDoc(userRef, userData);
};

export const getUserProfile = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() as UserProfile : null;
};

// Work Log Operations
export const createWorkLog = async (userId: string, logData: Omit<WorkLog, 'userId' | 'createdAt' | 'updatedAt'>) => {
  const workLogsRef = collection(db, 'workLogs');
  const newLog: WorkLog = {
    ...logData,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = doc(workLogsRef);
  await setDoc(docRef, newLog);
  return docRef.id;
};

export const getUserWorkLogs = async (userId: string) => {
  const workLogsRef = collection(db, 'workLogs');
  const q = query(
    workLogsRef,
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as (WorkLog & { id: string })[];
};

// UPH Target Operations
export const createUPHTarget = async (userId: string, targetData: Omit<UPHTarget, 'userId' | 'createdAt' | 'updatedAt'>) => {
  const targetsRef = collection(db, 'uphTargets');
  const newTarget: UPHTarget = {
    ...targetData,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = doc(targetsRef);
  await setDoc(docRef, newTarget);
  return docRef.id;
};

export const getUserUPHTargets = async (userId: string) => {
  const targetsRef = collection(db, 'uphTargets');
  const q = query(
    targetsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as (UPHTarget & { id: string })[];
};

// User Settings Operations
export const createUserSettings = async (userId: string) => {
  const settingsRef = doc(db, 'userSettings', userId);
  const settingsData: UserSettings = {
    userId,
    theme: 'system',
    notifications: true,
    updatedAt: Timestamp.now(),
  };
  await setDoc(settingsRef, settingsData);
};

export const getUserSettings = async (userId: string) => {
  const settingsRef = doc(db, 'userSettings', userId);
  const settingsSnap = await getDoc(settingsRef);
  return settingsSnap.exists() ? settingsSnap.data() as UserSettings : null;
}; 