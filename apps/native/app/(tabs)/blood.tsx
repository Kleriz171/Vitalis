import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BellRing, Clock3, Droplets, HeartHandshake, PackageSearch, Pill, Send, ShieldPlus } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { api } from '@/lib/api';
import { RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

type QueueCategory = 'blood' | 'organ' | 'tissue' | 'medicine';
type FilterCategory = 'all' | QueueCategory;
type FeedTab = 'request' | 'queue' | 'exchange' | 'inventory';
type Urgency = 'normal' | 'urgent' | 'critical';

type SupplyRequest = {
  id: string;
  category: QueueCategory;
  requestMode: 'exchange' | 'queue';
  title: string;
  resourceType: string;
  urgency: Urgency;
  quantityLabel: string;
  facilityName?: string;
  notes?: string;
  requesterName?: string;
  status: 'open' | 'queued' | 'matched' | 'fulfilled' | 'cancelled';
  inquiryCount: number;
  queuePosition: number | null;
  matchedAt?: string;
  matchSummary?: string;
  createdAt?: string;
};

type SupplyInquiry = {
  id: string;
  message: string;
  status: 'open' | 'responded' | 'closed';
  createdAt?: string;
  request?: {
    id: string;
    title: string;
    resourceType: string;
    category: QueueCategory;
    facilityName?: string;
    urgency: Urgency;
  };
};

type MedicineResult = {
  _id?: string;
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

const requestCategories: { key: QueueCategory; label: string; helper: string; shortLabel: string; icon: ReactNode }[] = [
  { key: 'blood', label: 'Blood', shortLabel: 'Blood', helper: 'Match a blood type, plasma, or platelet need.', icon: <Droplets size={16} color={colors.destructive} /> },
  { key: 'organ', label: 'Organ', shortLabel: 'Organ', helper: 'Queue for transplant-ready organs and parts.', icon: <HeartHandshake size={16} color={colors.primary} /> },
  { key: 'tissue', label: 'Tissue', shortLabel: 'Tissue', helper: 'Track corneas, skin grafts, and tissue needs.', icon: <ShieldPlus size={16} color={colors.info} /> },
  { key: 'medicine', label: 'Medicine', shortLabel: 'Medicine', helper: 'Request a specific drug or treatment quickly.', icon: <Pill size={16} color={colors.success} /> },
];

const tabs: { key: FeedTab; label: string }[] = [
  { key: 'request', label: 'Request' },
  { key: 'queue', label: 'My queue' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'inventory', label: 'Inventory' },
];

const filterCategories: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'blood', label: 'Blood' },
  { key: 'organ', label: 'Organs' },
  { key: 'tissue', label: 'Tissues' },
  { key: 'medicine', label: 'Medicine' },
];

const urgencyChoices: { key: Urgency; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'critical', label: 'Critical' },
];

const urgencyTheme: Record<Urgency, { background: string; color: string }> = {
  normal: { background: colors.infoSoft, color: colors.info },
  urgent: { background: colors.warningSoft, color: colors.warning },
  critical: { background: colors.destructiveSoft, color: colors.destructive },
};

