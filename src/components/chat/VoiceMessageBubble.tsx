import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { ChatMessage } from '@/context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_COUNT = 28;

interface VoiceMessageBubbleProps {
    message: ChatMessage;
    isUser: boolean;
    isPlaying: boolean;
    onPlayAudio?: (uri: string) => void;
}

export const VoiceMessageBubble = ({
    message,
    isUser,
    isPlaying,
    onPlayAudio
}: VoiceMessageBubbleProps) => {
    const [elapsed, setElapsed] = useState(0);
    const barAnimations = useRef(
        Array.from({ length: BAR_COUNT }, (_, i) => new Animated.Value(0.25 + (i % 5) * 0.1))
    ).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    // Animated waveform while playing
    useEffect(() => {
        if (isPlaying) {
            const animations = barAnimations.map((anim, i) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 0.2 + Math.random() * 0.8,
                            duration: 200 + (i % 7) * 60,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.15 + Math.random() * 0.4,
                            duration: 200 + (i % 5) * 50,
                            useNativeDriver: true,
                        }),
                    ])
                )
            );
            animationRef.current = Animated.parallel(animations);
            animationRef.current.start();
        } else {
            animationRef.current?.stop();
            barAnimations.forEach((anim, i) =>
                Animated.spring(anim, {
                    toValue: 0.25 + (i % 5) * 0.1,
                    useNativeDriver: true,
                    damping: 10,
                }).start()
            );
        }
        return () => animationRef.current?.stop();
    }, [isPlaying]);

    // Elapsed time counter
    useEffect(() => {
        if (!isPlaying) {
            setElapsed(0);
            return;
        }
        const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
        return () => clearInterval(interval);
    }, [isPlaying]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const accentColor = isUser ? 'rgba(255,255,255,0.95)' : palette.brandGreen;
    const secondaryColor = isUser ? 'rgba(255,255,255,0.55)' : '#A5C8AE';
    const bgColor = isUser ? 'rgba(255,255,255,0.18)' : 'rgba(67,160,71,0.1)';

    return (
        <View style={styles.container}>
            {/* Play / Pause button */}
            <Pressable
                style={[styles.playBtn, { backgroundColor: bgColor }]}
                onPress={() => {
                    if (message.audioUri && onPlayAudio) {
                        onPlayAudio(message.audioUri);
                    }
                }}
                accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
                accessibilityRole="button"
            >
                <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color={accentColor}
                />
            </Pressable>

            {/* Animated waveform bars */}
            <View style={styles.waveform}>
                {barAnimations.map((anim, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.bar,
                            {
                                backgroundColor: isPlaying
                                    ? accentColor
                                    : secondaryColor,
                                transform: [{ scaleY: anim }],
                            },
                        ]}
                    />
                ))}
            </View>

            {/* Duration / elapsed */}
            <Text style={[styles.duration, { color: secondaryColor }]}>
                {isPlaying ? formatTime(elapsed) : ''}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        minWidth: 180,
        maxWidth: SCREEN_WIDTH * 0.68,
    },
    playBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waveform: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 28,
        overflow: 'hidden',
    },
    bar: {
        flex: 1,
        height: 20,
        borderRadius: 2,
        minWidth: 3,
    },
    duration: {
        fontSize: 11,
        fontWeight: '600',
        minWidth: 30,
        textAlign: 'right',
    },
});
