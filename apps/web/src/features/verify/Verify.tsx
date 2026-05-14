import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Award, CheckCircle2, XCircle, Printer, Heart } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface VerifyResult {
  valid: boolean;
  holderName: string;
  badgeLabel: string;
  courseSlug: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
}

const apiBase = () =>
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const Verify = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${apiBase()}/training/certifications/verify/${token}`)
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.error ?? 'Certificate could not be verified.'));
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 print:bg-white">
      <Card className="w-full max-w-lg p-10 text-center border-2 border-accent print:border-accent/50">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Heart size={14} fill="currentColor" />
          </div>
          <div className="text-[11px] tracking-widest font-bold text-primary">VITALIS · FIRST AID TRAINING</div>
        </div>

        <div className="my-6 grid place-items-center">
          {error ? (
            <XCircle size={56} className="text-destructive" />
          ) : data?.valid ? (
            <CheckCircle2 size={56} className="text-success" />
          ) : data ? (
            <XCircle size={56} className="text-destructive" />
          ) : (
            <Award size={56} className="text-muted-foreground" />
          )}
        </div>

        {error && <div className="text-destructive font-semibold">{error}</div>}

        {data && (
          <>
            <div className="text-sm text-muted-foreground">This certifies that</div>
            <div className="text-2xl font-black mt-1">{data.holderName}</div>
            <div className="text-sm text-muted-foreground mt-4">has earned</div>
            <div className="text-3xl font-black mt-1">{data.badgeLabel}</div>
            <div className="text-sm font-bold text-success mt-2">Score {data.score}%</div>

            <div className="mt-8 flex justify-center gap-16">
              <div>
                <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Issued</div>
                <div className="text-sm font-bold">{new Date(data.issuedAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Valid until</div>
                <div className="text-sm font-bold">{new Date(data.expiresAt).toLocaleDateString()}</div>
              </div>
            </div>

            <div className={`mt-6 text-sm font-bold ${data.valid ? 'text-success' : 'text-destructive'}`}>
              {data.valid ? '✓ Certification is currently valid.' : '✕ Certification has expired.'}
            </div>

            <p className="text-[11px] text-muted-foreground mt-8 leading-relaxed">
              Based on Red Cross / ERC guidelines. Educational use only — not a substitute for in-person certified training.
            </p>

            <Button onClick={() => window.print()} className="mt-6 w-full print:hidden">
              <Printer size={16} /> Print certificate
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};
