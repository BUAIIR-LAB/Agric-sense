import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const handlePhoneChange = (text: string) => {
    const sanitized = sanitizePhoneNumber(text);
    const formatted = formatPhoneNumber(sanitized);
    setPhoneNumber(formatted);
    
    // Real-time validation
    if (sanitized.length > 0) {
      const validation = validatePhoneNumber(sanitized);
      if (!validation.isValid) {
        setPhoneError(validation.error || 'Invalid phone number');
      } else {
        setPhoneError(null);
      }
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
      console.log('🔐 Starting login...');
      console.log('   Phone number (sanitized):', sanitized);
      console.log('   Phone number length:', sanitized.length);
      // Login with phone number only (no password required)
      const success = await loginWithAPI(sanitized);
      console.log('🔐 Login result:', success);
      if (success) {
        console.log('✅ Login successful, navigating to home...');
        showAlert('success', 'Welcome Back', 'Signed in successfully.', {
          onConfirm: () => {
            router.replace('/(tabs)/home');
          },
        });
      } else {
        console.error('❌ Login returned false');
        showAlert(
          'error', 
          'Login Failed', 
          'Unable to connect to server. The server may be starting up (this can take 30-60 seconds). Please wait a moment and try again.'
        );
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      let errorMessage = error.message || 'Try again.';
      
      // Provide more specific error messages
      if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMessage = 'Login timed out. The server may be starting up (this can take 30-60 seconds). Please wait a moment and try again.';
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. The server may be starting up (this can take 30-60 seconds). Please wait a moment and try again. If the problem persists, check your internet connection.';
      } else if (error.response?.status === 404) {
        errorMessage = 'User not found. Please register first.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid credentials. Please check your phone number.';
      }
      
      showAlert('error', 'Login Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || contextLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 }) ?? 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section */}
          <LinearGradient
            colors={[palette.brandGreen, palette.brandGreenDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            <View style={styles.heroContent}>
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="login" size={40} color={palette.white} />
              </View>
              <Text style={styles.heroTitle}>Welcome Back</Text>
              <Text style={styles.heroSubtitle}>
                Sign in to continue
              </Text>
            </View>
          </LinearGradient>

          {/* Login Form */}
          <View style={styles.formSection}>
            <View style={styles.card}>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIcon}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color={palette.white} />
                </View>
                <TextInput
                  style={[styles.input, phoneError && styles.inputError]}
                  placeholder="0701 234 567"
                  placeholderTextColor={palette.gray500}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  maxLength={13} // Format: 0701 234 567
                  accessibilityLabel="Phone number input"
                />
              </View>
              {phoneError && (
                <Text style={styles.errorText}>{phoneError}</Text>
              )}

              <Pressable 
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]} 
                onPress={submit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <>
                    <Text style={styles.primaryLabel}>Sign In</Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color={palette.white} />
                  </>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.secondaryButton} onPress={() => router.push('/register')}>
                <MaterialCommunityIcons name="account-plus" size={18} color={palette.brandGreen} />
                <Text style={styles.secondaryLabel}>Register</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBF6',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: spacing.xl * 2,
    borderBottomRightRadius: spacing.xl * 2,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
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
  heroTitle: {
    fontFamily: appFont,
    fontSize: 32,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: appFont,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  formSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  card: {
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: '#F8FBF9',
    borderWidth: 1,
    borderColor: '#E1EDE4',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 16,
    color: palette.charcoal,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xl,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  primaryLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E1EDE4',
  },
  dividerText: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.gray500,
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  inputError: {
    borderColor: palette.danger,
  },
  errorText: {
    fontFamily: appFont,
    fontSize: 13,
    color: palette.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.lg + 36 + spacing.md, // Align with input
  },
});
