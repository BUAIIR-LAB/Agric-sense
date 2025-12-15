import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { ReactNode } from 'react';

import { palette } from '@/theme/colors';
import { shadows } from '@/theme/shadows';
import { radius, spacing } from '@/theme/spacing';

type CardVariant = 'solid' | 'elevated' | 'tinted';

type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  accessibilityLabel?: string;
};

const variantStyles: Record<CardVariant, ViewStyle> = {
  solid: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: '#E1EAE4',
  },
  elevated: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: '#E1EAE4',
    ...shadows.medium,
  },
  tinted: {
    backgroundColor: '#F5FBF6',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.12)',
  },
};

export const Card = ({ children, variant = 'solid', style, onPress, accessibilityLabel }: CardProps) => {
  const cardStyle = [styles.base, variantStyles[variant], style];

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.86,
  },
});
