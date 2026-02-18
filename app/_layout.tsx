import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, Platform, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/context/AppContext';
import { AlertProvider } from '@/components/AlertProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { initImageCache, manageCacheSize, clearOldCache } from '@/utils/imageCache';
import { registerForPushNotificationsAsync } from '@/utils/notifications';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2E7D32',
    background: '#F4F7F5',
    text: '#1B1B1B',
    card: '#FFFFFF',
    border: '#DDE5DD',
    notification: '#66BB6A',
  },
};

const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#66BB6A',
    background: '#0F1A13',
    card: '#152719',
    text: '#F5F8F5',
    border: '#27402F',
    notification: '#81C784',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const [opacityAnim] = useState(new Animated.Value(0));
  const [textOpacityAnim] = useState(new Animated.Value(0));
  const [textTranslateAnim] = useState(new Animated.Value(20));
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    async function prepare() {
      try {
        // Simulate loading time for splash screen
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setAppIsReady(true);
            // Animate splash screen out
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 1.15,
                duration: 350,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
              }),
              Animated.timing(textOpacityAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start(() => {
              SplashScreen.hideAsync();
            });
          }
        }, 2000);
      } catch (e) {
        if (__DEV__) {
          console.warn(e);
        }
        if (isMounted) {
          setAppIsReady(true);
        }
      }
    }

    // Start splash animation — staggered entrance
    Animated.sequence([
      // 1. Logo springs in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      // 2. Brand text slides up
      Animated.parallel([
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateAnim, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Progress bar fills independently (JS driver — width interpolation)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start();

    prepare();
    registerForPushNotificationsAsync();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!appIsReady) {
    return (
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.splashContainer}
      >
        {/* Decorative background circles */}
        <View style={styles.splashCircleLarge} />
        <View style={styles.splashCircleSmall} />

        {/* Logo — springs in */}
        <Animated.View
          style={[
            styles.splashLogoWrapper,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <View style={styles.splashLogoCircle}>
            <Image
              source={require('../assets/images/splash-icon.png')}
              style={styles.splashImage}
              resizeMode="contain"
              accessibilityLabel="AgriSense logo"
            />
          </View>
        </Animated.View>

        {/* Brand text — slides up */}
        <Animated.View
          style={[
            styles.splashBrandWrapper,
            {
              opacity: textOpacityAnim,
              transform: [{ translateY: textTranslateAnim }],
            },
          ]}
        >
          <Text style={styles.splashText}>AgriSense</Text>
          <Text style={styles.splashTagline}>Smart Farming, Better Yields</Text>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.splashProgressTrack}>
          <Animated.View
            style={[
              styles.splashProgressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <AlertProvider>
          <NetworkStatusBar />
          <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
            <Stack screenOptions={{ headerShadowVisible: false, headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="register" />
              <Stack.Screen name="login" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </ThemeProvider>
        </AlertProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const SPLASH_FONT = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

const styles = StyleSheet.create({
  // ── Splash ──────────────────────────────────────────────────────────────────
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },

  // Decorative circles behind the logo
  splashCircleLarge: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -130,
    right: -110,
  },
  splashCircleSmall: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -50,
    left: -80,
  },

  // Logo
  splashLogoWrapper: {
    alignItems: 'center',
  },
  splashLogoCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 22,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  splashImage: {
    width: 110,
    height: 110,
  },

  // Brand text
  splashBrandWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  splashText: {
    fontFamily: SPLASH_FONT,
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  splashTagline: {
    fontFamily: SPLASH_FONT,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Progress bar
  splashProgressTrack: {
    position: 'absolute',
    bottom: 52,
    width: 100,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  splashProgressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
});
