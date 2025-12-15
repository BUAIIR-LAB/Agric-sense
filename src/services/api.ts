import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { secureStorage } from '@/utils/secureStorage';
import { retryWithBackoff } from '@/utils/retry';

// API Configuration
// ============================================
// PRODUCTION API URL (Deployed Backend)
// ============================================
const PRODUCTION_API_URL = 'https://buairapp.onrender.com';

// Chat API URL (Separate service)
// ============================================
const CHAT_API_URL = 'https://unfrowardly-prostrative-aurelio.ngrok-free.dev';

// ============================================
// DEVELOPMENT SETTINGS
// ============================================
// Set to true to use deployed backend during development
// Set to false to use local backend (requires local server running)
const USE_PRODUCTION_IN_DEV = true;

// Local development settings (only used if USE_PRODUCTION_IN_DEV = false)
const PHYSICAL_DEVICE_IP = '10.10.162.85'; // Your computer's IP address for local testing
const USE_PHYSICAL_DEVICE = false; // Set to true if testing on physical device with local backend

// Get the correct base URL based on environment
const getApiBaseUrl = (): string => {
  // Production mode - always use deployed backend
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }
  
  // Development mode
  if (USE_PRODUCTION_IN_DEV) {
    // Use deployed backend (recommended for testing)
    return PRODUCTION_API_URL;
  }
  
  // Use local development backend
  if (USE_PHYSICAL_DEVICE) {
    // Use computer's IP address for physical devices
    return `http://${PHYSICAL_DEVICE_IP}:8000`;
  } else {
    // Use localhost/emulator addresses for simulators/emulators
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      return 'http://10.0.2.2:8000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      return 'http://localhost:8000';
    } else {
      // Web or other platforms
      return 'http://localhost:8000';
    }
  }
};

const API_BASE_URL = getApiBaseUrl();

// Log the API URL for debugging
if (__DEV__) {
  console.log('🌐 API Configuration:');
  console.log('   Base URL:', API_BASE_URL);
  console.log('   Platform:', Platform.OS);
  console.log('   Using Production:', USE_PRODUCTION_IN_DEV || !__DEV__);
  console.log('   Using Physical Device:', USE_PHYSICAL_DEVICE);
}

const TOKEN_KEY = 'auth_token';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear token
      if (__DEV__) {
        console.warn('Authentication failed (401). Clearing token.');
      }
      await secureStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

// Types matching backend schemas
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UserCreate {
  name: string;
  phone_number: string;
  password: string;
  area: string;
  preferred_language?: string;
  crops_grown?: string[];
  gps_location?: Coordinates;
}

export interface UserLogin {
  phone_number: string;
  password?: string; // Optional - login works with phone number only
}

export interface UserUpdate {
  name?: string;
  area?: string;
  preferred_language?: string;
  crops_grown?: string[];
  gps_location?: Coordinates;
}

