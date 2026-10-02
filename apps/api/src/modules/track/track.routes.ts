import { Router } from 'express';
import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { haversineKm } from '../../utils/geo';
import { sha256 } from '../../utils/hash';

// Public, no login: the emergency contact opens it from an SMS (landing /track/:token).
// Shows only what a worried relative needs: first name, status, where the patient is, and how
// far help is. Never the responder's name or position. Dead 2 hours after the SOS ends.
const r = Router();
const OPEN_AFTER_END_MS = 2 * 3600_000;
const ACTIVE = ['pending', 'assigned', 'en_route', 'on_scene'];

r.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token);
    if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ error: 'This link is not valid.' });
    const e = await Emergency.findOne({ trackTokenHash: sha256(token), silent: { $ne: true } })
      .select('citizen status location responder etaSeconds responderStartM createdAt updatedAt timeline')
      .populate('citizen', 'name')
      .lean<any>();
    if (!e) return res.status(404).json({ error: 'This link is not valid.' });

    const active = ACTIVE.includes(e.status);
    const endedAt = active ? null : (e.timeline?.at(-1)?.at ?? e.updatedAt);
    if (endedAt && Date.now() - new Date(endedAt).getTime() > OPEN_AFTER_END_MS) {
      return res.status(410).json({ error: 'This SOS has ended and the link has expired.' });
    }

    const at = (e.location as any)?.coordinates as [number, number];
    let help: { distanceM: number | null; etaMinutes: number | null } | null = null;
    if (e.responder && active) {
      const accepted = [...(e.timeline ?? [])].reverse().find((t: any) => t.status === 'assigned')?.at;
      const r = await User.findById(e.responder).select('location locationAt').lean<any>();
      const from = r?.location?.coordinates as [number, number] | undefined;
      const fresh = from?.length === 2 && accepted && r.locationAt && new Date(r.locationAt) >= new Date(accepted);
      const left = fresh ? Math.round(haversineKm(from, at) * 1000) : null;
      // Road ETA from accept time, scaled by the distance still to go (same as the patient's app);
      // without a fresh position, counted down from the accept.
      const sinceAccept = accepted ? (Date.now() - new Date(accepted).getTime()) / 1000 : 0;
      const seconds = !e.etaSeconds ? null
        : left != null && e.responderStartM ? e.etaSeconds * Math.min(1, left / e.responderStartM)
        : e.etaSeconds - sinceAccept;
      const eta = seconds == null ? null : Math.max(1, Math.round(seconds / 60));
      help = { distanceM: left, etaMinutes: eta };
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      firstName: String((e.citizen as any)?.name ?? '').split(' ')[0],
      status: e.status,
      startedAt: e.createdAt,
      endedAt,
      location: at ? { lat: at[1], lng: at[0] } : null,
      help,
    });
  } catch (err) { next(err); }
});

export default r;
