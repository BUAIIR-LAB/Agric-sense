import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatMessage, useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { EmptyState } from '@/components/EmptyState';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { SkeletonMessage } from '@/components/SkeletonLoader';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { chatRateLimiter } from '@/utils/rateLimiter';
import * as Haptics from 'expo-haptics';
import apiService from '@/services/api';
import { ActivityIndicator } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const appFont = Platform.select({ ios: 'SF Pro Text', android: 'Roboto' }) ?? 'System';

// Language mapping for API and speech
const languageToCode: Record<string, string> = {
  English: 'en',
  Luganda: 'lg',
  Ateso: 'at',
  Japadhola: 'jap',
  Swahili: 'sw',
  Runyankore: 'nyn',
};

// WhatsApp-style Waveform Component
const Waveform = ({ 
  bars = 20, 
  animated = false, 
  color = palette.white,
  isUser = false 
}: { 
  bars?: number; 
  animated?: boolean;
  color?: string;
  isUser?: boolean;
}) => {
  const barAnimations = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (!animated) return;

    const animations = barAnimations.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 50),
          Animated.timing(anim, {
            toValue: 0.3 + Math.random() * 0.7,
            duration: 200 + Math.random() * 300,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 200 + Math.random() * 300,
            useNativeDriver: false,
          }),
        ])
      );
    });

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [animated]);

  return (
    <View style={styles.waveformContainer}>
      {barAnimations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: anim.interpolate({
                inputRange: [0.3, 1],
                outputRange: [4, isUser ? 20 : 18],
              }),
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
};

// WhatsApp-style Recording Indicator with Stop and Send
const RecordingIndicator = ({ 
  duration, 
  isRecording,
  onStop, 
  onCancel, 
  onSend 
}: { 
  duration: number;
  isRecording: boolean;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.recordingBar}>
      <View style={styles.recordingContent}>
        <Pressable 
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.buttonPressed
          ]}
          onPress={onCancel} 
          accessibilityLabel="Cancel recording"
        >
          <MaterialCommunityIcons name="close" size={22} color={palette.white} />
        </Pressable>
        <View style={styles.recordingCenter}>
          <View style={styles.recordingLeft}>
            <MaterialCommunityIcons name="microphone" size={18} color={palette.white} />
            {isRecording && <Waveform bars={15} animated={true} color={palette.white} />}
            {!isRecording && (
              <View style={styles.recordingStoppedIndicator}>
                <MaterialCommunityIcons name="check-circle" size={16} color={palette.white} />
              </View>
            )}
          </View>
          <Text style={styles.recordingTime}>{formatDuration(duration)}</Text>
        </View>
        {isRecording ? (
          <Pressable 
            style={({ pressed }) => [
              styles.stopRecordingButton,
              pressed && styles.buttonPressed
            ]}
            onPress={onStop} 
            accessibilityLabel="Stop recording"
          >
            <MaterialCommunityIcons name="stop" size={18} color={palette.white} />
          </Pressable>
        ) : (
          <Pressable 
            style={({ pressed }) => [
              styles.sendRecordingButton,
              pressed && styles.buttonPressed
            ]}
            onPress={onSend} 
            accessibilityLabel="Send recording"
          >
            <MaterialCommunityIcons name="send" size={18} color={palette.white} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

// Professional Typing Indicator
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 150);
    const anim3 = createAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
        </View>
      </View>
    </View>
  );
};

// WhatsApp-style Voice Message Component
const VoiceMessageBubble = ({ 
  message, 
  isUser, 
  isPlaying, 
  onPlayAudio 
}: { 
  message: ChatMessage; 
  isUser: boolean;
  isPlaying: boolean;
  onPlayAudio?: (uri: string) => void;
}) => {
  const [duration, setDuration] = useState<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Load audio to get duration
    const loadDuration = async () => {
      if (!message.audioUri) return;
      
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: message.audioUri },
          { shouldPlay: false }
        );
        soundRef.current = sound;
        
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setDuration(Math.floor(status.durationMillis / 1000));
        }
      } catch (error) {
        console.error('Failed to load audio duration:', error);
        // Default to 0:00 if we can't load
        setDuration(0);
      }
    };

    loadDuration();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [message.audioUri]);

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.voiceBubbleContainer}>
      <Pressable
        style={styles.voicePlayButton}
        onPress={() => {
          if (message.audioUri && onPlayAudio) {
            onPlayAudio(message.audioUri);
          }
        }}
      >
        <MaterialCommunityIcons 
          name={isPlaying ? "pause" : "play"} 
          size={18} 
          color={isUser ? palette.white : palette.brandGreen} 
        />
      </Pressable>
      <View style={styles.voiceContent}>
        <Waveform 
          bars={25} 
          animated={isPlaying} 
          color={isUser ? 'rgba(255,255,255,0.9)' : palette.brandGreen}
          isUser={isUser}
        />
        <Text style={[styles.voiceDuration, isUser && styles.voiceDurationUser]}>
          {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
};

