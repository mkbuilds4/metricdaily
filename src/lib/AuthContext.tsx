import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserProfile, getUserSettings, updateUserSettings, migrateUserSettings, UserSettings } from './firebase';
import { migrateUPHTargets } from './migration';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  settings: UserSettings | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(userCredential.user);
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          // Try to get settings from the new structure
          let userSettings = await getUserSettings(user.uid);
          
          // If no settings found, try to migrate from old structure
          if (!userSettings) {
            const migratedSettings = await migrateUserSettings(user.uid);
            if (migratedSettings) {
              userSettings = migratedSettings;
            }
          }
          
          // If still no settings, create new user profile with default settings
          if (!userSettings) {
            const newUserData = await createUserProfile(user);
            userSettings = newUserData.settings;
          }
          
          if (userSettings) {
            setSettings(userSettings);
          }

          // Migrate UPH targets to new structure
          try {
            await migrateUPHTargets(user.uid);
          } catch (error) {
            console.error('Error migrating UPH targets:', error);
          }
        } catch (error) {
          console.error('Error loading user settings:', error);
          // Create new user profile with default settings if there's an error
          const newUserData = await createUserProfile(user);
          setSettings(newUserData.settings);
        }
      } else {
        setUser(null);
        setSettings(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user || !settings) return;
    
    try {
      await updateUserSettings(user.uid, newSettings);
      // Update local state with the new settings
      setSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...newSettings
        };
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    settings,
    updateSettings,
    signIn,
    signUp,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 