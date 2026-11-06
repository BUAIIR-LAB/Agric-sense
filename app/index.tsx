import { useEffect } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAppContext } from '@/context/AppContext';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';

export default function WelcomeScreen() {
  const router = useRouter();
  const { state, isHydrated } = useAppContext();

  useEffect(() => {
    if (isHydrated && state.isAuthenticated && state.profile) {
      router.replace('/(tabs)/home');
    }
  }, [isHydrated, state.isAuthenticated, state.profile, router]);

  if (!isHydrated || (state.isAuthenticated && state.profile)) {
    return (
      <View style={[styles.root, styles.loading]}>
        <StatusBar style="dark" />
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../assets/images/welcome/hero.jpg')}
        style={styles.background}
        resizeMode="cover"
        imageStyle={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.55)']}
          locations={[0, 0.28, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/images/splash-icon.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="AgriSense logo"
              />
            </View>
            <Text style={styles.heroCaption}>AgriSense</Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push('/register')}
              accessibilityRole="button"
              accessibilityLabel="Create a new account"
            >
              <Text style={styles.primaryLabel}>Create Account</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.secondaryLabel}>Sign In</Text>
            </Pressable>

            <Pressable
              style={styles.guestButton}
              onPress={() => router.push('/(tabs)/marketplace')}
              accessibilityRole="button"
              accessibilityLabel="Browse marketplace without signing in"
            >
              <Text style={styles.guestLabel}>Continue as guest</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a120c',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    // Bias crop so the drone sits higher and stays visible above the CTAs
    resizeMode: 'cover',
  },
  safe: {
    flex: 1,
  },
  top: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
  },
  heroCaption: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: palette.white,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    gap: 10,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: palette.white,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: palette.brandGreenDark,
  },
  guestButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.white,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pressed: {
    opacity: 0.88,
  },
});
