import { getSpacingMultiplier, getScreenPadding } from '@/utils/responsive';

export const spacing = {
  xs: 4,    // Tight spacing (icons, badges)
  sm: 8,    // Small gaps (list items)
  md: 12,   // Medium gaps (card padding)
  lg: 16,   // Large gaps (sections)
  xl: 20,   // Extra large (screen padding)
  xxl: 24,  // Section spacing
  mega: 32, // Major sections
  giga: 40, // Screen edges
  // Semantic spacing
  section: 32,  // Between major sections
  card: 20,     // Card internal padding
  screen: 20,   // Screen horizontal padding
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Get responsive spacing values based on device size
 * Multiplies base spacing by device-specific factor
 */
export const getResponsiveSpacing = () => {
  const multiplier = getSpacingMultiplier();

  return {
    xs: Math.round(spacing.xs * multiplier),
    sm: Math.round(spacing.sm * multiplier),
    md: Math.round(spacing.md * multiplier),
    lg: Math.round(spacing.lg * multiplier),
    xl: Math.round(spacing.xl * multiplier),
    xxl: Math.round(spacing.xxl * multiplier),
    mega: Math.round(spacing.mega * multiplier),
    giga: Math.round(spacing.giga * multiplier),
    section: Math.round(spacing.section * multiplier),
    card: Math.round(spacing.card * multiplier),
    screen: getScreenPadding(),
  };
};
