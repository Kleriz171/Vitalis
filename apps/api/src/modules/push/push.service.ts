import { User } from '../../models/User';
import { logger } from '../../config/logger';

const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send';
export const PUSH_TOKEN = /^Expo(nent)?PushToken\[[\w-]{10,64}\]$/;

export type PushKind = 'sos' | 'update';
/** Push text in both app languages; each recipient gets theirs. */
export type PushText = { en: string; sq: string };

interface PushInput {
  userIds: string[];
  title: PushText;
  body: PushText;
  data: Record<string, string>;
  kind: PushKind;
}

/**
 * Sends through Expo's push service (FCM/APNs behind it). Fire-and-forget:
 * callers never wait on push delivery, sockets remain the in-app channel.
 */
export async function sendPush({ userIds, title, body, data, kind }: PushInput) {
  if (!userIds.length) return;
  const users = await User.find({ _id: { $in: userIds } }).select('+pushTokens language').lean();
  const targets: { to: string; lang: keyof PushText }[] = users.flatMap(u => ((u as any).pushTokens as string[] ?? [])
    .filter(t => PUSH_TOKEN.test(t))
    .map(to => ({ to, lang: (u as any).language === 'en' ? 'en' as const : 'sq' as const })));
  if (!targets.length) return;

  const sos = kind === 'sos';
  const messages = targets.map(({ to, lang }) => ({
    to,
    title: title[lang],
    body: body[lang],
    data,
    priority: 'high',
    channelId: sos ? 'sos' : 'updates',
    sound: sos && process.env.PUSH_CRITICAL === '1'
      // Needs Apple's critical-alerts entitlement; rings through silent mode.
      ? { critical: true, name: 'default', volume: 1 }
      : 'default',
    interruptionLevel: sos ? (process.env.PUSH_CRITICAL === '1' ? 'critical' : 'time-sensitive') : 'active',
    ttl: sos ? 120 : 3600, // an SOS that arrives five minutes late is noise
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      const dead = (json.data ?? [])
        .map((r, j) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? batch[j].to : null))
        .filter(Boolean) as string[];
      if (dead.length) await User.updateMany({ pushTokens: { $in: dead } }, { $pull: { pushTokens: { $in: dead } } });
    } catch (e: any) {
      logger.warn(`push send failed: ${e?.message}`);
    }
  }
}
