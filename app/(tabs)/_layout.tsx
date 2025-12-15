import { Tabs, useRouter, useSegments } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme/colors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  // Check if we're on the chat screen
  const isChatScreen = segments.includes('chat');
  const currentRoute = segments[segments.length - 1] || 'home';

  // Tab configuration - 5 tabs in a row with relatable agricultural icons
  const tabs = [
    { name: 'diagnosis', icon: 'microscope', route: '/(tabs)/diagnosis' }, // Plant health diagnosis - microscope for analysis
    { name: 'spectroscopy', icon: 'chart-timeline-variant', route: '/(tabs)/spectroscopy' }, // Data analysis - timeline chart for spectroscopy
    { name: 'home', icon: 'leaf', route: '/(tabs)/home' }, // Home - leaf icon
    { name: 'history', icon: 'history', route: '/(tabs)/history' }, // Past records
    { name: 'profile', icon: 'account', route: '/(tabs)/profile' }, // User profile
  ];

  const isActive = (tabName: string) => currentRoute === tabName;

  return (
    <View style={styles.container}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            display: 'none', // Hide default tab bar, we'll use custom
          },
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="diagnosis" />
        <Tabs.Screen name="spectroscopy" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {!isChatScreen && (
        <>
          {/* WhatsApp-style Tab Bar - Fixed at bottom */}
          <View style={[
            styles.tabBarContainer, 
            { 
              bottom: 0,
              paddingBottom: Math.max(insets.bottom, 0),
            }
          ]}>
            <View style={styles.customTabBar}>
              {/* All 5 tabs in a row - WhatsApp style (clean, flat icons) */}
              {tabs.map((tab) => (
                <Pressable
                  key={tab.name}
                  style={styles.tabButton}
                  onPress={() => router.push(tab.route)}
                  accessibilityLabel={tab.name.charAt(0).toUpperCase() + tab.name.slice(1)}
                >
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={28}
                    color={isActive(tab.name) ? palette.brandGreen : '#8696A0'}
                  />
                </Pressable>
              ))}
            </View>
          </View>
          
          {/* Chat FAB - Floating action button (WhatsApp style) */}
          <Pressable
            accessibilityLabel="Open chat"
            style={[
              styles.fabContainer,
              {
                bottom: Math.max(insets.bottom, 0) + 60, // Tab bar height + spacing
              },
            ]}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <LinearGradient
              colors={[palette.brandGreen, '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <MaterialCommunityIcons name="message-text" size={28} color={palette.white} />
            </LinearGradient>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 100,
  },
  customTabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingVertical: 0,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.brandGreen,
    elevation: 12,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    zIndex: 99,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
