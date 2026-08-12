import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileHeader from '@/components/ProfileHeader';
import { useAppContext } from '@/context/AppContext';
import { useOrders } from '@/context/OrdersContext';
import apiService from '@/services/api';
import { palette } from '@/theme/colors';
import { elevation } from '@/theme/elevation';
import { Fonts } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';
import { formatUgx } from '@/types/marketplace';
import { isProfileIncomplete } from '@/utils/profileCompleteness';

type ServiceItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  iconColor: string;
  href: string;
};

const SERVICES: ServiceItem[] = [
  {
    key: 'diagnosis',
    title: 'Crop diagnosis',
    subtitle: 'Spot disease from leaf photos',
    icon: 'camera-plus',
    tint: '#E8F5E9',
    iconColor: palette.brandGreen,
    href: '/(tabs)/scan?mode=symptom',
  },
  {
    key: 'early',
    title: 'Early detection',
    subtitle: 'Spectrum scan before symptoms',
    icon: 'chart-timeline-variant',
    tint: '#E3F2FD',
    iconColor: '#1565C0',
    href: '/(tabs)/scan?mode=early',
  },
  {
    key: 'weather',
    title: 'Weather',
    subtitle: 'Local forecast for your farm',
    icon: 'weather-partly-cloudy',
    tint: '#E0F7FA',
    iconColor: '#00838F',
    href: '/tools/weather',
  },
  {
    key: 'yield',
    title: 'Yield estimate',
    subtitle: 'Project harvest and returns',
    icon: 'sprout',
    tint: '#F1F8E9',
    iconColor: '#558B2F',
    href: '/tools/yield',
  },
  {
    key: 'soil',
    title: 'Soil pH',
    subtitle: 'Check acidity and amendments',
    icon: 'test-tube',
    tint: '#FFF3E0',
    iconColor: '#EF6C00',
    href: '/tools/soil-ph',
  },
  {
    key: 'market',
    title: 'Marketplace',
    subtitle: 'Sell produce or buy inputs',
    icon: 'storefront-outline',
    tint: '#FCE4EC',
    iconColor: '#C2185B',
    href: '/(tabs)/marketplace',
  },
  {
    key: 'chat',
    title: 'Farm advisor',
    subtitle: 'Ask about crops and pests',
    icon: 'message-text-outline',
    tint: '#EDE7F6',
    iconColor: '#5E35B1',
    href: '/(tabs)/chat',
  },
  {
    key: 'history',
    title: 'History',
    subtitle: 'Past scans and records',
    icon: 'clock-outline',
    tint: '#ECEFF1',
    iconColor: '#546E7A',
    href: '/(tabs)/history',
  },
];

const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);

