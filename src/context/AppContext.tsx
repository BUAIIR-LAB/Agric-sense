import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService, { type UserResponse, type DiagnosisResponse, type SpectroscopyResponse } from '@/services/api';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { initDB, setProfileDB, setChatHistoryDB, setDiagnosisHistoryDB, setSpectroscopyHistoryDB, getProfileDB, getChatHistoryDB, getDiagnosisHistoryDB, getSpectroscopyHistoryDB, getPendingDiagnosesDB } from '@/services/database';
import syncService from '@/services/SyncService';
import { sanitizeStateForStorage } from '@/utils/historyStorage';
import type { AiToolSession } from '@/types/aiToolSession';

export const SUPPORTED_LANGUAGES = [
  'English',
  'Luganda',
  'Ateso',
  'Acholi',
  'Japadhola',
  'Runyankore',
] as const;

export type LanguageOption = typeof SUPPORTED_LANGUAGES[number];

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type FarmerProfile = {
  id: string;
  name: string;
  phoneNumber: string;
  area: string;
  gpsLocation?: Coordinates;
  cropsGrown: string[];
  preferredLanguage: LanguageOption;
  /** False for thin website signups until farm details are filled on mobile */
  profileComplete?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  modality: 'text' | 'voice';
  content: string;
  timestamp: string;
  audioUri?: string;
  triggerSpeech?: boolean;
};

export type DiagnosisRecord = {
  id: string;
  imageUri?: string;
  suspectedIssues: string[];
  confidence: number;
  summary: string;
  recommendations: string[];
  followUpQuestion?: string;
  followUpResponse?: string;
  timestamp: string;
  syncStatus?: number; // 0 = synced, 1 = pending
};

export type SpectroscopyRecord = {
  id: string;
  sampleName: string;
  spectrum: Array<{ wavelength: number; intensity: number }>;
  summary: string;
  insights: string[];
  timestamp: string;
};

export type AppState = {
  profile?: FarmerProfile;
  isAuthenticated: boolean;
  chatHistory: ChatMessage[];
  diagnosisHistory: DiagnosisRecord[];
  spectroscopyHistory: SpectroscopyRecord[];
  createdAt: string;
  updatedAt?: string;
};

const STORAGE_KEY = 'agrisense-state-v1';

const baseState: AppState = {
  profile: undefined,
  isAuthenticated: false,
  chatHistory: [],
  diagnosisHistory: [],
  spectroscopyHistory: [],
  createdAt: new Date().toISOString(),
  updatedAt: undefined,
};

type NewChatMessage = Omit<ChatMessage, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

type NewDiagnosisRecord = Omit<DiagnosisRecord, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

type NewSpectroscopyRecord = Omit<SpectroscopyRecord, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

