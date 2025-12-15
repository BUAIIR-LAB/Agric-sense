import { Platform } from 'react-native';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

export const typography = {
  // Display (Hero sections, large titles)
  display: {
    large: {
      fontFamily: appFont,
      fontSize: 48,
      fontWeight: '800' as const,
      lineHeight: 56,
    },
    medium: {
      fontFamily: appFont,
      fontSize: 36,
      fontWeight: '700' as const,
      lineHeight: 44,
    },
    small: {
      fontFamily: appFont,
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 36,
    },
  },
  // Headings
  heading: {
    h1: {
      fontFamily: appFont,
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    h2: {
      fontFamily: appFont,
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    h3: {
      fontFamily: appFont,
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    h4: {
      fontFamily: appFont,
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 22,
    },
  },
  // Body text
  body: {
    large: {
      fontFamily: appFont,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: appFont,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
    },
    small: {
      fontFamily: appFont,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    tiny: {
      fontFamily: appFont,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400' as const,
    },
  },
  // Labels & Captions
  label: {
    large: {
      fontFamily: appFont,
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    medium: {
      fontFamily: appFont,
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 18,
    },
    small: {
      fontFamily: appFont,
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
    },
  },
  // Caption (for backward compatibility and small text)
  caption: {
    fontFamily: appFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
};
