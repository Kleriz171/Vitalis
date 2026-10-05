import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Activity, Plane, Boxes, BarChart3, LogOut, Heart, Users, Stethoscope, Zap,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RootState, logout } from '../../store';
import { socket } from '../../realtime/socket';
import { cn } from '../../lib/utils';

type NavItem = { to: string; label: string; icon: typeof Activity; end?: boolean };

const baseNav: NavItem[] = [
  { to: '/command', label: 'Live operations', icon: Activity, end: true },
  { to: '/command/aeds', label: 'Defibrillators', icon: Zap },
  { to: '/command/drones', label: 'Drones', icon: Plane },
  { to: '/command/ledger', label: 'Ledger', icon: Boxes },
  { to: '/command/analytics', label: 'Analytics', icon: BarChart3 },
];
const adminNav: NavItem[] = [
  { to: '/command/admin/users', label: 'Users', icon: Users },
  { to: '/command/admin/doctor-applications', label: 'Doctor review', icon: Stethoscope },
];

const time = (d: Date, timeZone?: string) => d.toLocaleTimeString('en-GB', { hourCycle: 'h23', timeZone });

/** Socket link state, for the status light in the top bar. */
const useLive = () => {
  const [live, setLive] = useState(socket.connected);
  useEffect(() => {
    const up = () => setLive(true);
    const down = () => setLive(false);
    socket.on('connect', up);
    socket.on('disconnect', down);
    // The socket often connects before this mounts; read its state now so the light is not stale.
    setLive(socket.connected);
    return () => { socket.off('connect', up); socket.off('disconnect', down); };
  }, []);
  return live;
};

const Clocks = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden lg:flex items-center gap-5 font-mono text-xs">
      <span><span className="text-muted-foreground mr-2">TIRANA</span><span className="tabular-nums text-foreground">{time(now, 'Europe/Tirane')}</span></span>
      <span><span className="text-muted-foreground mr-2">UTC</span><span className="tabular-nums text-foreground/80">{time(now, 'UTC')}</span></span>
    </div>
  );
};

export const CommandShell = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const items = user?.role === 'admin' ? [...baseNav, ...adminNav] : baseNav;
  const dispatch = useDispatch();
  const nav = useNavigate();
  const location = useLocation();
  const live = useLive();
  const current = [...items].reverse().find(i => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));

  const signOut = () => { dispatch(logout()); nav('/login'); };

  return (
    <div className="h-screen grid grid-rows-[48px_1fr] grid-cols-[224px_1fr] scanlines">
      {/* Top bar: who and where you are, link state, time. */}
      <header className="col-span-2 flex items-center gap-4 px-4 border-b border-border bg-sidebar/90 backdrop-blur">
        <div className="flex items-center gap-2.5 w-[200px]">
          <div className="w-7 h-7 rounded-sm border border-primary/60 bg-primary/10 grid place-items-center text-primary shadow-[0_0_14px_hsl(var(--glow)/0.45)]">
            <Heart size={14} fill="currentColor" />
          </div>
          <div className="font-mono text-[13px] tracking-[0.22em] leading-none">
            <span className="text-foreground font-semibold">VITALIS</span>
            <span className="text-primary"> / </span>
            <span className="text-muted-foreground">COMMAND</span>
          </div>
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="hud-label text-foreground/80">{current?.label ?? ''}</div>

        <div className="ml-auto flex items-center gap-5">
          <div className="flex items-center gap-2 font-mono text-xs" aria-live="polite">
            <span className={cn('relative w-2 h-2 rounded-full', live ? 'bg-primary shadow-[0_0_10px_hsl(var(--glow))]' : 'bg-[hsl(var(--warn))] animate-blink')} />
            <span className={live ? 'text-primary' : 'text-[hsl(var(--warn))]'}>{live ? 'LIVE' : 'RECONNECTING'}</span>
          </div>
          <Clocks />
          <div className="h-5 w-px bg-border" />
          <div className="text-right leading-tight">
            <div className="text-sm font-medium">{user?.name ?? 'Operator'}</div>
            <div className="hud-label !text-[10px]">{user?.role ?? ''}</div>
          </div>
          <button
            onClick={signOut}
            className="w-8 h-8 grid place-items-center rounded-sm border border-border text-muted-foreground hover:text-destructive hover:border-destructive/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Navigation rail. */}
      <aside className="border-r border-sidebar-border bg-sidebar/80 backdrop-blur flex flex-col min-h-0">
        <div className="hud-label px-5 pt-5 pb-2">Sections</div>
        <nav className="flex flex-col px-2 gap-0.5">
          {items.map(({ to, label, icon: Icon, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'group relative flex items-center gap-3 pl-4 pr-3 h-10 rounded-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-gradient-to-r from-primary/15 to-transparent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-primary shadow-[0_0_10px_hsl(var(--glow))]" />}
                  <span className={cn('font-mono text-[10px] tabular-nums w-4', isActive ? 'text-primary' : 'text-muted-foreground/60')}>{String(i + 1).padStart(2, '0')}</span>
                  <Icon size={16} className={isActive ? 'text-primary' : ''} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 border-t border-sidebar-border font-mono text-[10px] leading-relaxed text-muted-foreground/70 tracking-wider">
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/70" /> ENCRYPTED LINK</div>
          <div>41.33°N 19.82°E · TIRANA</div>
        </div>
      </aside>

      <main className="min-w-0 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

/** Page title row: a mono section tag above a plain-language title. */
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <header className="flex items-end justify-between gap-4 px-6 pt-6 pb-4">
    <div>
      <div className="hud-label flex items-center gap-2">
        <span className="inline-block w-3 h-px bg-primary" /> {subtitle ?? 'Vitalis command'}
      </div>
      <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">{title}</h1>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
);
