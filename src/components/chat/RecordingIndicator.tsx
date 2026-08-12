import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { Waveform } from './Waveform';

interface RecordingIndicatorProps {
    duration: number;
    isRecording: boolean;
    onStop: () => void;
    onCancel: () => void;
    onSend: () => void;
}

export const RecordingIndicator = ({
    duration,
    isRecording,
    onStop,
    onCancel,
    onSend
}: RecordingIndicatorProps) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!isRecording) {
            pulseAnim.setValue(1);
            pulseOpacity.setValue(1);
            return;
        }
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
                    Animated.timing(pulseOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
                ]),
                Animated.delay(100),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [isRecording, pulseAnim, pulseOpacity]);

    const formatDuration = (seconds: number): string => {
        if (seconds === 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.wrapper}>
            <LinearGradient
                colors={['#1B5E20', '#2E7D32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.recordingBar}
            >
                {/* Cancel */}
                <Pressable
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                    onPress={onCancel}
                    accessibilityLabel="Cancel recording"
                >
                    <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.8)" />
                </Pressable>

                {/* Center: mic + waveform/check + timer */}
                <View style={styles.recordingCenter}>
                    <View style={styles.recordingLeft}>
                        {isRecording ? (
                            <View style={styles.recordingDotWrap}>
                                <Animated.View
                                    style={[
                                        styles.recordingDotPulse,
                                        { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }
                                    ]}
                                />
                                <View style={styles.recordingDot} />
                            </View>
                        ) : (
                            <View style={styles.recordingReadyBadge}>
                                <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                            </View>
                        )}
                        {isRecording && <Waveform bars={14} animated={true} color="rgba(255,255,255,0.85)" />}
                    </View>
                    <Text style={styles.recordingTime}>{formatDuration(duration)}</Text>
                </View>

                {/* Stop / Send */}
                {isRecording ? (
                    <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.stopButton, pressed && styles.buttonPressed]}
                        onPress={onStop}
                        accessibilityLabel="Stop recording"
                    >
                        <MaterialCommunityIcons name="stop" size={18} color={palette.brandGreen} />
                    </Pressable>
                ) : (
                    <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.sendButton, pressed && styles.buttonPressed]}
                        onPress={onSend}
                        accessibilityLabel="Send recording"
                    >
                        <MaterialCommunityIcons name="send" size={17} color={palette.brandGreen} />
                    </Pressable>
                )}
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        paddingTop: 4,
    },
    recordingBar: {
        borderRadius: 28,
        paddingVertical: 10,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#1B5E20',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 8,
    },
    cancelButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 8,
    },
    recordingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDotWrap: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingDotPulse: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FF5252',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF1744',
    },
    recordingReadyBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingTime: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        letterSpacing: 0.5,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    sendButton: {
        backgroundColor: '#FFFFFF',
    },
    buttonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.93 }],
    },
});
