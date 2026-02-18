import { Tabs, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

import { palette } from '@/theme/colors';

const appFont = Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }) ?? 'System';

type Tab = {
  name: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: any;
};

const TAB_BAR_HEIGHT = 64;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as string[];

  const isChatScreen = segments.includes('chat');
  const currentRoute = segments[segments.length - 1] || 'home';

  const tabs: Tab[] = [
    {
      name: 'diagnosis',
      label: 'Diagnose',
      icon: 'microscope',
      activeIcon: 'microscope',
      route: '/(tabs)/diagnosis',
    },
    {
      name: 'home',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
      route: '/(tabs)/home',
    },
    {
      name: 'history',
      label: 'History',
      icon: 'history',
      activeIcon: 'history',
      route: '/(tabs)/history',
    },
    {
      name: 'profile',
      label: 'Profile',
      icon: 'account-outline',
      activeIcon: 'account',
      route: '/(tabs)/profile',
    },
  ];

  // One animated scale value per tab
  const tabScales = useRef(tabs.map(() => new Animated.Value(1))).current;

  // FAB breathing pulse (scale only — native driver compatible)
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isChatScreen) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fabScale, {
          toValue: 1.08,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(fabScale, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isChatScreen]);

  const isActive = (tabName: string) => currentRoute === tabName;

  const handleTabPress = (index: number, route: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(tabScales[index], {
        toValue: 0.82,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(tabScales[index], {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 320,
      }),
    ]).start();
    router.push(route);
  };

  const handleFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/chat');
  };

  return (
    <View style={styles.container}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="diagnosis" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {!isChatScreen && (
        <>
          {/* Bottom Tab Bar */}
          <View
            style={[
              styles.tabBarContainer,
              {
                paddingBottom: Math.max(insets.bottom, 8),
                height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8),
              },
            ]}
          >
            {/* Subtle top highlight line */}
            <View style={styles.tabBarTopLine} />

            <View style={styles.customTabBar}>
              {tabs.map((tab, index) => {
                const active = isActive(tab.name);
                return (
                  <Pressable
                    key={tab.name}
                    style={styles.tabButton}
                    onPress={() => handleTabPress(index, tab.route)}
                    accessibilityLabel={tab.label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Animated.View
                      style={[
                        styles.tabInner,
                        { transform: [{ scale: tabScales[index] }] },
                      ]}
                    >
                      {/* Active pill background */}
                      {active && <View style={styles.activePill} />}

                      <MaterialCommunityIcons
                        name={(active ? tab.activeIcon : tab.icon) as any}
                        size={24}
                        color={active ? palette.brandGreen : '#94A3B0'}
                      />
                      <Text
                        style={[
                          styles.tabLabel,
                          active && styles.tabLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Chat FAB with pulse animation */}
          <Animated.View
            style={[
              styles.fabWrapper,
              {
                bottom: Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT + 12,
                transform: [{ scale: fabScale }],
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Open AI chat"
              accessibilityRole="button"
              onPress={handleFabPress}
              style={styles.fabPressable}
            >
              <LinearGradient
                colors={['#43A047', palette.brandGreen, '#1B5E20']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fab}
              >
                <MaterialCommunityIcons
                  name="robot"
                  size={26}
                  color={palette.white}
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    // Stronger shadow compared to before
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
    justifyContent: 'space-around',
    paddingTop: 6,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    position: 'relative',
    gap: 3,
  },
  activePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: '#EBF5EC',
  },
  tabLabel: {
    fontFamily: appFont,
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B0',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: palette.brandGreen,
    fontWeight: '700',
  },

  // ── FAB ─────────────────────────────────────────────────────────────────────
  fabWrapper: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    // Shadow rendered on the wrapper so the Animated scale works on it
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 14,
    zIndex: 99,
    borderRadius: 29,
  },
  fabPressable: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