// Professional Message Bubble Component
const MessageBubble = ({ 
  message, 
  isTyping, 
  displayedText,
  onPlayAudio,
  showAlert,
  isPlayingAudio
}: { 
  message: ChatMessage; 
  isTyping?: boolean;
  displayedText?: string;
  onPlayAudio?: (uri: string) => void;
  showAlert?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
  isPlayingAudio?: boolean;
}) => {
  const isUser = message.role === 'user';
  const content = isTyping && displayedText !== undefined ? displayedText : message.content;
  const [showCursor, setShowCursor] = useState(true);
  const isVoiceMessage = message.modality === 'voice';

  useEffect(() => {
    if (!isTyping || isUser) return;
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, [isTyping, isUser]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="leaf" size={16} color={palette.white} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isVoiceMessage && message.audioUri ? (
          <VoiceMessageBubble
            message={message}
            isUser={isUser}
            isPlaying={isPlayingAudio || false}
            onPlayAudio={onPlayAudio}
          />
        ) : (
          <>
            <Text 
              style={[styles.messageText, isUser && styles.messageTextUser]}
              selectable={!isTyping}
            >
              {content}
              {isTyping && !isUser && showCursor && (
                <Text style={styles.cursor}>▊</Text>
              )}
        </Text>
            {!isTyping && (
              <View style={styles.messageMeta}>
                <Text style={[styles.timeText, isUser && styles.timeTextUser]}>
                  {formatTime(message.timestamp)}
                </Text>
                {isUser && (
                  <MaterialCommunityIcons 
                    name="check-all" 
                    size={14} 
                    color={isUser ? 'rgba(255,255,255,0.7)' : palette.gray500} 
                    style={styles.checkIcon}
                  />
                )}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const { state, addChatMessages, clearChatHistory } = useAppContext();
  const { showAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [typingMessages, setTypingMessages] = useState<Record<string, { text: string; isTyping: boolean }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [recordingStopped, setRecordingStopped] = useState(false);
  const [stoppedRecordingUri, setStoppedRecordingUri] = useState<string | null>(null);
  const [stoppedRecordingDuration, setStoppedRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Map<string, ChatMessage>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearChatHistory();
    setConversationId(null);
    setPendingMessages(new Map());
    setTypingMessages({});
    setRefreshing(false);
  }, [clearChatHistory]);

  const typingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  
  const animateTyping = useCallback((messageId: string, fullText: string, onComplete?: () => void) => {
    const existingInterval = typingIntervalsRef.current.get(messageId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    setTypingMessages((prev) => ({ ...prev, [messageId]: { text: '', isTyping: true } }));
    
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      currentIndex++;
      const displayedText = fullText.slice(0, currentIndex);
      
      setTypingMessages((prev) => ({
        ...prev,
        [messageId]: { text: displayedText, isTyping: true },
      }));

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      if (currentIndex >= fullText.length) {
        clearInterval(typingInterval);
        typingIntervalsRef.current.delete(messageId);
        setTypingMessages((prev) => ({
          ...prev,
          [messageId]: { text: fullText, isTyping: false },
        }));
        if (onComplete) {
          onComplete();
        }
      }
    }, 20);
    
    typingIntervalsRef.current.set(messageId, typingInterval);
  }, []);
  
  useEffect(() => {
    return () => {
      typingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      typingIntervalsRef.current.clear();
    };
  }, []);

  const sendTextMessage = async () => {
    const trimmed = input.trim();
    
    // Debug logging
    if (__DEV__) {
      console.log('📤 sendTextMessage called');
      console.log('   Input:', trimmed);
      console.log('   Has profile:', !!state.profile);
      console.log('   Profile ID:', state.profile?.id);
      console.log('   Is loading:', isLoading);
    }
    
    if (!trimmed) {
      if (__DEV__) {
        console.log('⚠️ No input text to send');
      }
      return;
    }
    
    if (!state.profile?.id) {
      if (__DEV__) {
        console.error('❌ No user profile or profile ID');
      }
      setErrorMessage('User profile not available. Please log in again.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (isLoading) {
      if (__DEV__) {
        console.log('⚠️ Already loading, ignoring send request');
      }
      return;
    }

    if (!chatRateLimiter.isAllowed('chat')) {
      const waitTime = Math.ceil(chatRateLimiter.getTimeUntilNext('chat') / 1000);
      setErrorMessage(`Please wait ${waitTime}s`);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Store trimmed value in a const to ensure it's preserved in async callbacks
    const messageText = trimmed;
    const currentProfile = state.profile;
    const currentConversationId = conversationId;

    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-user`,
      role: 'user',
      modality: 'text',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    addChatMessages([userMessage]);
    setInput(''); // Clear input immediately after creating message

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      if (!currentProfile) {
        throw new Error('User profile not available');
      }

      const preferredLanguage = currentProfile.preferredLanguage ?? 'English';
      const targetLang = languageToCode[preferredLanguage] ?? 'en';

      if (__DEV__) {
        console.log('📝 Text Message Request:');
        console.log('   Message Text:', messageText);
        console.log('   User Language:', preferredLanguage);
        console.log('   Language Code:', targetLang);
        console.log('   Query Length:', messageText.length);
        console.log('   Has Conversation ID:', !!currentConversationId);
        console.log('   User ID:', currentProfile.id);
      }

      const tempAssistantId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-assistant`;
      const tempAssistantMessage: ChatMessage = {
        id: tempAssistantId,
        role: 'assistant',
        modality: 'text',
        content: '', // Empty content, will be filled by typing animation
        timestamp: new Date().toISOString(),
        triggerSpeech: true,
      };
      
      // Add pending message to show typing indicator
      setPendingMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(tempAssistantId, tempAssistantMessage);
        return newMap;
      });

      // Set typing state to show indicator
      setTypingMessages((prev) => ({
        ...prev,
        [tempAssistantId]: { text: '', isTyping: true },
      }));

      // Make API call
      (async () => {
        try {
          if (!currentProfile) {
            throw new Error('User profile not available');
          }

          if (__DEV__) {
            console.log('🚀 Sending API request with prompt:', messageText.substring(0, 50) + '...');
          }

          const apiResponse = await apiService.askQuestion({
            prompt: messageText,
            user_id: currentProfile.id,
            target_lang: targetLang,
            conversation_id: currentConversationId || undefined,
            user_profile: {
              name: currentProfile.name,
              area: currentProfile.area,
              preferred_language: preferredLanguage,
              crops_grown: currentProfile.cropsGrown,
            },
          });

          if (__DEV__) {
            console.log('✅ API Response received:');
            console.log('   Conversation ID:', apiResponse.conversation_id);
            console.log('   Response length:', apiResponse.results?.length || 0);
          }

          if (apiResponse.conversation_id) {
            setConversationId(apiResponse.conversation_id);
            if (__DEV__) {
              console.log('Conversation ID set:', apiResponse.conversation_id ? 'Yes' : 'No');
            }
          }

          const responseText = apiResponse.results || '';

          if (__DEV__) {
            console.log('💬 Animating response text, length:', responseText.length);
          }

          // Remove from pending messages
          setPendingMessages((prev) => {
            const newMap = new Map(prev);
            newMap.delete(tempAssistantId);
            return newMap;
          });

          // Animate the actual response text
          animateTyping(tempAssistantId, responseText, () => {
            // When typing animation completes, add the final message
            const finalMessage: ChatMessage = {
              id: tempAssistantId,
              role: 'assistant',
              modality: 'text',
              content: responseText,
              timestamp: new Date().toISOString(),
              triggerSpeech: true,
            };
            
            // Clear typing state
            setTypingMessages((prev) => {
              const updated = { ...prev };
              delete updated[tempAssistantId];
              return updated;
            });
            
            // Add final message to chat history
            addChatMessages([finalMessage]);
            
            if (__DEV__) {
              console.log('✅ Message added to chat history');
            }
          });
        } catch (error: any) {
          console.error('❌ Error sending message:', error);
          setErrorMessage(error.message || 'Failed to send. Tap to retry.');
          
          // Clear typing state
          setTypingMessages((prev) => {
            const updated = { ...prev };
            delete updated[tempAssistantId];
            return updated;
          });
          
          // Remove from pending messages
          setPendingMessages((prev) => {
            const newMap = new Map(prev);
            newMap.delete(tempAssistantId);
            return newMap;
          });
        } finally {
          setIsLoading(false);
        }
      })();
    } catch (error: any) {
      console.error('Error sending message:', error);
      setErrorMessage('Failed to send. Tap to retry.');
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    // Immediately update UI for better responsiveness
    const currentDuration = recordingDuration; // Capture current duration before stopping
    
    // Stop timer immediately
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    
    // Immediately update UI state for instant feedback
      setIsVoiceRecording(false);
    
    // Use ref to get current recording object
    const currentRecording = recordingRef.current || recording;
    
    if (!currentRecording) {
      // If no recording object, just clean up
      setRecording(null);
      setRecordingDuration(0);
      setRecordingStopped(false);
      recordingRef.current = null;
      return;
    }

    // Stop recording asynchronously (don't block UI)
    currentRecording.stopAndUnloadAsync()
      .then(() => {
        const uri = currentRecording.getURI();
        
      if (!uri) {
          setErrorMessage('Failed to save recording');
          setTimeout(() => setErrorMessage(null), 3000);
          setRecording(null);
          recordingRef.current = null;
          setRecordingDuration(0);
          setRecordingStopped(false);
        return;
      }

        // Store the stopped recording info with captured duration
        setStoppedRecordingUri(uri);
        setStoppedRecordingDuration(currentDuration); // Use captured duration
        setRecordingStopped(true);
        setRecording(null);
        recordingRef.current = null;
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .catch((error: any) => {
        console.error('❌ Error stopping recording:', error);
        setErrorMessage('Failed to stop recording');
        setTimeout(() => setErrorMessage(null), 3000);
        setRecording(null);
        recordingRef.current = null;
        setRecordingDuration(0);
        setRecordingStopped(false);
      });
  };

  const cancelRecording = async () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    try {
      const currentRecording = recordingRef.current || recording;
      if (currentRecording) {
        await currentRecording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.warn('Error canceling recording:', error);
    }
    setIsVoiceRecording(false);
    setRecording(null);
    recordingRef.current = null; // Clear ref
    setRecordingDuration(0);
    setRecordingStopped(false);
    setStoppedRecordingUri(null);
    setStoppedRecordingDuration(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const sendRecording = async () => {
    if (!stoppedRecordingUri || !state.profile?.id) {
      return;
    }

    const uri = stoppedRecordingUri;
    const finalDuration = stoppedRecordingDuration;

    // Reset stopped recording state
    setRecordingStopped(false);
    setStoppedRecordingUri(null);
    setStoppedRecordingDuration(0);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setIsLoading(true);
      const userMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-voice`,
          role: 'user',
          modality: 'voice',
        content: `Voice message (${Math.floor(finalDuration / 60)}:${(finalDuration % 60).toString().padStart(2, '0')})`,
          timestamp: new Date().toISOString(),
          audioUri: uri,
      };
      addChatMessages([userMessage]);

      try {
        const preferredLanguage = state.profile?.preferredLanguage ?? 'English';
        const targetLang = languageToCode[preferredLanguage] ?? 'en';

        if (__DEV__) {
          console.log('🎤 Voice Message Request:');
          console.log('   User Language:', preferredLanguage);
          console.log('   Language Code:', targetLang);
          console.log('   Has Voice URI:', !!uri);
          console.log('   Has Conversation ID:', !!conversationId);
        }

        const getAudioFormat = (uri: string): { type: string; extension: string } => {
          const uriLower = uri.toLowerCase();
          if (uriLower.includes('.wav') || uriLower.endsWith('.wav')) {
            return { type: 'audio/wav', extension: 'wav' };
          } else if (uriLower.includes('.m4a') || uriLower.endsWith('.m4a')) {
            return { type: 'audio/m4a', extension: 'm4a' };
          } else if (uriLower.includes('.mp3') || uriLower.endsWith('.mp3')) {
            return { type: 'audio/mp3', extension: 'mp3' };
          } else if (uriLower.includes('.mp4') || uriLower.endsWith('.mp4')) {
            return { type: 'audio/mp4', extension: 'mp4' };
          } else if (uriLower.includes('.aac') || uriLower.endsWith('.aac')) {
            return { type: 'audio/aac', extension: 'aac' };
          }
          return { type: 'audio/m4a', extension: 'm4a' };
        };

        const audioFormat = getAudioFormat(uri);
        const timestamp = Date.now();
        const voiceFile = {
          uri: uri,
          type: audioFormat.type,
          name: `voice-${timestamp}.${audioFormat.extension}`,
        };
        
        if (__DEV__) {
          console.log('📁 Voice File Details:');
          console.log('   File Type:', voiceFile.type);
          console.log('   File Name:', voiceFile.name);
          console.log('   Platform:', Platform.OS);
        }

        const tempAssistantId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-assistant`;
        const tempAssistantMessage: ChatMessage = {
          id: tempAssistantId,
          role: 'assistant',
          modality: 'voice',
          content: '...',
          timestamp: new Date().toISOString(),
          triggerSpeech: true,
        };
        
        setPendingMessages((prev) => {
          const newMap = new Map(prev);
          newMap.set(tempAssistantId, tempAssistantMessage);
          return newMap;
        });

        animateTyping(tempAssistantId, '...', async () => {
          try {
            if (!state.profile) {
              throw new Error('User profile not available');
            }

            const apiResponse = await apiService.sendVoiceQuestion(
              voiceFile,
              state.profile.id,
              conversationId || undefined,
              targetLang,
              {
                name: state.profile.name,
                area: state.profile.area,
                preferred_language: preferredLanguage,
                crops_grown: state.profile.cropsGrown,
              }
            );

            const responseText = apiResponse.results || '';

            if (apiResponse.conversation_id) {
              setConversationId(apiResponse.conversation_id);
              if (__DEV__) {
                console.log('✅ Conversation ID set from voice:', !!apiResponse.conversation_id);
              }
            }

            // Update user message with transcription if available
            if (apiResponse.transcription) {
              const updatedUserMessage: ChatMessage = {
                ...userMessage,
                content: apiResponse.transcription,
              };
              addChatMessages([updatedUserMessage]);
            }

            setTypingMessages((prev) => ({
              ...prev,
              [tempAssistantId]: { text: responseText, isTyping: false },
            }));

            const finalMessage: ChatMessage = {
              id: tempAssistantId,
              role: 'assistant',
              modality: 'voice',
              content: responseText,
              timestamp: new Date().toISOString(),
              triggerSpeech: true,
              audioUri: apiResponse.output_audio_url,
            };
            
            setPendingMessages((prev) => {
              const newMap = new Map(prev);
              newMap.delete(tempAssistantId);
              return newMap;
            });
            
            addChatMessages([finalMessage]);

            if (apiResponse.output_audio_url) {
              try {
                const { sound } = await Audio.Sound.createAsync(
                  { uri: apiResponse.output_audio_url },
                  { shouldPlay: true }
                );
              } catch (audioError) {
                console.warn('Failed to play audio, falling back to TTS:', audioError);
                const languageCode = languageToCode[preferredLanguage] ?? 'en';
                Speech.speak(responseText, {
                  language: languageCode,
                });
              }
            } else {
              const languageCode = languageToCode[preferredLanguage] ?? 'en';
              Speech.speak(responseText, {
                language: languageCode,
              });
            }
          } catch (error: any) {
            console.error('❌ Error sending voice message:', error);
            
            // Extract user-friendly error message
            let errorMsg = 'Failed to send voice message';
            if (error.message) {
              if (error.message.includes('500')) {
                errorMsg = 'Server error. Please try again.';
              } else if (error.message.includes('transcription')) {
                errorMsg = 'Voice processing failed. Please try again.';
              } else if (error.message.includes('timeout') || error.name === 'AbortError') {
                errorMsg = 'Request timed out. The server may be processing. Please try again.';
              } else {
                errorMsg = error.message;
              }
            } else if (error.name === 'AbortError') {
              errorMsg = 'Request timed out. The server may be processing. Please try again.';
            }
            
            setErrorMessage(errorMsg);
            
            // Remove the user message if API failed - user can retry
            // We'll keep the message in chat history but show error
            
            setTypingMessages((prev) => {
              const updated = { ...prev };
              delete updated[tempAssistantId];
              return updated;
            });
            
            setPendingMessages((prev) => {
              const newMap = new Map(prev);
              newMap.delete(tempAssistantId);
              return newMap;
            });
          } finally {
            setIsLoading(false);
          }
        });
    } catch (error: any) {
      console.error('❌ Error processing voice:', error);
      let errorMsg = 'Failed to process voice message';
      if (error.message) {
        if (error.message.includes('500')) {
          errorMsg = 'Server error. Please try again.';
        } else {
          errorMsg = error.message;
        }
      }
      setErrorMessage(errorMsg);
      setIsLoading(false);
      setIsVoiceRecording(false);
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  const toggleVoiceRecording = async () => {
    if (isVoiceRecording) {
      // If already recording, this shouldn't be called - use cancelRecording or sendRecording instead
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Microphone permission needed');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      recordingRef.current = newRecording; // Store in ref for reliable access
      setIsVoiceRecording(true);
      setRecordingDuration(0);
      
      const timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    } catch (error) {
      console.warn('Voice recording failed', error);
      setErrorMessage('Recording failed. Try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handlePlayAudio = async (uri: string) => {
    try {
      if (playingAudio === uri) {
        // Pause/stop if already playing
        setPlayingAudio(null);
        return;
      }
      
      setPlayingAudio(uri);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setPlayingAudio(null);
            sound.unloadAsync();
          }
        }
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      setErrorMessage('Playback failed');
      setTimeout(() => setErrorMessage(null), 2000);
      setPlayingAudio(null);
    }
  };

  const toggleMenu = () => setMenuVisible((prev) => !prev);

  const openLibrary = () => {
    setMenuVisible(false);
    router.push('/library' as never);
  };

  const startNewConversation = () => {
    setMenuVisible(false);
    showAlert(
      'info',
      'New Conversation',
      'Start a fresh conversation?',
      {
        showCancel: true,
        confirmText: 'Start',
        cancelText: 'Cancel',
        onConfirm: () => {
          setConversationId(null);
          setPendingMessages(new Map());
          setTypingMessages({});
          clearChatHistory();
        },
      }
    );
  };

  // Load conversation history if conversationId is provided
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!params.conversationId || !state.profile?.id) {
        return;
      }

      // Don't reload if we already have this conversation loaded
      if (conversationId === params.conversationId && state.chatHistory.length > 0) {
        if (__DEV__) {
          console.log('📚 Conversation already loaded, skipping reload');
        }
        return;
      }

      setIsLoadingHistory(true);
      
      // Clear existing messages before loading new conversation
      clearChatHistory();
      setPendingMessages(new Map());
      setTypingMessages({});
      
      try {
        if (__DEV__) {
          console.log('📚 Loading conversation history:', params.conversationId);
        }
        
        const history = await apiService.getConversationHistory(
          state.profile.id,
          params.conversationId,
          50
        );

        if (__DEV__) {
          console.log('📚 Received history:', history.length, 'messages');
        }

        if (history && history.length > 0) {
          // Convert API response to ChatMessage format
          // API format: {role, content, source, audio_url, timestamp, message_id, ...}
          const messages: ChatMessage[] = history.map((msg: any) => ({
            id: msg.message_id || msg.id || `${Date.now()}-${Math.random()}`,
            role: msg.role || 'assistant',
            modality: (msg.source === 'voice' ? 'voice' : 'text') as 'text' | 'voice',
            content: msg.content || '',
            timestamp: msg.timestamp || msg.display_timestamp || new Date().toISOString(),
            audioUri: msg.audio_url || msg.voice_file_url || msg.audio_uri || msg.audioUri,
          }));

          // Sort messages by timestamp to ensure chronological order (oldest first)
          // This ensures user input appears before assistant response
          // When timestamps are equal or very close, user messages should come first
          const sortedMessages = [...messages].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            const timeDiff = timeA - timeB;
            
            // If timestamps are equal or very close (within 2 seconds), prioritize user messages
            if (Math.abs(timeDiff) < 2000) {
              // User messages should come before assistant messages when timestamps are close
              if (a.role === 'user' && b.role === 'assistant') return -1;
              if (a.role === 'assistant' && b.role === 'user') return 1;
              // If both are same role, maintain original order
              return 0;
            }
            
            // Otherwise, sort by timestamp (oldest first)
            return timeDiff;
          });

          if (__DEV__) {
            console.log('📚 Converting', sortedMessages.length, 'messages');
            console.log('   First message:', sortedMessages[0]?.role, sortedMessages[0]?.content?.substring(0, 50));
            console.log('   Last message:', sortedMessages[sortedMessages.length - 1]?.role, sortedMessages[sortedMessages.length - 1]?.content?.substring(0, 50));
            sortedMessages.forEach((msg, idx) => {
              console.log(`   [${idx}] ${msg.role}: ${msg.timestamp} - ${msg.content?.substring(0, 30)}`);
            });
          }

          // Add messages to chat history
          addChatMessages(sortedMessages);
          setConversationId(params.conversationId);
          
          if (__DEV__) {
            console.log('✅ Loaded', sortedMessages.length, 'messages into chat');
            console.log('   Chat history length:', state.chatHistory.length);
          }
          
          // Scroll to bottom after loading (show most recent messages)
          setTimeout(() => {
            if (flatListRef.current && sortedMessages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }, 600);
        } else {
          if (__DEV__) {
            console.log('⚠️ No messages found in conversation');
          }
        }
      } catch (error: any) {
        console.error('❌ Error loading conversation history:', error);
        setErrorMessage('Failed to load conversation');
        setTimeout(() => setErrorMessage(null), 3000);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    if (params.conversationId && state.profile?.id) {
      loadConversationHistory();
    }
  }, [params.conversationId, state.profile?.id, addChatMessages, clearChatHistory, conversationId]);

  // Clear chat screen only when navigating to a new conversation (not on every focus)
  useFocusEffect(
    useCallback(() => {
      // Only clear if:
      // 1. No conversationId in URL params AND
      // 2. No active conversationId in state AND
      // 3. No messages in chat history
      // This prevents clearing an active conversation when the screen refocuses
      const hasActiveConversation = conversationId || state.chatHistory.length > 0;
      const hasParamsConversation = !!params.conversationId;
      
      if (!hasParamsConversation && !hasActiveConversation) {
        // Only clear if there's truly no active conversation
        clearChatHistory();
        setConversationId(null);
        setPendingMessages(new Map());
        setTypingMessages({});
        if (__DEV__) {
          console.log('🧹 Chat screen focused - cleared empty history');
        }
      } else if (hasParamsConversation) {
        // If conversationId is provided in params, ensure it's set (but don't reload if already loaded)
        if (conversationId !== params.conversationId) {
          setConversationId(params.conversationId);
          if (__DEV__) {
            console.log('📚 Chat screen focused - conversation ID set from params:', params.conversationId);
          }
        } else if (__DEV__) {
          console.log('📚 Chat screen focused - conversation already active:', conversationId);
        }
      } else if (hasActiveConversation && __DEV__) {
        // Active conversation exists, don't clear
        console.log('💬 Chat screen focused - preserving active conversation:', conversationId);
      }
    }, [clearChatHistory, params.conversationId, conversationId, state.chatHistory.length])
  );

  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    });

    return () => {
      showSubscription.remove();
    };
  }, []);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.push('/(tabs)/home')}
        style={styles.headerButton}
        >
        <MaterialCommunityIcons name="arrow-left" size={24} color={palette.charcoal} />
        </Pressable>
      <View style={styles.headerSpacer} />
      <Pressable accessibilityLabel="Open menu" style={styles.headerButton} onPress={toggleMenu}>
        <MaterialCommunityIcons name="dots-vertical" size={24} color={palette.charcoal} />
        </Pressable>
    </View>
  );

  const allMessages = useMemo(() => [
    ...state.chatHistory,
    ...Array.from(pendingMessages.values()),
  ], [state.chatHistory, pendingMessages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <NetworkStatusBar />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const typingState = typingMessages[item.id];
            return (
              <MessageBubble
                message={item}
                isTyping={typingState?.isTyping ?? false}
                displayedText={typingState?.text}
                onPlayAudio={handlePlayAudio}
                showAlert={showAlert}
                isPlayingAudio={playingAudio === item.audioUri}
              />
            );
          }}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brandGreen}
              colors={[palette.brandGreen]}
            />
          }
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            isLoading ? <TypingIndicator /> : null
          }
          ListEmptyComponent={
            isLoadingHistory ? (
              <View style={styles.emptyContainer}>
                {[...Array(3)].map((_, i) => (
                  <SkeletonMessage key={i} />
                ))}
              </View>
            ) : allMessages.length === 0 ? (
              <EmptyState
                icon="leaf"
                title="New Conversation"
                message="Ask questions about your crops in your preferred language."
              />
            ) : null
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={true}
          onContentSizeChange={() => {
            if (allMessages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            if (allMessages.length > 0 && !isLoadingHistory) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }
          }}
        />

        {(isVoiceRecording || recordingStopped) && (
          <RecordingIndicator 
            duration={recordingStopped ? stoppedRecordingDuration : recordingDuration}
            isRecording={isVoiceRecording}
            onStop={stopRecording}
            onCancel={cancelRecording}
            onSend={sendRecording}
          />
        )}

        {errorMessage && (
          <View style={styles.errorBar}>
            <MaterialCommunityIcons name="alert-circle" size={16} color={palette.danger} />
            <Text style={styles.errorText} numberOfLines={1}>{errorMessage}</Text>
          <Pressable
              onPress={() => {
                setErrorMessage(null);
                if (input.trim()) {
                  sendTextMessage();
                }
              }}
              style={styles.retryButton}
            >
              <MaterialCommunityIcons name="refresh" size={16} color={palette.danger} />
            </Pressable>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.inputWrapper}>
            {input.trim().length === 0 ? (
              <>
                <Pressable
                  accessibilityLabel="Record voice message"
                  style={[styles.iconButton, isVoiceRecording && styles.iconButtonActive]}
            onPress={toggleVoiceRecording}
                  disabled={isLoading}
          >
            <MaterialCommunityIcons
                    name="microphone"
                    size={22}
                    color={isVoiceRecording ? palette.white : palette.brandGreen}
            />
          </Pressable>
            <TextInput
                  ref={inputRef}
              style={styles.textInput}
                  placeholder="Type a message..."
              placeholderTextColor={palette.gray500}
              value={input}
                  onChangeText={(text) => {
                    setInput(text);
                    setErrorMessage(null);
                  }}
              multiline
                  textAlignVertical="center"
                  onFocus={() => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                  onSubmitEditing={() => {
                    // Send message when user presses Enter (on single line) or Return
                    if (input.trim() && !isLoading) {
                      sendTextMessage();
                    }
                  }}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  keyboardType="default"
                  autoCorrect={true}
                  autoCapitalize="sentences"
                  editable={!isLoading}
                />
                <Pressable accessibilityLabel="Attach" style={styles.iconButton}>
                  <MaterialCommunityIcons name="paperclip" size={20} color={palette.gray500} />
              </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor={palette.gray500}
                  value={input}
                  onChangeText={(text) => {
                    setInput(text);
                    setErrorMessage(null);
                  }}
                  multiline
                  textAlignVertical="center"
                  onFocus={() => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                  onSubmitEditing={() => {
                    // Send message when user presses Enter (on single line) or Return
                    if (input.trim() && !isLoading) {
                      sendTextMessage();
                    }
                  }}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  keyboardType="default"
                  autoCorrect={true}
                  autoCapitalize="sentences"
                  editable={!isLoading}
                />
                <Pressable
                  accessibilityLabel="Send message"
                  style={[styles.sendButton, (isLoading || !input.trim()) && styles.sendButtonDisabled]}
                  onPress={sendTextMessage}
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={palette.white} />
                  ) : (
                    <MaterialCommunityIcons name="send" size={20} color={palette.white} />
                  )}
          </Pressable>
              </>
            )}
        </View>
        </View>
      </KeyboardAvoidingView>

        {isMenuVisible && (
          <Pressable
            style={styles.menuOverlay}
            accessibilityLabel="Close menu"
            onPress={() => setMenuVisible(false)}
          >
          <View style={styles.menu}>
            <Pressable style={styles.menuItem} onPress={startNewConversation}>
              <MaterialCommunityIcons name="message-plus" size={20} color={palette.charcoal} />
              <Text style={styles.menuText}>New Chat</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={openLibrary}>
              <MaterialCommunityIcons name="bookshelf" size={20} color={palette.charcoal} />
              <Text style={styles.menuText}>Library</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerSpacer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: palette.brandGreen,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: palette.white,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  messageText: {
    fontFamily: appFont,
    fontSize: 15,
    lineHeight: 20,
    color: palette.charcoal,
  },
  messageTextUser: {
    color: palette.white,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
    gap: 4,
  },
  timeText: {
    fontFamily: appFont,
    fontSize: 11,
    color: palette.gray500,
  },
  timeTextUser: {
    color: 'rgba(255,255,255,0.7)',
  },
  checkIcon: {
    marginLeft: 2,
  },
  cursor: {
    color: palette.brandGreen,
    fontWeight: '700',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  typingBubble: {
    backgroundColor: palette.white,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 16,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.gray500,
  },
  emptyContainer: {
    paddingVertical: 48,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2.5,
    height: 24,
    paddingVertical: 2,
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 1.25,
    minHeight: 4,
    maxHeight: 20,
  },
  recordingBar: {
    backgroundColor: palette.danger,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingStoppedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingTime: {
    fontFamily: appFont,
    fontSize: 17,
    fontWeight: '700',
    color: palette.white,
    minWidth: 55,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stopRecordingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendRecordingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  voiceBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    minWidth: 180,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  voicePlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
  },
  voiceDuration: {
    fontFamily: appFont,
    fontSize: 12,
    fontWeight: '600',
    color: palette.brandGreen,
    minWidth: 35,
    textAlign: 'right',
  },
  voiceDurationUser: {
    color: 'rgba(255,255,255,0.95)',
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFCDD2',
  },
  errorText: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 13,
    color: palette.danger,
    fontWeight: '500',
  },
  retryButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    backgroundColor: palette.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 15,
    color: palette.charcoal,
    maxHeight: 100,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: palette.danger,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menu: {
    width: 160,
    backgroundColor: palette.white,
    borderRadius: 12,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
    elevation: 12,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginVertical: 4,
  },
  menuText: {
    fontFamily: appFont,
    fontSize: 15,
    color: palette.charcoal,
  },
});
