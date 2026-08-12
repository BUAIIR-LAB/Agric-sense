import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { palette } from '@/theme/colors';

interface WaveformProps {
    bars?: number;
    animated?: boolean;
    color?: string;
    isUser?: boolean;
}

export const Waveform = ({
    bars = 20,
    animated = false,
    color = palette.white,
    isUser = false
}: WaveformProps) => {
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
    }, [animated, barAnimations]);

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

const styles = StyleSheet.create({
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
    },
    waveformBar: {
        width: 2,
        borderRadius: 1,
    },
});
