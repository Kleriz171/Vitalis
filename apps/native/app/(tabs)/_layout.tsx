import { Tabs } from 'expo-router';
import { GraduationCap, Home as HomeIcon, MapPin, UserCircle } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { t } from '@/lib/i18n';

// Four sections (HIG: tabs are places, never actions). SOS lives on Home, not in the bar.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.card },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('Home'), tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} /> }} />
      <Tabs.Screen name="nearby" options={{ title: t('Nearby'), tabBarIcon: ({ color }) => <MapPin size={22} color={color} /> }} />
      <Tabs.Screen name="learn" options={{ title: t('Learn'), tabBarIcon: ({ color }) => <GraduationCap size={22} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: t('Me'), tabBarIcon: ({ color }) => <UserCircle size={22} color={color} /> }} />
    </Tabs>
  );
}
