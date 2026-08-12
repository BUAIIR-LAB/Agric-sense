import { useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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

  // Avoid flashing the landing CTAs while we restore a saved session
  if (!isHydrated || (state.isAuthenticated && state.profile)) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.appName}>AgriSense</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Brand section ─────────────────────────────────────────── */}
        <View style={styles.brandSection}>
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="AgriSense logo"
          />
          <Text style={styles.appName}>AgriSense</Text>
          <Text style={styles.appTagline}>Smart Farming, Better Yields</Text>
        </View>

        {/* ── CTA section ──────────────────────────────────────── */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaHeading}>Start your farming journey</Text>
          <Text style={styles.ctaBody}>
            Join thousands of farmers growing smarter with AI-powered crop insights.
          </Text>

          {/* Primary — Create Account */}
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/register')}
            accessibilityLabel="Create a new account"
          >
            <Text style={styles.primaryLabel}>Create Account</Text>
          </Pressable>

          {/* Secondary — Sign In */}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/login')}
            accessibilityLabel="Sign in with existing account"
          >
            <Text style={styles.secondaryLabel}>Sign In</Text>
          </Pressable>

          <Pressable
            style={styles.ghostButton}
            onPress={() => router.push('/(tabs)/marketplace')}
            accessibilityLabel="Browse marketplace without signing in"
          >
            <Text style={styles.ghostLabel}>Browse marketplace as guest</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.brandGreen,
  },
  safeArea: {
    flex: 1,
  },

  // ── Brand section ────────────────────────────────────────────────────────────
  brandSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  appName: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appTagline: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },

  // ── CTA section ────────────────────────────────────────────────────────────────
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  ctaHeading: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ctaBody: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },

  // Primary button
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    fontWeight: '600',
    color: palette.brandGreen,
  },

  // Secondary button
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ghostButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textDecorationLine: 'underline',
  },
});
