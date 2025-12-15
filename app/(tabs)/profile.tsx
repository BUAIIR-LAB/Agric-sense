import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { SUPPORTED_LANGUAGES, useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { PieChart } from '@/components/charts/PieChart';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

const getInitials = (name: string | undefined) =>
  name
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') ?? 'U';

export default function ProfileScreen() {
  const router = useRouter();
  const { state, updateProfile, logout } = useAppContext();
  const { showAlert } = useSweetAlert();
  const profile = state.profile;
  const initials = getInitials(profile?.name);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
    area: profile?.area ?? '',
    cropsGrown: (profile?.cropsGrown ?? []).join(', '),
    preferredLanguage: profile?.preferredLanguage ?? '',
  });
  const [isEditing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Calculate activity breakdown for pie chart
  const activityBreakdown = [
    {
      label: 'Diagnoses',
      value: state.diagnosisHistory.length,
      color: palette.brandGreen,
    },
    {
      label: 'Spectra',
      value: state.spectroscopyHistory.length,
      color: palette.success,
    },
    {
      label: 'Chats',
      value: state.chatHistory.length,
      color: palette.info,
    },
  ].filter((item) => item.value > 0); // Only show activities with data

  const handleLogout = async () => {
    showAlert(
      'warning',
      'Log Out',
      'Are you sure?',
      {
        showCancel: true,
        confirmText: 'Log Out',
        cancelText: 'Cancel',
        onConfirm: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
            showAlert('success', 'Logged Out', 'Logged out successfully.', {
              onConfirm: () => {
                router.replace('/');
              },
            });
          } catch (error: any) {
            showAlert('error', 'Logout Error', error.message || 'Failed to log out. Please try again.');
          } finally {
            setIsLoggingOut(false);
          }
        },
      }
    );
  };

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const persistChanges = async () => {
    setIsSaving(true);
    try {
      const normalizedLanguage =
        SUPPORTED_LANGUAGES.find(
          (lang) => lang.toLowerCase() === form.preferredLanguage.trim().toLowerCase(),
        ) ?? profile?.preferredLanguage ?? SUPPORTED_LANGUAGES[0];

      updateProfile({
        name: form.name,
        phoneNumber: form.phoneNumber,
        area: form.area,
        cropsGrown: form.cropsGrown
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        preferredLanguage: normalizedLanguage,
      });
      showAlert('success', 'Profile Updated', 'Profile saved.');
    } catch (error: any) {
      showAlert('error', 'Update Failed', error.message || 'Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-off" size={64} color={palette.gray500} />
          <Text style={styles.emptyTitle}>No Profile</Text>
          <Text style={styles.emptyText}>Register to continue</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/register')}>
            <MaterialCommunityIcons name="account-plus" size={20} color={palette.white} />
            <Text style={styles.primaryButtonText}>Register</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Gradient */}
        <LinearGradient
          colors={[palette.brandGreen, palette.brandGreenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.heroContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Pressable
                style={styles.editButton}
                onPress={() => {
                  if (isEditing) {
                    persistChanges();
                  }
                  setEditing((prev) => !prev);
                }}
                disabled={isSaving}
                accessibilityLabel={isEditing ? 'Save profile' : 'Edit profile'}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={palette.brandGreen} />
                ) : (
                  <MaterialCommunityIcons
                    name={isEditing ? 'check' : 'pencil'}
                    size={18}
                    color={isEditing ? palette.brandGreen : palette.white}
                  />
                )}
              </Pressable>
            </View>
            <Text style={styles.heroName}>{profile.name}</Text>
            <View style={styles.heroMeta}>
              <MaterialCommunityIcons name="map-marker" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroLocation}>{profile.area || 'Location not set'}</Text>
            </View>
            <View style={styles.heroMeta}>
              <MaterialCommunityIcons name="phone" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroPhone}>{profile.phoneNumber}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.contentSection}>
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="microscope" size={24} color={palette.white} />
            </View>
            <Text style={styles.statValue}>{state.diagnosisHistory.length}</Text>
            <Text style={styles.statLabel}>Diagnoses</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={palette.white} />
            </View>
            <Text style={styles.statValue}>{state.spectroscopyHistory.length}</Text>
            <Text style={styles.statLabel}>Spectra</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="robot-outline" size={24} color={palette.white} />
            </View>
            <Text style={styles.statValue}>{state.chatHistory.length}</Text>
            <Text style={styles.statLabel}>Chats</Text>
          </View>
        </View>

          {/* Activity Breakdown Chart */}
          {activityBreakdown.length > 0 && activityBreakdown.some(item => item.value > 0) && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Activity Breakdown</Text>
              <PieChart
                data={activityBreakdown}
                size={200}
                showLegend={true}
                showLabels={true}
              />
            </View>
          )}

          {/* Profile Information Card */}
          <View style={styles.contentCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account-details" size={20} color={palette.brandGreen} />
            <Text style={styles.sectionTitle}>Profile</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account" size={18} color={palette.gray500} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(text) => handleChange('name', text)}
                  editable={isEditing}
                  placeholder="Name"
                  placeholderTextColor={palette.gray500}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="phone" size={18} color={palette.gray500} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.phoneNumber}
                  onChangeText={(text) => handleChange('phoneNumber', text)}
                  editable={isEditing}
                  placeholder="Phone"
                  placeholderTextColor={palette.gray500}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Location</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="map-marker" size={18} color={palette.gray500} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.area}
                  onChangeText={(text) => handleChange('area', text)}
                  editable={isEditing}
                  placeholder="Location"
                  placeholderTextColor={palette.gray500}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Crops</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="sprout" size={18} color={palette.gray500} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={form.cropsGrown}
                  onChangeText={(text) => handleChange('cropsGrown', text)}
                  editable={isEditing}
                  placeholder="e.g. Maize, Beans, Cassava"
                  placeholderTextColor={palette.gray500}
                  multiline
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Language</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="translate" size={18} color={palette.gray500} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.preferredLanguage}
                  onChangeText={(text) => handleChange('preferredLanguage', text)}
                  editable={isEditing}
                  placeholder="English"
                  placeholderTextColor={palette.gray500}
                />
              </View>
            </View>
          </View>
        </View>

          {/* Logout Button */}
          <View style={styles.logoutSection}>
            <Pressable 
              style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]} 
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={palette.danger} />
              ) : (
                <MaterialCommunityIcons name="logout" size={20} color={palette.danger} />
              )}
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </Pressable>
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
  container: {
    paddingBottom: spacing.xxl * 2,
  },
  contentSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: appFont,
    fontSize: 24,
    fontWeight: '700',
    color: palette.charcoal,
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: appFont,
    fontSize: 16,
    color: palette.gray500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brandGreen,
    borderRadius: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '600',
    color: palette.white,
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
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
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
  avatarText: {
    fontFamily: appFont,
    fontSize: 40,
    fontWeight: '800',
    color: palette.white,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: palette.brandGreenDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 12,
  },
  heroName: {
    fontFamily: appFont,
    fontSize: 32,
    fontWeight: '800',
    color: palette.white,
    textAlign: 'center',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroLocation: {
    fontFamily: appFont,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  heroPhone: {
    fontFamily: appFont,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  chartCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
  },
  chartTitle: {
    fontFamily: appFont,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: appFont,
    fontSize: 28,
    fontWeight: '800',
    color: palette.charcoal,
  },
  statLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
    textAlign: 'center',
  },
  contentCard: {
    backgroundColor: palette.white,
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E1EDE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
  },
  formSection: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: appFont,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray500,
    marginBottom: spacing.xs / 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1EDE4',
    borderRadius: spacing.md,
    backgroundColor: '#FAFBFA',
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: appFont,
    fontSize: 15,
    color: palette.charcoal,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.md,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  logoutSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.white,
    borderRadius: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#FFE0E0',
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 12,
  },
  logoutButtonText: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '600',
    color: palette.danger,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
});

