import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { palette } from '@/theme/colors';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

export default function ProfileScreen() {
  const router = useRouter();
  const { state, logout, clearChatHistory, clearDiagnosisHistory, clearSpectroscopyHistory, resetAll } = useAppContext();
  const { showAlert } = useSweetAlert();
  const [isResetting, setIsResetting] = useState(false);

  if (!state.profile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, styles.textShadow]}>No profile found. Please register first.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/register')}>
          <View style={styles.buttonIcon}>
            <MaterialCommunityIcons name="account-plus" size={18} color={palette.white} />
          </View>
          <Text style={[styles.primaryLabel, styles.textShadow]}>Go to Registration</Text>
        </Pressable>
      </View>
    );
  }

  const confirmReset = () => {
    showAlert(
      'warning',
      'Reset Application',
      'This will remove your profile and all history. This action cannot be undone. Are you sure?',
      {
        showCancel: true,
        confirmText: 'Reset',
        cancelText: 'Cancel',
        onConfirm: async () => {
          setIsResetting(true);
          try {
            resetAll();
            showAlert('success', 'Application Reset', 'All data has been cleared successfully.', {
              onConfirm: () => {
                router.replace('/');
              },
            });
          } catch (error: any) {
            showAlert('error', 'Reset Failed', error.message || 'Failed to reset application. Please try again.');
          } finally {
            setIsResetting(false);
          }
        },
      }
    );
  };

  const handleLogout = () => {
    showAlert('info', 'Log Out', 'Are you sure you want to log out?', {
      showCancel: true,
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      onConfirm: () => {
        logout();
        router.replace('/');
      },
    });
  };

  const handleClearChat = () => {
    showAlert('warning', 'Clear Chat History', 'This will permanently delete all your chat messages. Continue?', {
      showCancel: true,
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        clearChatHistory();
        showAlert('success', 'Chat History Cleared', 'All chat messages have been deleted.');
      },
    });
  };

  const handleClearDiagnosis = () => {
    showAlert('warning', 'Clear Diagnoses', 'This will permanently delete all your diagnosis records. Continue?', {
      showCancel: true,
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        clearDiagnosisHistory();
        showAlert('success', 'Diagnoses Cleared', 'All diagnosis records have been deleted.');
      },
    });
  };

  const handleClearSpectroscopy = () => {
    showAlert('warning', 'Clear Spectroscopy', 'This will permanently delete all your spectroscopy records. Continue?', {
      showCancel: true,
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        clearSpectroscopyHistory();
        showAlert('success', 'Spectroscopy Cleared', 'All spectroscopy records have been deleted.');
      },
    });
  };

  const stats = [
    { label: 'Chat Sessions', value: state.chatHistory.length, icon: 'message-text-outline' as const },
    { label: 'Diagnosis Runs', value: state.diagnosisHistory.length, icon: 'microscope' as const },
    { label: 'Spectra Logged', value: state.spectroscopyHistory.length, icon: 'chart-timeline-variant' as const },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <View style={styles.avatarLarge}>
          <MaterialCommunityIcons name="account-circle" size={48} color={palette.white} />
        </View>
        <Text style={[styles.heading, styles.textShadow]}>{state.profile.name}</Text>
        <Text style={[styles.subtitle, styles.textShadow]}>{state.profile.phoneNumber}</Text>
        <View style={styles.profileDetails}>
          <DetailRow label="Area" value={state.profile.area} />
          <DetailRow label="Preferred Language" value={state.profile.preferredLanguage} />
          <DetailRow
            label="Crops Grown"
            value={state.profile.cropsGrown.length ? state.profile.cropsGrown.join(', ') : 'Not specified'}
          />
          {state.profile.gpsLocation && (
            <DetailRow
              label="GPS"
              value={`${state.profile.gpsLocation.latitude.toFixed(4)}, ${state.profile.gpsLocation.longitude.toFixed(4)}`}
            />
          )}
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/register')}>
          <View style={styles.buttonIcon}>
            <MaterialCommunityIcons name="pencil" size={18} color={palette.white} />
          </View>
          <Text style={[styles.primaryLabel, styles.textShadow]}>Edit Profile</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name={stat.icon} size={18} color={palette.white} />
            </View>
            <Text style={[styles.statValue, styles.textShadow]}>{stat.value}</Text>
            <Text style={[styles.statLabel, styles.textShadow]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="database" size={18} color={palette.white} />
          </View>
          <Text style={[styles.cardTitle, styles.textShadow]}>Manage Data</Text>
        </View>
        <Pressable style={styles.outlineButton} onPress={handleClearChat}>
          <Text style={[styles.outlineLabel, styles.textShadow]}>Clear Chat History</Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={handleClearDiagnosis}>
          <Text style={[styles.outlineLabel, styles.textShadow]}>Clear Diagnoses</Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={handleClearSpectroscopy}>
          <Text style={[styles.outlineLabel, styles.textShadow]}>Clear Spectroscopy</Text>
        </Pressable>
        <Pressable 
          style={[styles.alertButton, isResetting && styles.alertButtonDisabled]} 
          onPress={confirmReset}
          disabled={isResetting}
        >
          {isResetting ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <>
              <View style={styles.alertIcon}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={palette.white} />
              </View>
              <Text style={[styles.alertLabel, styles.textShadow]}>Reset Application</Text>
            </>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.secondaryButton} onPress={handleLogout}>
        <View style={styles.secondaryIcon}>
          <MaterialCommunityIcons name="logout" size={16} color={palette.white} />
        </View>
        <Text style={[styles.secondaryLabel, styles.textShadow]}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, styles.textShadow]}>{label}</Text>
    <Text style={[styles.detailValue, styles.textShadow]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 140,
    gap: 24,
    backgroundColor: palette.white,
  },
  textShadow: {
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.white,
    gap: 16,
  },
  emptyText: {
    fontFamily: appFont,
    fontSize: 16,
    color: palette.charcoal,
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: palette.white,
    borderRadius: 26,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    borderColor: '#E1EAE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: appFont,
    fontSize: 24,
    fontWeight: '700',
    color: palette.charcoal,
  },
  subtitle: {
    fontFamily: appFont,
    fontSize: 15,
    color: palette.gray500,
  },
  profileDetails: {
    width: '100%',
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailLabel: {
    fontFamily: appFont,
    color: palette.gray500,
    fontSize: 13,
  },
  detailValue: {
    fontFamily: appFont,
    color: palette.charcoal,
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.brandGreen,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.brandGreenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
    borderColor: '#E1EAE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: appFont,
    color: palette.charcoal,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: appFont,
    color: palette.gray500,
    fontSize: 13,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E1EAE4',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '700',
    color: palette.charcoal,
  },
  outlineButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1EAE4',
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: palette.white,
  },
  outlineLabel: {
    fontFamily: appFont,
    color: palette.charcoal,
    fontWeight: '600',
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#D84315',
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#BF360C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertLabel: {
    fontFamily: appFont,
    color: palette.white,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#E1EAE4',
  },
  secondaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: appFont,
    color: palette.brandGreenDark,
    fontWeight: '600',
  },
  alertButtonDisabled: {
    opacity: 0.6,
  },
});
