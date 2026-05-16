import { Tabs } from 'expo-router';
import { Home as HomeIcon, Droplets, Stethoscope, Users, UserCircle, GraduationCap } from 'lucide-react-native';
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
          height: 78,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: 'rgba(255,255,255,0.98)',
          shadowColor: shadows.floating.shadowColor,
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        },
        tabBarItemStyle: { borderRadius: radius.lg, marginHorizontal: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} /> }} />
      <Tabs.Screen name="blood" options={{ title: 'Supply', tabBarIcon: ({ color }) => <Droplets size={22} color={color} /> }} />
      <Tabs.Screen name="doctors" options={{ title: 'Doctors', tabBarIcon: ({ color }) => <Stethoscope size={22} color={color} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="training" options={{ title: 'Training', tabBarIcon: ({ color }) => <GraduationCap size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserCircle size={22} color={color} /> }} />
    </Tabs>
  );
}
