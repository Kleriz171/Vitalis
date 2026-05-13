import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { BellRing, Droplets, HeartHandshake, MessageCircleMore, PackageSearch, Pill, Send, ShieldPlus } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

type Category = 'all' | 'blood' | 'organ' | 'tissue' | 'medicine';
type FeedTab = 'exchange' | 'inventory' | 'inquiries';

type SupplyRequest = {
  _id: string;
  category: Exclude<Category, 'all'>;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  hospitalName?: string;
  locationLabel?: string;
  bloodType?: string;
  unitsNeeded?: number;
  itemName?: string;
  contactName?: string;
  createdAt?: string;
};

type SupplyInquiry = {
  _id: string;
  message: string;
  status: 'open' | 'responded' | 'closed';
  createdAt?: string;
  requestId?: {
    _id: string;
    title: string;
    category: string;
    hospitalName?: string;
  };
};

type MedicineResult = {
  _id: string;
  name: string;
  brand?: string;
  stock?: number;
  locationName?: string;
  requiresPrescription?: boolean;
};

type BloodStatus = {
  _id?: string;
  bloodType: string;
  availableUnits: number;
  reservedUnits?: number;
  criticalLevel?: number;
  hospital?: {
    name: string;
  };
};

const categories: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'blood', label: 'Blood' },
  { key: 'organ', label: 'Organs' },
  { key: 'tissue', label: 'Tissues' },
  { key: 'medicine', label: 'Medicine' },
];

const tabs: { key: FeedTab; label: string }[] = [
  { key: 'exchange', label: 'Exchange' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'inquiries', label: 'Replies' },
];

const priorityColors = {
  low: colors.info,
  medium: colors.primary,
  high: '#f59e0b',
  critical: colors.destructive,
} as const;

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(value))
    : 'Just now';

