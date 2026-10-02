import dgram from 'node:dgram';

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
