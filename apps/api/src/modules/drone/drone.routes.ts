import { Router } from 'express';
import { z } from 'zod';
import { DroneMission } from '../../models/DroneMission';
import { Emergency } from '../../models/Emergency';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { getIO } from '../../realtime/socket';
import { DRONE_ID, ROUTES, fleetSnapshot, isOnline, isValidStep, sendToBridge } from '../../realtime/drones';
import { blockchainService } from '../blockchain/blockchain.service';

const r = Router();
r.use(authRequired, allow('eso'));

r.get('/fleet', (_req, res) => res.json(fleetSnapshot()));

r.get('/routes', (_req, res) => res.json(Object.entries(ROUTES).map(([id, v]) => ({ id, ...v }))));

r.get('/', async (_req, res, next) => {
  try { res.json(await DroneMission.find().sort('-createdAt').limit(50).lean()); } catch (e) { next(e); }
});

const dispatchSchema = z.object({
  routeId: z.string().optional(),
  steps: z.array(z.string().trim()).min(1).max(20).optional(),
  emergencyId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  payload: z.string().trim().max(120).optional(),
}).strict().refine(b => !!b.routeId !== !!b.steps, { message: 'Give either routeId or steps' });

// Autonomous flight: takeoff → route steps → land. The bridge reports progress back.
r.post('/:droneId/dispatch', validate(dispatchSchema), async (req: AuthReq, res, next) => {
  try {
    const { droneId } = req.params;
    if (!DRONE_ID.test(droneId)) return res.status(400).json({ error: 'Invalid drone id' });
    if (!isOnline(droneId)) return res.status(409).json({ error: 'Drone is offline. Start the bridge and connect it to the Tello Wi-Fi.' });

    const body = req.body as z.infer<typeof dispatchSchema>;
    const preset = body.routeId ? ROUTES[body.routeId] : undefined;
    if (body.routeId && !preset) return res.status(400).json({ error: 'Unknown route' });
    const steps = preset?.steps ?? body.steps!;
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
      routeName: preset?.name ?? 'Custom route',
      emergency: emergency?._id,
      destination: emergency?.location,
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
