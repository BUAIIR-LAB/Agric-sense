export const palette = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  brandGreen: '#2E7D32',
  brandGreenLight: '#66BB6A',
  brandGreenDark: '#1B5E20',
  brandGreenMid: '#43A047',

  // ── Semantic ───────────────────────────────────────────────────────────────
  semantic: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },

  // ── Surface ────────────────────────────────────────────────────────────────
  surface: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#EEEEEE',
    elevated: '#FFFFFF',
    screen: '#F5FBF6',
    screenAlt: '#F2F6F3',
  },

  // ── Text ───────────────────────────────────────────────────────────────────
  text: {
    primary: '#1B1B1B',
    secondary: '#424242',
    tertiary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
    muted: '#546E5A',
    dark: '#1A2B1E',
    greenDark: '#2D3B30',
  },

  // ── Border ─────────────────────────────────────────────────────────────────
  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#757575',
    green: '#E1EDE4',
    greenLight: '#EEF5EF',
    greenLighter: '#EEF2EF',
    card: '#E8F0EA',
  },

  // ── Input ──────────────────────────────────────────────────────────────────
  input: {
    background: '#F4F8F5',
    backgroundFocused: '#F0F9F1',
    backgroundError: '#FFF5F5',
    border: '#DDE9E1',
    borderFocused: '#2E7D32',
    borderError: '#F44336',
  },

  // ── Green tints ────────────────────────────────────────────────────────────
  tint: {
    50: '#F5FBF6',
    100: '#E8F5E9',
    200: '#C8E6C9',
    300: '#A5D6A7',
    400: '#EBF5EC',
    500: '#F0F9F1',
  },

  // ── UI tokens ──────────────────────────────────────────────────────────────
  ui: {
    tabBarInactive: '#94A3B0',
    tabBarBackground: '#FFFFFF',
    offlineBanner: '#FF8F00',
    sheetHandle: '#DDE5E0',
    divider: '#EEF3EF',
    skeleton: '#E1EAE4',
    errorBg: '#FFF5F5',
    errorBorder: '#FFCDD2',
    errorText: '#C62828',
    footerNote: '#B0BEC5',
    placeholder: '#A8C5B0',
    chipBorder: '#C8E6C9',
    menuBackground: '#FFFFFF',
    promptBorder: '#EEF5EF',
  },

  // ── Legacy (kept for backward compatibility) ───────────────────────────────
  charcoal: '#1B1B1B',
  gray100: '#F4F7F5',
  gray200: '#E1E7E2',
  gray300: '#D2DAD4',
  gray400: '#9E9E9E',
  gray500: '#6B7D6E',
  gray600: '#424242',
  danger: '#F44336',
  warning: '#FF9800',
  success: '#4CAF50',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const gradients = {
  hero: ['#2E7D32', '#1B5E20'] as const,
  heroFull: ['#1B5E20', '#2E7D32', '#388E3C'] as const,
  card: ['#2E7D32', '#66BB6A'] as const,
  light: ['#E8F5E9', '#F1F8E9'] as const,
  aiGuide: ['#F1F8E9', '#FFFFFF'] as const,
};
