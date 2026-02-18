import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { FarmerProfile, useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatPhoneNumber, validatePhoneNumber, sanitizePhoneNumber } from '@/utils/phoneNumber';
import { sanitizeText } from '@/utils/sanitize';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

const createGuestProfile = (phone: string): FarmerProfile => {
  const timestamp = new Date().toISOString();
  return {
    id: `guest-${Date.now()}`,
    name: 'Guest Farmer',
    phoneNumber: phone || `Guest-${Date.now()}`,
    area: 'Unknown Area',
    preferredLanguage: 'English',
    cropsGrown: [],
    gpsLocation: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithAPI, isLoading: contextLoading } = useAppContext();
  const { showAlert } = useSweetAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const formSectionY = useRef(0);
  const { height: windowHeight } = useWindowDimensions();

  const scrollFormIntoView = useCallback((keyboardHeight: number = 280) => {
    const scrollY = formSectionY.current - (windowHeight - keyboardHeight - 220);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollY), animated: true });
  }, [windowHeight]);

  useEffect(() => {
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => scrollFormIntoView(e.endCoordinates?.height ?? 280)
    );
    return () => sub.remove();
  }, [scrollFormIntoView]);

  const handlePhoneChange = (text: string) => {
    const sanitized = sanitizePhoneNumber(text);
    setPhoneNumber(formatPhoneNumber(sanitized));
    if (sanitized.length > 0) {
      const v = validatePhoneNumber(sanitized);
      setPhoneError(v.isValid ? null : (v.error || 'Invalid phone number'));
    } else {
      setPhoneError(null);
    }
  };

  const submit = async () => {
    const sanitized = sanitizePhoneNumber(phoneNumber);
    if (!sanitized) {
      showAlert('warning', 'Phone Required', 'Enter your phone number.');
      return;
    }
    const validation = validatePhoneNumber(sanitized);
    if (!validation.isValid) {
      setPhoneError(validation.error || 'Invalid phone number');
      showAlert('warning', 'Invalid Number', validation.error || 'Enter a valid phone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await loginWithAPI(sanitized);
      if (success) {
        showAlert('success', 'Welcome Back', 'Signed in successfully.', {
          onConfirm: () => router.replace('/(tabs)/home'),
        });
      } else {
        showAlert('error', 'Login Failed',
          'Unable to connect. The server may be starting up — please wait a moment and try again.');
      }
    } catch (error: any) {
      let msg = error.message || 'Try again.';
      if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        msg = 'Login timed out. Please wait a moment and try again.';
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        msg = 'Network error. Check your internet connection and try again.';
      } else if (error.response?.status === 404) {
        msg = 'User not found. Please register first.';
      } else if (error.response?.status === 401) {
        msg = 'Invalid credentials. Please check your phone number.';
      }
      showAlert('error', 'Login Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || contextLoading;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative circles */}
      <View style={styles.decorCircleLarge} />
      <View style={styles.decorCircleSmall} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* ── Brand section ─────────────────────────────── */}
            <View style={[styles.brandSection, { minHeight: windowHeight * 0.40 }]}>
              {/* Back button */}
              <Pressable
                style={styles.backBtn}
                onPress={() => router.replace('/')}
                accessibilityLabel="Go back"
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
              </Pressable>

              <View style={styles.logoRing}>
                <View style={styles.logoCircle}>
                  <Image
                    source={require('../assets/images/splash-icon.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Text style={styles.appName}>AgriSense</Text>
              <Text style={styles.heroTitle}>Welcome back</Text>
              <Text style={styles.heroSub}>Sign in to continue to your farm dashboard</Text>
            </View>

            {/* ── Form bottom sheet ──────────────────────────── */}
            <View
              style={styles.formSheet}
              onLayout={(e) => { formSectionY.current = e.nativeEvent.layout.y; }}
            >
              <View style={styles.sheetHandle} />

              {/* Phone number field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={[
                  styles.inputRow,
                  isFocused && styles.inputRowFocused,
                  !!phoneError && styles.inputRowError,
                ]}>
                  <View style={styles.inputIconBadge}>
                    <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="0701 234 567"
                    placeholderTextColor="#B0BEC5"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    onFocus={() => {
                      setIsFocused(true);
                      setTimeout(() => scrollFormIntoView(280), 100);
                    }}
                    onBlur={() => setIsFocused(false)}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    maxLength={13}
                    accessibilityLabel="Phone number"
                  />
                </View>
                {phoneError && (
                  <View style={styles.errorRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={13} color={palette.danger} />
                    <Text style={styles.errorText}>{phoneError}</Text>
                  </View>
                )}
              </View>

              {/* Sign In button */}
              <Pressable
                style={[styles.primaryButton, isLoading && styles.primaryDisabled]}
                onPress={submit}
                disabled={isLoading}
                accessibilityLabel="Sign in"
              >
                <LinearGradient
                  colors={isLoading ? ['#A5D6A7', '#A5D6A7'] : ['#2E7D32', '#1B5E20']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryLabel}>Sign In</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color="rgba(255,255,255,0.85)" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register link */}
              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.push('/register')}
                accessibilityLabel="Create a new account"
              >
                <MaterialCommunityIcons name="account-plus" size={17} color={palette.brandGreen} />
                <Text style={styles.secondaryLabel}>Create Account</Text>
              </Pressable>

              {/* Footer note */}
              <Text style={styles.footerNote}>
                Your data is protected and never shared without consent.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B5E20' },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1 },

  // Decor
  decorCircleLarge: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -90,
    right: -90,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: 120,
    left: -60,
  },

  // ── Brand section ────────────────────────────────────────────────────────────
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 8,
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
  },
  logoCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 14,
  },
  logoImage: { width: 70, height: 70 },
  appName: {
    fontFamily: appFont,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: appFont,
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: appFont,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // ── Form sheet ───────────────────────────────────────────────────────────────
  formSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 20,
    flex: 1,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDE5E0',
    alignSelf: 'center',
    marginBottom: 4,
  },

  // Field
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '700',
    color: palette.charcoal,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: '#F4F8F5',
    borderWidth: 1.5,
    borderColor: '#DDE9E1',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputRowFocused: {
    borderColor: palette.brandGreen,
    backgroundColor: '#F0F9F1',
  },
  inputRowError: {
    borderColor: palette.danger,
    backgroundColor: '#FFF5F5',
  },
  inputIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 16,
    color: palette.charcoal,
    fontWeight: '500',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 2,
  },
  errorText: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.danger,
    fontWeight: '500',
  },

  // Primary button
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 4,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryLabel: {
    fontFamily: appFont,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  primaryDisabled: { opacity: 0.7 },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: -2,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EEF3EF' },
  dividerText: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
    fontWeight: '500',
  },

  // Secondary button
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.brandGreen,
    backgroundColor: '#F0F9F1',
  },
  secondaryLabel: {
    fontFamily: appFont,
    color: palette.brandGreen,
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer
  footerNote: {
    fontFamily: appFont,
    fontSize: 12,
    color: '#B0BEC5',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: -4,
  },
});
