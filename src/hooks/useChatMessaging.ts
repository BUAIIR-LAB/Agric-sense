import { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChatMessage, useAppContext } from '@/context/AppContext';
import { chatRateLimiter } from '@/utils/rateLimiter';
import apiService, { type AskResponse, type VoiceQuestionResponse } from '@/services/api';
import { createAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { getLanguageCode } from '@/constants/languages';

export const useChatMessaging = (flatListRef: React.RefObject<FlatList | null>) => {
    const { state, addChatMessages, clearChatHistory, isOffline } = useAppContext();
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [typingMessages, setTypingMessages] = useState<Record<string, { text: string; isTyping: boolean }>>({});
    const [pendingMessages, setPendingMessages] = useState<Map<string, ChatMessage>>(new Map());
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const [lastAttemptedMessage, setLastAttemptedMessage] = useState<{ type: 'text' | 'voice'; content: string; duration?: number } | null>(null);
    const typingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

    // ─── Helpers ────────────────────────────────────────────────────────────
    const saveBase64Audio = async (base64Data: string): Promise<string | null> => {
        try {
            if (!base64Data) return null;

            const base64Content = base64Data.includes('base64,')
                ? base64Data.split('base64,')[1]
                : base64Data;

            let extension = '.wav';
            if (base64Data.includes('audio/mp4') || base64Data.includes('audio/m4a')) extension = '.m4a';
            else if (base64Data.includes('audio/mpeg') || base64Data.includes('audio/mp3')) extension = '.mp3';

            const filename = `reply_${Date.now()}${extension}`;
            const cacheDir = (FileSystem as any).cacheDirectory || FileSystem.documentDirectory;
            const formattedCacheDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
            const filepath = `${formattedCacheDir}${filename}`;

            await FileSystem.writeAsStringAsync(filepath, base64Content, {
                encoding: 'base64' as any,
            });

            return filepath;
        } catch (error) {
            console.error('[Audio] Failed to save base64 audio:', error);
            return null;
        }
    };

    useEffect(() => {
        return () => {
            typingIntervalsRef.current.forEach((interval) => clearInterval(interval));
            typingIntervalsRef.current.clear();
        };
    }, []);

    const clearError = () => setErrorMessage(null);

    // ─── Typing animation (text mode only) ──────────────────────────────────
    const animateTyping = useCallback((id: string, fullText: string, onComplete?: () => void) => {
        let index = 0;
        setTypingMessages((prev) => ({ ...prev, [id]: { text: '', isTyping: true } }));

        const interval = setInterval(() => {
            index++;
            if (index <= fullText.length) {
                setTypingMessages((prev) => ({
                    ...prev,
                    [id]: { text: fullText.substring(0, index), isTyping: true },
                }));
                if (index % 10 === 0) flatListRef.current?.scrollToEnd({ animated: true });
            } else {
                clearInterval(interval);
                typingIntervalsRef.current.delete(id);
                setTypingMessages((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                onComplete?.();
            }
        }, 15);

        typingIntervalsRef.current.set(id, interval);
    }, [flatListRef]);

    // ─── Audio player ────────────────────────────────────────────────────────
    const handlePlayAudio = async (uri: string) => {
        try {
            let finalUri = uri;
            if (uri.startsWith('data:audio') || uri.length > 500) {
                const filepath = await saveBase64Audio(uri);
                if (filepath) finalUri = filepath.startsWith('file://') ? filepath : `file://${filepath}`;
            }

            if (playingAudio === finalUri) {
                setPlayingAudio(null);
                return;
            }

            setPlayingAudio(finalUri);
            const player = createAudioPlayer(finalUri);
            player.play();

            const statusListener = player.addListener('playbackStatusUpdate', (status: any) => {
                if (status.didJustFinish) {
                    setPlayingAudio(null);
                    statusListener.remove();
                    player.remove();
                }
            });
        } catch (error) {
            console.error('[Audio] Failed to play:', error);
            setPlayingAudio(null);
        }
    };

    // ─── Text response: typing animation then text bubble ───────────────────
    const processTextResponse = async (tempId: string, apiResponse: AskResponse | VoiceQuestionResponse) => {
        const responseText = apiResponse.results || '';

        // Pre-save audio for optional playback
        let finalAudioPath: string | null = null;
        if (apiResponse.audio_content) {
            const filepath = await saveBase64Audio(apiResponse.audio_content);
            if (filepath) finalAudioPath = filepath.startsWith('file://') ? filepath : `file://${filepath}`;
        }

        animateTyping(tempId, responseText, async () => {
            const finalMessage: ChatMessage = {
                id: tempId,
                role: 'assistant',
                modality: 'text',
                content: responseText,
                timestamp: new Date().toISOString(),
                audioUri: finalAudioPath || undefined,
            };

            setPendingMessages((prev) => {
                const m = new Map(prev);
                m.delete(tempId);
                return m;
            });
            addChatMessages([finalMessage]);
            setLastAttemptedMessage(null);

            if (finalAudioPath) handlePlayAudio(finalAudioPath);
        });
    };

    // ─── Voice response: audio-only bubble, no text ──────────────────────────
    const processVoiceResponse = async (tempId: string, apiResponse: VoiceQuestionResponse) => {
        let finalAudioPath: string | null = null;

        if (apiResponse.audio_content) {
            const filepath = await saveBase64Audio(apiResponse.audio_content);
            if (filepath) finalAudioPath = filepath.startsWith('file://') ? filepath : `file://${filepath}`;
        }

        // Remove pending placeholder — no text bubble added
        setPendingMessages((prev) => {
            const m = new Map(prev);
            m.delete(tempId);
            return m;
        });

        if (finalAudioPath) {
            // Add a voice-mode assistant bubble (audio player only, no text)
            const voiceMessage: ChatMessage = {
                id: tempId,
                role: 'assistant',
                modality: 'voice',
                content: '', // intentionally empty — UI shows audio player only
                timestamp: new Date().toISOString(),
                audioUri: finalAudioPath,
            };
            addChatMessages([voiceMessage]);
            setLastAttemptedMessage(null);

            // Auto-play immediately
            setTimeout(() => handlePlayAudio(finalAudioPath!), 300);
        } else {
            // Fallback: if no audio, show text response
            await processTextResponse(tempId, apiResponse);
        }
    };

    // ─── Send text message ───────────────────────────────────────────────────
    const sendTextMessage = async (messageText: string) => {
        const currentProfile = state.profile;
        if (!currentProfile?.id || isLoading || !messageText.trim()) return;

        if (!chatRateLimiter.isAllowed('chat')) {
            const waitTime = Math.ceil(chatRateLimiter.getTimeUntilNext('chat') / 1000);
            setErrorMessage(`Please wait ${waitTime}s`);
            setTimeout(() => setErrorMessage(null), 3000);
            return;
        }

        setErrorMessage(null);
        setLastAttemptedMessage({ type: 'text', content: messageText });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsLoading(true);

        const userMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-user`,
            role: 'user',
            modality: 'text',
            content: messageText,
            timestamp: new Date().toISOString(),
        };

        addChatMessages([userMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        // Add pending bubble (text mode — typing animation will replace it)
        const tempId = `${Date.now()}-assistant`;
        const tempMsg: ChatMessage = {
            id: tempId,
            role: 'assistant',
            modality: 'text',
            content: '',
            timestamp: new Date().toISOString(),
        };
        setPendingMessages((prev) => new Map(prev).set(tempId, tempMsg));

        if (isOffline) {
            setErrorMessage('You are offline.');
            setIsLoading(false);
            setPendingMessages((prev) => { const m = new Map(prev); m.delete(tempId); return m; });
            return;
        }

        try {
            const targetLang = getLanguageCode(currentProfile.preferredLanguage ?? 'English');
            const apiResponse = await apiService.askQuestion({
                prompt: messageText,
                user_id: currentProfile.id,
                target_lang: targetLang,
                conversation_id: conversationId || undefined,
                user_profile: {
                    name: currentProfile.name,
                    area: currentProfile.area,
                    preferred_language: currentProfile.preferredLanguage,
                    crops_grown: currentProfile.cropsGrown,
                },
            });

            if (apiResponse.conversation_id) setConversationId(apiResponse.conversation_id);
            await processTextResponse(tempId, apiResponse);
        } catch (error: any) {
            console.error('[Chat] Text send error:', error);
            setErrorMessage(error.message || 'Failed to send');
            setPendingMessages((prev) => { const m = new Map(prev); m.delete(tempId); return m; });
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Send voice recording ────────────────────────────────────────────────
    const sendRecording = async (uri: string, duration: number) => {
        const currentProfile = state.profile;
        if (!currentProfile?.id || isLoading) return;

        setErrorMessage(null);
        setLastAttemptedMessage({ type: 'voice', content: uri, duration });
        setIsLoading(true);

        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            modality: 'voice',
            content: 'Voice message',
            audioUri: uri,
            timestamp: new Date().toISOString(),
        };

        addChatMessages([userMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        // NOTE: No pending text bubble for voice mode — TypingIndicator handles progress
        const tempId = `${Date.now()}-assistant-voice`;

        if (isOffline) {
            setErrorMessage('You are offline.');
            setIsLoading(false);
            return;
        }

        try {
            const targetLang = getLanguageCode(currentProfile.preferredLanguage ?? 'English');
            const uriLower = uri.toLowerCase();
            const voiceFileObj = {
                uri,
                type: uriLower.endsWith('.wav') ? 'audio/wav' : 'audio/mp4',
                name: uriLower.endsWith('.wav') ? 'voice.wav' : 'voice.m4a',
            };

            const apiResponse = await apiService.sendVoiceQuestion(
                voiceFileObj,
                currentProfile.id,
                conversationId || undefined,
                targetLang,
                {
                    name: currentProfile.name,
                    area: currentProfile.area,
                    preferred_language: currentProfile.preferredLanguage,
                    crops_grown: currentProfile.cropsGrown,
                }
            );

            if (apiResponse.conversation_id) setConversationId(apiResponse.conversation_id);
            await processVoiceResponse(tempId, apiResponse);
        } catch (error: any) {
            console.error('[Chat] Voice send error:', error);
            setErrorMessage(error.message || 'Failed to send voice');
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        clearChatHistory();
        setConversationId(null);
        setPendingMessages(new Map());
        setTypingMessages({});
        setTimeout(() => setRefreshing(false), 500);
    }, [clearChatHistory]);

    const loadConversationHistory = useCallback(async (overrideConversationId?: string) => {
        if (!state.profile?.id || isOffline) return;

        setIsLoadingHistory(true);
        try {
            const result = await apiService.getConversationHistory(
                state.profile.id,
                overrideConversationId || conversationId || ''
            );

            if (result && result.messages && result.messages.length > 0) {
                setConversationId(result.conversation_id);

                const messages: ChatMessage[] = result.messages.map((msg: any) => ({
                    id: msg.id || `${Date.now()}-${Math.random()}`,
                    role: (msg.sender_type === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                    modality: (msg.source === 'voice' ? 'voice' : 'text') as 'text' | 'voice',
                    content: msg.content || '',
                    timestamp: msg.timestamp || new Date().toISOString(),
                    audioUri: msg.audio_content || msg.audio_url || msg.voice_file_url || msg.audio_uri || msg.audioUri,
                }));

                const sortedMessages = [...messages].sort((a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );

                addChatMessages(sortedMessages);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 600);
            }
        } catch (error: any) {
            console.error('[History] Load error:', error);
            setErrorMessage('Failed to load history');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [state.profile?.id, isOffline, conversationId, addChatMessages, flatListRef]);

    const handleRetry = useCallback(() => {
        if (!lastAttemptedMessage) return;
        if (lastAttemptedMessage.type === 'text') {
            sendTextMessage(lastAttemptedMessage.content);
        } else {
            sendRecording(lastAttemptedMessage.content, lastAttemptedMessage.duration || 0);
        }
    }, [lastAttemptedMessage]);

    return {
        conversationId,
        setConversationId,
        isLoading,
        isLoadingHistory,
        refreshing,
        typingMessages,
        setTypingMessages,
        pendingMessages,
        setPendingMessages,
        errorMessage,
        setErrorMessage,
        playingAudio,
        lastAttemptedMessage,
        sendTextMessage,
        sendRecording,
        onRefresh,
        animateTyping,
        handlePlayAudio,
        loadConversationHistory,
        handleRetry,
        clearError,
    };
};
