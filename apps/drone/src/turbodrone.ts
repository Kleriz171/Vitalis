import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import type { Drone } from './drone';

/**
 * Wi-Fi toy drones (see ../turbodrone). The bridge starts the turbodrone server on
 * 127.0.0.1 with a fresh token and steers it over its WebSocket. These drones report
 * no battery, height or position: we only know the link is up because video frames or
 * replies keep arriving, and we can't fly measured routes.
 */

const DIR = path.resolve(import.meta.dirname, '../turbodrone');
// Calibration knobs: how long the drone's own climb and soft landing take. Time yours.
const TAKEOFF_MS = Number(process.env.TOY_TAKEOFF_MS ?? 3_000);
const LAND_MS = Number(process.env.TOY_LAND_MS ?? 5_000);
const LINK_STALE_S = 3;
const START_TIMEOUT_MS = 60_000;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Any free local port, unless TURBODRONE_PORT pins one.
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer().on('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

const python = () =>
  process.env.TURBODRONE_PYTHON ??
  [path.join(DIR, '.venv/bin/python'), path.join(DIR, '.venv/Scripts/python.exe')].find(p => existsSync(p)) ??
  (process.platform === 'win32' ? 'python' : 'python3');

export class Turbodrone implements Drone {
  info: Drone['info'];
  private token = process.env.TURBODRONE_TOKEN ?? randomBytes(24).toString('hex');
  private port = 0;
  private base = '';
  private child?: ChildProcess;
  private ws?: WebSocket;
  private closing = false;
  private status: { video_age_s: number | null; rc_age_s: number | null; variant: string | null } | null = null;
  private statusAt = 0;
  private poll?: NodeJS.Timeout;
  private flightS = 0;
  private flyingSince = 0;
  camera?: Drone['camera'];

  constructor(private type: string) {
    this.info = { driver: 'turbodrone', model: type, routes: false };
    // The CooingDV apps' camera button ("06 01" / "06 02"), for dual-camera models.
    if (type === 'cooingdv') this.camera = index => this.send({ type: 'camera', index });
  }

  async open() {
    this.port = Number(process.env.TURBODRONE_PORT) || (await freePort());
    this.base = `http://127.0.0.1:${this.port}`;
    const env: NodeJS.ProcessEnv = { ...process.env, DRONE_TYPE: this.type, TURBODRONE_TOKEN: this.token, TURBODRONE_WATCH_STDIN: '1' };
    // Bridge settings stay here: turbodrone reads VIDEO_PORT as the drone's own video port,
    // and the API key is none of its business. Drone settings go in turbodrone/.env.
    for (const k of ['DRONE_BRIDGE_KEY', 'API_URL', 'VIDEO_PORT', 'VIDEO_HOST', 'DRONE_ID']) delete env[k];
    this.child = spawn(python(), ['-m', 'uvicorn', 'web_server:app', '--host', '127.0.0.1', '--port', String(this.port), '--log-level', 'warning'], {
      cwd: DIR,
      env,
      // stdin is a lifeline: turbodrone exits when it closes, so a crashed bridge never
      // leaves it running. Its own process group keeps Ctrl+C away from it, so the
      // bridge can still land the drone on the way out.
      // ponytail: Windows shares Ctrl+C across the console, so there the server stops first and the drone's own failsafe takes over.
      stdio: ['pipe', 'inherit', 'inherit'],
      detached: process.platform !== 'win32',
    });
    this.child.on('error', e => {
      console.error(`Could not start turbodrone with "${python()}": ${e.message}. See apps/drone/README.md (Toy drones).`);
      process.exit(1);
    });
    this.child.on('exit', code => {
      if (this.closing) return;
      console.error(`turbodrone stopped (exit ${code}). The drone is on its own failsafe now.`);
      process.exit(1);
    });

    const deadline = Date.now() + START_TIMEOUT_MS;
    while (!(await this.refresh())) {
      if (Date.now() > deadline) throw new Error(`turbodrone did not start on port ${this.port}`);
      await sleep(500);
    }
    this.poll = setInterval(() => void this.refresh(), 500);
    await this.connect();
    log(`turbodrone ready (${this.type}). Waiting for the drone: join its Wi-Fi if you haven't.`);
  }

  private async refresh() {
    try {
      const res = await fetch(`${this.base}/status?token=${this.token}`, { signal: AbortSignal.timeout(1000) });
      if (!res.ok) return false;
      this.status = await res.json();
      this.statusAt = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  private connect() {
    return new Promise<void>(resolve => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws?token=${this.token}`);
      ws.onopen = () => resolve();
      ws.onerror = () => {};
      ws.onclose = () => {
        if (this.ws !== ws || this.closing) return;
        log('lost turbodrone socket, reconnecting');
        setTimeout(() => void this.connect(), 1000);
      };
      this.ws = ws;
    });
  }

  private send(msg: object) {
    if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('turbodrone socket is not open');
    this.ws.send(JSON.stringify(msg));
  }

  get oneKey() {
    return this.status?.variant === 'gl';
  }

  linkOk() {
    if (!this.status || Date.now() - this.statusAt > 2_000) return false;
    const ages = [this.status.video_age_s, this.status.rc_age_s].filter((a): a is number => a !== null);
    return ages.length > 0 && Math.min(...ages) < LINK_STALE_S;
  }

  async takeoff() {
    this.send({ type: 'takeoff' });
    this.flyingSince = Date.now();
    await sleep(TAKEOFF_MS);
  }

  async land() {
    this.send({ type: 'land' });
    await sleep(LAND_MS);
    this.landed();
  }

  emergency() {
    this.send({ type: 'estop' });
    this.landed();
  }

  private landed() {
    if (this.flyingSince) this.flightS += (Date.now() - this.flyingSince) / 1000;
    this.flyingSince = 0;
  }

  rc(lr: number, fb: number, ud: number, yaw: number) {
    // Absolute mode: the stick position maps straight onto the drone's range.
    try {
      this.send({ type: 'axes', mode: 'abs', throttle: ud / 100, yaw: yaw / 100, pitch: fb / 100, roll: lr / 100 });
    } catch {
      // Socket is reconnecting; turbodrone has already centred the sticks.
    }
  }

  async move(): Promise<void> {
    throw new Error('This drone has no positioning, so it can only be flown by hand');
  }

  readings() {
    const live = this.flyingSince ? (Date.now() - this.flyingSince) / 1000 : 0;
    return { flightTimeS: Math.round(this.flightS + live) };
  }

  // One upstream stream per viewer, reopened whenever the drone's video drops, so a
  // console that is watching picks the picture back up without reloading.
  video = (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-store' });
    let up: http.ClientRequest | undefined;
    let open = true;
    const pull = () => {
      if (!open) return;
      up = http.get(`${this.base}/mjpeg?token=${this.token}`, u => {
        if (u.statusCode !== 200) { u.resume(); setTimeout(pull, 1000); return; }
        u.pipe(res, { end: false });
        u.on('end', () => setTimeout(pull, 1000));
      });
      up.on('error', () => setTimeout(pull, 1000));
    };
    req.on('close', () => { open = false; up?.destroy(); });
    pull();
  };

  close() {
    this.closing = true;
    clearInterval(this.poll);
    this.ws?.close();
    this.child?.kill();
  }
}
