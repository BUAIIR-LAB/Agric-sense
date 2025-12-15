export const palette = {
  // Brand colors
  brandGreen: '#2E7D32',
  brandGreenLight: '#66BB6A',
  brandGreenDark: '#1B5E20',
  
  // Semantic colors
  semantic: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },
  
  // Surface colors
  surface: {
    primary: '#FFFFFF',
    secondary: '#F5F5F5',
    tertiary: '#EEEEEE',
    elevated: '#FFFFFF',
  },
  
  // Text colors
  text: {
    primary: '#1B1B1B',
    secondary: '#424242',
    tertiary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
  },
  
  // Border colors
  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#757575',
  },
  
  // Legacy colors (for backward compatibility)
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
  hero: ['#2E7D32', '#1B5E20'],
  card: ['#2E7D32', '#66BB6A'],
};