export interface UserResponse {
  id: string;
  name: string;
  phone_number: string;
  area: string;
  preferred_language: string;
  crops_grown: string[];
  gps_latitude?: number;
  gps_longitude?: number;
  created_at: string;
  updated_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface DiagnosisCreate {
  image_uri?: string;
  suspected_issues: string[];
  confidence: number;
  summary: string;
  recommendations: string[];
  follow_up_question?: string;
  follow_up_response?: string;
}

export interface DiagnosisResponse {
  id: string;
  image_uri?: string;
  suspected_issues: string[];
  confidence: number;
  summary: string;
  recommendations: string[];
  follow_up_question?: string;
  follow_up_response?: string;
  timestamp: string;
  user_id: string;
}

export interface SpectrumPoint {
  wavelength: number;
  intensity: number;
}

export interface SpectroscopyCreate {
  sample_name: string;
  spectrum: SpectrumPoint[];
  summary: string;
  insights: string[];
}

export interface SpectroscopyResponse {
  id: string;
  sample_name: string;
  spectrum: SpectrumPoint[];
  summary: string;
  insights: string[];
  timestamp: string;
  user_id: string;
}

export interface TimelineEvent {
  id: string;
  record_id: string;
  timestamp: string;
  type: string;
  title: string;
  content: string;
  meta: string;
}

export interface HistoryStats {
  total_diagnoses: number;
  total_spectroscopy: number;
  latest_diagnosis_date?: string;
  latest_spectroscopy_date?: string;
}

export interface MessageResponse {
  message: string;
}

// Chat API Types
export interface ChatConversation {
  conversation_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessageResponse {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modality?: 'text' | 'voice';
}

export interface AskRequest {
  prompt: string;
  user_id: string;
  target_lang: string;
  conversation_id?: string;
  user_profile?: Record<string, any>;
}

export interface AskResponse {
  conversation_id: string;
  results: string;
  intent?: string;
}

export interface VoiceQuestionRequest {
  voice_note: any; // File/Blob for multipart/form-data
  user_id: string;
  conversation_id?: string;
  target_lang?: string;
  user_profile?: string; // JSON string
}

export interface VoiceQuestionResponse {
  conversation_id: string;
  transcription: string;
  results: string;
  input_audio_url?: string;
  output_audio_url?: string;
}

export interface ConversationsResponse {
  conversations: string[];
}

// API Service Functions
export const apiService = {
  // Token management (using secure storage)
  async saveToken(token: string): Promise<void> {
    await secureStorage.setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await secureStorage.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await secureStorage.removeItem(TOKEN_KEY);
  },

  // Authentication (with retry logic)
  async register(userData: UserCreate): Promise<UserResponse> {
    return retryWithBackoff(async () => {
      const response = await api.post<UserResponse>('/register', userData);
      return response.data;
    });
  },

  async login(loginData: UserLogin): Promise<TokenResponse> {
    // Create a separate axios instance with appropriate timeout for login
    // Render.com free tier can take 30-60 seconds to wake up from sleep
    const loginApi = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60 seconds timeout (Render.com cold start can take time)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Health check to wake up server if it's sleeping (Render.com cold start)
    // Wait longer for the server to wake up
    try {
      console.log('🔍 Checking backend health...');
      await axios.get(`${API_BASE_URL}/`, { timeout: 10000 }); // 10 seconds for health check
      console.log('✅ Backend is reachable');
    } catch (healthError: any) {
      console.warn('⚠️ Backend health check failed, server may be waking up...');
      console.warn('   This is normal for Render.com free tier (cold start takes 30-60 seconds)');
      // Wait a bit longer for server to wake up before attempting login
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    return retryWithBackoff(
      async () => {
        // Only send phone_number, password is optional
        const payload: UserLogin = {
          phone_number: loginData.phone_number,
        };
        // Include password only if provided
        if (loginData.password) {
          payload.password = loginData.password;
        }
        
        console.log('🔐 Login request:', { phone_number: loginData.phone_number });
        const startTime = Date.now();
        const response = await loginApi.post<TokenResponse>('/login', payload);
        const elapsed = Date.now() - startTime;
        console.log(`✅ Login successful (${elapsed}ms)`);
        await this.saveToken(response.data.access_token);
        return response.data;
      },
      {
        maxRetries: 2, // 2 retries (total 3 attempts) - Render.com may need multiple attempts
        initialDelay: 3000, // 3 seconds delay before first retry (give server time to wake up)
        maxDelay: 5000, // Max 5 seconds delay between retries
      }
    );
  },

  // User Profile
  async getCurrentUser(): Promise<UserResponse> {
    // Use retry logic for profile loading (backend might be slow on cold start)
    return retryWithBackoff(
      async () => {
        console.log('👤 Fetching user profile...');
        const startTime = Date.now();
        const response = await api.get<UserResponse>('/me');
        const elapsed = Date.now() - startTime;
        console.log(`✅ Profile loaded successfully (${elapsed}ms)`);
        return response.data;
      },
      {
        maxRetries: 2, // 2 retries (total 3 attempts)
        initialDelay: 1000, // 1 second delay before first retry
        maxDelay: 3000, // Max 3 seconds delay
      }
    );
  },

  async updateProfile(updates: UserUpdate): Promise<UserResponse> {
    const response = await api.patch<UserResponse>('/me', updates);
    return response.data;
  },

  // Diagnosis
  async diagnoseFromImage(imageBase64: string): Promise<DiagnosisResponse> {
    console.log('🌐 API Call - diagnoseFromImage:');
    console.log('   URL:', `${API_BASE_URL}/diagnosis/image`);
    console.log('   Image size:', imageBase64.length, 'chars (base64)');
    console.log('   Approx size:', Math.round((imageBase64.length * 3) / 4 / 1024), 'KB');
    
    // Quick non-blocking health check (don't wait if it fails)
    const healthCheckPromise = axios.get(`${API_BASE_URL}/`, { timeout: 3000 })
      .then(() => {
        console.log('✅ Backend is reachable');
      })
      .catch((healthError: any) => {
        console.warn('⚠️ Backend health check failed (continuing anyway):', healthError.message);
      });
    
    // Don't wait for health check - start diagnosis immediately
    // Health check will run in background
    
    try {
      console.log('📤 Sending diagnosis request...');
      const overallStartTime = Date.now();
      
      // Create a separate axios instance with longer timeout for diagnosis
      // Diagnosis can take time due to ML model inference + LLM recommendations
      const diagnosisApi = axios.create({
        baseURL: API_BASE_URL,
        timeout: 180000, // 3 minutes timeout (ML inference + LLM can take time)
        headers: {
          'Content-Type': 'application/json',
        },
        maxContentLength: 50 * 1024 * 1024, // 50MB max content length
        maxBodyLength: 50 * 1024 * 1024, // 50MB max body length
      });

      // Add auth token to request
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (token) {
        diagnosisApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      // Add progress logging (logs every 10 seconds to show it's still working)
      let progressInterval: ReturnType<typeof setInterval> | null = null;
      const startProgressLogging = () => {
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - overallStartTime;
          if (elapsed > 10000) { // Only log after 10 seconds
            console.log(`⏳ Still processing... (${Math.round(elapsed / 1000)}s elapsed)`);
          }
        }, 10000); // Log every 10 seconds
      };

      // Retry logic for network errors (up to 2 retries)
      let lastError: any = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            const elapsed = Date.now() - overallStartTime;
            console.log(`🔄 Retry attempt ${attempt} (${elapsed}ms elapsed)...`);
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          } else {
            console.log('📤 Sending diagnosis request (attempt 1)...');
            // Start progress logging on first attempt
            startProgressLogging();
          }
          
          const requestStartTime = Date.now();
          const response = await diagnosisApi.post<DiagnosisResponse>('/diagnosis/image', {
            image_base64: imageBase64,
          });
          const requestTime = Date.now() - requestStartTime;
          
          if (progressInterval) {
            clearInterval(progressInterval);
          }
          const totalTime = Date.now() - overallStartTime;
          console.log(`✅ Diagnosis successful (${requestTime}ms request, ${totalTime}ms total):`);
          console.log('   Diagnosis ID:', response.data.id);
          console.log('   Top issue:', response.data.suspected_issues[0]);
          console.log('   Confidence:', Math.round(response.data.confidence * 100) + '%');
          
          return response.data;
        } catch (attemptError: any) {
          lastError = attemptError;
          if (progressInterval) {
            clearInterval(progressInterval);
          }
          
          const elapsed = Date.now() - overallStartTime;
          console.error(`❌ Attempt ${attempt + 1} failed after ${elapsed}ms:`, attemptError.message);
          
          // Don't retry on client errors (4xx) except 408 (timeout)
          if (attemptError.response?.status >= 400 && attemptError.response?.status < 500 && attemptError.response?.status !== 408) {
            break;
          }
          
          // Don't retry on server errors (5xx) except 503 (service unavailable) and 504 (gateway timeout)
          if (attemptError.response?.status >= 500 && 
              attemptError.response?.status !== 503 && 
              attemptError.response?.status !== 504) {
            break;
          }
          
          // Retry on network errors or timeouts
          if (attemptError.message === 'Network Error' || 
              attemptError.code === 'ERR_NETWORK' ||
              attemptError.code === 'ECONNABORTED' ||
              attemptError.response?.status === 408 ||
              attemptError.response?.status === 503 ||
              attemptError.response?.status === 504) {
            if (attempt < 2) {
              continue; // Retry
            }
          } else {
            break; // Don't retry for other errors
          }
        }
      }
      
