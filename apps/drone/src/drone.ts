import type http from 'node:http';

/**
 * What the bridge needs from a drone. Two drivers implement it:
 *   tello.ts       DJI Tello over its SDK (telemetry, measured moves, so routes work)
 *   turbodrone.ts  Wi-Fi toy drones through the vendored turbodrone server (sticks only)
 */
export interface Drone {
  /** Sent to the API on connect, so the console knows what the drone can do. */
  info: { driver: 'tello' | 'turbodrone'; model: string; routes: boolean };
  /** Resolves once the drone answers. Retries until then. */
  open(): Promise<void>;
  /** Resolve when the manoeuvre is done (or after the calibrated time for drones that can't tell). */
  takeoff(): Promise<void>;
  land(): Promise<void>;
  /** Motors off immediately. */
  emergency(): void;
  /** Stick positions, each -100…100. Latest wins; no reply. */
  rc(lr: number, fb: number, ud: number, yaw: number): void;
  /** One route step such as "forward 200". Only when info.routes. */
  move(step: string): Promise<void>;
  /** Whatever the drone reports; missing fields mean it doesn't. */
  readings(): { battery?: number; heightCm?: number; tempC?: number; flightTimeS?: number; speedCms?: number };
  /**
   * Take off and land are the same button: "land" sent to a drone that already set
   * itself down launches it again. The bridge never lands these on its own.
   */
  oneKey?: boolean;
  /** The bridge has heard from the drone recently. */
  linkOk(): boolean;
  /** Streams the camera as MJPEG. Undefined while there is no camera feed. */
  video?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  close(): void;
}
