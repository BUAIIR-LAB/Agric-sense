/**
 * Font system — single source of truth for all font families.
 * Loaded in app/_layout.tsx via useFonts() from @expo-google-fonts/inter.
 * Import Fonts.* instead of declaring local appFont in each screen.
 */
export const Fonts = {
  regular: 'Inter',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
} as const;

/** Convenience alias for body / default text */
export const appFont = Fonts.regular;
