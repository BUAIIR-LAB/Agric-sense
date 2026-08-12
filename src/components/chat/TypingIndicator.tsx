import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';

export const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const bubbleScale = useRef(new Animated.Value(0.85)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(bubbleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        ]).start();

        // Dot bounce animations
        const createAnimation = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: -6, duration: 350, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
                    Animated.delay(400),
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
    }, [dot1, dot2, dot3, bubbleOpacity, bubbleScale]);

    return (
        <View style={styles.typingRow}>
            {/* AI avatar */}
            <LinearGradient colors={['#43A047', '#1B5E20']} style={styles.typingAvatar}>
                <MaterialCommunityIcons name="leaf" size={15} color="#FFFFFF" />
            </LinearGradient>

            <Animated.View style={[styles.typingBubble, { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] }]}>
                <View style={styles.typingDots}>
                    <Animated.View style={[styles.typingDot, styles.typingDot1, { transform: [{ translateY: dot1 }] }]} />
                    <Animated.View style={[styles.typingDot, styles.typingDot2, { transform: [{ translateY: dot2 }] }]} />
                    <Animated.View style={[styles.typingDot, styles.typingDot3, { transform: [{ translateY: dot3 }] }]} />
                </View>
                <Text style={styles.thinkingLabel}>Thinking</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    typingRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    typingAvatar: {
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
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderBottomLeftRadius: 5,
        paddingHorizontal: 16,
        paddingVertical: 13,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E8F0EA',
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 18,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    typingDot1: {
        backgroundColor: '#66BB6A',
    },
    typingDot2: {
        backgroundColor: '#43A047',
    },
    typingDot3: {
        backgroundColor: '#2E7D32',
    },
    thinkingLabel: {
        fontSize: 13,
        color: palette.brandGreen,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
});
