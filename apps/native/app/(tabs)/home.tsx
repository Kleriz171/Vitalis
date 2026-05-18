import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import {
  Activity,
  AlertCircle,
  Bot,
  ChevronRight,
  Heart,
  LogOut,
  MapPin,
  Pill,
  QrCode,
  ShieldCheck,
  Siren,
  Stethoscope,
  Users,
} from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { logout, RootState } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { colors, radius } from '@/lib/theme';

type SOSState = 'idle' | 'broadcasting' | 'pending' | 'matched' | 'resolved';

const formatEta = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function Home() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const router = useRouter();

  const [sos, setSos] = useState<SOSState>('idle');
  const [eta, setEta] = useState<number | null>(null);
  const [lastNearbyCount, setLastNearbyCount] = useState<number | null>(null);
  const sosScale = useSharedValue(1);

  useEffect(() => {
    const onAssigned = (event: any) => {
      setSos('matched');
      setEta(event.etaSeconds);
      toast.success('Responder en route', { description: `ETA ${formatEta(event.etaSeconds)}` });
    };

    const onStatus = (event: any) => {
      if (event.status === 'resolved') {
        setSos('resolved');
        setEta(0);
        toast.success('Incident resolved');
      }
    };

    socket.on('emergency:assigned', onAssigned);
    socket.on('emergency:status', onStatus);

    return () => {
      socket.off('emergency:assigned', onAssigned);
      socket.off('emergency:status', onStatus);
    };
  }, []);

  useEffect(() => {
    if (sos !== 'matched' || eta == null) return;
    const timer = setInterval(() => setEta((value) => (value != null && value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [sos, eta]);

  const firstName = user?.name?.split(' ')[0] ?? 'friend';
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    []
  );
  const isActive = sos !== 'idle' && sos !== 'resolved';
  const sosAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: sosScale.value }] }));

  useEffect(() => {
    sosScale.value = withRepeat(withTiming(isActive ? 1.02 : 1, { duration: 900 }), -1, true);
  }, [isActive, sosScale]);

  const triggerSOS = async () => {
    if (isActive) return;
    setSos('broadcasting');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setSos('idle');
        toast.error('Location needed', {
          description: 'Enable location to broadcast your SOS, then tap again.',
          action: { label: 'Try again', onClick: () => triggerSOS() },
        });
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data } = await api.post('/emergencies', {
        type: 'medical',
        priority: 1,
        description: 'Citizen SOS',
        coordinates: [position.coords.longitude, position.coords.latitude],
      });

      setLastNearbyCount(data.nearbyCount);
      setSos('pending');
      socket.emit('emergency:join', data.emergency._id);
      toast('SOS broadcast', {
        description: `${data.nearbyCount} responder${data.nearbyCount === 1 ? '' : 's'} notified nearby.`,
      });
    } catch (error: any) {
      setSos('idle');
      toast.error('SOS failed', {
        description: error.response?.data?.error ?? 'Please try again.',
        action: { label: 'Retry', onClick: () => triggerSOS() },
      });
    }
  };

  const signOut = () => {
    dispatch(logout());
    router.replace('/');
  };

  const isResponder = ['doctor', 'nurse', 'student_responder'].includes(user?.role ?? '');

  const quickActions = [
    ...(isResponder
      ? ([
          {
            label: 'Inbox',
            hint: 'Live SOS broadcasts',
            icon: <Siren size={18} color={colors.primary} />,
            path: '/responder-inbox' as const,
          },
        ] as const)
      : []),
    { label: 'Doctors', hint: 'Find specialists', icon: <Stethoscope size={18} color={colors.info} />, path: '/(tabs)/doctors' as const },
    { label: 'Supply', hint: 'Blood, organs, medicine', icon: <Heart size={18} color={colors.destructive} />, path: '/(tabs)/blood' as const },
    { label: 'Community', hint: 'Support groups', icon: <Users size={18} color={colors.purple} />, path: '/(tabs)/community' as const },
    { label: 'Assistant', hint: 'Quick wellness help', icon: <Bot size={18} color={colors.success} />, path: '/assistant' as const },
  ];

  return (
    <AppScreen
      tone="dark"
      eyebrow={todayLabel}
      title={`Hello, ${firstName}.`}
      subtitle="Keep your emergency tools, medical identity, and care network ready."
      icon={<Heart size={24} color="#fff" fill="#fff" />}
      action={
        <Pressable onPress={signOut} style={styles.iconButton}>
          <LogOut size={16} color="#fff" />
        </Pressable>
      }
      headerContent={
        <View style={styles.heroHeaderContent}>
          <Badge style={styles.heroBadge} variant="outline">
            Bio Passport ready
          </Badge>
          <Text style={styles.heroHeaderText}>
            {isActive
              ? sos === 'matched'
                ? 'Responder is already on the way.'
                : 'Your emergency alert is currently live.'
              : 'No active incident right now.'}
          </Text>
        </View>
      }
    >
      <Card style={styles.sosCard}>
        <View style={styles.sosHeader}>
          <View>
            <Text style={styles.sosEyebrow}>Emergency control</Text>
            <Text style={styles.sosTitle}>One tap when every second matters.</Text>
          </View>
          <View style={[styles.sosStatePill, isActive ? styles.sosStatePillActive : styles.sosStatePillIdle]}>
            <Text style={[styles.sosStateText, isActive ? styles.sosStateTextActive : styles.sosStateTextIdle]}>
              {isActive ? 'Live' : 'Standby'}
            </Text>
          </View>
        </View>

        <Animated.View style={sosAnimatedStyle}>
          <Pressable
            onPress={triggerSOS}
            disabled={isActive}
            style={[
              styles.sosButton,
              { backgroundColor: isActive ? colors.primary : colors.destructive },
            ]}
          >
            <Siren size={32} color="#fff" />
            <Text style={styles.sosButtonLabel}>
              {sos === 'idle'
                ? 'Start SOS'
                : sos === 'broadcasting'
                ? 'Broadcasting'
                : sos === 'pending'
                ? 'Waiting for responder'
                : sos === 'matched'
                ? eta != null
                  ? `ETA ${formatEta(eta)}`
                  : 'Responder matched'
                : 'Resolved'}
            </Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.sosDescription}>
          {!isActive
            ? 'Vitalis will share your location and incident with nearby responders and track updates here.'
            : sos === 'matched'
            ? 'Stay where you are if safe. Keep your phone available and visible.'
            : 'Your alert is active and visible to nearby responders.'}
        </Text>

        <View style={styles.sosMetaRow}>
          <View style={styles.metaChip}>
            <MapPin size={14} color={colors.primary} />
            <Text style={styles.metaChipText}>Live GPS</Text>
          </View>
          <View style={styles.metaChip}>
            <ShieldCheck size={14} color={colors.primary} />
            <Text style={styles.metaChipText}>
              {lastNearbyCount != null ? `${lastNearbyCount} nearby` : 'Ready to notify'}
            </Text>
          </View>
        </View>

        {!isActive ? (
          <Button variant="outline" onPress={() => router.push('/sos')}>
            View emergency numbers
          </Button>
        ) : null}
      </Card>

      <View style={styles.grid}>
        {quickActions.map((action) => (
          <Pressable key={action.label} onPress={() => router.push(action.path)} style={styles.gridItem}>
            <Card style={styles.gridCard}>
              <View style={styles.gridIcon}>{action.icon}</View>
              <Text style={styles.gridLabel}>{action.label}</Text>
              <Text style={styles.gridHint}>{action.hint}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Health identity</Text>
            <Text style={styles.sectionTitle}>Bio Passport</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <Text style={styles.sectionBody}>
          Keep your blood type, allergies, and medications ready to share during an emergency.
        </Text>
        <Button onPress={() => router.push('/(tabs)/profile')} style={styles.secondaryAction}>
          <QrCode size={16} color="#fff" />
          Open profile
        </Button>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Quick support</Text>
            <Text style={styles.sectionTitle}>Preparedness checklist</Text>
          </View>
          <Activity size={18} color={colors.primary} />
        </View>
        <View style={styles.checklist}>
          <ChecklistRow label="Review emergency numbers" />
          <ChecklistRow label="Update medications & allergies" />
          <ChecklistRow label="Check urgent blood demand" />
        </View>
      </Card>

      <Card style={[styles.sectionCard, styles.alertCard]}>
        <View style={styles.sectionHeader}>
          <View style={styles.alertIcon}>
            <AlertCircle size={18} color={colors.destructive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Urgent supply needs</Text>
            <Text style={styles.alertBody}>See blood shortages, organ and tissue requests, and rare medicine demand.</Text>
          </View>
        </View>
        <Button variant="outline" onPress={() => router.push('/(tabs)/blood')}>
          <Pill size={16} color={colors.foreground} />
          Open supply exchange
        </Button>
      </Card>
    </AppScreen>
  );
}

function ChecklistRow({ label }: { label: string }) {
  return (
    <View style={styles.checklistRow}>
      <View style={styles.checklistDot} />
      <Text style={styles.checklistText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroHeaderContent: {
    gap: 8,
  },
  heroBadge: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroHeaderText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  sosCard: {
    padding: 18,
    gap: 16,
  },
  sosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sosEyebrow: {
    color: colors.destructive,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sosTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  sosStatePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  sosStatePillIdle: {
    backgroundColor: colors.background,
  },
  sosStatePillActive: {
    backgroundColor: colors.destructiveSoft,
  },
  sosStateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sosStateTextIdle: {
    color: colors.mutedForeground,
  },
  sosStateTextActive: {
    color: colors.destructive,
  },
  sosButton: {
    borderRadius: radius.xl,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  sosButtonLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sosDescription: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  sosMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  metaChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
  gridCard: {
    padding: 16,
    gap: 12,
    minHeight: 140,
  },
  gridIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  gridLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  gridHint: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    padding: 18,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryAction: {
    backgroundColor: colors.primaryStrong,
  },
  checklist: {
    gap: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  checklistText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  alertCard: {
    backgroundColor: colors.destructiveSoft,
    borderColor: '#F8D4D4',
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  alertTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  alertBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
});
