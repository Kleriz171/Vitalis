import { useEffect, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { Logo } from './components/Logo';

interface Live {
  firstName: string;
  status: 'pending' | 'assigned' | 'en_route' | 'on_scene' | 'resolved' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
  location: { lat: number; lng: number } | null;
  help: { distanceM: number | null; etaMinutes: number | null } | null;
}

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';
const POLL_MS = 15_000;

// The SMS is written in the patient's app language; English links carry ?l=en.
const en = new URLSearchParams(window.location.search).get('l') === 'en';
const T = en ? {
  checking: 'Loading…',
  invalid: 'This link is not valid.',
  expired: 'This SOS has ended and the link has expired.',
  offline: 'Could not reach Vitalis. Retrying…',
  pending: (n: string) => `${n} sent an SOS`,
  pendingBody: 'Certified first-aid responders nearby are being alerted. Also call the ambulance if you can.',
  coming: 'Help is on the way',
  away: (m: string) => `${m} away`,
  minutes: (n: number) => `about ${n} min`,
  onScene: (n: string) => `A responder has reached ${n}`,
  resolved: 'The SOS is closed',
  resolvedBody: (n: string) => `The emergency is over, or ${n} is now with the medical team.`,
  cancelled: 'The SOS was cancelled',
  cancelledBody: (n: string) => `${n} cancelled the SOS.`,
  sent: (t: string, ago: string) => `SOS sent at ${t} (${ago})`,
  ago: (m: number) => (m < 1 ? 'just now' : `${m} min ago`),
  maps: 'Open the location in Maps',
  map: 'Map of where the SOS was sent from',
  call: 'Call ambulance 127',
  live: 'Updates every 15 seconds. Only you have this link.',
  note: 'Vitalis does not replace emergency services.',
} : {
  checking: 'Po ngarkohet…',
  invalid: 'Ky link nuk është i vlefshëm.',
  expired: 'Ky SOS ka përfunduar dhe linku ka skaduar.',
  offline: 'Nuk u lidh me Vitalis. Po provojmë sërish…',
  pending: (n: string) => `${n} dërgoi një SOS`,
  pendingBody: 'Po njoftohen ndihmësit e certifikuar të ndihmës së parë që janë pranë. Nëse mundeni, telefononi edhe ambulancën.',
  coming: 'Ndihma është rrugës',
  away: (m: string) => `${m} larg`,
  minutes: (n: number) => `rreth ${n} min`,
  onScene: (n: string) => `Ndihmësi ka arritur te ${n}`,
  resolved: 'SOS-i u mbyll',
  resolvedBody: (n: string) => `Emergjenca përfundoi, ose ${n} tani është me ekipin mjekësor.`,
  cancelled: 'SOS-i u anulua',
  cancelledBody: (n: string) => `${n} e anuloi SOS-in.`,
  sent: (t: string, ago: string) => `SOS dërguar në ${t} (${ago})`,
  ago: (m: number) => (m < 1 ? 'tani' : `${m} min më parë`),
  maps: 'Hapni vendndodhjen në Maps',
  map: 'Harta e vendit nga u dërgua SOS-i',
  call: 'Telefononi ambulancën 127',
  live: 'Përditësohet çdo 15 sekonda. Vetëm ju e keni këtë link.',
  note: 'Vitalis nuk zëvendëson shërbimet e urgjencës.',
};

const distance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

/** Public page behind the link texted to the emergency contact when someone sends an SOS. */
export const Track = ({ token }: { token: string }) => {
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!/^[a-f0-9]{32}$/.test(token)) { setError(T.invalid); return; }
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch(`${API}/track/${token}`)
        .then(async r => {
          if (r.status === 404) throw Object.assign(new Error(T.invalid), { final: true });
          if (r.status === 410) throw Object.assign(new Error(T.expired), { final: true });
          if (!r.ok) throw new Error(T.offline);
          const body = await r.json();
          setData(body); setOffline(false);
          if (!body.endedAt) timer = setTimeout(load, POLL_MS);
        })
        .catch(e => {
          if (e.final) { setError(e.message); return; }
          setOffline(true);
          timer = setTimeout(load, POLL_MS);
        });
    void load();
    return () => clearTimeout(timer);
  }, [token]);

  const name = data?.firstName || (en ? 'them' : 'personit');
  const ended = data?.status === 'resolved' || data?.status === 'cancelled';
  const time = data ? new Date(data.startedAt).toLocaleTimeString(en ? 'en-GB' : 'sq-AL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
  const ago = data ? T.ago(Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 60_000)) : '';
  const loc = data?.location;
  const d = 0.004; // ~400 m around the patient

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <a href="/" className="mb-8"><Logo /></a>
      <main className="w-full max-w-md" aria-live="polite">
        {error ? (
          <section className="rounded-2xl bg-white border border-border p-8 text-center">
            <h1 className="text-2xl font-bold">{error}</h1>
          </section>
        ) : !data ? (
          <p className="text-center text-muted">{T.checking}</p>
        ) : (
          <>
            <section className={`rounded-2xl p-6 text-white ${ended ? 'bg-ink' : data.status === 'pending' ? 'bg-sos' : 'bg-teal-deep'}`}>
              <h1 className="text-3xl font-extrabold leading-tight">
                {data.status === 'pending' ? T.pending(name)
                  : data.status === 'on_scene' ? T.onScene(name)
                  : data.status === 'resolved' ? T.resolved
                  : data.status === 'cancelled' ? T.cancelled
                  : T.coming}
              </h1>
              {data.help && (data.status === 'assigned' || data.status === 'en_route') ? (
                <p className="mt-3 text-xl font-semibold tabular-nums">
                  {[data.help.etaMinutes != null && T.minutes(data.help.etaMinutes), data.help.distanceM != null && T.away(distance(data.help.distanceM))]
                    .filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <p className="mt-3 text-white/85">
                {data.status === 'pending' ? T.pendingBody
                  : data.status === 'resolved' ? T.resolvedBody(name)
                  : data.status === 'cancelled' ? T.cancelledBody(name)
                  : null}
              </p>
              <p className="mt-4 text-sm text-white/75">{T.sent(time, ago)}</p>
            </section>

            {loc ? (
              <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
                <iframe
                  title={T.map}
                  className="block h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer" // the page URL carries the private token
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - d},${loc.lat - d},${loc.lng + d},${loc.lat + d}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                />
                <a
                  className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 font-semibold text-teal-deep"
                  href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
                  target="_blank" rel="noreferrer"
                >
                  <MapPin size={18} aria-hidden /> {T.maps}
                </a>
              </section>
            ) : null}

            {!ended ? (
              <a href="tel:127" className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-sos px-4 py-4 text-lg font-bold text-white">
                <Phone size={20} aria-hidden /> {T.call}
              </a>
            ) : null}

            <p className="mt-6 text-center text-sm text-muted">
              {offline ? T.offline : !ended ? T.live : null} {T.note}
            </p>
          </>
        )}
      </main>
    </div>
  );
};
