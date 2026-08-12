import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { ChatMessage } from '@/context/AppContext';
import { VoiceMessageBubble } from './VoiceMessageBubble';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageBubbleProps {
    message: ChatMessage;
    isTyping?: boolean;
    displayedText?: string;
    onPlayAudio?: (uri: string) => void;
    isPlayingAudio?: boolean;
}

export const MessageBubble = ({
    message,
    isTyping,
    displayedText,
    onPlayAudio,
    isPlayingAudio
}: MessageBubbleProps) => {
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
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const minutes = Math.floor(diff / 60000);

            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    return (
        <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
            {!isUser && (
                <LinearGradient colors={['#43A047', '#1B5E20']} style={styles.avatar}>
                    <MaterialCommunityIcons name="leaf" size={15} color={palette.white} />
                </LinearGradient>
            )}
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>

                {/* Case 1: Voice message from user → waveform player */}
                {isVoiceMessage && isUser && message.audioUri && (
                    <VoiceMessageBubble
                        message={message}
                        isUser={isUser}
                        isPlaying={isPlayingAudio || false}
                        onPlayAudio={onPlayAudio}
                    />
                )}

                {/* Case 2: Voice response from assistant → audio-only card */}
                {!isUser && message.modality === 'voice' && message.audioUri && (
                    <View style={styles.voiceResponseCard}>
                        <MaterialCommunityIcons
                            name={isPlayingAudio ? 'waveform' : 'volume-high'}
                            size={16}
                            color={palette.brandGreen}
                        />
                        <VoiceMessageBubble
                            message={message}
                            isUser={false}
                            isPlaying={isPlayingAudio || false}
                            onPlayAudio={onPlayAudio}
                        />
                    </View>
                )}

                {/* Case 3: Text messages (user or assistant) */}
                {(message.modality !== 'voice') && (
                    <>
                        {isUser ? (
                            <LinearGradient
                                colors={['#43A047', '#2E7D32']}
                                style={styles.userGradientInner}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={[styles.messageText, styles.messageTextUser]} selectable={!isTyping}>
                                    {content}
                                </Text>
                                {!isTyping && (
                                    <View style={styles.messageMeta}>
                                        <Text style={styles.timeTextUser}>{formatTime(message.timestamp)}</Text>
                                        <MaterialCommunityIcons
                                            name="check-all"
                                            size={13}
                                            color="rgba(255,255,255,0.65)"
                                        />
                                    </View>
                                )}
                            </LinearGradient>
                        ) : (
                            <View style={styles.assistantContent}>
                                <Text style={styles.messageText} selectable={!isTyping}>
                                    {content}
                                    {isTyping && !isUser && showCursor && (
                                        <Text style={styles.cursor}>▊</Text>
                                    )}
                                </Text>

                                {message.audioUri && !isTyping && (
                                    <View style={styles.assistantAudioPlayer}>
                                        <VoiceMessageBubble
                                            message={message}
                                            isUser={isUser}
                                            isPlaying={isPlayingAudio || false}
                                            onPlayAudio={onPlayAudio}
                                        />
                                    </View>
                                )}

                                {!isTyping && (
                                    <View style={styles.messageMeta}>
                                        <Text style={styles.timeText}>{formatTime(message.timestamp)}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 10,
        gap: 8,
    },
    messageRowUser: {
        flexDirection: 'row-reverse',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#2E7D32',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
    },
    bubble: {
        maxWidth: SCREEN_WIDTH * 0.74,
        borderRadius: 20,
        overflow: 'hidden',
    },
    bubbleUser: {
        borderBottomRightRadius: 5,
        shadowColor: '#2E7D32',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    bubbleAssistant: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 5,
        paddingHorizontal: 14,
        paddingVertical: 11,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E8F0EA',
    },
    userGradientInner: {
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#1A2B1E',
        fontWeight: '400',
    },
    messageTextUser: {
        color: '#FFFFFF',
        fontWeight: '400',
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        alignSelf: 'flex-end',
        gap: 4,
    },
    timeText: {
        fontSize: 11,
        color: '#90A898',
        fontWeight: '400',
    },
    timeTextUser: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '400',
    },
    cursor: {
        color: palette.brandGreen,
        fontWeight: '700',
        marginLeft: 2,
    },
    assistantContent: {
        width: '100%',
    },
    assistantAudioPlayer: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 4,
        marginLeft: -4,
    },
    voiceResponseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
});
