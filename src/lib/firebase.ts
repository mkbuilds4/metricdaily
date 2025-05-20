import { initializeApp, getApps } from 'firebase/app';
import { getAuth, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
console.log('[Firebase] Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' : 'missing',
});

if (!firebaseConfig.apiKey) {
  console.error('[Firebase] Missing required Firebase configuration. Please check your .env.local file.');
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
console.log('[Firebase] Firebase app initialized:', app.name);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  emailNotifications: boolean;
  defaultView: 'dashboard' | 'analytics' | 'logs';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  workHours: {
    start: string;
    end: string;
    days: string[];
  };
  metrics: {
    defaultUnit: string;
    defaultTarget: number;
    defaultInterval: 'daily' | 'weekly' | 'monthly';
  };
}

export const createUserProfile = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userData = {
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    settings: {
      theme: 'system' as const,
      notifications: true,
      emailNotifications: true,
      defaultView: 'dashboard' as const,
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h' as const,
      workHours: {
        start: '09:00',
        end: '17:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      },
      metrics: {
        defaultUnit: 'units',
        defaultTarget: 100,
        defaultInterval: 'daily' as const
      }
    } satisfies UserSettings
  };

  await setDoc(userRef, userData);
  return userData;
};

export const updateUserSettings = async (userId: string, settings: Partial<UserSettings>) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    [`settings.${Object.keys(settings)[0]}`]: Object.values(settings)[0],
    updatedAt: serverTimestamp()
  });
};

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    return userData.settings as UserSettings;
  }
  
  return null;
};

export const migrateUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const userRef = doc(db, 'users', userId);
  const userSettingsRef = doc(db, 'userSettings', userId);
  
  // Get the user settings from the old collection
  const userSettingsDoc = await getDoc(userSettingsRef);
  
  if (userSettingsDoc.exists()) {
    const data = userSettingsDoc.data();
    const settings: UserSettings = {
      theme: data.theme as 'light' | 'dark' | 'system',
      notifications: data.notifications ?? true,
      emailNotifications: data.emailNotifications ?? true,
      defaultView: data.defaultView as 'dashboard' | 'analytics' | 'logs',
      language: data.language ?? 'en',
      timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: data.dateFormat ?? 'MM/DD/YYYY',
      timeFormat: data.timeFormat as '12h' | '24h',
      workHours: {
        start: data.workHours?.start ?? '09:00',
        end: data.workHours?.end ?? '17:00',
        days: data.workHours?.days ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      },
      metrics: {
        defaultUnit: data.metrics?.defaultUnit ?? 'units',
        defaultTarget: data.metrics?.defaultTarget ?? 100,
        defaultInterval: data.metrics?.defaultInterval as 'daily' | 'weekly' | 'monthly'
      }
    };
    
    // Update the user document with the settings
    await updateDoc(userRef, {
      settings: settings,
      updatedAt: serverTimestamp()
    });
    
    // Delete the old settings document
    await deleteDoc(userSettingsRef);
    
    return settings;
  }
  
  return null;
}; 