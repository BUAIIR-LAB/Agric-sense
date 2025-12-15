import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService, { type UserResponse, type DiagnosisResponse, type SpectroscopyResponse } from '@/services/api';

export const SUPPORTED_LANGUAGES = [
  'English',
  'Luganda',
  'Ateso',
  'Japadhola',
  'Swahili',
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
  // Registration & Authentication
  completeRegistration: (profile: FarmerProfile) => void;
  registerWithAPI: (userData: { name: string; phone_number: string; password: string; area: string; preferred_language?: string; crops_grown?: string[]; gps_location?: Coordinates }) => Promise<boolean>;
  authenticate: (phoneNumber: string) => boolean;
  loginWithAPI: (phoneNumber: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  // Profile
  updateProfile: (updates: Partial<FarmerProfile>) => void;
  updateProfileWithAPI: (updates: Partial<FarmerProfile>) => Promise<boolean>;
  loadUserProfile: () => Promise<void>;
  // Chat (local only for now)
  addChatMessages: (messages: NewChatMessage[]) => void;
  clearChatHistory: () => void;
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
  loadHistoryStats: () => Promise<void>;
  // Reset
  resetAll: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Props = {
  children: ReactNode;
};

export const AppProvider = ({ children }: Props) => {
  const [state, setState] = useState<AppState>(baseState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Define persist and updateState first, as they're used by other functions
  const persist = useCallback((next: AppState) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) =>
      console.warn('Failed to persist application state', error),
    );
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
        let parsed: AppState | null = null;
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          parsed = JSON.parse(stored) as AppState;
          setState((prev) => ({
            ...prev,
            ...parsed,
            chatHistory: parsed.chatHistory ?? [],
            diagnosisHistory: parsed.diagnosisHistory ?? [],
            spectroscopyHistory: parsed.spectroscopyHistory ?? [],
            createdAt: parsed.createdAt ?? prev.createdAt,
          }));
        }
        
        // Check if user has a valid token and restore authentication
        // This ensures users stay logged in when they reopen the app
        const token = await apiService.getToken();
        if (token) {
          console.log('🔐 Token found on startup, restoring authentication...');
          // If we have a token, try to load profile to verify it's still valid
          try {
            await loadUserProfile();
            console.log('✅ Authentication restored successfully');
          } catch (error: any) {
            console.warn('⚠️ Failed to restore authentication:', error.message);
            // If token is invalid (401), clear it and mark as unauthenticated
            if (error?.response?.status === 401) {
              console.log('🔐 Token is invalid, clearing...');
              await apiService.removeToken();
              setState((prev) => ({
                ...prev,
                isAuthenticated: false,
                profile: undefined,
              }));
            } else {
              // For other errors (network, etc.), keep the token but don't set authenticated
              // User can try again later
              console.warn('⚠️ Could not verify token, but keeping it for retry');
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
      } catch (error) {
        console.warn('Failed to restore application state', error);
      } finally {
        setIsHydrated(true);
      }
    };

    hydrate();
  }, [loadUserProfile]);

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

  const authenticate = useCallback(
    (phoneNumber: string) => {
      if (!state.profile) {
        return false;
      }
      const matches = state.profile.phoneNumber.trim() === phoneNumber.trim();
      if (matches) {
        updateState((prev) => ({
          ...prev,
          isAuthenticated: true,
        }));
      }
      return matches;
    },
    [state.profile, updateState],
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
          id: message.id ?? createId(),
          timestamp: message.timestamp ?? new Date().toISOString(),
          ...message,
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

  const addDiagnosisRecord = useCallback(
    (record: NewDiagnosisRecord) => {
      updateState((prev) => ({
        ...prev,
        diagnosisHistory: [
          {
            id: record.id ?? createId(),
            timestamp: record.timestamp ?? new Date().toISOString(),
            ...record,
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
            id: record.id ?? createId(),
            timestamp: record.timestamp ?? new Date().toISOString(),
            ...record,
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
      
      // Convert API response to FarmerProfile
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
        createdAt: response.created_at,
        updatedAt: response.updated_at,
      };
      
      completeRegistration(profile);
      return true;
    } catch (error: any) {
      console.error('Registration failed:', error);
      // Error handling is done in the component with sweet alerts
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [completeRegistration]);

  const loginWithAPI = useCallback(async (phoneNumber: string, password?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      if (__DEV__) {
        console.log('Logging in with phone number (length):', phoneNumber.length);
      }
      const tokenResponse = await apiService.login({ phone_number: phoneNumber, password });
      if (__DEV__) {
        console.log('Login successful, token received:', !!tokenResponse.access_token);
      }
      
      // Verify token was saved
      const savedToken = await apiService.getToken();
      if (savedToken) {
        if (__DEV__) {
          console.log('✅ Token successfully saved to storage');
        }
      } else {
        if (__DEV__) {
          console.error('❌ WARNING: Token was not saved to storage!');
        }
      }
      
      // Load user profile after login
      // Don't fail login if profile loading fails - user is already authenticated
      try {
        await loadUserProfile();
        console.log('✅ User profile loaded after login');
      } catch (profileError: any) {
        console.warn('⚠️ Failed to load profile after login, but login was successful:', profileError.message);
        // User is still authenticated (token is saved), profile can be loaded later
        // Set authenticated state even if profile load fails
        updateState((prev) => ({
          ...prev,
          isAuthenticated: true,
        }));
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      console.error('   Error message:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error response:', error.response?.status, error.response?.data);
      
      // Provide more helpful error information
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.error('   💡 Tip: Backend may be waking up (Render.com free tier). Please wait 30-60 seconds and try again.');
      }
      
      // Error handling is done in the component with sweet alerts
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile, updateState]);

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
      
      const response = await apiService.updateProfile(apiUpdates);
      const profile: FarmerProfile = {
        name: response.name,
        phoneNumber: response.phone_number,
        area: response.area,
        preferredLanguage: (response.preferred_language as LanguageOption) || 'English',
        cropsGrown: response.crops_grown || [],
        gpsLocation: response.gps_latitude && response.gps_longitude
          ? { latitude: response.gps_latitude, longitude: response.gps_longitude }
          : undefined,
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
      const response = await apiService.createDiagnosis({
        image_uri: diagnosis.imageUri,
        suspected_issues: diagnosis.suspectedIssues,
        confidence: diagnosis.confidence,
        summary: diagnosis.summary,
        recommendations: diagnosis.recommendations,
        follow_up_question: diagnosis.followUpQuestion,
        follow_up_response: diagnosis.followUpResponse,
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
      // Check if user has a token before making API call
      const token = await apiService.getToken();
      if (!token) {
        console.warn('⚠️ No authentication token found. Skipping API load.');
        return;
      }

      console.log('📥 Loading diagnosis history from API...');
      const records = await apiService.getDiagnosisHistory({ limit: 100, sort: 'newest' });
      console.log(`✅ Loaded ${records.length} diagnosis records from API`);
      const diagnosisHistory: (DiagnosisRecord & { image_base64?: string })[] = records.map((r) => ({
        id: r.id,
        imageUri: r.image_uri,
        image_base64: r.image_base64, // Include base64 image from API
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
        // Server error - log but don't show error to user, continue with local data
        console.warn('Server error loading diagnosis history. Using local data only.');
      } else {
        // Other errors - log but continue with local data
        console.warn('Error loading diagnosis history. Using local data only.');
      }
      // Don't throw error - allow app to continue with local data
    }
  }, [updateState]);

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
        // Server error - log but don't show error to user, continue with local data
        console.warn('Server error loading spectroscopy history. Using local data only.');
      } else {
        // Other errors - log but continue with local data
        console.warn('Error loading spectroscopy history. Using local data only.');
      }
      // Don't throw error - allow app to continue with local data
    }
  }, [updateState]);

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
    apiService.removeToken();
  }, [persist]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      isHydrated,
      isLoading,
      completeRegistration,
      registerWithAPI,
      authenticate,
      loginWithAPI,
      logout,
      updateProfile,
      updateProfileWithAPI,
      loadUserProfile,
      addChatMessages,
      clearChatHistory,
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
      loadHistoryStats,
      resetAll,
    }),
    [
      state,
      isHydrated,
      isLoading,
      completeRegistration,
      registerWithAPI,
      authenticate,
      loginWithAPI,
      logout,
      updateProfile,
      updateProfileWithAPI,
      loadUserProfile,
      addChatMessages,
      clearChatHistory,
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
