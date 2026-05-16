import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  SupplyInquiry,
  SupplyRequest,
  SUPPLY_CATEGORIES,
  SUPPLY_REQUEST_MODES,
} from '../../models/SupplyRequest';

const r = Router();
r.use(authRequired);

const normalizeResource = (value: string) =>
  value.toLowerCase().replace(/blood/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const requestToView = (item: any, queuePosition?: number | null) => ({
  id: String(item._id),
  category: item.category,
  requestMode: item.requestMode ?? 'exchange',
  title: item.title,
  resourceType: item.resourceType,
  urgency: item.urgency,
  quantityLabel: item.quantityLabel,
  facilityName: item.facilityName,
  notes: item.notes,
  requesterName: item.requesterName,
  status: item.status,
  inquiryCount: item.inquiryCount ?? 0,
  queuePosition: queuePosition ?? null,
  matchedAt: item.matchedAt,
  matchSummary: item.matchSummary,
  createdAt: item.createdAt,
});

async function getQueuePositions() {
  const queueItems = await SupplyRequest.find({ requestMode: 'queue', status: 'queued' })
    .select('_id category resourceType createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const counters = new Map<string, number>();
  const positions = new Map<string, number>();

  for (const item of queueItems) {
    const key = `${item.category}:${normalizeResource(item.resourceType)}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    positions.set(String(item._id), next);
  }

  return positions;
}

r.get('/requests', async (req, res, next) => {
  try {
    const {
      category,
      status,
      requestMode = 'exchange',
    } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = { requestMode };
    if (category) query.category = category;
    if (status) query.status = status;
    else if (requestMode === 'queue') query.status = { $in: ['queued', 'matched'] };
    else query.status = 'open';

    const items = await SupplyRequest.find(query).sort('-createdAt').limit(100).lean();
    const queuePositions = requestMode === 'queue' ? await getQueuePositions() : new Map<string, number>();
    res.json(items.map(item => requestToView(item, queuePositions.get(String(item._id)) ?? null)));
  } catch (e) { next(e); }
});

r.get('/requests/mine', async (req: AuthReq, res, next) => {
  try {
    const { requestMode } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = { createdBy: req.user!.id };
    if (requestMode) query.requestMode = requestMode;
    const items = await SupplyRequest.find(query).sort('-createdAt').limit(100).lean();
    const queuePositions = await getQueuePositions();
    res.json(items.map(item => requestToView(item, queuePositions.get(String(item._id)) ?? null)));
  } catch (e) { next(e); }
});

const createRequestSchema = z.object({
  category: z.enum(SUPPLY_CATEGORIES),
  title: z.string().min(1),
  resourceType: z.string().min(1),
  urgency: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  quantityLabel: z.string().min(1),
  facilityName: z.string().min(1).optional(),
  notes: z.string().optional(),
  requestMode: z.enum(SUPPLY_REQUEST_MODES).optional(),
});

r.post('/requests', validate(createRequestSchema), async (req: AuthReq, res, next) => {
  try {
    const created = await SupplyRequest.create({
      ...req.body,
      requestMode: req.body.requestMode ?? 'exchange',
      status: req.body.requestMode === 'queue' ? 'queued' : 'open',
      requesterName: req.user?.name,
      createdBy: req.user!.id,
    });
    res.status(201).json(requestToView(created.toObject(), null));
  } catch (e) { next(e); }
});

const createQueueRequestSchema = z.object({
  category: z.enum(SUPPLY_CATEGORIES),
  resourceType: z.string().min(1),
  urgency: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  quantityLabel: z.string().min(1),
  notes: z.string().max(400).optional(),
});

r.post('/queue-requests', validate(createQueueRequestSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof createQueueRequestSchema>;
    const exchangeCandidates = await SupplyRequest.find({
      requestMode: 'exchange',
      status: 'open',
      category: body.category,
    })
      .select('_id facilityName resourceType')
      .sort('-createdAt')
      .lean();

    const normalizedTarget = normalizeResource(body.resourceType);
    const matchedCandidate = exchangeCandidates.find((candidate: any) => {
      const candidateResource = normalizeResource(candidate.resourceType);
      return candidateResource === normalizedTarget
        || candidateResource.includes(normalizedTarget)
        || normalizedTarget.includes(candidateResource);
    });

    const prettyCategory = body.category === 'organ'
      ? 'Organ'
      : body.category === 'tissue'
        ? 'Tissue'
        : body.category === 'medicine'
          ? 'Medicine'
          : 'Blood';

    const created = await SupplyRequest.create({
      category: body.category,
      title: `${prettyCategory} request for ${body.resourceType}`,
      resourceType: body.resourceType,
      urgency: body.urgency,
      quantityLabel: body.quantityLabel,
      facilityName: req.user?.name ?? 'Vitalis citizen',
      notes: body.notes,
      requestMode: 'queue',
      status: matchedCandidate ? 'matched' : 'queued',
      requesterName: req.user?.name,
      createdBy: req.user!.id,
      matchedAt: matchedCandidate ? new Date() : undefined,
      matchSummary: matchedCandidate
        ? `${matchedCandidate.facilityName ?? 'A coordinator'} may have a match for ${matchedCandidate.resourceType}.`
        : undefined,
    });

    const queuePositions = await getQueuePositions();
    res.status(201).json(requestToView(created.toObject(), queuePositions.get(String(created._id)) ?? null));
  } catch (e) { next(e); }
});

const inquirySchema = z.object({
  message: z.string().min(3),
  contactPreference: z.enum(['in_app', 'phone', 'email']).default('in_app'),
});

r.post('/requests/:id/inquiries', validate(inquirySchema), async (req: AuthReq, res, next) => {
  try {
    const request = await SupplyRequest.findById(req.params.id);
    if (!request || request.status !== 'open') {
      return res.status(404).json({ error: 'Request unavailable' });
    }
    const inquiry = await SupplyInquiry.create({
      request: request._id,
      user: req.user!.id,
      message: req.body.message,
      contactPreference: req.body.contactPreference,
    });
    request.inquiryCount = (request.inquiryCount ?? 0) + 1;
    await request.save();
    res.status(201).json({ id: String(inquiry._id) });
  } catch (e) { next(e); }
});

r.get('/inquiries/mine', async (req: AuthReq, res, next) => {
  try {
    const items = await SupplyInquiry.find({ user: req.user!.id })
      .populate('request')
      .sort('-createdAt')
      .limit(100)
      .lean();
    res.json(items.map(item => ({
      id: String(item._id),
      message: item.message,
      contactPreference: item.contactPreference,
      status: item.status,
      createdAt: item.createdAt,
      request: item.request ? {
        id: String((item.request as any)._id),
        title: (item.request as any).title,
        resourceType: (item.request as any).resourceType,
        category: (item.request as any).category,
        facilityName: (item.request as any).facilityName,
        urgency: (item.request as any).urgency,
      } : null,
    })));
  } catch (e) { next(e); }
});

export default r;