export default function SupplyScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [tab, setTab] = useState<FeedTab>('exchange');
  const [category, setCategory] = useState<Category>('all');
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [inquiries, setInquiries] = useState<SupplyInquiry[]>([]);
  const [medicines, setMedicines] = useState<MedicineResult[]>([]);
  const [bloodCritical, setBloodCritical] = useState<BloodStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    const [requestRes, inquiryRes, medicineRes, bloodRes] = await Promise.all([
      api.get('/supply/requests'),
      api.get('/supply/inquiries/mine'),
      api.get('/medicine/search?q=rare'),
      api.get('/blood/critical'),
    ]);

    setRequests(requestRes.data.requests ?? []);
    setInquiries(inquiryRes.data.inquiries ?? []);
    setMedicines(medicineRes.data.results ?? medicineRes.data.items ?? []);
    setBloodCritical(bloodRes.data.inventory ?? bloodRes.data.items ?? []);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (error: any) {
        toast.error('Could not load supply exchange', {
          description: error.response?.data?.error ?? 'Please try again shortly.',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [loadData]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } catch (error: any) {
      toast.error('Refresh failed', {
        description: error.response?.data?.error ?? 'Please try again shortly.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRequests = useMemo(
    () => requests.filter((request) => category === 'all' || request.category === category),
    [category, requests]
  );

  const selectedRequest = filteredRequests.find((request) => request._id === selectedRequestId) ?? null;

  const submitInquiry = async () => {
    if (!selectedRequest || !messageDraft.trim()) return;

    try {
      setSending(true);
      await api.post(`/supply/requests/${selectedRequest._id}/inquiries`, {
        message: messageDraft.trim(),
      });
      setMessageDraft('');
      await loadData();
      setTab('inquiries');
      toast.success('Inquiry sent', {
        description: 'The requester can now reply with availability details.',
      });
    } catch (error: any) {
      toast.error('Could not send inquiry', {
        description: error.response?.data?.error ?? 'Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AppScreen
      tone="info"
      eyebrow="Supply exchange"
      title="Blood, organs, tissue, and medicine in one place."
      subtitle="Track active requests, check critical stock, and message requesters directly when you can help."
      icon={<HeartHandshake size={24} color="#fff" />}
      scroll={false}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <Badge variant="outline" style={styles.heroBadge}>
              {user?.bloodType ?? 'Profile incomplete'}
            </Badge>
            <Text style={styles.heroMeta}>Replies stay linked to your Bio Passport profile.</Text>
          </View>
          <View style={styles.kpiRow}>
            <KpiCard label="Live requests" value={String(requests.length)} icon={<BellRing size={16} color={colors.primary} />} />
            <KpiCard label="Critical blood" value={String(bloodCritical.length)} icon={<Droplets size={16} color={colors.destructive} />} />
            <KpiCard label="Rare meds" value={String(medicines.length)} icon={<Pill size={16} color={colors.success} />} />
          </View>
        </Card>

        <View style={styles.tabRow}>
          {tabs.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'exchange' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {categories.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setCategory(item.key)}
                  style={[styles.filterChip, category === item.key && styles.filterChipActive]}
                >
                  <Text style={[styles.filterLabel, category === item.key && styles.filterLabelActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredRequests.length === 0 ? (
              <Card style={styles.emptyCard}>
                <PackageSearch size={20} color={colors.primary} />
                <Text style={styles.emptyTitle}>No active requests in this category</Text>
                <Text style={styles.emptyBody}>Try another filter or pull to refresh the live exchange feed.</Text>
              </Card>
            ) : (
              filteredRequests.map((request, index) => {
                const isSelected = selectedRequestId === request._id;
                return (
                  <Animated.View key={request._id} entering={FadeInDown.delay(index * 70).duration(300)}>
                    <Card style={[styles.requestCard, isSelected && styles.requestCardSelected]}>
                      <View style={styles.requestHeader}>
                        <View style={styles.requestHeaderCopy}>
                          <Badge
                            style={{ backgroundColor: `${priorityColors[request.priority]}18`, borderColor: `${priorityColors[request.priority]}30` }}
                            textStyle={{ color: priorityColors[request.priority] }}
                          >
                            {request.priority.toUpperCase()}
                          </Badge>
                          <Text style={styles.requestTitle}>{request.title}</Text>
                          <Text style={styles.requestMeta}>
                            {request.hospitalName ?? 'Coordinated request'} · {request.locationLabel ?? 'Location pending'}
                          </Text>
                        </View>
                        <Badge variant="outline" textStyle={{ color: colors.primary }}>
                          {request.category}
                        </Badge>
                      </View>

                      <Text style={styles.requestBody}>{request.description}</Text>

                      <View style={styles.requestFacts}>
                        {request.bloodType ? <FactPill label={`Blood ${request.bloodType}`} /> : null}
                        {request.unitsNeeded ? <FactPill label={`${request.unitsNeeded} units`} /> : null}
                        {request.itemName ? <FactPill label={request.itemName} /> : null}
                        <FactPill label={formatDate(request.createdAt)} />
                      </View>

                      <Button
                        variant={isSelected ? 'secondary' : 'outline'}
                        onPress={() => setSelectedRequestId(isSelected ? null : request._id)}
                      >
                        <MessageCircleMore size={16} color={isSelected ? '#fff' : colors.foreground} />
                        {isSelected ? 'Hide inquiry' : 'Reply / inquire'}
                      </Button>

                      {isSelected ? (
                        <View style={styles.replyBox}>
                          <Text style={styles.replyTitle}>Message the requester</Text>
                          <TextInput
                            value={messageDraft}
                            onChangeText={setMessageDraft}
                            placeholder="Share availability, transport timing, stock details, or questions."
                            placeholderTextColor={colors.mutedForeground}
                            style={styles.replyInput}
                            multiline
                          />
                          <Button onPress={submitInquiry} loading={sending}>
                            <Send size={16} color="#fff" />
                            Send inquiry
                          </Button>
                        </View>
                      ) : null}
                    </Card>
                  </Animated.View>
                );
              })
            )}
          </>
        ) : null}

        {tab === 'inventory' ? (
          <>
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Critical blood centres</Text>
                <Badge variant="outline">Live</Badge>
              </View>
              {bloodCritical.length === 0 ? (
                <Text style={styles.sectionBody}>No critical blood centre alerts right now.</Text>
              ) : (
                bloodCritical.map((item) => (
                  <View key={`${item._id ?? item.bloodType}-${item.hospital?.name ?? 'hospital'}`} style={styles.inventoryRow}>
                    <View>
                      <Text style={styles.inventoryTitle}>{item.hospital?.name ?? 'Regional hospital'}</Text>
                      <Text style={styles.inventoryMeta}>
                        {item.bloodType} · {item.availableUnits} units available
                      </Text>
                    </View>
                    <Badge textStyle={{ color: colors.destructive }} style={styles.dangerBadge}>
                      Critical
                    </Badge>
                  </View>
                ))
              )}
            </Card>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Rare medicine search</Text>
                <Badge variant="outline">Nearby</Badge>
              </View>
              {medicines.length === 0 ? (
                <Text style={styles.sectionBody}>No rare medicine matches found right now.</Text>
              ) : (
                medicines.map((item) => (
                  <View key={item._id} style={styles.inventoryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inventoryTitle}>{item.name}</Text>
                      <Text style={styles.inventoryMeta}>
                        {item.brand ?? 'Generic'} · {item.locationName ?? 'Location pending'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.inventoryStock}>{item.stock ?? 0} in stock</Text>
                      {item.requiresPrescription ? <Badge variant="outline">Rx</Badge> : null}
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === 'inquiries' ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your inquiry history</Text>
              <ShieldPlus size={16} color={colors.primary} />
            </View>
            {inquiries.length === 0 ? (
              <Text style={styles.sectionBody}>Once you contact a requester, replies and updates will appear here.</Text>
            ) : (
              inquiries.map((item) => (
                <View key={item._id} style={styles.inquiryRow}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.inventoryTitle}>{item.requestId?.title ?? 'Supply request'}</Text>
                    <Text style={styles.inventoryMeta}>
                      {item.requestId?.hospitalName ?? 'Coordinator'} · {formatDate(item.createdAt)}
                    </Text>
                    <Text style={styles.inquiryMessage}>{item.message}</Text>
                  </View>
                  <Badge
                    style={{ backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}24` }}
                    textStyle={{ color: colors.primary }}
                  >
                    {item.status}
                  </Badge>
                </View>
              ))
            )}
          </Card>
        ) : null}

        {loading ? (
          <Card style={styles.loadingCard}>
            <Text style={styles.sectionBody}>Loading live exchange data...</Text>
          </Card>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function FactPill({ label }: { label: string }) {
  return (
    <View style={styles.factPill}>
      <Text style={styles.factPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 140,
  },
  heroCard: {
    padding: 18,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroBadge: {
    backgroundColor: `${colors.primary}12`,
    borderColor: `${colors.primary}28`,
  },
  heroMeta: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.soft,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.foreground,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#fff',
  },
  filterRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.foreground,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#fff',
  },
  requestCard: {
    padding: 18,
    gap: 14,
  },
  requestCardSelected: {
    borderColor: `${colors.primary}40`,
    backgroundColor: colors.card,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.foreground,
  },
  requestMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  requestBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.foreground,
  },
  requestFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factPill: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.soft,
  },
  factPillText: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '600',
  },
  replyBox: {
    gap: 12,
    paddingTop: 4,
  },
  replyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  replyInput: {
    minHeight: 96,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    color: colors.foreground,
  },
  sectionCard: {
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
  },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inventoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  inventoryMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  inventoryStock: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  dangerBadge: {
    backgroundColor: `${colors.destructive}12`,
    borderColor: `${colors.destructive}28`,
  },
  inquiryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-start',
  },
  inquiryMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  emptyCard: {
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  loadingCard: {
    padding: 18,
  },
});
