import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Droplets, HeartHandshake, MessageSquare, Pill, Send, ShieldPlus } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Disclosure, Group, Row, Segmented, Stats } from '@/components/ui/List';
import { api } from '@/lib/api';
import { RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t, tn } from '@/lib/i18n';

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
  id: string;
  bloodType: string;
  unitsAvailable: number;
  unitsNeeded: number;
  hospitalName?: string;
};

const requestCategories: { key: QueueCategory; label: string; helper: string; shortLabel: string; icon: ReactNode }[] = [
  { key: 'blood', label: t('Blood'), shortLabel: t('Blood'), helper: t('Match a blood type, plasma, or platelet need.'), icon: <Droplets size={16} color={colors.destructive} /> },
  { key: 'organ', label: t('Organ'), shortLabel: t('Organ'), helper: t('Queue for transplant-ready organs and parts.'), icon: <HeartHandshake size={16} color={colors.primary} /> },
  { key: 'tissue', label: t('Tissue'), shortLabel: t('Tissue'), helper: t('Track corneas, skin grafts, and tissue needs.'), icon: <ShieldPlus size={16} color={colors.info} /> },
  { key: 'medicine', label: t('Medicine'), shortLabel: t('Medicine'), helper: t('Request a specific drug or treatment quickly.'), icon: <Pill size={16} color={colors.success} /> },
];

const tabs: { key: FeedTab; label: string }[] = [
  { key: 'request', label: t('Request') },
  { key: 'queue', label: t('My queue') },
  { key: 'exchange', label: t('Exchange') },
  { key: 'inventory', label: t('Inventory') },
];

const filterCategories: { key: FilterCategory; label: string }[] = [
  { key: 'all', label: t('All') },
  { key: 'blood', label: t('Blood') },
  { key: 'organ', label: t('Organs') },
  { key: 'tissue', label: t('Tissues') },
  { key: 'medicine', label: t('Medicine') },
];

const urgencyChoices: { key: Urgency; label: string }[] = [
  { key: 'normal', label: t('Normal') },
  { key: 'urgent', label: t('Urgent') },
  { key: 'critical', label: t('Critical') },
];

const categoryIcon: Record<QueueCategory, ReactNode> = {
  blood: <Droplets size={18} color={colors.destructive} />,
  organ: <HeartHandshake size={18} color={colors.primary} />,
  tissue: <ShieldPlus size={18} color={colors.info} />,
  medicine: <Pill size={18} color={colors.success} />,
};

const urgencyLabel: Record<Urgency, string> = { normal: t('Normal'), urgent: t('Urgent'), critical: t('Critical') };

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(value))
    : t('Just now');