      // If we get here, all retries failed
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      throw lastError;
      
    } catch (error: any) {
      console.error('❌ API Error - diagnoseFromImage:');
      console.error('   URL:', `${API_BASE_URL}/diagnosis/image`);
      console.error('   Error:', error.message);
      console.error('   Error Code:', error.code);
      console.error('   Error Name:', error.name);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      } else if (error.request) {
        console.error('   Request made but no response received');
        console.error('   This usually means:');
        console.error('     - Backend server is down or unreachable');
        console.error('     - Network connectivity issue');
        console.error('     - Request timeout (image may be too large)');
        console.error('     - CORS issue');
        console.error('     - Render.com cold start (server spinning up)');
      }
      
      // Provide user-friendly error message
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Request timed out. The image may be too large or the server is taking too long to process. Please try again with a smaller image.');
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        throw new Error('Network error. The server may be starting up (this can take 30-60 seconds on free tier). Please wait a moment and try again.');
      } else if (error.response?.status === 503) {
        throw new Error('Service temporarily unavailable. The ML model may not be loaded or the server is starting up. Please try again in a moment.');
      } else if (error.response?.status === 413) {
        throw new Error('Image too large. Please use a smaller image (under 5MB).');
      } else if (error.response?.status === 500) {
        // Check if it's a Firestore size limit error
        const errorDetail = error.response?.data?.detail || '';
        if ('longer than' in errorDetail && 'bytes' in errorDetail) {
          throw new Error('Image is too large for storage. The image has been compressed, but it\'s still too large. Please try capturing a new image with lower quality.');
        } else if (errorDetail) {
          throw new Error(`Diagnosis failed: ${errorDetail}`);
        } else {
          throw new Error('Server error. Please try again with a smaller image.');
        }
      } else if (error.response?.status === 504) {
        throw new Error('Gateway timeout. The server took too long to respond. Please try again.');
      } else if (error.response?.data?.detail) {
        throw new Error(`Diagnosis failed: ${error.response.data.detail}`);
      }
      
      throw error;
    }
  },

  async createDiagnosis(diagnosis: DiagnosisCreate): Promise<DiagnosisResponse> {
    const response = await api.post<DiagnosisResponse>('/diagnosis', diagnosis);
    return response.data;
  },

  async getDiagnosisHistory(params?: {
    limit?: number;
    offset?: number;
    sort?: 'newest' | 'oldest';
  }): Promise<DiagnosisResponse[]> {
    const response = await api.get<DiagnosisResponse[]>('/diagnosis', { params });
    return response.data;
  },

  async getDiagnosis(diagnosisId: string): Promise<DiagnosisResponse> {
    const response = await api.get<DiagnosisResponse>(`/diagnosis/${diagnosisId}`);
    return response.data;
  },

  async deleteDiagnosis(diagnosisId: string): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/diagnosis/${diagnosisId}`);
    return response.data;
  },

  async clearDiagnosisHistory(): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>('/diagnosis');
    return response.data;
  },

  // Spectroscopy
  async createSpectroscopy(spectroscopy: SpectroscopyCreate): Promise<SpectroscopyResponse> {
    const response = await api.post<SpectroscopyResponse>('/spectroscopy', spectroscopy);
    return response.data;
  },

  async getSpectroscopyHistory(params?: {
    limit?: number;
    offset?: number;
    sort?: 'newest' | 'oldest';
  }): Promise<SpectroscopyResponse[]> {
    const response = await api.get<SpectroscopyResponse[]>('/spectroscopy', { params });
    return response.data;
  },

  async getSpectroscopy(spectroscopyId: string): Promise<SpectroscopyResponse> {
    const response = await api.get<SpectroscopyResponse>(`/spectroscopy/${spectroscopyId}`);
    return response.data;
  },

  async deleteSpectroscopy(spectroscopyId: string): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/spectroscopy/${spectroscopyId}`);
    return response.data;
  },

  async clearSpectroscopyHistory(): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>('/spectroscopy');
    return response.data;
  },

  // History
  async getTimeline(params?: {
    limit?: number;
    offset?: number;
    type?: 'diagnosis' | 'spectroscopy' | 'all';
  }): Promise<TimelineEvent[]> {
    const response = await api.get<TimelineEvent[]>('/history/timeline', { params });
    return response.data;
  },

  async getHistoryStats(): Promise<HistoryStats> {
    const response = await api.get<HistoryStats>('/history/stats');
    return response.data;
  },

  // Chat API (separate service)
  async getConversations(userId: string): Promise<any[]> {
    // Endpoint uses GET with query parameters
    const chatApi = axios.create({
      baseURL: CHAT_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    try {
      const response = await chatApi.get(`/get_conversations?user_id=${userId}`);
      
      // Response format: {"conversations": [{"id": "...", "created_at": "...", "updated_at": "...", "metadata": {...}, "message_count": ...}, ...]}
      const data = response.data;
      if (data.conversations) {
        return Array.isArray(data.conversations) ? data.conversations : [];
      }
      // If it's already an array, return it
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('❌ API Error - getConversations:');
      console.error('   URL:', `${CHAT_API_URL}/get_conversations?user_id=${userId}`);
      console.error('   Error:', error.message);
      console.error('   Response:', error.response?.data);
      throw error;
    }
  },

  async getConversationHistory(
    userId: string,
    conversationId: string,
    limit: number = 50
  ): Promise<ChatMessageResponse[]> {
    const chatApi = axios.create({
      baseURL: CHAT_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const response = await chatApi.get(
      `/conversation_history?user_id=${userId}&conversation_id=${conversationId}&limit=${limit}`
    );
    
    // Response format: {"conversation_id": "...", "user_id": "...", "metadata": {...}, "messages": [...]}
    let data = response.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return [];
      }
    }
    
    // Extract messages array from response
    if (data.messages && Array.isArray(data.messages)) {
      return data.messages;
    }
    
    // Fallback: if data is already an array, return it
    return Array.isArray(data) ? data : [];
  },

  async askQuestion(request: AskRequest): Promise<AskResponse> {
    const chatApi = axios.create({
      baseURL: CHAT_API_URL,
      timeout: 60000, // Longer timeout for AI responses
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    // Remove conversation_id if it's undefined or empty (for first message)
    const requestPayload: any = { ...request };
    if (!requestPayload.conversation_id) {
      delete requestPayload.conversation_id;
    }
    
    console.log('🌐 API Call - askQuestion:');
    console.log('   URL:', `${CHAT_API_URL}/ask`);
    console.log('   Payload:', JSON.stringify(requestPayload, null, 2));
    
    try {
      const response = await chatApi.post<AskResponse>('/ask', requestPayload);
      console.log('✅ API Response received:');
      console.log('   Conversation ID:', response.data.conversation_id);
      console.log('   Response length:', response.data.results?.length || 0);
      console.log('   Intent:', response.data.intent);
      // Response format: {"conversation_id": "...", "results": "...", "intent": "..."}
      // First response creates conversation_id, subsequent ones return existing one
      return response.data;
    } catch (error: any) {
      console.error('❌ API Error - askQuestion:');
      console.error('   URL:', `${CHAT_API_URL}/ask`);
      console.error('   Error:', error.message);
      console.error('   Response:', error.response?.data);
      console.error('   Status:', error.response?.status);
      throw error;
    }
  },

  async sendVoiceQuestion(
    voiceFile: any,
    userId: string,
    conversationId?: string,
    targetLang?: string,
    userProfile?: Record<string, any>
  ): Promise<VoiceQuestionResponse> {
    // React Native FormData format - ensure URI is correct
    const formData = new FormData();
    
    // Keep the original URI format - React Native FormData handles file:// correctly
    // Detect format from URI if type/name not provided
    let fileType = voiceFile.type || 'audio/m4a';
    let fileName = voiceFile.name || 'voice.m4a';
    
    // If type/name not provided, try to detect from URI
    if (!voiceFile.type || !voiceFile.name) {
      const uriLower = voiceFile.uri.toLowerCase();
      if (uriLower.includes('.wav') || uriLower.endsWith('.wav')) {
        fileType = 'audio/wav';
        fileName = voiceFile.name || 'voice.wav';
      } else if (uriLower.includes('.m4a') || uriLower.endsWith('.m4a')) {
        fileType = 'audio/m4a';
        fileName = voiceFile.name || 'voice.m4a';
      } else if (uriLower.includes('.mp3') || uriLower.endsWith('.mp3')) {
        fileType = 'audio/mp3';
        fileName = voiceFile.name || 'voice.mp3';
      }
    }
    
    const fileData = {
      uri: voiceFile.uri,
      type: fileType,
      name: fileName,
    };
    
    formData.append('voice_note', fileData as any);
    formData.append('user_id', userId);
    
    // Only append conversation_id if it exists (for continuing conversations)
    // First voice message won't have conversation_id, API will create one
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (targetLang) {
      formData.append('target_lang', targetLang);
    }
    if (userProfile) {
      formData.append('user_profile', JSON.stringify(userProfile));
    }

    console.log('🌐 API Call - sendVoiceQuestion:');
    console.log('   URL:', `${CHAT_API_URL}/voicequestion`);
    console.log('   User ID:', userId);
    console.log('   Conversation ID:', conversationId || 'NEW');
    console.log('   Target Lang:', targetLang);
    console.log('   File URI:', voiceFile.uri);
    console.log('   File Type:', fileData.type);
    console.log('   File Name:', fileData.name);
    
    try {
      // Use native fetch API instead of axios for FormData uploads
      // React Native's fetch handles FormData correctly with multipart/form-data
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      const response = await fetch(`${CHAT_API_URL}/voicequestion`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          // Don't set Content-Type - fetch will set it automatically with boundary for FormData
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data: VoiceQuestionResponse = await response.json();
      
      // Handle cases where transcription might be missing (API error)
      if (!data.transcription && data.results) {
        // If transcription is missing but we have results, use a fallback
        console.warn('⚠️ Transcription missing in API response, using fallback');
        data.transcription = 'Voice message';
      }
      
      // Validate required fields
      if (!data.conversation_id) {
        throw new Error('API response missing conversation_id');
      }
      
      if (!data.results) {
        throw new Error('API response missing results');
      }
      
      console.log('✅ API Response received:');
      console.log('   Conversation ID:', data.conversation_id);
      console.log('   Transcription:', data.transcription || 'N/A');
      console.log('   Response length:', data.results?.length || 0);
      // Response format: {"conversation_id": "...", "transcription": "...", "results": "...", "input_audio_url": "...", "output_audio_url": "..."}
      return data;
    } catch (error: any) {
      console.error('❌ API Error - sendVoiceQuestion:');
      console.error('   URL:', `${CHAT_API_URL}/voicequestion`);
      console.error('   Error Message:', error.message);
      console.error('   Error Name:', error.name);
      if (error.name === 'AbortError') {
        console.error('   Request timed out after 5 minutes');
      }
      throw error;
    }
  },
};

export default apiService;