type AppContextValue = {
  state: AppState;
  isHydrated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  // Registration & Authentication
  completeRegistration: (profile: FarmerProfile) => void;
  registerWithAPI: (userData: { name: string; phone_number: string; password: string; area: string; preferred_language?: string; crops_grown?: string[]; gps_location?: Coordinates }) => Promise<boolean>;
  loginWithAPI: (phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  // Profile
  updateProfile: (updates: Partial<FarmerProfile>) => void;
  updateProfileWithAPI: (updates: Partial<FarmerProfile>) => Promise<boolean>;
  loadUserProfile: () => Promise<void>;
  // Chat (local only for now)
  addChatMessages: (messages: NewChatMessage[]) => void;
  clearChatHistory: () => void;
  /** Ephemeral tool-result context for AgriSense AI (not persisted) */
  activeAiSession: AiToolSession | null;
  setActiveAiSession: (session: AiToolSession | null) => void;
  clearActiveAiSession: () => void;
  // Diagnosis
  addDiagnosisRecord: (record: NewDiagnosisRecord) => void;
  createDiagnosisWithAPI: (diagnosis: Omit<DiagnosisRecord, 'id' | 'timestamp'>) => Promise<DiagnosisRecord | null>;
  loadDiagnosisHistory: () => Promise<void>;
  clearDiagnosisHistory: () => void;
  removeDiagnosisRecord: (id: string) => void;
  removeDiagnosisRecordWithAPI: (id: string) => Promise<boolean>;
  // Spectroscopy
  addSpectroscopyRecord: (record: NewSpectroscopyRecord) => void;
  createSpectroscopyWithAPI: (spectroscopy: Omit<SpectroscopyRecord, 'id' | 'timestamp'>) => Promise<SpectroscopyRecord | null>;
  loadSpectroscopyHistory: () => Promise<void>;
  clearSpectroscopyHistory: () => void;
  removeSpectroscopyRecord: (id: string) => void;
  removeSpectroscopyRecordWithAPI: (id: string) => Promise<boolean>;
  // History
  syncHistoryFromAPI: () => Promise<boolean>;
  isSyncingHistory: boolean;
  lastHistorySyncAt: number | null;
  loadHistoryStats: () => Promise<void>;
  // Reset
  resetAll: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const useAppValue = (value: AppContextValue) => value;

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Props = {
  children: ReactNode;
};

export const AppProvider = ({ children }: Props) => {
  const [state, setState] = useState<AppState>(baseState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [lastHistorySyncAt, setLastHistorySyncAt] = useState<number | null>(null);
  const [activeAiSession, setActiveAiSessionState] = useState<AiToolSession | null>(null);
  const historySyncInFlight = useRef(false);
  const networkStatus = useNetworkStatus();
  const isOffline = networkStatus.isConnected === false;

  // Define persist and updateState first, as they're used by other functions
  const persist = useCallback((next: AppState) => {
    const storable = sanitizeStateForStorage(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storable)).catch((error) =>
      console.warn('Failed to persist application state to AsyncStorage', error),
    );
    const saveToSQLite = async () => {
      try {
        await setProfileDB(storable.profile);
        await setChatHistoryDB(storable.chatHistory);
        await setDiagnosisHistoryDB(storable.diagnosisHistory);
        await setSpectroscopyHistoryDB(storable.spectroscopyHistory);
      } catch (e) {
        console.warn('Failed to persist to SQLite', e);
      }
    };
    saveToSQLite();
  }, []);

  const updateState = useCallback(
    (updater: (previous: AppState) => AppState) => {
      setState((previous) => {
        const updated = updater(previous);
        const normalized: AppState = {
          ...updated,
          createdAt: previous.createdAt ?? updated.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Persist asynchronously to avoid blocking state update
        persist(normalized);
        return normalized;
      });
    },
    [persist],
  );

  const loadUserProfile = useCallback(async () => {
    try {
      const response = await apiService.getCurrentUser();
      const profile: FarmerProfile = {
        id: response.id,
        name: response.name,
        phoneNumber: response.phone_number,
        area: response.area,
        preferredLanguage: (response.preferred_language as LanguageOption) || 'English',
        cropsGrown: response.crops_grown || [],
        gpsLocation: response.gps_latitude && response.gps_longitude
          ? { latitude: response.gps_latitude, longitude: response.gps_longitude }
          : undefined,
        profileComplete: response.profile_complete,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      };

      updateState((prev) => ({
        ...prev,
        profile,
        isAuthenticated: true,
      }));
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
      // Re-throw error so caller can handle it appropriately
      throw error;
    }
  }, [updateState]);

  useEffect(() => {
    const hydrate = async () => {
      try {
        await initDB();
        
        // Try loading from SQLite first sequentially
        const dbProfile = await getProfileDB();
        const dbChats = await getChatHistoryDB();
        const dbDiagnoses = await getDiagnosisHistoryDB();
        const dbSpectroscopy = await getSpectroscopyHistoryDB();
        
        let parsed: AppState | null = null;
        
        // If we found data in SQLite, use it
        if (dbProfile || dbChats.length > 0 || dbDiagnoses.length > 0 || dbSpectroscopy.length > 0) {
          console.log('✅ Hydrating state from SQLite database');
          setState((prev) => ({
            ...prev,
            profile: dbProfile || prev.profile,
            chatHistory: dbChats,
            diagnosisHistory: dbDiagnoses,
            spectroscopyHistory: dbSpectroscopy,
          }));
        } else {
          // Fallback to AsyncStorage
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            parsed = JSON.parse(stored) as AppState;
            if (parsed) {
              console.log('✅ Hydrating state from AsyncStorage (migrating to SQLite)');
              setState((prev) => ({
                ...prev,
                ...parsed,
                chatHistory: parsed?.chatHistory ?? [],
                diagnosisHistory: parsed?.diagnosisHistory ?? [],
                spectroscopyHistory: parsed?.spectroscopyHistory ?? [],
                createdAt: parsed?.createdAt ?? prev.createdAt,
              }));
              // Migrate data to SQLite exactly once
              const migrateToSQLite = async () => {
                try {
                  await setProfileDB(parsed!.profile);
                  await setChatHistoryDB(parsed!.chatHistory);
                  await setDiagnosisHistoryDB(parsed!.diagnosisHistory);
                  await setSpectroscopyHistoryDB(parsed!.spectroscopyHistory);
                } catch (e) {
                  console.warn('Fast migration catch', e);
                }
              };
              migrateToSQLite();
            }
          }
        }

        // Check if user has a valid token and restore authentication
        // This ensures users stay logged in when they reopen the app
        const token = await apiService.getToken();
        const cachedProfile = dbProfile || parsed?.profile;

        if (token) {
          console.log('🔐 Token found on startup, restoring authentication...');
          // Trust cached session immediately so we skip landing → home without waiting on /me
          if (cachedProfile) {
            setState((prev) => ({
              ...prev,
              profile: cachedProfile,
              isAuthenticated: true,
            }));
          }

          try {
            await loadUserProfile();
            console.log('✅ Authentication restored successfully');
          } catch (error: any) {
            console.warn('⚠️ Failed to restore authentication:', error.message);
            if (error?.response?.status === 401) {
              console.log('🔐 Token is invalid, clearing...');
              await apiService.removeToken();
              setState((prev) => ({
                ...prev,
                isAuthenticated: false,
                profile: undefined,
              }));
            } else if (cachedProfile) {
              // Offline / server wake-up: keep session with cached profile
              console.warn('⚠️ Could not verify token online; keeping cached session');
              setState((prev) => ({
                ...prev,
                profile: cachedProfile,
                isAuthenticated: true,
              }));
            } else {
              console.warn('⚠️ Could not verify token and no cached profile');
            }
          }
        } else {
          // No token found - ensure we're marked as unauthenticated
          console.log('🔐 No token found, user needs to login');
          setState((prev) => ({
            ...prev,
            isAuthenticated: false,
            profile: undefined,
          }));
        }
      } catch (error: any) {
        console.error('❌ Error during hydration:', error);
      } finally {
        setIsHydrated(true);
      }
    };
    hydrate();
  }, [loadUserProfile, updateState]);

  // Network Recovery Synchronization
  useEffect(() => {
    if (!isOffline && isHydrated && state.isAuthenticated) {
      const runSync = async () => {
        console.log('🌐 Network restored, checking for pending syncs...');
        try {
          await syncService.syncPendingDiagnoses((syncedRecord) => {
            updateState((prev) => ({
              ...prev,
              diagnosisHistory: prev.diagnosisHistory.map((rec) =>
                rec.id === syncedRecord.id ? { ...rec, syncStatus: 0 } : rec
              ),
            }));
          });
        } catch (e) {
          console.warn('Sync failed:', e);
        }
      };
      runSync();
    }
  }, [isOffline, isHydrated, state.isAuthenticated, updateState]);

  const completeRegistration = useCallback(
    (profile: FarmerProfile) => {
      updateState((prev) => ({
        ...prev,
        profile,
        isAuthenticated: true,
      }));
    },
    [updateState],
  );


  const updateProfile = useCallback(
    (updates: Partial<FarmerProfile>) => {
      if (!state.profile) {
        return;
      }
      updateState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile!,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [state.profile, updateState],
  );

  const addChatMessages = useCallback(
    (messages: NewChatMessage[]) => {
      if (!messages.length) {
        return;
      }
      updateState((prev) => {
        const newMessages = messages.map((message) => ({
          ...message,
          id: message.id ?? createId(),
          timestamp: message.timestamp ?? new Date().toISOString(),
        }));

        // Replace existing messages with same ID, add new ones
        // Use a Map for O(1) lookup and to ensure no duplicates
        const messageMap = new Map<string, ChatMessage>();

        // First, add all existing messages
        prev.chatHistory.forEach((msg) => {
          messageMap.set(msg.id, msg);
        });

        // Then, add/update with new messages (new messages override existing ones with same ID)
        newMessages.forEach((newMsg) => {
          messageMap.set(newMsg.id, newMsg);
        });

        // Convert back to array
        const updatedHistory = Array.from(messageMap.values());

        return {
          ...prev,
          chatHistory: updatedHistory,
        };
      });
    },
    [updateState],
  );

  const clearChatHistory = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      chatHistory: [],
    }));
  }, [updateState]);

  const setActiveAiSession = useCallback((session: AiToolSession | null) => {
    setActiveAiSessionState(session);
  }, []);

  const clearActiveAiSession = useCallback(() => {
    setActiveAiSessionState(null);
  }, []);

  const addDiagnosisRecord = useCallback(
    (record: NewDiagnosisRecord) => {
      updateState((prev) => ({
        ...prev,
        diagnosisHistory: [
          {
            ...record,
            id: record.id ?? createId(),
            timestamp: record.timestamp ?? new Date().toISOString(),
          },
          ...prev.diagnosisHistory,
        ],
      }));
    },
    [updateState],
  );

  const removeDiagnosisRecord = useCallback(
    (id: string) => {
      console.log('Removing diagnosis record locally:', id);
      updateState((prev) => {
        const filtered = prev.diagnosisHistory.filter((entry) => entry.id !== id);
        console.log('Diagnosis history before:', prev.diagnosisHistory.length, 'after:', filtered.length);
        return {
          ...prev,
          diagnosisHistory: filtered,
        };
      });
    },
    [updateState],
  );

  const clearDiagnosisHistory = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      diagnosisHistory: [],
    }));
  }, [updateState]);

  const addSpectroscopyRecord = useCallback(
    (record: NewSpectroscopyRecord) => {
      updateState((prev) => ({
        ...prev,
        spectroscopyHistory: [
          {
            ...record,
            id: record.id ?? createId(),
            timestamp: record.timestamp ?? new Date().toISOString(),
          },
          ...prev.spectroscopyHistory,
        ],
      }));
    },
    [updateState],
  );

  const removeSpectroscopyRecord = useCallback(
    (id: string) => {
      console.log('Removing spectroscopy record locally:', id);
      updateState((prev) => {
        const filtered = prev.spectroscopyHistory.filter((entry) => entry.id !== id);
        console.log('Spectroscopy history before:', prev.spectroscopyHistory.length, 'after:', filtered.length);
        return {
          ...prev,
          spectroscopyHistory: filtered,
        };
      });
    },
    [updateState],
  );

  const clearSpectroscopyHistory = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      spectroscopyHistory: [],
    }));
  }, [updateState]);

  // API Integration Methods
  const loginWithAPI = useCallback(async (phoneNumber: string, password: string): Promise<boolean> => {
    if (!password?.trim()) {
      throw new Error('Password is required');
    }
    try {
      setIsLoading(true);
      if (__DEV__) {
        console.log('Logging in with phone number (length):', phoneNumber.length);
      }
      await apiService.login({ identifier: phoneNumber, password });

      updateState((prev) => ({
        ...prev,
        isAuthenticated: true,
      }));

      // Load profile in background — don't block the login success UI
      loadUserProfile().catch((profileError: any) => {
        if (__DEV__) {
          console.warn('⚠️ Failed to load profile after login:', profileError.message);
        }
      });

      return true;
    } catch (error: any) {
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.warn('Login validation warning:', error.response?.data?.detail || error.message);
      } else {
        console.error('❌ Login failed:', error.message);
      }

      // Provide more helpful error information
      if (error.response?.status === 404) {
        console.log('💡 Tip: The login endpoint returned 404. This might mean the user doesn\'t exist or the endpoint path is incorrect.');
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.warn('💡 Tip: Backend may be waking up (Render.com free tier) or unreachable. Please wait 30-60 seconds and try again.');
      }

      // Rethrow to let the component handle the error message
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile, updateState]);

  const registerWithAPI = useCallback(async (userData: {
    name: string;
    phone_number: string;
    password: string;
    area: string;
    preferred_language?: string;
    crops_grown?: string[];
    gps_location?: Coordinates;
  }): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await apiService.register(userData);
      console.log('✅ Registration successful for:', response.phone_number);

      try {
        console.log('🔄 Performing automated login after registration...');
        await loginWithAPI(userData.phone_number, userData.password);
        console.log('✅ Automated login successful');
        return true;
      } catch (loginError: any) {
        console.warn('⚠️ Register succeeded but auto-login failed:', loginError.message);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.warn('Registration validation warning:', error.response?.data?.detail || error.message);
      } else {
        console.error('Registration failed:', error.message);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loginWithAPI]);

  const updateProfileWithAPI = useCallback(async (updates: Partial<FarmerProfile>): Promise<boolean> => {
    try {
      setIsLoading(true);
      const apiUpdates: any = {};
      if (updates.name) apiUpdates.name = updates.name;
      if (updates.area) apiUpdates.area = updates.area;
      if (updates.preferredLanguage) apiUpdates.preferred_language = updates.preferredLanguage;
      if (updates.cropsGrown) apiUpdates.crops_grown = updates.cropsGrown;
      if (updates.gpsLocation) {
        apiUpdates.gps_location = {
          latitude: updates.gpsLocation.latitude,
          longitude: updates.gpsLocation.longitude,
        };
      }
      // Completing farm details from mobile clears the website thin-signup flag
      if (updates.area || updates.cropsGrown) {
        apiUpdates.profile_complete = true;
      }

      const response = await apiService.updateProfile(apiUpdates);
      const profile: FarmerProfile = {
        id: response.id,
        name: response.name,
        phoneNumber: response.phone_number,
        area: response.area,
        preferredLanguage: (response.preferred_language as LanguageOption) || 'English',
        cropsGrown: response.crops_grown || [],
        gpsLocation: response.gps_latitude && response.gps_longitude
          ? { latitude: response.gps_latitude, longitude: response.gps_longitude }
          : undefined,
        profileComplete: response.profile_complete ?? true,
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      };

      updateState((prev) => ({
        ...prev,
        profile,
      }));
      return true;
    } catch (error: any) {
      console.error('Profile update failed:', error);
      // Error handling is done in the component with sweet alerts
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);

  const createDiagnosisWithAPI = useCallback(async (diagnosis: Omit<DiagnosisRecord, 'id' | 'timestamp'>): Promise<DiagnosisRecord | null> => {
    try {
      setIsLoading(true);

      // If offline, we save the diagnosis locally as "Pending" and return it
      if (isOffline) {
        console.log('📴 Offline: Queuing diagnosis record locally for future sync');
        const offlineRecord: DiagnosisRecord = {
          ...diagnosis,
          id: createId(),
          timestamp: new Date().toISOString(),
          syncStatus: 1, // Pending
        };

        updateState((prev) => ({
          ...prev,
          diagnosisHistory: [offlineRecord, ...prev.diagnosisHistory],
        }));

        return offlineRecord;
      }

      // If online, proceed with standard API call
      const response = await apiService.createDiagnosis({
        image_uri: diagnosis.imageUri,
        suspected_issues: diagnosis.suspectedIssues,
        confidence: diagnosis.confidence,
        summary: diagnosis.summary,
        recommendations: diagnosis.recommendations,
        follow_up_question: diagnosis.followUpQuestion,
        follow_up_response: diagnosis.followUpResponse,
        target_lang: state.profile?.preferredLanguage,
      });

      const record: DiagnosisRecord = {
        id: response.id,
        imageUri: response.image_uri,
        suspectedIssues: response.suspected_issues,
        confidence: response.confidence,
        summary: response.summary,
        recommendations: response.recommendations,
        followUpQuestion: response.follow_up_question,
        followUpResponse: response.follow_up_response,
        timestamp: response.timestamp,
      };

      addDiagnosisRecord(record);
      return record;
    } catch (error: any) {
      console.error('Diagnosis creation failed:', error);
      // Error handling is done in the component with sweet alerts
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [addDiagnosisRecord]);

  const loadDiagnosisHistory = useCallback(async () => {
    try {
      if (isOffline) {
        console.log('📶 App is offline. Skipping diagnosis history API load.');
        return;
      }

      // Check if user has a token before making API call
      const token = await apiService.getToken();
      if (!token) {
        console.warn('⚠️ No authentication token found. Skipping API load.');
        return;
      }

      console.log('📥 Loading diagnosis history from API...');
      const records = await apiService.getDiagnosisHistory({ limit: 100, sort: 'newest' });
      console.log(`✅ Loaded ${records.length} diagnosis records from API`);
      const diagnosisHistory: DiagnosisRecord[] = records.map((r) => ({
        id: r.id,
        imageUri: r.image_uri,
        suspectedIssues: r.suspected_issues,
        confidence: r.confidence,
        summary: r.summary,
        recommendations: r.recommendations,
        followUpQuestion: r.follow_up_question,
        followUpResponse: r.follow_up_response,
        timestamp: r.timestamp,
      }));

      updateState((prev) => ({
        ...prev,
        diagnosisHistory,
      }));
    } catch (error: any) {
      console.error('❌ Failed to load diagnosis history:', error);
      console.error('   Error status:', error?.response?.status);
      console.error('   Error message:', error?.message);
      const status = error?.response?.status;

      // Handle different error statuses
      if (status === 401) {
        // Unauthorized - clear token and mark as unauthenticated
        await apiService.removeToken();
        updateState((prev) => ({
          ...prev,
          isAuthenticated: false,
        }));
      } else if (status === 500) {
        console.warn('Server error loading diagnosis history. Using local data only.');
        return;
      }
      throw error;
    }
  }, [updateState, isOffline]);

  const removeDiagnosisRecordWithAPI = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Check if user has a token before making API call
      const token = await apiService.getToken();
      if (!token) {
        console.warn('⚠️ No authentication token found. Using local delete only.');
        // Delete locally immediately
        removeDiagnosisRecord(id);
        return true; // Return true since we deleted locally
      }

      console.log(`🗑️ Deleting diagnosis record ${id} from API...`);

      setIsLoading(true);
      await apiService.deleteDiagnosis(id);
      console.log('✅ Diagnosis record deleted from API successfully');
      // Update local state after successful API delete
      removeDiagnosisRecord(id);
      setIsLoading(false);
      return true;
    } catch (error: any) {
      setIsLoading(false);
      console.error('❌ Failed to delete diagnosis from API:', error);
      console.error('   Error status:', error?.response?.status);
      console.error('   Error message:', error?.message);
      // Don't show alert - let the caller handle fallback
      // If 401, clear token
      if (error?.response?.status === 401) {
        await apiService.removeToken();
        updateState((prev) => ({
          ...prev,
          isAuthenticated: false,
        }));
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [removeDiagnosisRecord, updateState]);

  const createSpectroscopyWithAPI = useCallback(async (spectroscopy: Omit<SpectroscopyRecord, 'id' | 'timestamp'>): Promise<SpectroscopyRecord | null> => {
    try {
      setIsLoading(true);
      const response = await apiService.createSpectroscopy({
        sample_name: spectroscopy.sampleName,
        spectrum: spectroscopy.spectrum,
        summary: spectroscopy.summary,
        insights: spectroscopy.insights,
      });

      const record: SpectroscopyRecord = {
        id: response.id,
        sampleName: response.sample_name,
        spectrum: response.spectrum,
        summary: response.summary,
        insights: response.insights,
        timestamp: response.timestamp,
      };

      addSpectroscopyRecord(record);
      return record;
    } catch (error: any) {
      console.error('Spectroscopy creation failed:', error);
      // Error handling is done in the component with sweet alerts
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [addSpectroscopyRecord]);

  const loadSpectroscopyHistory = useCallback(async () => {
    try {
      if (isOffline) {
        console.log('📶 App is offline. Skipping spectroscopy history API load.');
        return;
      }

      // Check if user has a token before making API call
      const token = await apiService.getToken();
      if (!token) {
        console.warn('No authentication token found. Skipping API load.');
        return;
      }

      console.log('📥 Loading spectroscopy history from API...');
      const records = await apiService.getSpectroscopyHistory({ limit: 100, sort: 'newest' });
      console.log(`✅ Loaded ${records.length} spectroscopy records from API`);
      const spectroscopyHistory: SpectroscopyRecord[] = records.map((r) => ({
        id: r.id,
        sampleName: r.sample_name,
        spectrum: r.spectrum,
        summary: r.summary,
        insights: r.insights,
        timestamp: r.timestamp,
      }));

      updateState((prev) => ({
        ...prev,
        spectroscopyHistory,
      }));
    } catch (error: any) {
      console.error('❌ Failed to load spectroscopy history:', error);
      console.error('   Error status:', error?.response?.status);
      console.error('   Error message:', error?.message);
      const status = error?.response?.status;

      // Handle different error statuses
      if (status === 401) {
        // Unauthorized - clear token and mark as unauthenticated
        await apiService.removeToken();
        updateState((prev) => ({
          ...prev,
          isAuthenticated: false,
        }));
      } else if (status === 500) {
        console.warn('Server error loading spectroscopy history. Using local data only.');
        return;
      }
      throw error;
    }
  }, [updateState, isOffline]);

  const syncHistoryFromAPI = useCallback(async (): Promise<boolean> => {
    if (isOffline || historySyncInFlight.current) {
      return false;
    }

    const token = await apiService.getToken();
    if (!token) {
      return false;
    }

    historySyncInFlight.current = true;
    setIsSyncingHistory(true);

    try {
      const results = await Promise.allSettled([
        loadDiagnosisHistory(),
        loadSpectroscopyHistory(),
      ]);

      const hasFailure = results.some((result) => result.status === 'rejected');
      if (!hasFailure) {
        setLastHistorySyncAt(Date.now());
        return true;
      }
      return false;
    } finally {
      historySyncInFlight.current = false;
      setIsSyncingHistory(false);
    }
  }, [isOffline, loadDiagnosisHistory, loadSpectroscopyHistory]);

  useEffect(() => {
    if (!isHydrated || !state.isAuthenticated || isOffline) {
      return;
    }
    syncHistoryFromAPI();
  }, [isHydrated, state.isAuthenticated, isOffline, syncHistoryFromAPI]);

  const removeSpectroscopyRecordWithAPI = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Check if user has a token before making API call
      const token = await apiService.getToken();
      if (!token) {
        console.warn('⚠️ No authentication token found. Using local delete only.');
        // Delete locally immediately
        removeSpectroscopyRecord(id);
        return true; // Return true since we deleted locally
      }

      console.log(`🗑️ Deleting spectroscopy record ${id} from API...`);

      setIsLoading(true);
      await apiService.deleteSpectroscopy(id);
      console.log('✅ Spectroscopy record deleted from API successfully');
      // Update local state after successful API delete
      removeSpectroscopyRecord(id);
      setIsLoading(false);
      return true;
    } catch (error: any) {
      setIsLoading(false);
      console.error('❌ Failed to delete spectroscopy from API:', error);
      console.error('   Error status:', error?.response?.status);
      console.error('   Error message:', error?.message);
      // Don't show alert - let the caller handle fallback
      // If 401, clear token
      if (error?.response?.status === 401) {
        await apiService.removeToken();
        updateState((prev) => ({
          ...prev,
          isAuthenticated: false,
        }));
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [removeSpectroscopyRecord, updateState]);

  const loadHistoryStats = useCallback(async () => {
    try {
      await apiService.getHistoryStats();
      // Stats can be used for display purposes
    } catch (error) {
      console.error('Failed to load history stats:', error);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('Logging out...');
    // Remove token first
    await apiService.removeToken();
    setActiveAiSessionState(null);
    // Clear authentication state
    updateState((prev) => ({
      ...prev,
      isAuthenticated: false,
      profile: undefined,
      diagnosisHistory: [],
      spectroscopyHistory: [],
      chatHistory: [],
    }));
    if (__DEV__) {
      console.log('Logout complete. Token removed and state cleared.');
    }
  }, [updateState]);

  const resetAll = useCallback(() => {
    const resetState: AppState = {
      ...baseState,
      createdAt: new Date().toISOString(),
    };
    setState(resetState);
    persist(resetState);
    setActiveAiSessionState(null);
    apiService.removeToken();
  }, [persist]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      isHydrated,
      isLoading,
      isOffline,
      completeRegistration,
      registerWithAPI,
      loginWithAPI,
      logout,
      updateProfile,
      updateProfileWithAPI,
      loadUserProfile,
      addChatMessages,
      clearChatHistory,
      activeAiSession,
      setActiveAiSession,
      clearActiveAiSession,
      addDiagnosisRecord,
      createDiagnosisWithAPI,
      loadDiagnosisHistory,
      clearDiagnosisHistory,
      removeDiagnosisRecord,
      removeDiagnosisRecordWithAPI,
      addSpectroscopyRecord,
      createSpectroscopyWithAPI,
      loadSpectroscopyHistory,
      clearSpectroscopyHistory,
      removeSpectroscopyRecord,
      removeSpectroscopyRecordWithAPI,
      syncHistoryFromAPI,
      isSyncingHistory,
      lastHistorySyncAt,
      loadHistoryStats,
      resetAll,
    }),
    [
      state,
      isHydrated,
      isLoading,
      isOffline,
      isSyncingHistory,
      lastHistorySyncAt,
      activeAiSession,
      completeRegistration,
      registerWithAPI,
      loginWithAPI,
      logout,
      updateProfile,
      updateProfileWithAPI,
      loadUserProfile,
      addChatMessages,
      clearChatHistory,
      setActiveAiSession,
      clearActiveAiSession,
      addDiagnosisRecord,
      createDiagnosisWithAPI,
      loadDiagnosisHistory,
      clearDiagnosisHistory,
      removeDiagnosisRecord,
      removeDiagnosisRecordWithAPI,
      addSpectroscopyRecord,
      createSpectroscopyWithAPI,
      loadSpectroscopyHistory,
      clearSpectroscopyHistory,
      removeSpectroscopyRecord,
      removeSpectroscopyRecordWithAPI,
      syncHistoryFromAPI,
      loadHistoryStats,
      resetAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
