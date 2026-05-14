import { Link, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Heart, MapPin, ShieldCheck } from 'lucide-react';
import { RootState } from '../../store';
import { Button } from '../../components/ui/button';

export const Onboarding = () => {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  if (token) return <Navigate to="/app" replace />;

  return (
    <div className="mobile-container">
      <div className="mobile-content-full scrollbar-hide">
        <div className="min-h-full flex flex-col px-6 pt-12 pb-10">
          <header className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <div className="font-extrabold tracking-wide text-foreground">VITALIS</div>
              <div className="text-xs text-muted-foreground">Mobile · citizen + responder</div>
            </div>
          </header>

          <div className="flex-1 flex flex-col justify-center py-12 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
                Help is one<br />
                <span className="text-primary">tap away.</span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                SOS broadcasts, rare-medicine radar, and your medical passport — wherever you go.
              </p>
            </div>

            <ul className="space-y-3">
              <Bullet icon={<Heart size={18} />}>One-tap emergency broadcast</Bullet>
              <Bullet icon={<MapPin size={18} />}>Live responder ETA + tracking</Bullet>
              <Bullet icon={<ShieldCheck size={18} />}>QR-secured Bio Passport</Bullet>
            </ul>
          </div>

          <div className="space-y-2">
            <Link to="/login?mode=register" className="block">
              <Button size="lg" className="w-full">Create account</Button>
            </Link>
            <Link to="/login" className="block">
              <Button size="lg" variant="outline" className="w-full">I already have one</Button>
            </Link>
            <p className="text-[11px] text-muted-foreground text-center pt-3">
              Operators: open the <span className="text-primary font-medium">desktop portal</span> instead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Bullet = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <li className="flex items-center gap-3 text-sm text-foreground">
    <span className="w-9 h-9 rounded-full bg-accent text-accent-foreground grid place-items-center">{icon}</span>
    {children}
  </li>
);
