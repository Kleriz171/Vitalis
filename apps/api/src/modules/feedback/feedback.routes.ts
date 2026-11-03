import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { Feedback, FEEDBACK_CATEGORY, FEEDBACK_PRIORITY, FEEDBACK_STATUS } from '../../models/Feedback';
import { User } from '../../models/User';
import { recordAdminAction } from '../../models/AdminAction';

const view = (f: any, forAdmin: boolean) => ({
  id: String(f._id), category: f.category, message: f.message, status: f.status, resolution: f.resolution, createdAt: f.createdAt, updatedAt: f.updatedAt,
  ...(forAdmin ? {
    priority: f.priority,
    author: f.author?.name ? { id: String(f.author._id), name: f.author.name, role: f.author.role } : null,
    assignee: f.assignee?.name ? { id: String(f.assignee._id), name: f.assignee.name } : null,
    history: (f.history ?? []).map((h: any) => ({ at: h.at, by: h.by?.name ?? null, change: h.change })),
  } : {}),
});

// Anyone signed in: send feedback or a complaint, see what became of it.
export const feedbackRoutes = Router();
feedbackRoutes.use(authRequired);

feedbackRoutes.post('/', validate(z.object({ category: z.enum(FEEDBACK_CATEGORY), message: z.string().trim().min(5).max(2000) }).strict()), async (req: AuthReq, res, next) => {
  try {
    // ponytail: five open items per person stops floods; a proper quota if abuse shows up.
    if (await Feedback.countDocuments({ author: req.user!.id, status: { $in: ['new', 'in_review'] } }) >= 5) {
      return res.status(429).json({ error: 'You have five open items already. We will answer them first.' });
    }
    const f = await Feedback.create({ author: req.user!.id, ...req.body, history: [{ by: req.user!.id, change: 'sent' }] });
    res.status(201).json(view(f, false));
  } catch (e) { next(e); }
});

feedbackRoutes.get('/mine', async (req: AuthReq, res, next) => {
  try { res.json((await Feedback.find({ author: req.user!.id }).sort('-createdAt').limit(50).lean()).map(f => view(f, false))); } catch (e) { next(e); }
});

// Administrators: triage, assign, resolve.
export const adminFeedbackRoutes = Router();
adminFeedbackRoutes.use(authRequired, allow('admin'));

adminFeedbackRoutes.get('/', async (req, res, next) => {
  try {
    const status = FEEDBACK_STATUS.includes(req.query.status as any) ? { status: req.query.status } : {};
    const list = await Feedback.find(status).sort('-createdAt').limit(300).populate('author assignee history.by', 'name role').lean();
    res.json(list.map(f => view(f, true)));
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  status: z.enum(FEEDBACK_STATUS).optional(),
  priority: z.enum(FEEDBACK_PRIORITY).optional(),
  assignee: z.string().regex(/^[a-f0-9]{24}$/i).nullable().optional(),
  resolution: z.string().trim().max(2000).optional(),
}).strict().refine(b => Object.keys(b).length > 0, { message: 'Nothing to change' });

adminFeedbackRoutes.patch('/:id', validate(updateSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof updateSchema>;
    if (body.assignee && !(await User.exists({ _id: body.assignee, role: 'admin' }))) return res.status(400).json({ error: 'Assign to an administrator' });
    if ((body.status === 'resolved' || body.status === 'dismissed') && !body.resolution) return res.status(400).json({ error: 'Write what was done before closing it' });
    const change = Object.entries(body).map(([k, v]) => `${k}: ${v ?? 'nobody'}`).join(', ');
    const { assignee, ...rest } = body;
    const f = await Feedback.findByIdAndUpdate(
      req.params.id,
      { $set: { ...rest, ...(assignee !== undefined ? { assignee } : {}) }, $push: { history: { by: req.user!.id, change } } },
      { new: true },
    ).populate('author assignee history.by', 'name role').lean();
    if (!f) return res.status(404).json({ error: 'Not found' });
    await recordAdminAction(req.user!.id, 'feedback_updated', (f.author as any)?._id, change);
    res.json(view(f, true));
  } catch (e) { next(e); }
});
