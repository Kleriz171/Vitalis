import { env } from '../config/env';
import { logger } from '../config/logger';

const twilio = {
  sid: process.env.TWILIO_ACCOUNT_SID ?? '',
  token: process.env.TWILIO_AUTH_TOKEN ?? '',
  from: process.env.TWILIO_FROM ?? '',
};

/** True when codes are only logged (dev without a provider). Never true in production. */
export const smsIsFake = () => !twilio.sid && env.nodeEnv !== 'production';

export async function sendSms(to: string, body: string) {
  if (twilio.sid && twilio.token && twilio.from) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.sid}:${twilio.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: twilio.from, Body: body }),
    });
    if (!res.ok) {
      logger.error(`SMS send failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      throw Object.assign(new Error('Could not send the SMS. Try again shortly.'), { status: 502 });
    }
    return;
  }
  if (smsIsFake()) {
    logger.info(`[sms:dev] to ${to}: ${body}`);
    return;
  }
  throw Object.assign(new Error('SMS is not configured'), { status: 503 });
}
