import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Logo } from './components/Logo';

interface Result {
  valid: boolean;
  holderName: string;
  badgeLabel: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
}

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

/** Public page behind the QR code on every Vitalis training certificate. */
export const Verify = ({ token }: { token: string }) => {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!/^[a-f0-9]{8,64}$/i.test(token)) { setError('This link is not a valid certificate link.'); return; }
    fetch(`${API}/training/certifications/verify/${token}`)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? 'Certificate not found');
        setData(body);
      })
      .catch(e => setError(e.message || 'Could not reach Vitalis. Try again.'));
  }, [token]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const ok = !!data?.valid;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <a href="/" className="mb-10"><Logo /></a>
      <main className="w-full max-w-md rounded-2xl bg-white border border-border p-8 text-center" aria-live="polite">
        {!data && !error ? (
          <p className="text-muted">Checking certificate…</p>
        ) : error ? (
          <>
            <XCircle size={48} className="mx-auto text-sos" aria-hidden />
            <h1 className="mt-4 text-2xl font-bold">Not verified</h1>
            <p className="mt-2 text-muted">{error}</p>
          </>
        ) : (
          <>
            {ok ? <CheckCircle2 size={48} className="mx-auto text-teal" aria-hidden /> : <XCircle size={48} className="mx-auto text-sos" aria-hidden />}
            <h1 className="mt-4 text-2xl font-bold">{ok ? 'Valid certificate' : 'Certificate expired'}</h1>
            <p className="mt-6 text-muted">Issued to</p>
            <p className="text-2xl font-bold">{data!.holderName}</p>
            <p className="mt-4 text-lg font-semibold text-teal-deep">{data!.badgeLabel}</p>
            <dl className="mt-6 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-muted">Score</dt><dd className="font-semibold tabular-nums">{data!.score}%</dd></div>
              <div><dt className="text-muted">Issued</dt><dd className="font-semibold">{date(data!.issuedAt)}</dd></div>
              <div><dt className="text-muted">{ok ? 'Valid until' : 'Expired'}</dt><dd className="font-semibold">{date(data!.expiresAt)}</dd></div>
            </dl>
          </>
        )}
      </main>
      <p className="mt-6 max-w-sm text-center text-sm text-muted">Vitalis first-aid training is educational and does not replace accredited in-person courses.</p>
    </div>
  );
};
