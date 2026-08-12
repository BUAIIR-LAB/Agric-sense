import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import ProfileHeader from '@/components/ProfileHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonMessage } from '@/components/SkeletonLoader';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { spacing, radius } from '@/theme/spacing';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { RecordingIndicator } from '@/components/chat/RecordingIndicator';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { ToolContextBanner } from '@/components/chat/ToolContextBanner';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useChatMessaging } from '@/hooks/useChatMessaging';
import { AI_TOOL_LABELS } from '@/types/aiToolSession';

const QUICK_PROMPTS = [
  { icon: 'leaf', text: 'What diseases affect maize in wet weather?' },
  { icon: 'bug-outline', text: 'How do I control pests on my tomatoes?' },
  { icon: 'shovel', text: 'Best soil preparation tips for beans?' },
  { icon: 'weather-partly-cloudy', text: 'Farming advice for the current season?' },
] as const;

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId?: string;
    prompt?: string;
    autoSend?: string;
    continueSoil?: string;
    continueYield?: string;
    continueDiagnosis?: string;
    continueWeather?: string;
    continueTool?: string;
  }>();
  const { state, clearChatHistory, activeAiSession, clearActiveAiSession } = useAppContext();
  const { showAlert } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const autoSentPromptRef = useRef<string | null>(null);
  const toolContinueRef = useRef(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);


  // Online dot pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const {
    isVoiceRecording,
    recordingDuration,
    recordingStopped,
    stoppedRecordingUri,
    stoppedRecordingDuration,
    toggleVoiceRecording,
    stopRecording,
    cancelRecording,
    resetRecordingState,
    error: recordingError,
    setError: setRecordingError,
  } = useVoiceRecording();

  const {
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
    sendTextMessage,
    sendRecording,
    onRefresh,
    handlePlayAudio,
    loadConversationHistory,
    handleRetry,
  } = useChatMessaging(flatListRef);

  useEffect(() => {
    if (!params.prompt) return;
    const prompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
    if (!prompt) return;
    setInput(prompt);

    const autoSendRaw = Array.isArray(params.autoSend) ? params.autoSend[0] : params.autoSend;
    const shouldAutoSend = autoSendRaw === '1' || autoSendRaw === 'true';
    if (!shouldAutoSend) return;
    if (autoSentPromptRef.current === prompt) return;
    if (isLoading) return;

    autoSentPromptRef.current = prompt;
    // Let the screen settle, then send so history/clear effects don't wipe it.
    const timer = setTimeout(() => {
      void sendTextMessage(prompt);
      setInput('');
    }, 350);
    return () => clearTimeout(timer);
  }, [params.prompt, params.autoSend, isLoading, sendTextMessage]);

  // Continue tool advice: keep seeded messages and attach API conversation id for follow-ups.
  useEffect(() => {
    const flag = (v?: string | string[]) => {
      const raw = Array.isArray(v) ? v[0] : v;
      return raw === '1' || raw === 'true';
    };
    const incomingId = Array.isArray(params.conversationId)
      ? params.conversationId[0]
      : params.conversationId;

    const isContinue =
      flag(params.continueSoil) ||
      flag(params.continueYield) ||
      flag(params.continueDiagnosis) ||
      flag(params.continueWeather) ||
      flag(params.continueTool);

    if (isContinue) {
      toolContinueRef.current = true;
      setUsedSuggestions([]);
      if (incomingId) setConversationId(incomingId);
      return;
    }

    if (incomingId && state.profile?.id && conversationId !== incomingId) {
      loadConversationHistory(incomingId);
    }
  }, [
    params.conversationId,
    params.continueSoil,
    params.continueYield,
    params.continueDiagnosis,
    params.continueWeather,
    params.continueTool,
    state.profile?.id,
    conversationId,
    loadConversationHistory,
    setConversationId,
  ]);

  useFocusEffect(
    useCallback(() => {
      // Keep history when arriving with a tool prompt or continuing tool advice.
      if (
        params.prompt ||
        params.continueSoil ||
        params.continueYield ||
        params.continueDiagnosis ||
        params.continueWeather ||
        params.continueTool ||
        toolContinueRef.current
      ) {
        return;
      }
      const hasActiveConversation = conversationId || state.chatHistory.length > 0;
      const hasParamsConversation = !!params.conversationId;
      if (!hasParamsConversation && !hasActiveConversation) {
        clearChatHistory();
        clearActiveAiSession();
        setConversationId(null);
        setPendingMessages(new Map());
        setTypingMessages({});
      }
    }, [
      clearChatHistory,
      clearActiveAiSession,
      params.conversationId,
      params.prompt,
      params.continueSoil,
      params.continueYield,
      params.continueDiagnosis,
      params.continueWeather,
      params.continueTool,
      conversationId,
      state.chatHistory.length,
      setConversationId,
      setPendingMessages,
      setTypingMessages,
    ])
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    });
    return () => showSub.remove();
  }, []);

  const handleSend = () => {
    if (input.trim()) {
      sendTextMessage(input);
      setInput('');
    }
  };

  const handleSendRecording = async () => {
    if (stoppedRecordingUri) {
      const uri = stoppedRecordingUri;
      const duration = stoppedRecordingDuration;
      // Dismiss the recording panel immediately — don't wait for API
      resetRecordingState();
      await sendRecording(uri, duration);
    }
  };

  const openLibrary = () => {
    router.push('/library' as never);
  };

  const startNewConversation = () => {
    setConversationId(null);
    setPendingMessages(new Map());
    setTypingMessages({});
    clearChatHistory();
    clearActiveAiSession();
    setUsedSuggestions([]);
    toolContinueRef.current = false;
    setErrorMessage(null);
    setInput('');
  };

  const remainingSuggestions = useMemo(() => {
    if (!activeAiSession?.suggestions?.length) return [];
    return activeAiSession.suggestions.filter((s) => !usedSuggestions.includes(s));
  }, [activeAiSession, usedSuggestions]);

  const handleSuggestion = (text: string) => {
    setUsedSuggestions((prev) => [...prev, text]);
    sendTextMessage(text);
  };

  const allMessages = useMemo(
    () => [...state.chatHistory, ...Array.from(pendingMessages.values())],
    [state.chatHistory, pendingMessages]
  );

  const showToolSuggestions =
    !!activeAiSession &&
    allMessages.length > 0 &&
    remainingSuggestions.length > 0 &&
    !isLoading;

  // Tab bar is hidden on chat — only pad for the home-indicator / safe area.
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProfileHeader />
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back to home"
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/home')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={palette.charcoal} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName}>AgriSense AI</Text>
          <Text style={[styles.headerStatus, isLoading && styles.headerStatusThinking]}>
            {isLoading
              ? 'Thinking…'
              : activeAiSession
                ? AI_TOOL_LABELS[activeAiSession.tool]
                : 'Online'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityLabel="Start new conversation"
            accessibilityRole="button"
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            onPress={startNewConversation}
          >
            <MaterialCommunityIcons name="message-plus" size={22} color={palette.brandGreen} />
          </Pressable>
          <Pressable
            accessibilityLabel="Open library"
            accessibilityRole="button"
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            onPress={openLibrary}
          >
            <MaterialCommunityIcons name="bookshelf" size={22} color={palette.brandGreen} />
          </Pressable>
        </View>
      </View>

      {activeAiSession ? (
        <ToolContextBanner
          session={activeAiSession}
          onClear={() => {
            clearActiveAiSession();
            setUsedSuggestions([]);
          }}
        />
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + 60) : 0}
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
                isPlayingAudio={playingAudio === item.audioUri}
              />
            );
          }}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: bottomOffset + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brandGreen}
              colors={[palette.brandGreen]}
            />
          }
          ListFooterComponent={
            <>
              {isLoading ? <TypingIndicator /> : null}
              {showToolSuggestions ? (
                <SuggestionChips
                  suggestions={remainingSuggestions}
                  onSelect={handleSuggestion}
                  disabled={isLoading}
                />
              ) : null}
            </>
          }
          ListEmptyComponent={
            isLoadingHistory ? (
              <View style={styles.emptyContainer}>
                {[...Array(3)].map((_, i) => <SkeletonMessage key={i} />)}
              </View>
            ) : allMessages.length === 0 ? (
              <View style={styles.emptyContainer}>
                {/* Welcome card */}
                <LinearGradient
                  colors={[palette.brandGreenDark, palette.brandGreen]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.welcomeCard}
                >
                  <View style={styles.welcomeDecorCircle1} />
                  <View style={styles.welcomeDecorCircle2} />

                  <View style={styles.welcomeAvatarWrap}>
                    <View style={styles.welcomeAvatarRing}>
                      <MaterialCommunityIcons name="leaf" size={38} color={palette.white} />
                    </View>
                    <View style={styles.welcomeAvatarBadge}>
                      <MaterialCommunityIcons name="leaf" size={10} color={palette.white} />
                    </View>
                  </View>
                  <Text style={styles.welcomeTitle}>
                    Hello{state.profile?.name ? `, ${state.profile.name.split(' ')[0]}` : ''}! 👋
                  </Text>
                  <Text style={styles.welcomeSubtitle}>
                    Your personal farming expert — crops, pests, soil & weather, in your language.
                  </Text>
                  {state.profile?.preferredLanguage && state.profile.preferredLanguage !== 'English' && (
                    <View style={styles.welcomeLangBadge}>
                      <MaterialCommunityIcons name="translate" size={12} color="rgba(255,255,255,0.95)" />
                      <Text style={styles.welcomeLangText}>
                        Responding in {state.profile.preferredLanguage}
                      </Text>
                    </View>
                  )}
                </LinearGradient>

                {/* Quick prompts */}
                <Text style={styles.promptsLabel}>Quick questions</Text>
                <View style={styles.promptsGrid}>
                  {QUICK_PROMPTS.map((p) => (
                    <Pressable
                      key={p.text}
                      style={({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        sendTextMessage(p.text);
                      }}
                      accessibilityLabel={p.text}
                      accessibilityRole="button"
                      accessibilityHint="Tap to send this question"
                    >
                      <View style={styles.promptIconWrap}>
                        <MaterialCommunityIcons name={p.icon as any} size={17} color={palette.brandGreen} />
                      </View>
                      <Text style={styles.promptChipText} numberOfLines={2}>{p.text}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color={palette.brandGreen} style={{ opacity: 0.5 }} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            if (allMessages.length > 0) flatListRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {(isVoiceRecording || recordingStopped) && (
          <RecordingIndicator
            duration={recordingStopped ? stoppedRecordingDuration : recordingDuration}
            isRecording={isVoiceRecording}
            onStop={stopRecording}
            onCancel={cancelRecording}
            onSend={handleSendRecording}
          />
        )}

        {(errorMessage || recordingError) && (
          <View style={styles.errorBar} accessibilityRole="alert">
            <View style={styles.errorIconWrap}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={palette.danger} />
            </View>
            <Text style={styles.errorText} numberOfLines={1}>{errorMessage || recordingError}</Text>
            <Pressable
              onPress={() => {
                setErrorMessage(null);
                setRecordingError(null);
                handleRetry();
              }}
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Retry"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="refresh" size={15} color={palette.danger} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!isVoiceRecording && !recordingStopped && (
          <View style={[styles.inputContainer, { paddingBottom: bottomOffset }]}>
            <View style={styles.inputCard}>
              <Pressable
                style={({ pressed }) => [styles.micButton, pressed && styles.micButtonPressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleVoiceRecording();
                }}
                accessibilityLabel="Start voice message"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="microphone" size={20} color={palette.brandGreen} />
              </Pressable>

              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Ask about your crops…"
                placeholderTextColor={palette.ui.placeholder}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={1000}
                accessibilityLabel="Message input"
                accessibilityHint="Type your farming question here"
              />

              <Pressable
                style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!input.trim()}
                accessibilityLabel="Send message"
                accessibilityRole="button"
                accessibilityState={{ disabled: !input.trim() }}
              >
                <LinearGradient
                  colors={input.trim() ? [palette.brandGreenMid, palette.brandGreenDark] : [palette.tint[200], palette.tint[300]]}
                  style={styles.sendGradient}
                >
                  <MaterialCommunityIcons name="send" size={17} color={palette.white} />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface.screenAlt,
  },
  keyboardView: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 60,
    paddingVertical: 8,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border.greenLighter,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerButtonPressed: {
    backgroundColor: palette.tint[500],
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 1,
    minWidth: 0,
    marginLeft: 2,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.white,
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.semantic.success,
    borderWidth: 2,
    borderColor: palette.white,
  },
  headerInfo: {
    gap: 1,
  },
  headerName: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: palette.text.primary,
    letterSpacing: -0.2,
  },
  headerStatus: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: palette.text.tertiary,
  },
  headerStatusThinking: {
    color: palette.brandGreen,
    fontFamily: Fonts.semiBold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.tint[100],
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.ui.chipBorder,
  },
  langChipText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: palette.brandGreen,
    letterSpacing: 0.5,
  },

  // ── Messages ────────────────────────────────────────────────────────────────
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingVertical: 32,
  },

  // ── Welcome card ────────────────────────────────────────────────────────────
  welcomeCard: {
    borderRadius: 24,
    padding: 28,
    marginBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: palette.brandGreenDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeDecorCircle1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40,
    right: -40,
  },
  welcomeDecorCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -20,
    left: -20,
  },
  welcomeAvatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  welcomeAvatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAvatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.brandGreenMid,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 22,
    color: palette.white,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  welcomeLangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  welcomeLangText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.95)',
  },

  // ── Quick prompts ───────────────────────────────────────────────────────────
  promptsLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: palette.text.muted,
    marginBottom: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  promptsGrid: {
    gap: 8,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: palette.brandGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.ui.promptBorder,
  },
  promptChipPressed: {
    backgroundColor: palette.tint[500],
    transform: [{ scale: 0.98 }],
  },
  promptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptChipText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: palette.text.greenDark,
    lineHeight: 19,
  },

  // ── Error bar ───────────────────────────────────────────────────────────────
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.ui.errorBg,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: palette.danger,
    borderWidth: 1,
    borderColor: palette.ui.errorBorder,
  },
  errorIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(244,67,54,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: palette.ui.errorText,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(244,67,54,0.08)',
  },
  retryText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: palette.danger,
  },

  // ── Input bar ───────────────────────────────────────────────────────────────
  inputContainer: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border.greenLighter,
    paddingTop: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.input.background,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.input.border,
    minHeight: 48,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.ui.chipBorder,
  },
  micButtonPressed: {
    backgroundColor: palette.tint[200],
    transform: [{ scale: 0.94 }],
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: palette.text.dark,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
