import dgram from 'node:dgram';

/**
 * Fake Tello on 127.0.0.1:8889 for developing without the drone.
 * Replies like SDK 1.3, drains battery, and streams state to :8890.
 * ponytail: no physics; moves just take distance/100 seconds.
 */
export const startSimulator = () => {
  const sock = dgram.createSocket('udp4');
  let battery = 92;
  let height = 0;
  let airborne = false;
  let flightS = 0;
  let sdk = false;
  let stateTo: { address: string } | null = null;

  const reply = (text: string, rinfo: dgram.RemoteInfo, delayMs = 60) =>
    setTimeout(() => sock.send(text, rinfo.port, rinfo.address), delayMs);

  sock.on('message', (msg, rinfo) => {
    const [verb, arg] = msg.toString().trim().split(' ');
    stateTo = { address: rinfo.address };
    if (verb === 'command') { sdk = true; return reply('ok', rinfo); }
    if (!sdk) return reply('error Not in SDK mode', rinfo);
    switch (verb) {
      case 'battery?': return reply(String(battery), rinfo);
      case 'streamon': case 'streamoff': return reply('ok', rinfo);
      case 'takeoff':
        if (airborne) return reply('error', rinfo);
        return setTimeout(() => { airborne = true; height = 80; reply('ok', rinfo, 0); }, 1200);
      case 'land':
        return setTimeout(() => { airborne = false; height = 0; reply('ok', rinfo, 0); }, 1200);
      case 'emergency': airborne = false; height = 0; return;
      case 'rc': return; // no reply, like the real drone
      case 'up': case 'down': case 'forward': case 'back': case 'left': case 'right':
      case 'cw': case 'ccw': {
        if (!airborne) return reply('error Not flying', rinfo);
        const n = Number(arg);
        if (verb === 'up') height += n;
        if (verb === 'down') height = Math.max(20, height - n);
        return reply('ok', rinfo, verb === 'cw' || verb === 'ccw' ? 600 : Math.max(400, n * 10));
      }
      default: return reply('error Unknown command', rinfo);
    }
  });

  const tick = setInterval(() => {
    if (airborne) { flightS += 0.1; battery = Math.max(0, battery - 0.01); }
    if (!stateTo) return;
    const state = `pitch:0;roll:0;yaw:0;vgx:${airborne ? 3 : 0};vgy:0;vgz:0;templ:48;temph:51;tof:${height + 10};h:${Math.round(height)};bat:${Math.round(battery)};baro:0.00;time:${Math.round(flightS)};agx:0;agy:0;agz:-1000;\r\n`;
    sock.send(state, 8890, stateTo.address);
  }, 100);

  sock.bind(8889, '127.0.0.1');
  return () => { clearInterval(tick); sock.close(); };
};
