import { Tabs } from 'expo-router';
import { Home as HomeIcon, Droplets, Stethoscope, Users, UserCircle } from 'lucide-react-native';
import { colors, radius, shadows } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 18,
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          borderTopWidth: 0,
          borderRadius: radius.xl,
          backgroundColor: 'rgba(255,255,255,0.96)',
          ...shadows.floating,
        },
        tabBarItemStyle: { borderRadius: radius.lg, marginHorizontal: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} /> }} />
      <Tabs.Screen name="blood" options={{ title: 'Supply', tabBarIcon: ({ color }) => <Droplets size={22} color={color} /> }} />
      <Tabs.Screen name="doctors" options={{ title: 'Doctors', tabBarIcon: ({ color }) => <Stethoscope size={22} color={color} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserCircle size={22} color={color} /> }} />
    </Tabs>
  );
}
