import { Router } from 'express';
import { z } from 'zod';
import { DroneMission } from '../../models/DroneMission';
import { Emergency } from '../../models/Emergency';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { getIO } from '../../realtime/socket';
import { DRONE_ID, ROUTES, droneInfo, fleetSnapshot, isOnline, isValidStep, sendToBridge, stepsTo } from '../../realtime/drones';
import { blockchainService } from '../blockchain/blockchain.service';
import { haversineKm } from '../../utils/geo';

const r = Router();
r.use(authRequired, allow('eso'));

r.get('/fleet', (_req, res) => res.json(fleetSnapshot()));

r.get('/routes', (_req, res) => res.json(Object.entries(ROUTES).map(([id, v]) => ({ id, ...v }))));

r.get('/', async (_req, res, next) => {
  try { res.json(await DroneMission.find().sort('-createdAt').limit(50).lean()); } catch (e) { next(e); }
});

// Farthest a drone is sent from its take-off point: about the Tello's Wi-Fi range; toy drones
// fly by time, so a short hop keeps the error small and the drone in range.
const MAX_ROUTE_M = { tello: 100, turbodrone: 50 };

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const dispatchSchema = z.object({
  routeId: z.string().optional(),
  steps: z.array(z.string().trim()).min(1).max(20).optional(),
  // To a point: where the drone takes off from, and which way its nose points (degrees from north).
  target: lngLat.optional(),
  home: lngLat.optional(),
  heading: z.number().min(0).lt(360).default(0),
  emergencyId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  payload: z.string().trim().max(120).optional(),
}).strict()
  .refine(b => [b.routeId, b.steps, b.target].filter(Boolean).length === 1, { message: 'Give one of routeId, steps or target' })
  .refine(b => !b.target || !!b.home, { message: 'Set the take-off point (home) to fly to a target' });

// Autonomous flight: takeoff → route steps → land. The bridge reports progress back.
r.post('/:droneId/dispatch', validate(dispatchSchema), async (req: AuthReq, res, next) => {
  try {
    const { droneId } = req.params;
    if (!DRONE_ID.test(droneId)) return res.status(400).json({ error: 'Invalid drone id' });
    if (!isOnline(droneId)) return res.status(409).json({ error: 'Drone is offline. Start the bridge and connect it to the drone\'s Wi-Fi.' });
    const info = droneInfo(droneId);
    if (!info?.routes) return res.status(409).json({ error: 'This drone can only be flown by hand. Update its bridge to send it to a point.' });

    const body = req.body as z.infer<typeof dispatchSchema>;
    const preset = body.routeId ? ROUTES[body.routeId] : undefined;
    if (body.routeId && !preset) return res.status(400).json({ error: 'Unknown route' });
    let steps = preset?.steps ?? body.steps!;
    let routeName = preset?.name ?? 'Custom route';
    if (body.target) {
      const m = Math.round(haversineKm(body.home!, body.target) * 1000);
      if (m > MAX_ROUTE_M[info.driver]) return res.status(400).json({ error: `That point is ${m} m from the take-off point. This drone flies at most ${MAX_ROUTE_M[info.driver]} m.` });
      const to = stepsTo(body.home!, body.target, body.heading);
      if (!to) return res.status(400).json({ error: 'That point is where the drone already is.' });
      steps = to;
      routeName = `To ${body.target[1].toFixed(5)}, ${body.target[0].toFixed(5)} · ${m} m`;
    }
    const bad = steps.find(s => !isValidStep(s));
    if (bad) return res.status(400).json({ error: `Invalid step "${bad}". Use e.g. "forward 200" (20–500 cm) or "cw 90".` });

    if (await DroneMission.exists({ droneId, status: { $in: ['queued', 'launched', 'in_flight'] } })) {
      return res.status(409).json({ error: 'This drone is already on a mission' });
    }
    const emergency = body.emergencyId ? await Emergency.findById(body.emergencyId).select('location').lean() : null;
    if (body.emergencyId && !emergency) return res.status(404).json({ error: 'Emergency not found' });

    const mission = await DroneMission.create({
      droneId,
      steps,
      routeName,
      emergency: emergency?._id,
      origin: body.home ? { type: 'Point', coordinates: body.home } : undefined,
      destination: body.target ? { type: 'Point', coordinates: body.target } : emergency?.location,
      payload: body.payload,
      dispatchedBy: req.user!.id,
    });
    sendToBridge(droneId, 'mission:start', { missionId: String(mission._id), steps });
    await blockchainService.append({ entity: 'drone_mission', entityId: String(mission._id), action: 'dispatched', actor: req.user!.id });
    getIO().to('dispatchers').emit('drone:mission', mission);
    res.status(201).json(mission);
  } catch (e) { next(e); }
});

export default r;
