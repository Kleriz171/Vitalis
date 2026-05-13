import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { CommunityGroup } from '../../models/CommunityGroup';
import { CommunityPost } from '../../models/CommunityPost';
import { User } from '../../models/User';

const r = Router();
r.use(authRequired);

r.get('/groups', async (_req, res, next) => {
  try {
    const groups = await CommunityGroup.find().sort('-memberCount').lean();
    res.json(groups.map(g => ({
      id: String(g._id),
      name: g.name,
      description: g.description,
      category: g.category,
      memberCount: g.memberCount,
    })));
  } catch (e) { next(e); }
});

r.get('/posts', async (req, res, next) => {
  try {
    const { groupId } = req.query as Record<string, string | undefined>;
    const q: Record<string, unknown> = {};
    if (groupId) q.group = groupId;
    const posts = await CommunityPost.find(q).sort('-createdAt').limit(50).lean();
    res.json(posts.map(p => ({
      id: String(p._id),
      groupId: String(p.group),
      content: p.content,
      isAnonymous: p.isAnonymous,
      authorName: p.isAnonymous ? null : p.authorName,
      likes: p.likes,
      commentsCount: p.commentsCount,
      createdAt: p.createdAt,
    })));
  } catch (e) { next(e); }
});

const createPostSchema = z.object({
  groupId: z.string().min(1),
  content: z.string().min(1).max(2000),
  isAnonymous: z.boolean().default(false),
});

r.post('/posts', validate(createPostSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof createPostSchema>;
    const user = await User.findById(req.user!.id).lean();
    const post = await CommunityPost.create({
      group: new mongoose.Types.ObjectId(body.groupId),
      author: req.user!.id,
      authorName: body.isAnonymous ? undefined : (user?.name ?? 'User'),
      isAnonymous: body.isAnonymous,
      content: body.content,
    });
    res.status(201).json({ id: String(post._id) });
  } catch (e) { next(e); }
});

export default r;
