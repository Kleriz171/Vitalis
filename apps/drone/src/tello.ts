import dgram from 'node:dgram';
import type http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import type { Drone } from './drone';

/**
 * Minimal DJI Tello SDK client over UDP.
 *   commands → <host>:8889, replies "ok" / "error ..." / a value
 *   state    ← :8890, "pitch:0;roll:0;...;bat:87;h:0;..." ~10 Hz
 * The Tello executes one command at a time, so commands are queued.
 */

export type TelloState = Record<string, number>;

// Worst-case durations. A 5 m move at the default speed takes ~8 s.
const TIMEOUT_MS: Record<string, number> = { takeoff: 20_000, land: 20_000, default: 15_000 };

export class Tello {
  private cmd = dgram.createSocket('udp4');
  private stateSock = dgram.createSocket('udp4');
  private queue: Promise<unknown> = Promise.resolve();
  private pending: { resolve: (v: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | null = null;
  state: TelloState = {};
  lastStateAt = 0;

  constructor(private host = '192.168.10.1', private port = 8889) {}

  async open() {
    this.cmd.on('message', msg => {
      const text = msg.toString().trim();
      const p = this.pending;
      if (!p) return;
      this.pending = null;
      clearTimeout(p.timer);
      text.startsWith('error') ? p.reject(new Error(text)) : p.resolve(text);
    });
    this.stateSock.on('message', msg => {
      const s: TelloState = {};
      for (const pair of msg.toString().trim().split(';')) {
        const [k, v] = pair.split(':');
        if (k && v !== undefined && !Number.isNaN(Number(v))) s[k] = Number(v);
      }
      this.state = s;
      this.lastStateAt = Date.now();
    });
    await new Promise<void>(r => this.cmd.bind(0, r));
    await new Promise<void>((r, j) => { this.stateSock.once('error', j); this.stateSock.bind(8890, r); });
  }

  /** Queued command that waits for the drone's reply. */
  send(command: string) {
    const run = this.queue.then(() => this.raw(command));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Bypasses the queue. Only for 'emergency' (motor kill) and 'rc' (no reply). */
  now(command: string) {
    this.cmd.send(command, this.port, this.host);
  }

  private raw(command: string) {
    return new Promise<string>((resolve, reject) => {
      const verb = command.split(' ')[0];
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`timeout: ${command}`));
      }, TIMEOUT_MS[verb] ?? TIMEOUT_MS.default);
      this.pending = { resolve, reject, timer };
      this.cmd.send(command, this.port, this.host, err => {
        if (err) { clearTimeout(timer); this.pending = null; reject(err); }
      });
    });
  }

  close() {
    this.cmd.close();
    this.stateSock.close();
  }
}

const STATE_STALE_MS = 3_000;
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Tello as a bridge driver. SDK moves are measured, so it can fly routes. */
export class TelloDrone implements Drone {
  info = { driver: 'tello', model: 'tello', routes: true } as const;
  video?: Drone['video'];
  private tello: Tello;

  constructor(host: string, private withVideo: boolean) {
    this.tello = new Tello(host);
  }

  async open() {
    await this.tello.open();
    // Enter SDK mode; keep trying until the laptop is on the Tello's Wi-Fi.
    for (;;) {
      try {
        await this.tello.send('command');
        break;
      } catch {
        log('no answer from the Tello. Join its Wi-Fi (TELLO-XXXXXX). Retrying…');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    log(`Tello ready, battery ${await this.tello.send('battery?').catch(() => '?')}%`);
    if (!this.withVideo) return;
    await this.tello.send('streamon').catch(() => log('streamon failed: video unavailable'));
    this.startVideo();
  }

  takeoff = async () => { await this.tello.send('takeoff'); };
  land = async () => { await this.tello.send('land'); };
  emergency = () => this.tello.now('emergency');
  rc = (lr: number, fb: number, ud: number, yaw: number) => this.tello.now(`rc ${lr} ${fb} ${ud} ${yaw}`);
  move = async (step: string) => { await this.tello.send(step); };
  linkOk = () => Date.now() - this.tello.lastStateAt < STATE_STALE_MS;

  readings() {
    const s = this.tello.state;
    return {
      battery: s.bat,
      heightCm: s.h,
      tempC: s.templ !== undefined ? Math.round((s.templ + s.temph) / 2) : undefined,
      flightTimeS: s.time,
      speedCms: Math.round(Math.hypot(s.vgx ?? 0, s.vgy ?? 0) * 10),
    };
  }

  /**
   * Tello streams raw H.264 to :11111. With ffmpeg installed we transcode it to MJPEG
   * and fan the frames out to every viewer.
   * ponytail: one ffmpeg per bridge, fine for one drone; use WebRTC if many viewers need it.
   */
  private startVideo() {
    let ff: ChildProcess;
    try {
      ff = spawn('ffmpeg', ['-loglevel', 'error', '-i', 'udp://0.0.0.0:11111', '-f', 'mjpeg', '-q:v', '6', '-r', '12', 'pipe:1']);
    } catch {
      return log('ffmpeg not found: video disabled (brew install ffmpeg)');
    }
    const clients = new Set<http.ServerResponse>();
    ff.on('error', () => {
      this.video = undefined;
      log('ffmpeg not found: video disabled (brew install ffmpeg)');
    });
    let buf = Buffer.alloc(0);
    ff.stdout?.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      let end;
      while ((end = buf.indexOf(Buffer.from([0xff, 0xd9]))) !== -1) {
        const start = buf.indexOf(Buffer.from([0xff, 0xd8]));
        const frame = start !== -1 && start < end ? buf.subarray(start, end + 2) : null;
        buf = buf.subarray(end + 2);
        if (!frame) continue;
        for (const res of clients) {
          res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write('\r\n');
        }
      }
      if (buf.length > 4_000_000) buf = Buffer.alloc(0);
    });
    this.video = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-store' });
      clients.add(res);
      req.on('close', () => clients.delete(res));
    };
  }

  close() {
    this.tello.close();
  }
}
