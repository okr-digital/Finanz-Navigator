import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { INITIAL_STATE, UserProfile } from '../types';
import { calculateScores } from '../utils/scoring';
import { saveToDatabase } from '../services/api';

interface UserContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateNestedProfile: (section: keyof UserProfile, updates: any) => void;
  calculateAndSave: () => void;
  resetProfile: () => void;
  hasPreviousSession: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_STATE);
  const [hasPreviousSession, setHasPreviousSession] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Ref to track if the initial load has happened to prevent overwriting with empty state
  const isLoadedRef = useRef(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('finanzNavigatorState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
        setHasPreviousSession(true);
      } catch (e) {
        console.error("Failed to parse local storage", e);
      }
    } else {
        // Initialize new session ID
        setProfile(p => ({
            ...p,
            meta: { ...p.meta, sessionId: crypto.randomUUID(), createdAt: new Date().toISOString() }
        }));
    }
    setIsInitialized(true);
    isLoadedRef.current = true;
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('finanzNavigatorState', JSON.stringify(profile));
  }, [profile, isInitialized]);

  // --- AUTO-SAVE TO SUPABASE (DEBOUNCED) ---
  useEffect(() => {
    // Nur speichern, wenn:
    // 1. Die App fertig geladen ist
    // 2. Der User bereits "Lead"-Daten (Name/Email) eingegeben hat ODER den Check abgeschlossen hat.
    //    (Wir wollen keine leeren "Ghost"-Sessions spammen, bevor der User zugestimmt hat)
    if (!isInitialized || !isLoadedRef.current) return;
    
    const hasConsentAndData = profile.lead.consent && profile.lead.email && profile.lead.email.length > 0;
    const isFinished = profile.meta.isFinished;

    if (hasConsentAndData || isFinished) {
      // Debounce: Warte 2 Sekunden nach der letzten Änderung, bevor gespeichert wird.
      // Das verhindert, dass bei jedem Tastenanschlag ein Request gesendet wird.
      const timer = setTimeout(() => {
        console.log("🔄 Auto-Sync zu Supabase...");
        saveToDatabase(profile);
      }, 2000);

      return () => clearTimeout(timer); // Löscht den Timer, wenn sich profile vor Ablauf ändert
    }
  }, [profile, isInitialized]);


  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...updates,
      meta: { ...prev.meta, lastUpdatedAt: new Date().toISOString() }
    }));
  };

  const updateNestedProfile = (section: keyof UserProfile, updates: any) => {
    setProfile((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        ...updates
      },
      meta: { ...prev.meta, lastUpdatedAt: new Date().toISOString() }
    }));
  };

  const calculateAndSave = () => {
    setProfile((prev) => {
      const calculated = calculateScores(prev);
      return {
        ...calculated,
        meta: { ...calculated.meta, isFinished: true, lastUpdatedAt: new Date().toISOString() }
      };
    });
  };

  const resetProfile = () => {
    const newSession = {
        ...INITIAL_STATE,
        meta: {
            sessionId: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            isFinished: false
        }
    };
    setProfile(newSession);
    setHasPreviousSession(false);
    localStorage.setItem('finanzNavigatorState', JSON.stringify(newSession));
  };

  return (
    <UserContext.Provider value={{ profile, updateProfile, updateNestedProfile, calculateAndSave, resetProfile, hasPreviousSession }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};