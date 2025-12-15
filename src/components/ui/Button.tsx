import React from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { elevation } from '@/theme/elevation';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getButtonStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.button, styles[`button_${variant}`], styles[`button_${size}`]];
    
    if (fullWidth) {
      baseStyle.push(styles.button_fullWidth);
    }
    
    if (isDisabled) {
      baseStyle.push(styles.button_disabled);
    }
    
    if (variant === 'primary') {
      baseStyle.push(elevation.medium);
    }
    
    return baseStyle;
  };

  const getTextStyle = (): TextStyle[] => {
    return [
      styles.text,
      styles[`text_${variant}`],
      styles[`text_${size}`],
      isDisabled && styles.text_disabled,
    ];
  };

  const getIconSize = () => {
    if (size === 'large') return 22;
    if (size === 'small') return 16;
    return 20;
  };

  const getIconColor = () => {
    if (isDisabled) {
      return variant === 'primary' ? 'rgba(255,255,255,0.5)' : palette.text.disabled;
    }
    if (variant === 'primary') return palette.white;
    if (variant === 'secondary') return palette.brandGreen;
    return palette.text.secondary;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        ...getButtonStyle(),
        pressed && !isDisabled && styles.button_pressed,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? palette.white : palette.brandGreen}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <MaterialCommunityIcons
              name={icon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.icon_left}
            />
          )}
          <Text style={getTextStyle()}>{label}</Text>
          {icon && iconPosition === 'right' && (
            <MaterialCommunityIcons
              name={icon}
              size={getIconSize()}
              color={getIconColor()}
              style={styles.icon_right}
            />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  // Variants
  button_primary: {
    backgroundColor: palette.brandGreen,
  },
  button_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: palette.brandGreen,
  },
  button_tertiary: {
    backgroundColor: palette.surface.secondary,
  },
  // Sizes
  button_large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  button_medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  button_small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  // States
  button_fullWidth: {
    width: '100%',
  },
  button_disabled: {
    opacity: 0.5,
  },
  button_pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  // Text styles
  text: {
    ...typography.label.medium,
  },
  text_primary: {
    color: palette.white,
    fontWeight: '700',
  },
  text_secondary: {
    color: palette.brandGreen,
    fontWeight: '600',
  },
  text_tertiary: {
    color: palette.text.secondary,
    fontWeight: '500',
  },
  text_large: {
    ...typography.label.large,
  },
  text_medium: {
    ...typography.label.medium,
  },
  text_small: {
    ...typography.label.small,
  },
  text_disabled: {
    opacity: 0.6,
  },
  // Icons
  icon_left: {
    marginRight: spacing.xs,
  },
  icon_right: {
    marginLeft: spacing.xs,
  },
});
