import { Dimensions, Platform, useWindowDimensions } from 'react-native';

// Base dimensions (iPhone 11 Pro as reference)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Get current screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Scale a value based on screen width
 * Useful for horizontal spacing, widths, and horizontal positioning
 */
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Scale a value based on screen height
 * Useful for vertical spacing, heights, and vertical positioning
 */
export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scale - balanced scaling with configurable factor
 * Factor of 0.5 means halfway between no scaling and full scaling
 * @param size - The size to scale
 * @param factor - Scaling factor (0 = no scaling, 1 = full scaling)
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

/**
 * Get responsive font size based on screen width
 * Ensures text remains readable across all device sizes
 */
export const responsiveFontSize = (size: number): number => {
  // Use moderate scaling for fonts to avoid extreme sizes
  return moderateScale(size, 0.3);
};

/**
 * Device type detection based on screen width
 */
export type DeviceType = 'small' | 'medium' | 'large' | 'tablet';

export const getDeviceType = (): DeviceType => {
  if (SCREEN_WIDTH < 375) return 'small';      // iPhone SE, small Android phones
  if (SCREEN_WIDTH < 414) return 'medium';     // iPhone 11 Pro, standard phones
  if (SCREEN_WIDTH < 768) return 'large';      // iPhone 14 Pro Max, large phones
  return 'tablet';                              // iPad, Android tablets
};

/**
 * Check if device is a tablet
 */
export const isTablet = (): boolean => {
  return getDeviceType() === 'tablet';
};

/**
 * Check if device is small (iPhone SE size or smaller)
 */
export const isSmallDevice = (): boolean => {
  return getDeviceType() === 'small';
};

/**
 * Get responsive spacing multiplier based on device type
 */
export const getSpacingMultiplier = (): number => {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'small':
      return 0.85;  // Reduce spacing on small devices
    case 'medium':
      return 1;     // Standard spacing
    case 'large':
      return 1.1;   // Slightly increase spacing
    case 'tablet':
      return 1.3;   // Increase spacing on tablets
    default:
      return 1;
  }
};

/**
 * React hook for responsive dimensions
 * Updates when screen size changes (e.g., rotation)
 */
export const useResponsiveDimensions = () => {
  const { width, height } = useWindowDimensions();
  
  const deviceType: DeviceType = 
    width < 375 ? 'small' :
    width < 414 ? 'medium' :
    width < 768 ? 'large' : 'tablet';
  
  const isSmall = deviceType === 'small';
  const isTablet = deviceType === 'tablet';
  
  const spacingMultiplier = 
    deviceType === 'small' ? 0.85 :
    deviceType === 'medium' ? 1 :
    deviceType === 'large' ? 1.1 : 1.3;
  
  return {
    width,
    height,
    deviceType,
    isSmall,
    isTablet,
    spacingMultiplier,
    scale: (size: number) => (width / BASE_WIDTH) * size,
    verticalScale: (size: number) => (height / BASE_HEIGHT) * size,
    moderateScale: (size: number, factor: number = 0.5) => 
      size + ((width / BASE_WIDTH) * size - size) * factor,
    responsiveFontSize: (size: number) => 
      size + ((width / BASE_WIDTH) * size - size) * 0.3,
  };
};

/**
 * Get responsive padding for screen edges
 */
export const getScreenPadding = (): number => {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'small':
      return 16;
    case 'medium':
      return 20;
    case 'large':
      return 24;
    case 'tablet':
      return 32;
    default:
      return 20;
  }
};

/**
 * Get max content width for tablets to prevent stretching
 */
export const getMaxContentWidth = (): number | undefined => {
  return isTablet() ? 600 : undefined;
};

/**
 * Platform-specific responsive value
 */
export const platformValue = <T,>(ios: T, android: T): T => {
  return Platform.select({ ios, android }) ?? ios;
};
