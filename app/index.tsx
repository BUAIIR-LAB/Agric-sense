import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppContext } from '@/context/AppContext';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

export default function WelcomeScreen() {
  const router = useRouter();
  const { state, isHydrated } = useAppContext();

  useEffect(() => {
    // Once app is hydrated, check if user is already authenticated
    // If authenticated, redirect to home screen immediately
    if (isHydrated) {
      if (state.isAuthenticated && state.profile) {
        console.log('✅ User is authenticated, redirecting to home...');
        router.replace('/(tabs)/home');
      } else {
        console.log('ℹ️ User is not authenticated, showing welcome screen');
      }
    }
  }, [isHydrated, state.isAuthenticated, state.profile, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Gradient */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="leaf" size={44} color={palette.white} />
              </View>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.title}>Agri-sense</Text>
              <Text style={styles.subtitle}>
                AI-powered crop diagnosis
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <View style={styles.ctaCard}>
            <Pressable 
              style={styles.primaryButton} 
              onPress={() => router.push('/register')}
              accessibilityLabel="Register as farmer"
            >
              <View style={styles.buttonIconContainer}>
                <MaterialCommunityIcons name="account-plus" size={20} color={palette.white} />
              </View>
              <Text style={styles.primaryLabel}>Register</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={palette.white} />
            </Pressable>
            
            <Pressable 
              style={styles.secondaryButton} 
              onPress={() => router.push('/login')}
              accessibilityLabel="Sign in with phone number"
            >
              <MaterialCommunityIcons name="login" size={18} color={palette.brandGreen} />
              <Text style={styles.secondaryLabel}>Sign In</Text>
            </Pressable>
          </View>
        </View>

        {/* Trust Indicators */}
        <View style={styles.trustSection}>
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="shield-check" size={24} color={palette.brandGreen} />
            <Text style={styles.trustText}>Secure</Text>
          </View>
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="translate" size={24} color={palette.brandGreen} />
            <Text style={styles.trustText}>Multilingual</Text>
          </View>
          <View style={styles.trustItem}>
            <MaterialCommunityIcons name="school" size={24} color={palette.brandGreen} />
            <Text style={styles.trustText}>Expert</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: spacing.xl * 2,
    borderBottomRightRadius: spacing.xl * 2,
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  logoBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  heroText: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: appFont,
    fontSize: 38,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: appFont,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  ctaSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  ctaCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  ctaTitle: {
    fontFamily: appFont,
    fontSize: 24,
    fontWeight: '700',
    color: palette.charcoal,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontFamily: appFont,
    fontSize: 14,
    lineHeight: 20,
    color: palette.gray500,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  buttonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: spacing.lg,
    borderWidth: 2,
    borderColor: palette.brandGreen,
    backgroundColor: palette.white,
  },
  secondaryLabel: {
    fontFamily: appFont,
    color: palette.brandGreen,
    fontSize: 17,
    fontWeight: '600',
  },
  trustSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustText: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
    textAlign: 'center',
    fontWeight: '500',
  },
});
