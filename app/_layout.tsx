import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import 'react-native-reanimated';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider } from '@/context/AppContext';
import { CartProvider } from '@/context/CartContext';
import { OrdersProvider } from '@/context/OrdersContext';
import { AlertProvider } from '@/components/AlertProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Fonts } from '@/theme/fonts';
import { registerForPushNotificationsAsync } from '@/utils/notifications';

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

  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    async function prepare() {
      try {
        timeoutId = setTimeout(() => {
          if (isMounted) {
            setAppIsReady(true);
            Animated.parallel([
              Animated.timing(scaleAnim, { toValue: 1.15, duration: 350, useNativeDriver: true }),
              Animated.timing(opacityAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
              Animated.timing(textOpacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            ]).start(() => {
              if (fontsLoaded) SplashScreen.hideAsync();
            });
          }
        }, 2000);
      } catch (e) {
        if (__DEV__) console.warn(e);
        if (isMounted) setAppIsReady(true);
      }
    }

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacityAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(textTranslateAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(progressAnim, { toValue: 1, duration: 1800, useNativeDriver: false }).start();

    prepare();
    registerForPushNotificationsAsync();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fontsLoaded]);

  // Hide splash once both app is ready AND fonts are loaded
  useEffect(() => {
    if (appIsReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  if (!appIsReady || !fontsLoaded) {
    return (
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.splashContainer}
      >
        <View style={styles.splashCircleLarge} />
        <View style={styles.splashCircleSmall} />

        <Animated.View style={[styles.splashLogoWrapper, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <View style={styles.splashLogoCircle}>
            <Image
              source={require('../assets/images/splash-icon.png')}
              style={styles.splashImage}
              resizeMode="contain"
              accessibilityLabel="AgriSense logo"
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.splashBrandWrapper, { opacity: textOpacityAnim, transform: [{ translateY: textTranslateAnim }] }]}>
          <Text style={styles.splashText}>AgriSense</Text>
          <Text style={styles.splashTagline}>Smart Farming, Better Yields</Text>
        </Animated.View>

        <View style={styles.splashProgressTrack}>
          <Animated.View
            style={[styles.splashProgressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <CartProvider>
            <OrdersProvider>
              <AlertProvider>
                <NetworkStatusBar />
                <ThemeProvider value={colorScheme === 'dark' ? darkTheme : lightTheme}>
                  <Stack screenOptions={{ headerShadowVisible: false, headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="register" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="profile" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="library" />
                    <Stack.Screen name="history/timeline" />
                    <Stack.Screen name="history/[type]/[id]" />
                    <Stack.Screen name="tools/soil-ph" />
                    <Stack.Screen name="tools/yield" />
                    <Stack.Screen name="tools/weather" />
                    <Stack.Screen name="cart" />
                    <Stack.Screen name="checkout" />
                    <Stack.Screen name="orders/index" />
                    <Stack.Screen name="orders/[id]" />
                  </Stack>
                  <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                </ThemeProvider>
              </AlertProvider>
            </OrdersProvider>
          </CartProvider>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
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
  splashBrandWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  splashText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  splashTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
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
