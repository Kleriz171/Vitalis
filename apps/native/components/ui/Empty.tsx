import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '@/lib/theme';

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export const Empty = ({ icon: Icon, title, description }: EmptyProps) => (
  <View style={styles.wrap}>
    {Icon && <Icon size={48} color="#94A3B8" />}
    <Text style={styles.title}>{title}</Text>
    {description && <Text style={styles.desc}>{description}</Text>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  title: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginTop: 12 },
  desc: { fontSize: 14, color: colors.mutedForeground, marginTop: 4, textAlign: 'center' },
});
