import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ChevronRight, Droplets, Hospital, Stethoscope, Zap } from 'lucide-react-native';
import { api } from '@/lib/api';
import { formatDistance } from '@/lib/geo';
import { colors, radius, type } from '@/lib/theme';

export default function Nearby() {
  const router = useRouter();
  const [nearestAed, setNearestAed] = useState<string | null>(null);

  // Nearest defibrillator is the one number worth showing up front.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({});
        if (!pos) return;
        const { data } = await api.get('/aeds', { params: { lng: pos.coords.longitude, lat: pos.coords.latitude } });
        if (alive && data[0]) setNearestAed(`${formatDistance(data[0].distanceM)} · ${data[0].name}`);
      })().catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  const rows = [
    { icon: <Zap size={20} color={colors.warning} />, title: 'Defibrillators', detail: nearestAed ?? 'Public AEDs near you', path: '/aeds' },
    { icon: <Hospital size={20} color={colors.destructive} />, title: 'Hospitals & emergency numbers', detail: 'Call or get directions', path: '/sos' },
    { icon: <Stethoscope size={20} color={colors.info} />, title: 'Doctors', detail: 'Verified specialists', path: '/doctors' },
    { icon: <Droplets size={20} color={colors.destructive} />, title: 'Blood & supply', detail: 'Requests, donors and inventory', path: '/blood' },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title} accessibilityRole="header">Nearby</Text>
        <View style={styles.group}>
          {rows.map((r, i) => (
            <Pressable
              key={r.title}
              onPress={() => router.push(r.path as never)}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.muted }]}
              accessibilityRole="button"
            >
              <View style={styles.icon}>{r.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowDetail} numberOfLines={1}>{r.detail}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 40 },
  title: { ...type.largeTitle, color: colors.foreground, marginTop: 8, marginBottom: 16 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 68 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...type.headline, color: colors.foreground },
  rowDetail: { ...type.footnote, color: colors.mutedForeground, marginTop: 2 },
});
