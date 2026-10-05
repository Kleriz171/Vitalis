import { Router } from 'express';
import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const r = Router();
r.use(authRequired, allow('dispatcher','admin'));

r.get('/kpis', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 86400000);
    const [total, active, pending, resolvedToday, onDuty, recent] = await Promise.all([
      Emergency.countDocuments(),
      Emergency.countDocuments({ status: { $in: ['pending','assigned','en_route','on_scene'] } }),
      Emergency.countDocuments({ status: 'pending' }),
      Emergency.countDocuments({ status: 'resolved', updatedAt: { $gte: since } }),
      User.countDocuments({ available: true, role: { $in: ['doctor','nurse','student_responder','blood_donor'] } }),
      Emergency.find({ createdAt: { $gte: since }, 'timeline.status': 'assigned' }).select('createdAt timeline').lean(),
    ]);
    const byType = await Emergency.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    // Time from SOS to a responder accepting: the number that decides survival in an arrest.
    const waits = recent
      .map((e: any) => {
        const t = e.timeline.find((x: any) => x.status === 'assigned');
        return t ? (+new Date(t.at) - +new Date(e.createdAt)) / 1000 : null;
      })
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    const medianAcceptSeconds = waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null;
    // Share of accepted calls (24 h) that a responder took within a minute: the dispatch target.
    const acceptedUnderMinutePct = waits.length ? Math.round((100 * waits.filter(w => w <= 60).length) / waits.length) : null;
    res.json({ total, active, pending, resolvedToday, onDuty, medianAcceptSeconds, acceptedUnderMinutePct, acceptedCount: waits.length, byType });
  } catch (e) { next(e); }
});

// Daily emergencies for the last 14 days
r.get('/timeseries', async (_req, res, next) => {
  try {
    const days = 14;
    const since = new Date(Date.now() - days * 86400000);
    const buckets = await Emergency.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const map = new Map<string, { count: number; resolved: number }>();
    for (const b of buckets) map.set(b._id, { count: b.count, resolved: b.resolved });
    const series: Array<{ date: string; count: number; resolved: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const v = map.get(d) ?? { count: 0, resolved: 0 };
      series.push({ date: d, count: v.count, resolved: v.resolved });
    }
    res.json(series);
  } catch (e) { next(e); }
});

// Average response time (assigned timestamp - created), resolution rate
r.get('/performance', async (_req, res, next) => {
  try {
    const totals = await Emergency.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          avgEta: { $avg: '$etaSeconds' },
        },
      },
    ]);
    const t = totals[0] ?? { total: 0, resolved: 0, avgEta: 0 };
    const resolutionRate = t.total ? Math.round((t.resolved / t.total) * 100) : 0;
    const avgEtaSeconds = Math.round(t.avgEta ?? 0);
    res.json({
      total: t.total,
      resolved: t.resolved,
      resolutionRate,
      avgEtaSeconds,
    });
  } catch (e) { next(e); }
});

// Top citizens by number of emergencies triggered (last 90 days)
r.get('/top-callers', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 90 * 86400000);
    const rows = await Emergency.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$citizen', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const ids = rows.map((r: any) => r._id);
    const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json(rows.map((r: any) => ({
      userId: String(r._id),
      name: byId.get(String(r._id))?.name ?? 'Unknown',
      email: byId.get(String(r._id))?.email ?? '',
      count: r.count,
    })));
  } catch (e) { next(e); }
});

export default r;
