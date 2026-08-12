import axios, { AxiosInstance, AxiosError } from 'axios';
import { secureStorage } from '@/utils/secureStorage';
import { retryWithBackoff } from '@/utils/retry';
import { env } from '@/config/env';

const API_BASE_URL = env.apiUrl;
const CHAT_API_URL = env.chatApiUrl;

if (__DEV__) {
  console.log('🌐 API Configuration:');
  console.log('   Base URL:', API_BASE_URL);
  console.log('   Chat URL:', CHAT_API_URL);
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

    // Add custom helper for network errors
    if (!error.response) {
      (error as any).isNetworkError = true;
      (error as any).userMessage = 'No internet connection. Please check your network.';
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      (error as any).isTimeout = true;
      (error as any).userMessage = 'The request timed out. The server might be busy.';
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
  // New backend fields (v1)
  gender?: string;
  age_bracket?: string;
}

export interface UserLogin {
  identifier: string;
  password: string;
}

export interface UserUpdate {
  name?: string;
  phone?: string;
  /** Prefer `area` — matches Agrobackend UserUpdate */
  area?: string;
  location?: string;
  preferred_language?: string;
  language?: string;
  crops_grown?: string[];
  gps_location?: Coordinates;
  profile_complete?: boolean;
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
  profile_complete?: boolean;
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
  target_lang?: string;
}

export interface DiagnosisResponse {
  id: string;
  image_uri?: string;
  image_base64?: string;
  suspected_issues: string[];
  confidence: number;
  summary: string;
  recommendations: string[];
  follow_up_question?: string;
  follow_up_response?: string;
  timestamp: string;
  user_id: string;
  // Pipeline outcome. Older backends omit these; treat missing status as "ok".
  status?: 'ok' | 'rejected';
  rejection_reason?: 'no_leaf' | 'low_confidence' | 'unsupported_crop' | 'model_unavailable' | string | null;
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
  audio_content?: string;
  audio_url?: string;
  sender_type?: string;
  source?: string;
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
  audio_content?: string;
  speaker_id?: string;
  tts_text?: string;
  tts_url?: string;
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
  audio_content?: string;
  speaker_id?: string;
  tts_text?: string;
  tts_url?: string;
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
      // Map frontend UserCreate to backend v1 Register fields
      const payload = {
        name: userData.name,
        password: userData.password,
        phone_number: userData.phone_number,
        area: userData.area,
        preferred_language: userData.preferred_language || "English",
        gender: userData.gender || "Prefer not to say",
        age_bracket: userData.age_bracket || "25-34",
        crops_grown: userData.crops_grown,
        gps_location: userData.gps_location,
        profile_complete: true,
      };

      console.log('📝 Registering user:', { name: payload.name, phone_number: payload.phone_number });
      const response = await api.post<UserResponse>('/register', payload);
      return response.data;
    });
  },

  async login(loginData: UserLogin): Promise<TokenResponse> {
    const loginApi = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return retryWithBackoff(
      async () => {
        if (!loginData.password?.trim()) {
          throw new Error('Password is required');
        }

        const payload = {
          phone_number: loginData.identifier,
          password: loginData.password,
        };

        if (__DEV__) {
          console.log('🔐 Login request:', { phone_number: payload.phone_number });
        }
        const startTime = Date.now();
        const response = await loginApi.post<TokenResponse>('/login', payload);
        if (__DEV__) {
          console.log(`✅ Login successful (${Date.now() - startTime}ms)`);
        }
        await this.saveToken(response.data.access_token);
        return response.data;
      },
      {
        maxRetries: 1,
        initialDelay: 500,
        maxDelay: 1500,
        retryableErrors: (error) => {
          if (!error.response) return true;
          const status = error.response.status;
          return status === 408 || status === 503 || status === 504;
        },
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
        const response = await api.get<any>('/me');
        const elapsed = Date.now() - startTime;
        console.log(`✅ Profile loaded successfully (${elapsed}ms)`);

        // Map backend v1 fields back to frontend UserResponse fields
        const data = response.data;
        return {
          ...data,
          phone_number: data.phone || data.phone_number,
          area: data.location || data.area,
          preferred_language: data.language || data.preferred_language,
          profile_complete: data.profile_complete,
        } as UserResponse;
      },
      {
        maxRetries: 2, // 2 retries (total 3 attempts)
        initialDelay: 1000, // 1 second delay before first retry
        maxDelay: 3000, // Max 3 seconds delay
      }
    );
  },

  async updateProfile(updates: UserUpdate): Promise<UserResponse> {
    const payload: Record<string, unknown> = {};
    if (updates.name) payload.name = updates.name;
    if (updates.area || updates.location) payload.area = updates.area || updates.location;
    if (updates.preferred_language || updates.language) {
      payload.preferred_language = updates.preferred_language || updates.language;
    }
    if (updates.crops_grown) payload.crops_grown = updates.crops_grown;
    if (updates.gps_location) payload.gps_location = updates.gps_location;
    if (updates.profile_complete != null) payload.profile_complete = updates.profile_complete;

    const response = await api.patch<UserResponse>('/me', payload);
    const data = response.data;
    return {
      ...data,
      phone_number: (data as any).phone || data.phone_number,
      area: (data as any).location || data.area,
      preferred_language: (data as any).language || data.preferred_language,
      profile_complete: data.profile_complete,
    };
  },

  // Diagnosis
  async diagnoseFromImage(imageBase64: string, targetLang?: string, cropType?: string): Promise<DiagnosisResponse> {
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
            target_lang: targetLang,
            crop_type: cropType,
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

  // Spectral Analysis Endpoints
  async analyzeSpectralOnly(
    spectralData: number[],
    weekRange: string,
    plantType: string
  ): Promise<{
    predicted_class: string;
    disease_name: string;
    confidence: number;
  }> {
    console.log('🔬 API Call - analyzeSpectralOnly:');
    console.log('   URL:', `${API_BASE_URL}/spectral/analyze`);
    console.log('   Plant Type:', plantType);
    console.log('   Week Range:', weekRange);
    console.log('   Spectral Data Length:', spectralData.length);

    const response = await api.post('/spectral/analyze', {
      spectral_data: spectralData,
      week_range: weekRange,
      plant_type: plantType,
    });
    return response.data;
  },

  async analyzeSpectralWithImage(
    spectralData: number[],
    weekRange: string,
    plantType: string,
    imageBase64: string
  ): Promise<{
    predicted_class: string;
    disease_name: string;
    confidence: number;
  }> {
    console.log('🔬 API Call - analyzeSpectralWithImage:');
    console.log('   URL:', `${API_BASE_URL}/spectral/analyze-with-image`);
    console.log('   Plant Type:', plantType);
    console.log('   Week Range:', weekRange);
    console.log('   Spectral Data Length:', spectralData.length);
    console.log('   Image Base64 Length:', imageBase64.length);

    const response = await api.post('/spectral/analyze-with-image', {
      spectral_data: spectralData,
      week_range: weekRange,
      plant_type: plantType,
      image_base64: imageBase64,
    });
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
  ): Promise<{ conversation_id: string; messages: ChatMessageResponse[] }> {
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
        return { conversation_id: conversationId, messages: [] };
      }
    }

    // Extract messages array from response
    if (data.messages && Array.isArray(data.messages)) {
      return {
        conversation_id: data.conversation_id || conversationId,
        messages: data.messages
      };
    }
    return { conversation_id: conversationId, messages: [] };
