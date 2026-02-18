import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useAppContext } from '@/context/AppContext';
import { palette } from '@/theme/colors';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

const FEATURES = [
  { icon: 'microscope' as const,          label: 'AI Crop Scan' },
  { icon: 'weather-partly-cloudy' as const, label: 'Weather Alerts' },
  { icon: 'robot' as const,               label: 'Expert AI Chat' },
];

const TRUST = [
  { icon: 'shield-check' as const, label: 'Secure' },
  { icon: 'earth'        as const, label: 'Multilingual' },
  { icon: 'school'       as const, label: 'Expert' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { state, isHydrated } = useAppContext();

  useEffect(() => {
    if (isHydrated && state.isAuthenticated && state.profile) {
      router.replace('/(tabs)/home');
    }
  }, [isHydrated, state.isAuthenticated, state.profile, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Full-screen gradient background */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#43A047']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative depth circles */}
      <View style={styles.decorCircleLarge} />
      <View style={styles.decorCircleSmall} />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Brand section ─────────────────────────────────────────── */}
        <View style={styles.brandSection}>
          {/* Logo */}
          <View style={styles.logoRing}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../assets/images/splash-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="AgriSense logo"
              />
            </View>
          </View>

          <Text style={styles.appName}>AgriSense</Text>
          <Text style={styles.appTagline}>Smart Farming, Better Yields</Text>

          {/* Feature pills */}
          <View style={styles.pillsRow}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.pill}>
                <MaterialCommunityIcons name={f.icon} size={13} color="rgba(255,255,255,0.95)" />
                <Text style={styles.pillText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA bottom sheet ──────────────────────────────────────── */}
        <View style={styles.ctaSheet}>
          {/* Sheet drag handle */}
          <View style={styles.sheetHandle} />

          <Text style={styles.ctaHeading}>Start your farming journey</Text>
          <Text style={styles.ctaBody}>
            Join thousands of farmers growing smarter with AI-powered crop insights.
          </Text>

          {/* Primary — Create Account (gradient button) */}
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/register')}
            accessibilityLabel="Create a new account"
          >
            <LinearGradient
              colors={['#2E7D32', '#1B5E20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <View style={styles.btnIconBadge}>
                <MaterialCommunityIcons name="account-plus" size={17} color={palette.brandGreen} />
              </View>
              <Text style={styles.primaryLabel}>Create Account</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
          </Pressable>

          {/* Secondary — Sign In (text link) */}
          <Pressable
            style={styles.signInRow}
            onPress={() => router.push('/login')}
            accessibilityLabel="Sign in with existing account"
          >
            <Text style={styles.signInText}>Already a member? </Text>
            <Text style={styles.signInLink}>Sign In →</Text>
          </Pressable>

          {/* Trust badges */}
          <View style={styles.trustDivider} />
          <View style={styles.trustRow}>
            {TRUST.map(t => (
              <View key={t.label} style={styles.trustItem}>
                <MaterialCommunityIcons name={t.icon} size={17} color={palette.brandGreen} />
                <Text style={styles.trustText}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  safeArea: {
    flex: 1,
  },

  // ── Decorative circles ───────────────────────────────────────────────────────
  decorCircleLarge: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -100,
    right: -100,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 100,
    left: -70,
  },

  // ── Brand section ────────────────────────────────────────────────────────────
  brandSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  logoRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
  },
  logoCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  logoImage: {
    width: 86,
    height: 86,
  },
  appName: {
    fontFamily: appFont,
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  appTagline: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: appFont,
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },

  // ── CTA sheet ────────────────────────────────────────────────────────────────
  ctaSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDE5E0',
    alignSelf: 'center',
    marginBottom: 4,
  },
  ctaHeading: {
    fontFamily: appFont,
    fontSize: 22,
    fontWeight: '800',
    color: palette.charcoal,
    letterSpacing: -0.3,
  },
  ctaBody: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    lineHeight: 20,
    marginTop: -4,
  },

  // Primary button
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  btnIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: appFont,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  // Sign in link
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  signInText: {
    fontFamily: appFont,
    fontSize: 15,
    color: palette.gray500,
  },
  signInLink: {
    fontFamily: appFont,
    fontSize: 15,
    fontWeight: '700',
    color: palette.brandGreen,
  },

  // Trust badges
  trustDivider: {
    height: 1,
    backgroundColor: '#EEF3EF',
    marginVertical: -2,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 2,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontFamily: appFont,
    fontSize: 11,
    fontWeight: '600',
    color: palette.gray500,
    letterSpacing: 0.3,
  },
});
