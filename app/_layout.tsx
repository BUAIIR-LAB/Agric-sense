import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/context/AppContext';
import { AlertProvider } from '@/components/AlertProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { initImageCache, manageCacheSize, clearOldCache } from '@/utils/imageCache';

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
  const [scaleAnim] = useState(new Animated.Value(0.3));
  const [opacityAnim] = useState(new Animated.Value(0));

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
                toValue: 1.2,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 400,
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

    // Start splash animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    prepare();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!appIsReady) {
    return (
      <View style={styles.splashContainer}>
        <Animated.View
          style={[
            styles.splashContent,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="leaf" size={100} color={palette.white} />
          </View>
          <Animated.Text
            style={[
              styles.splashText,
              {
                opacity: opacityAnim,
              },
            ]}
          >
            Agri-sense
          </Animated.Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <AlertProvider>
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  splashText: {
    fontFamily: Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System',
    fontSize: 24,
    fontWeight: '700',
    color: palette.white,
    letterSpacing: 1,
  },
});