// Fallback: if data is already an array, return it
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
      console.log('   Audio content:', response.data.audio_content ? `Present (${response.data.audio_content.length} chars)` : 'Missing');
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
    // Initialize with defaults, will be refined by URI detection if possible
    let fileType = voiceFile.type || 'audio/wav';
    let fileName = voiceFile.name || 'voice.wav';

    // Refine type/name based on URI
    const uriLower = voiceFile.uri.toLowerCase();
    if (uriLower.endsWith('.wav')) {
      fileType = 'audio/wav';
      fileName = voiceFile.name || 'voice.wav';
    } else if (uriLower.endsWith('.m4a') || uriLower.endsWith('.mp4')) {
      fileType = 'audio/mp4'; // Standard MIME type for .m4a (MP4 container with AAC audio)
      fileName = voiceFile.name || 'voice.m4a';
    } else if (uriLower.endsWith('.mp3')) {
      fileType = 'audio/mpeg';
      fileName = voiceFile.name || 'voice.mp3';
    } else if (uriLower.endsWith('.3gp')) {
      fileType = 'audio/3gpp';
      fileName = voiceFile.name || 'voice.3gp';
    }

    const fileData = {
      uri: voiceFile.uri,
      type: fileType,
      name: fileName,
    };

    formData.append('voice_note', fileData as any);
    formData.append('user_id', userId);

    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (targetLang) {
      formData.append('target_lang', targetLang);
      formData.append('language', targetLang); // Alias
    }
    if (userProfile) {
      formData.append('user_profile', JSON.stringify(userProfile));
    }

    console.log('🌐 API Call - sendVoiceQuestion:');
    console.log('   URL:', `${CHAT_API_URL}/voicequestion`);
    console.log('   User ID:', userId);
    console.log('   Conversation ID:', conversationId || 'NEW');
    console.log('   Target Lang:', targetLang);
    console.log('   File Type:', fileData.type);
    console.log('   File Name:', fileData.name);

    // Use axios for consistency with askQuestion and better FormData handling in some environments
    const chatApi = axios.create({
      baseURL: CHAT_API_URL,
      timeout: 300000, // 5 minute timeout for transcription and AI response
      headers: {
        'Content-Type': 'multipart/form-data',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    try {
      const response = await chatApi.post<VoiceQuestionResponse>('/voicequestion', formData);
      const data = response.data;

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
      console.log('   Audio content:', data.audio_content ? `Present (${data.audio_content.length} chars)` : 'Missing');
      return data;
    } catch (error: any) {
      console.error('❌ API Error - sendVoiceQuestion:');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data));
      }
      console.error('   URL:', `${CHAT_API_URL}/voicequestion`);
      console.error('   Error Message:', error.message);
      console.error('   Error Name:', error.name);
      if (error.name === 'AbortError') {
        console.error('   Request timed out after 5 minutes');
      }
      throw error;
    }
  },

  /**
   * Standardizes error extraction from backend responses.
   * Handles:
   * 1. Direct "detail" string (400, 401, 404)
   * 2. FastAPI "detail" array of validation errors (422)
   * 3. Network/Timeout user-friendly fallbacks
   */
  extractErrorMessage(error: any): string {
    if (!error) return 'An unexpected error occurred.';

    // 1. Manually injected userMessage from interceptor
    if (error.userMessage) return error.userMessage;

    // 2. Handle Axios response errors
    if (error.response?.data) {
      const data = error.response.data;
      
      // Handle the common { "detail": "message" }
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      
      // Handle FastAPI's JSON validation error list [{ "loc": [...], "msg": "..." }]
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((err: any) => {
            const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
            // Capitalize field name and clean up msg
            const fieldName = String(field).replace(/_/g, ' ').charAt(0).toUpperCase() + String(field).slice(1);
            return `${fieldName}: ${err.msg}`;
          })
          .join('. ');
      }
      
      // General message field
      if (data.message) return data.message;
    }

    // 3. Network/Timeout fallbacks
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      return 'Internet connection lost. Please check your network.';
    }

    // Final fallback
    return error.message || 'Something went wrong. Please try again.';
  },

  /** Marketplace — uses same env.apiUrl / Bearer auth as diagnosis */
  async getMarketplaceListings(kind?: 'produce' | 'input') {
    const params: Record<string, string | number> = { limit: 200 };
    if (kind) params.kind = kind;
    const { data } = await api.get('/market/products', { params });
    const items = Array.isArray(data?.items) ? data.items : [];
    return { items, source: 'api' as const, total: data?.total ?? items.length };
  },

  async getMarketplaceProduct(productId: string) {
    const { data } = await api.get(`/market/products/${productId}`);
    return data;
  },

  async createMarketplaceListing(payload: {
    kind?: 'produce' | 'input';
    title: string;
    category: string;
    description?: string;
    price_ugx: number;
    compare_at_price_ugx?: number;
    discount_percent?: number;
    unit?: string;
    stock?: number;
    min_order_qty?: number;
    images_base64?: string[];
    location?: string;
    quality?: string;
    sale_channel?: string;
    vat_mode?: string;
    organic?: boolean;
    delivery_available?: boolean;
    delivery_mode?: 'free' | 'paid';
    delivery_period?: '24_hours' | '3_days' | '1_week';
    harvest_date?: string;
    brand?: string;
    contact_phone?: string;
    produce_kind?: string;
    product_name?: string;
    badge?: string;
  }) {
    const { data } = await api.post('/market/products', {
      kind: payload.kind ?? 'produce',
      ...payload,
    });
    return { ok: true as const, id: data.id as string, product: data, source: 'api' as const };
  },

  async uploadMarketplaceImages(images_base64: string[]) {
    const { data } = await api.post('/market/products/images', { images_base64 });
    return data as { image_ids: string[]; images_base64: string[] };
  },

  async createMarketplaceQuote(items: Array<{ product_id: string; quantity: number }>) {
    const { data } = await api.post('/market/checkout/quote', { items });
    return data as {
      quote_id: string;
      subtotal_ugx: number;
      delivery_ugx: number;
      platform_fee_ugx: number;
      total_ugx: number;
      alerts: string[];
    };
  },

  async chargeMarketplacePayment(payload: {
    amount_ugx: number;
    method: 'mtn' | 'airtel' | 'card';
    phone?: string;
    card?: Record<string, string>;
    quote_id?: string;
  }) {
    const { data } = await api.post('/market/payments/charge', payload);
    return data as {
      ok: boolean;
      payment_ref: string;
      tracking_id: string;
      merchant_reference: string;
      method: string;
      pay_on_delivery: boolean;
    };
  },

  async createMarketplaceOrder(payload: {
    items: Array<{ product_id: string; quantity: number }>;
    delivery_address: string;
    district: string;
    payment_method: 'mtn' | 'airtel' | 'card' | 'cash';
    payment_ref: string;
    quote_id?: string;
    payment_tracking_id?: string;
    merchant_reference?: string;
    customer_name?: string;
    customer_phone?: string;
  }) {
    const { data } = await api.post('/market/orders', payload);
    return data;
  },

  async getMarketplaceOrders() {
    const { data } = await api.get('/market/orders');
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      source: 'api' as const,
    };
  },

  async getMarketplaceOrder(orderId: string) {
    const { data } = await api.get(`/market/orders/${orderId}`);
    return data;
  },

  async getSellerEarnings() {
    const { data } = await api.get('/market/seller/earnings');
    return {
      availableUgx: Number(data?.available_ugx ?? 0),
      pendingUgx: Number(data?.pending_ugx ?? 0),
      paidUgx: Number(data?.paid_ugx ?? 0),
      recent: Array.isArray(data?.recent) ? data.recent : [],
      source: 'api' as const,
    };
  },

  async submitMarketplaceInquiry(payload: {
    product_id: string;
    type?: 'buy' | 'quote';
    message?: string;
  }) {
    const { data } = await api.post('/market/inquiries', {
      product_id: payload.product_id,
      type: payload.type ?? 'buy',
      message: payload.message,
    });
    return { ok: true as const, inquiry: data, source: 'api' as const };
  },
};

export default apiService;

