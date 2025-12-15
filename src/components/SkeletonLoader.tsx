import React from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonMessage: React.FC = () => (
  <View style={styles.messageSkeleton}>
    <SkeletonLoader width={60} height={60} borderRadius={30} />
    <View style={styles.messageContent}>
      <SkeletonLoader width="80%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="60%" height={16} borderRadius={4} />
    </View>
  </View>
);

export const SkeletonCard: React.FC = () => (
  <View style={styles.cardSkeleton}>
    <SkeletonLoader width="100%" height={120} borderRadius={8} style={{ marginBottom: 12 }} />
    <SkeletonLoader width="70%" height={18} borderRadius={4} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="50%" height={14} borderRadius={4} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: palette.gray200,
  },
  messageSkeleton: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  messageContent: {
    flex: 1,
  },
  cardSkeleton: {
    padding: spacing.md,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});

