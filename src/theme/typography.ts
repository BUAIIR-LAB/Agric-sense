import { Fonts } from './fonts';
import { responsiveFontSize } from '@/utils/responsive';

export const typography = {
  // Display (Hero sections, large titles)
  display: {
    large: {
      fontFamily: Fonts.extraBold,
      fontSize: 48,
      lineHeight: 56,
    },
    medium: {
      fontFamily: Fonts.bold,
      fontSize: 36,
      lineHeight: 44,
    },
    small: {
      fontFamily: Fonts.bold,
      fontSize: 28,
      lineHeight: 36,
    },
  },
  // Headings
  heading: {
    h1: {
      fontFamily: Fonts.bold,
      fontSize: 24,
      lineHeight: 32,
    },
    h2: {
      fontFamily: Fonts.semiBold,
      fontSize: 20,
      lineHeight: 28,
    },
    h3: {
      fontFamily: Fonts.semiBold,
      fontSize: 18,
      lineHeight: 24,
    },
    h4: {
      fontFamily: Fonts.semiBold,
      fontSize: 16,
      lineHeight: 22,
    },
  },
  // Body text
  body: {
    large: {
      fontFamily: Fonts.regular,
      fontSize: 16,
      lineHeight: 24,
    },
    medium: {
      fontFamily: Fonts.regular,
      fontSize: 15,
      lineHeight: 22,
    },
    small: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      lineHeight: 20,
    },
    tiny: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      lineHeight: 16,
    },
  },
  // Labels & Captions
  label: {
    large: {
      fontFamily: Fonts.semiBold,
      fontSize: 14,
      lineHeight: 20,
    },
    medium: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      lineHeight: 18,
    },
    small: {
      fontFamily: Fonts.medium,
      fontSize: 12,
      lineHeight: 16,
    },
  },
  caption: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
};

export const getResponsiveTypography = () => ({
  display: {
    large: { ...typography.display.large, fontSize: responsiveFontSize(48), lineHeight: responsiveFontSize(56) },
    medium: { ...typography.display.medium, fontSize: responsiveFontSize(36), lineHeight: responsiveFontSize(44) },
    small: { ...typography.display.small, fontSize: responsiveFontSize(28), lineHeight: responsiveFontSize(36) },
  },
  heading: {
    h1: { ...typography.heading.h1, fontSize: responsiveFontSize(24), lineHeight: responsiveFontSize(32) },
    h2: { ...typography.heading.h2, fontSize: responsiveFontSize(20), lineHeight: responsiveFontSize(28) },
    h3: { ...typography.heading.h3, fontSize: responsiveFontSize(18), lineHeight: responsiveFontSize(24) },
    h4: { ...typography.heading.h4, fontSize: responsiveFontSize(16), lineHeight: responsiveFontSize(22) },
  },
  body: {
    large: { ...typography.body.large, fontSize: responsiveFontSize(16), lineHeight: responsiveFontSize(24) },
    medium: { ...typography.body.medium, fontSize: responsiveFontSize(15), lineHeight: responsiveFontSize(22) },
    small: { ...typography.body.small, fontSize: responsiveFontSize(14), lineHeight: responsiveFontSize(20) },
    tiny: { ...typography.body.tiny, fontSize: responsiveFontSize(12), lineHeight: responsiveFontSize(16) },
  },
  label: {
    large: { ...typography.label.large, fontSize: responsiveFontSize(14), lineHeight: responsiveFontSize(20) },
    medium: { ...typography.label.medium, fontSize: responsiveFontSize(13), lineHeight: responsiveFontSize(18) },
    small: { ...typography.label.small, fontSize: responsiveFontSize(12), lineHeight: responsiveFontSize(16) },
  },
  caption: { ...typography.caption, fontSize: responsiveFontSize(12), lineHeight: responsiveFontSize(16) },
});
