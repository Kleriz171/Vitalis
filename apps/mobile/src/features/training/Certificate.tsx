import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface CertView {
  id: string;
  courseSlug: string;
  badgeLabel: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  qr: string;
  verifyUrl: string;
}

export const Certificate = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [cert, setCert] = useState<CertView | null>(null);

  useEffect(() => {
    api.get<CertView>(`/training/certifications/${id}`).then((r) => setCert(r.data)).catch(() => {
      toast.error('Could not load certificate');
    });
  }, [id]);

  const share = async () => {
    if (!cert) return;
    const text = `I'm certified in ${cert.badgeLabel} via Vitalis. Verify: ${cert.verifyUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: cert.badgeLabel, text, url: cert.verifyUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); } catch {}
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <Card className="p-5 bg-success text-white border-0">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center mb-3">
          <ArrowLeft size={16} />
        </button>
        <Award size={28} className="mb-2" />
        <div className="text-[10px] tracking-widest font-bold opacity-80">FIRST AID CERTIFIED</div>
        <div className="text-2xl font-black">{cert?.badgeLabel ?? 'Certificate'}</div>
        <div className="text-sm opacity-90">{cert ? `Scored ${cert.score}%` : 'Loading…'}</div>
      </Card>

      {cert && (
        <Card className="p-6 items-center text-center border-2 border-accent">
          <div className="text-[10px] tracking-widest font-bold text-primary">VITALIS · FIRST AID TRAINING</div>
          <div className="text-sm text-muted-foreground mt-1">This certifies completion of</div>
          <div className="text-2xl font-black mt-2">{cert.badgeLabel}</div>
          <div className="text-sm font-bold text-success mt-1">Score {cert.score}%</div>
          {cert.qr && (
            <img src={cert.qr} alt="Verification QR" className="w-48 h-48 mx-auto mt-3 rounded-lg bg-white" />
          )}
          <a href={cert.verifyUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold block mt-2 break-all">
            {cert.verifyUrl}
          </a>
          <div className="flex justify-center gap-8 mt-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Issued</div>
              <div className="text-sm font-bold">{new Date(cert.issuedAt).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Valid until</div>
              <div className="text-sm font-bold">{new Date(cert.expiresAt).toLocaleDateString()}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            Based on Red Cross / ERC guidelines. Educational use only — not a substitute for in-person certified training.
          </p>
          <Button onClick={share} className="mt-4 w-full">
            <Share2 size={16} /> Share certificate
          </Button>
          <button onClick={() => window.print()} className="text-xs text-primary font-semibold mt-2">
            Print this certificate
          </button>
        </Card>
      )}
    </div>
  );
};