const queueTheme: Record<'queued' | 'matched', { background: string; color: string }> = {
  queued: { background: colors.infoSoft, color: colors.info },
  matched: { background: colors.successSoft, color: colors.success },
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
    : 'Just now';

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const readList = <T,>(value: unknown, keys: string[] = []): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    for (const key of keys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
};

export default function SupplyScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const user = useSelector((state: RootState) => state.auth.user);
  const [tab, setTab] = useState<FeedTab>('request');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [exchangeRequests, setExchangeRequests] = useState<SupplyRequest[]>([]);
  const [queueRequests, setQueueRequests] = useState<SupplyRequest[]>([]);
  const [inquiries, setInquiries] = useState<SupplyInquiry[]>([]);
  const [medicines, setMedicines] = useState<MedicineResult[]>([]);
  const [bloodCritical, setBloodCritical] = useState<BloodStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExchangeId, setSelectedExchangeId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestCategory, setRequestCategory] = useState<QueueCategory>('blood');
  const [resourceType, setResourceType] = useState(user?.bloodType ? `${user.bloodType} blood` : '');
  const [quantityLabel, setQuantityLabel] = useState('1 unit');
  const [urgency, setUrgency] = useState<Urgency>('urgent');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    const [exchangeRes, queueRes, inquiryRes, medicineRes, bloodRes] = await Promise.all([
      api.get('/supply/requests', { params: { requestMode: 'exchange' } }),
      api.get('/supply/requests/mine', { params: { requestMode: 'queue' } }),
      api.get('/supply/inquiries/mine'),
      api.get('/medicine/search?q=rare'),
      api.get('/blood/critical'),
    ]);

    setExchangeRequests(readList<SupplyRequest>(exchangeRes.data, ['requests', 'items']));
    setQueueRequests(readList<SupplyRequest>(queueRes.data, ['requests', 'items']));
    setInquiries(readList<SupplyInquiry>(inquiryRes.data, ['inquiries', 'items']));
    setMedicines(readList<MedicineResult>(medicineRes.data, ['results', 'items']));
    setBloodCritical(readList<BloodStatus>(bloodRes.data, ['inventory', 'items']));
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (error: any) {
        toast.error('Could not load supply center', {
          description: error.response?.data?.error ?? 'Please try again shortly.',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [loadData]);

  useEffect(() => {
    if (requestCategory === 'blood' && user?.bloodType) {
      setResourceType((current) => current.trim() ? current : `${user.bloodType} blood`);
      setQuantityLabel((current) => current.trim() ? current : '1 unit');
      return;
    }

    setResourceType((current) => (current === `${user?.bloodType} blood` ? '' : current));
    setQuantityLabel((current) => (current === '1 unit' ? '' : current));
  }, [requestCategory, user?.bloodType]);

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

  const selectedCategory = requestCategories.find((item) => item.key === requestCategory) ?? requestCategories[0];
  const filteredExchangeRequests = useMemo(
    () => exchangeRequests.filter((request) => categoryFilter === 'all' || request.category === categoryFilter),
    [categoryFilter, exchangeRequests]
  );
  const selectedExchange = filteredExchangeRequests.find((request) => request.id === selectedExchangeId) ?? null;
  const queuedCount = queueRequests.filter((request) => request.status === 'queued').length;
  const matchedCount = queueRequests.filter((request) => request.status === 'matched').length;
  const nextQueuePosition = queueRequests
    .filter((request) => request.status === 'queued' && typeof request.queuePosition === 'number')
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0))[0]?.queuePosition ?? null;

  const submitQueueRequest = async () => {
    if (!resourceType.trim() || !quantityLabel.trim()) {
      toast.error('Finish the request details', {
        description: 'Add a resource type and quantity before joining the queue.',
      });
      return;
    }

    try {
      setSubmittingRequest(true);
      await api.post('/supply/queue-requests', {
        category: requestCategory,
        resourceType: resourceType.trim(),
        quantityLabel: quantityLabel.trim(),
        urgency,
        notes: notes.trim() || undefined,
      });
      setNotes('');
      setMessageDraft('');
      setSelectedExchangeId(null);
      if (requestCategory !== 'blood' || !user?.bloodType) setResourceType('');
      setQuantityLabel(requestCategory === 'blood' ? '1 unit' : '');
      await loadData();
      setTab('queue');
      toast.success('Request added to the queue', {
        description: 'We will keep it active until a matching supply is found.',
      });
    } catch (error: any) {
      toast.error('Could not queue your request', {
        description: error.response?.data?.error ?? 'Please try again.',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const submitInquiry = async () => {
    if (!selectedExchange || !messageDraft.trim()) {
      toast.error('Add a short availability note first.');
      return;
    }

    try {
      setSendingInquiry(true);
      await api.post(`/supply/requests/${selectedExchange.id}/inquiries`, {
        message: messageDraft.trim(),
      });
      setMessageDraft('');
      await loadData();
      setTab('queue');
      toast.success('Availability message sent', {
        description: 'The requester will see your note in their replies.',
      });
    } catch (error: any) {
      toast.error('Could not send your note', {
        description: error.response?.data?.error ?? 'Please try again.',
      });
    } finally {
      setSendingInquiry(false);
    }
  };

  return (
    <AppScreen
      tone="info"
      eyebrow="Supply center"
      title="Find care fast and track every request in one place."
      subtitle="Request blood, organs, tissue, or medicine, stay in queue, and answer urgent exchange needs."
      icon={<HeartHandshake size={24} color="#fff" />}
      contentContainerStyle={{ paddingBottom: Math.max(tabBarHeight + 48, 148) }}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
      headerContent={
        <View style={styles.heroPanel}>
          <View style={styles.heroIdentityRow}>
            <Badge variant="outline" style={styles.heroBadge}>
              {user?.bloodType ?? 'Profile incomplete'}
            </Badge>
            <Text style={styles.heroHint}>Connected to your Vitalis profile and live supply matching.</Text>
          </View>
          <View style={styles.heroStatsRow}>
            <HeroStat label="Queued" value={String(queuedCount)} />
            <HeroStat label="Matched" value={String(matchedCount)} />
            <HeroStat label="Exchange" value={String(exchangeRequests.length)} />
            <HeroStat label="Replies" value={String(inquiries.length)} />
          </View>
        </View>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRail}>
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabChip, active && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipLabel, active && styles.tabChipLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !exchangeRequests.length && !queueRequests.length && !bloodCritical.length && !medicines.length ? (
        <Card style={styles.loadingCard}>
          <Text style={styles.sectionBody}>Loading supply network…</Text>
        </Card>
      ) : null}

      {tab === 'request' ? (
        <>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderBlock}>
              <Text style={styles.sectionTitle}>New request</Text>
              <Text style={styles.sectionBody}>
                Pick a category, add the exact type you need, and we will keep it in queue until a compatible match appears.
              </Text>
            </View>

            <View style={styles.categoryGrid}>
              {requestCategories.map((item) => {
                const active = requestCategory === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setRequestCategory(item.key)}
                    style={[styles.categoryTile, active && styles.categoryTileActive]}
                  >
                    <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>{item.icon}</View>
                    <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>{item.label}</Text>
                    <Text style={[styles.categoryBody, active && styles.categoryBodyActive]}>{item.helper}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.spotlightCard}>
              <View style={styles.spotlightHeader}>
                <View style={styles.spotlightIcon}>{selectedCategory.icon}</View>
                <View style={styles.spotlightCopy}>
                  <Text style={styles.spotlightTitle}>{selectedCategory.shortLabel} request</Text>
                  <Text style={styles.spotlightBody}>{selectedCategory.helper}</Text>
                </View>
              </View>
              <View style={styles.spotlightFacts}>
                <DetailPill label={`Open exchange: ${exchangeRequests.filter((item) => item.category === requestCategory).length}`} />
                <DetailPill label={nextQueuePosition ? `Closest queue slot: ${nextQueuePosition}` : 'No active wait shown'} />
              </View>
            </View>

            <View style={styles.formBlock}>
              <Label>
                {requestCategory === 'blood'
                  ? 'Blood type or product'
                  : requestCategory === 'medicine'
                    ? 'Medicine or treatment'
                    : requestCategory === 'organ'
                      ? 'Organ needed'
                      : 'Tissue needed'}
              </Label>
              <Input
                value={resourceType}
                onChangeText={setResourceType}
                placeholder={
                  requestCategory === 'blood'
                    ? 'O- blood, AB plasma, platelets'
                    : requestCategory === 'medicine'
                      ? 'Insulin, amoxicillin, epinephrine'
                      : requestCategory === 'organ'
                        ? 'Kidney, liver segment, heart'
                        : 'Cornea, skin graft, bone tissue'
                }
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Label>Quantity</Label>
                <Input value={quantityLabel} onChangeText={setQuantityLabel} placeholder="1 unit, 2 doses, urgent transplant" />
              </View>
              <View style={styles.formField}>
                <Label>Urgency</Label>
                <View style={styles.segmentRow}>
                  {urgencyChoices.map((item) => {
                    const active = urgency === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setUrgency(item.key)}
                        style={[styles.segmentChip, active && styles.segmentChipActive]}
                      >
                        <Text style={[styles.segmentChipLabel, active && styles.segmentChipLabelActive]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.formBlock}>
              <Label>Care notes</Label>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Share timing, diagnosis context, or where the match should be delivered."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                style={styles.notesInput}
              />
            </View>

            <View style={styles.submitSection}>
              <View style={styles.submitBubble}>
                <Button size="lg" loading={submittingRequest} onPress={submitQueueRequest} style={styles.submitButton}>
                  Join the queue
                </Button>
              </View>
              <Text style={styles.submitSectionBody}>Once the details look right, send it to the live queue here.</Text>
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>How the queue works</Text>
              <Badge variant="secondary">Live</Badge>
            </View>
            <View style={styles.stepList}>
              <StepTile title="Queued immediately" body="Your request is grouped by resource type and urgency." />
              <StepTile title="Monitored continuously" body="Open supply listings and replies are checked while you wait." />
              <StepTile title="Matched clearly" body="When a close match exists, it moves into your queue updates." />
            </View>
          </Card>
        </>
      ) : null}

      {tab === 'queue' ? (
        <>
          <View style={styles.summaryRow}>
            <SummaryCard label="Waiting" value={String(queuedCount)} tone="info" />
            <SummaryCard label="Matched" value={String(matchedCount)} tone="success" />
            <SummaryCard label="Replies" value={String(inquiries.length)} tone="primary" />
          </View>

          {queueRequests.length === 0 ? (
            <Card style={styles.emptyCard}>
              <PackageSearch size={20} color={colors.primary} />
              <Text style={styles.emptyTitle}>No active queue requests</Text>
              <Text style={styles.emptyBody}>Start a request and this screen will show your place in line and any supply matches.</Text>
              <Button onPress={() => setTab('request')}>Create request</Button>
            </Card>
          ) : (
            queueRequests.map((request) => {
              const tone = queueTheme[request.status as 'queued' | 'matched'] ?? queueTheme.queued;
              return (
                <Card key={request.id} style={styles.queueCard}>
                  <View style={styles.queueAccent} />
                  <View style={styles.queueContent}>
                    <View style={styles.queueHeader}>
                      <View style={styles.queueHeaderCopy}>
                        <Text style={styles.cardTitle}>{request.title}</Text>
                        <Text style={styles.cardMeta}>
                          {titleCase(request.category)} · {request.quantityLabel} · Added {formatDate(request.createdAt)}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
                        <Text style={[styles.statusPillText, { color: tone.color }]}>
                          {request.status === 'matched' ? 'Match found' : 'Queued'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <DetailPill label={request.resourceType} />
                      <DetailPill label={titleCase(request.urgency)} />
                      {request.status === 'queued' && request.queuePosition ? <DetailPill label={`Position ${request.queuePosition}`} /> : null}
                    </View>
                    <Text style={styles.cardBody}>
                      {request.status === 'matched'
                        ? request.matchSummary ?? 'A compatible source has been identified and queued for follow-up.'
                        : 'You are in line and waiting for the next compatible supply or coordinator reply.'}
                    </Text>
                    {request.notes ? <Text style={styles.cardSubtle}>Notes: {request.notes}</Text> : null}
                  </View>
                </Card>
              );
            })
          )}

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>Replies on your requests</Text>
              <Badge variant="secondary">{inquiries.length}</Badge>
            </View>
            {inquiries.length === 0 ? (
              <Text style={styles.sectionBody}>Availability notes and coordinator updates will appear here.</Text>
            ) : (
              inquiries.map((inquiry) => (
                <View key={inquiry.id} style={styles.replyRow}>
                  <View style={styles.replyDot} />
                  <View style={styles.replyCopy}>
                    <Text style={styles.replyTitle}>{inquiry.request?.title ?? 'Supply update'}</Text>
                    <Text style={styles.replyMessage}>{inquiry.message}</Text>
                    <Text style={styles.replyMeta}>
                      {inquiry.request?.facilityName ?? 'Vitalis coordinator'} · {formatDate(inquiry.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      {tab === 'exchange' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            {filterCategories.map((item) => {
              const active = categoryFilter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setCategoryFilter(item.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredExchangeRequests.length === 0 ? (
            <Card style={styles.emptyCard}>
              <PackageSearch size={20} color={colors.primary} />
              <Text style={styles.emptyTitle}>No open exchange requests</Text>
              <Text style={styles.emptyBody}>Pull to refresh or switch categories for more live hospital and donor requests.</Text>
            </Card>
          ) : (
            filteredExchangeRequests.map((request) => {
              const expanded = selectedExchangeId === request.id;
              const urgencyStyle = urgencyTheme[request.urgency];
              return (
                <Card key={request.id} style={[styles.exchangeCard, expanded && styles.exchangeCardActive]}>
                  <View style={styles.exchangeHeader}>
                    <View style={styles.exchangeHeaderCopy}>
                      <Text style={styles.cardTitle}>{request.title}</Text>
                      <Text style={styles.cardMeta}>
                        {request.facilityName ?? 'Supply coordinator'} · {formatDate(request.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: urgencyStyle.background }]}>
                      <Text style={[styles.statusPillText, { color: urgencyStyle.color }]}>{titleCase(request.urgency)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <DetailPill label={titleCase(request.category)} />
                    <DetailPill label={request.resourceType} />
                    <DetailPill label={request.quantityLabel} />
                    {request.inquiryCount > 0 ? <DetailPill label={`${request.inquiryCount} replies`} /> : null}
                  </View>

                  {request.notes ? <Text style={styles.cardBody}>{request.notes}</Text> : null}

                  <Button variant={expanded ? 'secondary' : 'default'} onPress={() => setSelectedExchangeId(expanded ? null : request.id)}>
                    {expanded ? 'Hide response' : 'Offer availability'}
                  </Button>

                  {expanded ? (
                    <View style={styles.responseBox}>
                      <Label>Response</Label>
                      <TextInput
                        value={messageDraft}
                        onChangeText={setMessageDraft}
                        placeholder="Example: I can help with two units and can coordinate transport this morning."
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        textAlignVertical="top"
                        style={styles.responseInput}
                      />
                      <Button loading={sendingInquiry} onPress={submitInquiry}>
                        <Send size={16} color={colors.primaryForeground} />
                        Send note
                      </Button>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {tab === 'inventory' ? (
        <>
          <View style={styles.summaryRow}>
            <SummaryCard label="Critical blood" value={String(bloodCritical.length)} tone="danger" />
            <SummaryCard label="Rare meds" value={String(medicines.length)} tone="success" />
          </View>

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>Critical blood alerts</Text>
              <Badge variant="destructive">{bloodCritical.length}</Badge>
            </View>
            {bloodCritical.length === 0 ? (
              <Text style={styles.sectionBody}>No blood inventory is flagged as critical right now.</Text>
            ) : (
              bloodCritical.map((item) => (
                <View key={`${item.hospital?.name ?? 'blood'}-${item.bloodType}`} style={styles.inventoryRow}>
                  <View style={styles.inventoryIconWrap}>
                    <Droplets size={16} color={colors.destructive} />
                  </View>
                  <View style={styles.inventoryCopy}>
                    <Text style={styles.inventoryTitle}>{item.bloodType}</Text>
                    <Text style={styles.inventoryMeta}>
                      {item.hospital?.name ?? 'Regional bank'} · {item.availableUnits} units available
                    </Text>
                  </View>
                  <Badge variant="destructive">{item.criticalLevel ? `Needs ${item.criticalLevel}+` : 'Critical'}</Badge>
                </View>
              ))
            )}
          </Card>

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>Medicine network</Text>
              <Badge variant="secondary">{medicines.length}</Badge>
            </View>
            {medicines.length === 0 ? (
              <Text style={styles.sectionBody}>No rare medicine inventory results are available right now.</Text>
            ) : (
              medicines.map((item) => (
                <View key={`${item._id ?? item.name}-${item.locationName ?? 'inventory'}`} style={styles.inventoryRow}>
                  <View style={styles.inventoryIconWrap}>
                    <Pill size={16} color={colors.success} />
                  </View>
                  <View style={styles.inventoryCopy}>
                    <Text style={styles.inventoryTitle}>{item.name}</Text>
                    <Text style={styles.inventoryMeta}>
                      {item.brand ? `${item.brand} · ` : ''}
                      {item.locationName ?? 'Pharmacy network'}
                    </Text>
                  </View>
                  <View style={styles.inventoryRight}>
                    <Text style={styles.inventoryStock}>{item.stock ?? 0} in stock</Text>
                    {item.requiresPrescription ? <Text style={styles.inventoryMeta}>Prescription</Text> : null}
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'info' | 'success' | 'primary' | 'danger';
}) {
  const theme =
    tone === 'success'
      ? { backgroundColor: colors.successSoft, color: colors.success }
      : tone === 'primary'
        ? { backgroundColor: colors.accent, color: colors.accentForeground }
        : tone === 'danger'
          ? { backgroundColor: colors.destructiveSoft, color: colors.destructive }
          : { backgroundColor: colors.infoSoft, color: colors.info };

  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.summaryValue, { color: theme.color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function DetailPill({ label }: { label: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailPillText}>{label}</Text>
    </View>
  );
}

function StepTile({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.stepTile}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    gap: 12,
  },
  heroIdentityRow: {
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
  },
  heroHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#F4FBFE',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStat: {
    minWidth: 88,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabRail: {
    gap: 8,
    paddingRight: 4,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  tabChipLabelActive: {
    color: colors.primaryForeground,
  },
  sectionCard: {
    padding: 18,
    gap: 16,
  },
  sectionHeaderBlock: {
    gap: 6,
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.foreground,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryTile: {
    width: '48%',
    minWidth: 148,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.soft,
    gap: 10,
  },
  categoryTileActive: {
    borderColor: `${colors.primary}55`,
    backgroundColor: '#F3FBFA',
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  categoryIconWrapActive: {
    backgroundColor: colors.accent,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  categoryTitleActive: {
    color: colors.primary,
  },
  categoryBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  categoryBodyActive: {
    color: colors.foreground,
  },
  spotlightCard: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
    gap: 12,
  },
  spotlightHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  spotlightIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  spotlightCopy: {
    flex: 1,
    gap: 3,
  },
  spotlightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
  },
  spotlightBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  spotlightFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formBlock: {
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  formField: {
    flex: 1,
    gap: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.soft,
  },
  segmentChipActive: {
    backgroundColor: colors.primary,
  },
  segmentChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  segmentChipLabelActive: {
    color: colors.primaryForeground,
  },
  notesInput: {
    minHeight: 108,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
  },
  submitSection: {
    gap: 8,
    paddingTop: 4,
    alignItems: 'center',
  },
  submitSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.foreground,
    textAlign: 'center',
  },
  submitSectionBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
  submitBubble: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  submitButton: {
    width: 236,
    alignSelf: 'center',
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.full,
  },
  stepList: {
    gap: 10,
  },
  stepTile: {
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
    gap: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.foreground,
  },
  stepBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: radius.xl,
    padding: 14,
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queueCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  queueAccent: {
    width: 5,
    backgroundColor: colors.primary,
  },
  queueContent: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  queueHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.soft,
  },
  detailPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.foreground,
  },
  cardSubtle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-start',
  },
  replyDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginTop: 6,
    backgroundColor: colors.primary,
  },
  replyCopy: {
    flex: 1,
    gap: 4,
  },
  replyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  replyMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  replyMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  filterRail: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  filterChipLabelActive: {
    color: colors.primaryForeground,
  },
  exchangeCard: {
    padding: 18,
    gap: 14,
  },
  exchangeCardActive: {
    borderColor: `${colors.primary}45`,
    backgroundColor: '#FBFEFD',
  },
  exchangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  exchangeHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  responseBox: {
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
  },
  responseInput: {
    minHeight: 96,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inventoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.soft,
  },
  inventoryCopy: {
    flex: 1,
    gap: 4,
  },
  inventoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  inventoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  inventoryMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  inventoryStock: {
    fontSize: 13,
    fontWeight: '700',
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