export default function HomeScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { orders, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [profileNudgeDismissed, setProfileNudgeDismissed] = useState(false);
  const [salesUgx, setSalesUgx] = useState(0);
  const [earningsLoading, setEarningsLoading] = useState(true);

  const needsProfileCompletion = isProfileIncomplete(state.profile);

  const inputsSpentUgx = useMemo(() => {
    return orders
      .filter((o) => PAID_STATUSES.has(o.status))
      .flatMap((o) => o.items)
      .filter((i) => i.kind === 'input')
      .reduce((sum, i) => sum + i.quantity * i.unitPriceUgx, 0);
  }, [orders]);

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const data = await apiService.getSellerEarnings();
      setSalesUgx((data.availableUgx ?? 0) + (data.paidUgx ?? 0));
    } catch {
      setSalesUgx(0);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = `profile-nudge-dismissed:${state.profile?.id ?? 'anon'}`;
        const raw = await AsyncStorage.getItem(key);
        if (mounted && raw === '1') setProfileNudgeDismissed(true);
        else if (mounted) setProfileNudgeDismissed(false);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [state.profile?.id]);

  const dismissProfileNudge = async () => {
    setProfileNudgeDismissed(true);
    try {
      const key = `profile-nudge-dismissed:${state.profile?.id ?? 'anon'}`;
      await AsyncStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadEarnings(), refreshOrders()]);
    setRefreshing(false);
  };

  const openService = (href: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(href as never);
  };

  const recentActivity = useMemo(() => {
    const diagnosis = state.diagnosisHistory.map((item) => ({
      id: item.id,
      type: 'diagnosis' as const,
      title: 'Symptom Scan',
      subtitle: `${item.suspectedIssues[0] ?? 'Diagnosis'} · ${new Date(item.timestamp).toLocaleDateString()}`,
      timestamp: item.timestamp,
      icon: 'camera-plus' as const,
      color: palette.brandGreen,
    }));
    const spectroscopy = state.spectroscopyHistory.map((item) => ({
      id: item.id,
      type: 'spectroscopy' as const,
      title: 'Early Scan',
      subtitle: `${item.sampleName} · ${new Date(item.timestamp).toLocaleDateString()}`,
      timestamp: item.timestamp,
      icon: 'chart-timeline-variant' as const,
      color: '#1565C0',
    }));
    return [...diagnosis, ...spectroscopy]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 2);
  }, [state.diagnosisHistory, state.spectroscopyHistory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProfileHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandGreen}
            colors={[palette.brandGreen]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingLabel}>Welcome back,</Text>
            <Text style={styles.greetingName}>
              {state.profile ? state.profile.name.split(' ')[0] : 'Farmer'}
            </Text>
          </View>
        </View>

        {needsProfileCompletion && !profileNudgeDismissed ? (
          <View style={styles.profileNudge}>
            <Pressable
              style={styles.profileNudgeMain}
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Complete your farm profile"
            >
              <View style={styles.profileNudgeIcon}>
                <MaterialCommunityIcons
                  name="account-edit-outline"
                  size={22}
                  color={palette.brandGreen}
                />
              </View>
              <View style={styles.profileNudgeText}>
                <Text style={styles.profileNudgeTitle}>Complete your farm profile</Text>
                <Text style={styles.profileNudgeBody}>
                  Add your area and crops for better advice.
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => void dismissProfileNudge()}
              hitSlop={10}
              accessibilityLabel="Dismiss profile reminder"
              style={styles.profileNudgeClose}
            >
              <MaterialCommunityIcons name="close" size={20} color={palette.gray400} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.moneyRow}>
          <Pressable
            style={({ pressed }) => [styles.moneyCard, pressed && styles.pressed]}
            onPress={() => openService('/(tabs)/marketplace?mode=sell')}
            accessibilityRole="button"
            accessibilityLabel="From sales"
          >
            <View style={[styles.moneyIcon, { backgroundColor: '#E8F5E9' }]}>
              <MaterialCommunityIcons name="cash-plus" size={20} color={palette.brandGreen} />
            </View>
            <Text style={styles.moneyLabel}>From sales</Text>
            <Text style={styles.moneyValue} numberOfLines={1}>
              {earningsLoading ? '…' : formatUgx(salesUgx)}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.moneyCard, pressed && styles.pressed]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/orders');
            }}
            accessibilityRole="button"
            accessibilityLabel="Spent on inputs"
          >
            <View style={[styles.moneyIcon, { backgroundColor: '#FFF3E0' }]}>
              <MaterialCommunityIcons name="cart-outline" size={20} color="#EF6C00" />
            </View>
            <Text style={styles.moneyLabel}>Spent on inputs</Text>
            <Text style={styles.moneyValue} numberOfLines={1}>
              {formatUgx(inputsSpentUgx)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <Pressable
                key={service.key}
                style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
                onPress={() => openService(service.href)}
                accessibilityRole="button"
                accessibilityLabel={service.title}
              >
                <View style={[styles.serviceIcon, { backgroundColor: service.tint }]}>
                  <MaterialCommunityIcons
                    name={service.icon}
                    size={24}
                    color={service.iconColor}
                  />
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceSubtitle} numberOfLines={2}>
                  {service.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent activity</Text>
            <Pressable onPress={() => router.push('/(tabs)/history')} accessibilityRole="button">
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>
          {recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {recentActivity.map((item) => (
                <Pressable
                  key={`${item.type}-${item.id}`}
                  style={({ pressed }) => [styles.activityItem, pressed && styles.pressed]}
                  onPress={() => router.push(`/history/${item.type}/${item.id}`)}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.activityIcon,
                      item.type === 'spectroscopy' && styles.activityIconSpectrum,
                    ]}
                  >
                    <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activitySubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={palette.gray400} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <MaterialCommunityIcons name="clock-outline" size={36} color={palette.gray300} />
              <Text style={styles.emptyActivityText}>No recent activity</Text>
              <Text style={styles.emptyActivitySubtext}>
                Start with crop diagnosis or early detection
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface.screen,
  },
  content: {
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  greetingLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: palette.gray500,
  },
  greetingName: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: palette.charcoal,
  },
  profileNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border.card,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
    ...elevation.low,
  },
  profileNudgeMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileNudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNudgeText: { flex: 1 },
  profileNudgeTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.charcoal,
  },
  profileNudgeBody: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.gray500,
    marginTop: 2,
  },
  profileNudgeClose: {
    padding: 10,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  moneyCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border.card,
    ...elevation.low,
  },
  moneyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  moneyLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: palette.gray500,
    marginBottom: 4,
  },
  moneyValue: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: palette.charcoal,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: palette.charcoal,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  seeAllText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.brandGreen,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '47.5%',
    flexGrow: 1,
    maxWidth: '48.5%',
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border.card,
    ...elevation.low,
    minHeight: 128,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.charcoal,
    marginBottom: 4,
  },
  serviceSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.gray500,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  activityList: {
    gap: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border.card,
    gap: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.tint[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconSpectrum: {
    backgroundColor: '#E3F2FD',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: palette.charcoal,
  },
  activitySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: palette.gray500,
    marginTop: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border.card,
  },
  emptyActivityText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: palette.charcoal,
  },
  emptyActivitySubtext: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: palette.gray500,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
