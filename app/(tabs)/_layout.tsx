import { Tabs, useRouter, useSegments, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';
import { useAppContext } from '@/context/AppContext';
import { useCart } from '@/context/CartContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { TAB_BAR_HEIGHT } from '@/constants/layout';

type Tab = {
  name: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: Href;
  match?: string[];
};

const ALL_TABS: Tab[] = [
  {
    name: 'home',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
    route: '/(tabs)/home',
  },
  {
    name: 'scan',
    label: 'Scan',
    icon: 'camera-plus-outline',
    activeIcon: 'camera-plus',
    route: '/(tabs)/scan?mode=symptom',
    match: ['scan', 'diagnosis', 'spectroscopy'],
  },
  {
    name: 'marketplace',
    label: 'Market',
    icon: 'storefront-outline',
    activeIcon: 'storefront',
    route: '/(tabs)/marketplace',
  },
  {
    name: 'chat',
    label: 'Chat',
    icon: 'message-outline',
    activeIcon: 'message',
    route: '/(tabs)/chat',
  },
  {
    name: 'history',
    label: 'History',
    icon: 'clock-outline',
    activeIcon: 'clock',
    route: '/(tabs)/history',
  },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];
  const { isOffline } = useAppContext();
  const { itemCount } = useCart();
  const onMarketplace = segments.includes('marketplace');
  const { isReady, isAuthenticated } = useAuthGuard({ allowGuest: true });

  const currentRoute = segments[segments.length - 1] || 'home';
  const hideTabBar = currentRoute === 'chat';

  const tabScales = useRef(ALL_TABS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(tabScales[0], { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(tabScales[0], { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [tabScales]);

  // Guests may only stay on Market; other tabs require sign-in
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated && !onMarketplace) {
      router.replace('/(tabs)/marketplace');
    }
  }, [isReady, isAuthenticated, onMarketplace, router]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.brandGreen} />
      </View>
    );
  }

  const isActive = (tab: Tab) => {
    if (tab.match) return tab.match.includes(currentRoute);
    return currentRoute === tab.name;
  };

  const handleTabPress = (index: number, route: Tab['route']) => {
    const tab = ALL_TABS[index];
    if (!isAuthenticated && tab.name !== 'marketplace') {
      router.push('/login');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(tabScales[index], { toValue: 0.8, duration: 65, useNativeDriver: true }),
      Animated.spring(tabScales[index], { toValue: 1, useNativeDriver: true, friction: 5, tension: 340 }),
    ]).start();
    router.push(route);
  };

  const renderTab = (tab: Tab, index: number) => {
    const active = isActive(tab);
    const showCartBadge = tab.name === 'marketplace' && itemCount > 0;
    return (
      <Pressable
        key={tab.name}
        style={styles.tabButton}
        onPress={() => handleTabPress(index, tab.route)}
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityHint={`Navigate to ${tab.label}`}
      >
        <Animated.View
          style={[styles.tabInner, { transform: [{ scale: tabScales[index] }] }]}
        >
          <View>
            <MaterialCommunityIcons
              name={(active ? tab.activeIcon : tab.icon) as any}
              size={24}
              color={active ? palette.brandGreen : palette.ui.tabBarInactive}
            />
            {showCartBadge ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={[styles.offlineBanner, { paddingTop: insets.top }]}>
          <MaterialCommunityIcons name="wifi-off" size={14} color={palette.white} />
          <Text style={styles.offlineBannerText}>Offline Mode · Using cached data</Text>
        </View>
      )}

      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="marketplace" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="diagnosis" options={{ href: null }} />
        <Tabs.Screen name="spectroscopy" options={{ href: null }} />
      </Tabs>

      {!hideTabBar && (
        <View
          style={[
            styles.tabBarContainer,
            { paddingBottom: Math.max(insets.bottom, 16), height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.tabBarTopLine} />
          <View style={styles.customTabBar}>
            {ALL_TABS.map((tab, index) => renderTab(tab, index))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface.screen,
  },
  offlineBanner: {
    backgroundColor: palette.ui.offlineBanner,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    zIndex: 1000,
  },
  offlineBannerText: {
    color: palette.white,
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.ui.tabBarBackground,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 100,
  },
  tabBarTopLine: {
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  customTabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TAB_BAR_HEIGHT - 8,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: palette.ui.tabBarInactive,
  },
  tabLabelActive: {
    fontFamily: Fonts.bold,
    color: palette.brandGreen,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#CC0C39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: palette.white,
  },
});
