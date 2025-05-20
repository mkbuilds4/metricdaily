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
  deleteDoc,
  updateDoc,
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
  name: string;
  unitsPerHour: number;
  docsPerUnit: number;
  videosPerUnit: number;
  isActive: boolean;
  isDisplayed: boolean;
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

export const deleteWorkLogFromFirestore = async (logId: string) => {
  const logRef = doc(db, 'workLogs', logId);
  await deleteDoc(logRef);
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
  try {
    console.log('Fetching UPH targets for user:', userId);
    const targetsRef = collection(db, 'uphTargets');
    const q = query(
      targetsRef,
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const targets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (UPHTarget & { id: string })[];
    console.log('Found targets:', targets);
    return targets;
  } catch (error) {
    console.error('Error fetching UPH targets:', error);
    throw error;
  }
};

export const updateUPHTargetInFirestore = async (targetId: string, data: Partial<UPHTarget>) => {
  const targetRef = doc(db, 'uphTargets', targetId);
  await updateDoc(targetRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const deleteUPHTargetFromFirestore = async (targetId: string) => {
  const targetRef = doc(db, 'uphTargets', targetId);
  await deleteDoc(targetRef);
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