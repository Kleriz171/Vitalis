import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { SupplyInquiry, SupplyRequest, SUPPLY_CATEGORIES } from '../../models/SupplyRequest';

const r = Router();
r.use(authRequired);

r.get('/requests', async (req, res, next) => {
  try {
    const { category, status = 'open' } = req.query as Record<string, string | undefined>;
    const query: Record<string, unknown> = { status };
    if (category) query.category = category;
    const items = await SupplyRequest.find(query).sort('-createdAt').limit(100).lean();
    res.json(items.map(item => ({
      id: String(item._id),
      category: item.category,
      title: item.title,
      resourceType: item.resourceType,
      urgency: item.urgency,
      quantityLabel: item.quantityLabel,
      facilityName: item.facilityName,
      notes: item.notes,
      inquiryCount: item.inquiryCount ?? 0,
      createdAt: item.createdAt,
    })));
  } catch (e) { next(e); }
});

const createRequestSchema = z.object({
  category: z.enum(SUPPLY_CATEGORIES),
  title: z.string().min(1),
  resourceType: z.string().min(1),
  urgency: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  quantityLabel: z.string().min(1),
  facilityName: z.string().min(1),
  notes: z.string().optional(),
});

r.post('/requests', validate(createRequestSchema), async (req: AuthReq, res, next) => {
  try {
    const created = await SupplyRequest.create({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ id: String(created._id) });
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