// Categories and urgencies arrive as lowercase keys; their labels live in the dictionary.

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
        toast.error(t('Could not load supply center'), {
          description: apiError(error, 'Please try again shortly.'),
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
      toast.error(t('Refresh failed'), {
        description: apiError(error, 'Please try again shortly.'),
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
      toast.error(t('Finish the request details'), {
        description: t('Add a resource type and quantity before joining the queue.'),
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
      toast.success(t('Request added to the queue'), {
        description: t('We will keep it active until a matching supply is found.'),
      });
    } catch (error: any) {
      toast.error(t('Could not queue your request'), {
        description: apiError(error, 'Please try again.'),
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const submitInquiry = async () => {
    if (!selectedExchange || !messageDraft.trim()) {
      toast.error(t('Add a short availability note first.'));
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
      toast.success(t('Availability message sent'), {
        description: t('The requester will see your note in their replies.'),
      });
    } catch (error: any) {
      toast.error(t('Could not send your note'), {
        description: apiError(error, 'Please try again.'),
      });
    } finally {
      setSendingInquiry(false);
    }
  };

  return (
    <AppScreen
      tone="info"
      title={t('Supply')}
      subtitle={user?.bloodType ? t('Blood {type}', { type: user.bloodType }) : t('Profile incomplete')}
      icon={<HeartHandshake size={20} color="#fff" />}
      contentContainerStyle={{ paddingBottom: 148 }}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
    >
      <Stats
        items={[
          { label: t('Queued'), value: queuedCount },
          { label: t('Matched'), value: matchedCount },
          { label: t('Exchange'), value: exchangeRequests.length },
          { label: t('Replies'), value: inquiries.length },
        ]}
      />

      <Segmented options={tabs} value={tab} onChange={setTab} />

      {loading && !exchangeRequests.length && !queueRequests.length && !bloodCritical.length && !medicines.length ? (
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map(i => (
            <Card key={i} style={[styles.loadingCard, { opacity: 0.6 }]}>
              <View style={{ height: 14, width: '40%', borderRadius: 7, backgroundColor: colors.muted, marginBottom: 10 }} />
              <View style={{ height: 10, width: '80%', borderRadius: 5, backgroundColor: colors.muted, marginBottom: 6 }} />
              <View style={{ height: 10, width: '60%', borderRadius: 5, backgroundColor: colors.muted }} />
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'request' ? (
        <Group title={t('New request')}>
          <View style={styles.formStack}>
            <Segmented
              options={requestCategories.map((c) => ({ key: c.key, label: c.shortLabel }))}
              value={requestCategory}
              onChange={setRequestCategory}
            />
            <Text style={styles.helper}>{selectedCategory.helper}</Text>

            <View style={styles.formBlock}>
              <Label>
                {requestCategory === 'blood'
                  ? t('Blood type or product')
                  : requestCategory === 'medicine'
                    ? t('Medicine or treatment')
                    : requestCategory === 'organ'
                      ? t('Organ needed')
                      : t('Tissue needed')}
              </Label>
              <Input
                value={resourceType}
                onChangeText={setResourceType}
                placeholder={
                  requestCategory === 'blood'
                    ? t('O- blood, AB plasma, platelets')
                    : requestCategory === 'medicine'
                      ? t('Insulin, amoxicillin, epinephrine')
                      : requestCategory === 'organ'
                        ? t('Kidney, liver segment, heart')
                        : t('Cornea, skin graft, bone tissue')
                }
              />
            </View>

            <View style={styles.formBlock}>
              <Label>{t('Quantity')}</Label>
              <Input value={quantityLabel} onChangeText={setQuantityLabel} placeholder={t('1 unit, 2 doses, urgent transplant')} />
            </View>

            <View style={styles.formBlock}>
              <Label>{t('Urgency')}</Label>
              <Segmented options={urgencyChoices} value={urgency} onChange={setUrgency} />
            </View>

            <View style={styles.formBlock}>
              <Label>{t('Care notes')}</Label>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('Share timing, diagnosis context, or where the match should be delivered.')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                style={styles.notesInput}
              />
            </View>

            <Button size="lg" loading={submittingRequest} onPress={submitQueueRequest}>
              {t('Join the queue')}
            </Button>
            {nextQueuePosition ? <Text style={styles.helperCenter}>{t('Closest queue slot: {n}', { n: nextQueuePosition })}</Text> : null}
          </View>
        </Group>
      ) : null}

      {tab === 'queue' ? (
        <>
          <Group title={t('My queue')}>
            {queueRequests.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.helper}>{t('Start a request and this screen will show your place in line and any supply matches.')}</Text>
                <Button variant="outline" onPress={() => setTab('request')}>{t('Create request')}</Button>
              </View>
            ) : (
              queueRequests.map((request, index) => (
                <Row
                  key={request.id}
                  first={index === 0}
                  icon={categoryIcon[request.category as QueueCategory]}
                  title={request.title}
                  summary={
                    request.status === 'matched'
                      ? request.matchSummary ?? t('A compatible source has been identified and queued for follow-up.')
                      : [request.resourceType, request.quantityLabel, request.queuePosition ? t('Position {n}', { n: request.queuePosition }) : null].filter(Boolean).join(' · ')
                  }
                  right={
                    <Badge variant={request.status === 'matched' ? 'default' : 'secondary'}>
                      {request.status === 'matched' ? t('Match found') : t('Queued')}
                    </Badge>
                  }
                />
              ))
            )}
          </Group>

          <Group title={t('Replies on your requests')}>
            {inquiries.length === 0 ? (
              <Text style={[styles.helper, styles.empty]}>{t('Availability notes and coordinator updates will appear here.')}</Text>
            ) : (
              inquiries.map((inquiry, index) => (
                <Row
                  key={inquiry.id}
                  first={index === 0}
                  icon={<MessageSquare size={18} color={colors.info} />}
                  title={inquiry.request?.title ?? t('Supply update')}
                  summary={`${inquiry.message}\n${inquiry.request?.facilityName ?? t('Vitalis coordinator')} · ${formatDate(inquiry.createdAt)}`}
                />
              ))
            )}
          </Group>
        </>
      ) : null}

      {tab === 'exchange' ? (
        <>
          <Segmented options={filterCategories} value={categoryFilter} onChange={setCategoryFilter} />

          <Group title={t('Open requests')}>
            {filteredExchangeRequests.length === 0 ? (
              <Text style={[styles.helper, styles.empty]}>{t('Pull to refresh or switch categories for more live hospital and donor requests.')}</Text>
            ) : (
              filteredExchangeRequests.map((request, index) => (
                <Disclosure
                  key={request.id}
                  first={index === 0}
                  icon={categoryIcon[request.category as QueueCategory]}
                  tint={request.urgency === 'critical' ? colors.destructiveSoft : undefined}
                  title={request.title}
                  summary={[urgencyLabel[request.urgency], request.facilityName ?? t('Supply coordinator'), request.quantityLabel].filter(Boolean).join(' · ')}
                  open={selectedExchangeId === request.id}
                  onToggle={() => setSelectedExchangeId(selectedExchangeId === request.id ? null : request.id)}
                >
                  <Text style={styles.helper}>
                    {[request.resourceType, request.quantityLabel, formatDate(request.createdAt), request.inquiryCount > 0 ? tn(request.inquiryCount, '1 reply', '{n} replies') : null].filter(Boolean).join(' · ')}
                  </Text>
                  {request.notes ? <Text style={styles.body}>{request.notes}</Text> : null}
                  <Label>{t('Response')}</Label>
                  <TextInput
                    value={messageDraft}
                    onChangeText={setMessageDraft}
                    placeholder={t('Example: I can help with two units and can coordinate transport this morning.')}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    textAlignVertical="top"
                    style={styles.notesInput}
                  />
                  <Button loading={sendingInquiry} onPress={submitInquiry}>
                    <Send size={16} color={colors.primaryForeground} />
                    {t('Offer availability')}
                  </Button>
                </Disclosure>
              ))
            )}
          </Group>
        </>
      ) : null}

      {tab === 'inventory' ? (
        <>
          <Group title={t('Critical blood alerts')}>
            {bloodCritical.length === 0 ? (
              <Text style={[styles.helper, styles.empty]}>{t('No blood inventory is flagged as critical right now.')}</Text>
            ) : (
              bloodCritical.map((item, index) => (
                <Row
                  key={item.id}
                  first={index === 0}
                  icon={<Droplets size={18} color={colors.destructive} />}
                  tint={colors.destructiveSoft}
                  title={item.bloodType}
                  summary={`${item.hospitalName ?? t('Regional bank')}\n${tn(item.unitsAvailable, '1 unit available', '{n} units available')}`}
                  right={<Badge variant="destructive">{t('Needs {n}+', { n: item.unitsNeeded })}</Badge>}
                />
              ))
            )}
          </Group>

          <Group title={t('Medicine network')}>
            {medicines.length === 0 ? (
              <Text style={[styles.helper, styles.empty]}>{t('No rare medicine inventory results are available right now.')}</Text>
            ) : (
              medicines.map((item, index) => (
                <Row
                  key={`${item._id ?? item.name}-${item.locationName ?? 'inventory'}`}
                  first={index === 0}
                  icon={<Pill size={18} color={colors.success} />}
                  title={item.name}
                  summary={[item.brand, item.locationName ?? t('Pharmacy network'), item.requiresPrescription ? t('Prescription') : null].filter(Boolean).join(' · ')}
                  right={<Text style={styles.stock}>{t('{n} in stock', { n: item.stock ?? 0 })}</Text>}
                />
              ))
            )}
          </Group>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formStack: { gap: 14, paddingTop: 4, paddingBottom: 16 },
  helper: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  helperCenter: { color: colors.mutedForeground, fontSize: 12, textAlign: 'center' },
  body: { color: colors.foreground, fontSize: 14, lineHeight: 20 },
  empty: { gap: 12, paddingTop: 4, paddingBottom: 16 },
  stock: { color: colors.success, fontSize: 13, fontWeight: '700' },
  formBlock: {
    gap: 8,
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
  loadingCard: {
    padding: 18,
  },
});
