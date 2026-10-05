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

const Clock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden lg:flex items-baseline gap-2 text-sm">
      <span className="num text-[15px] font-medium text-white">{time(now, 'Europe/Tirane')}</span>
      <span className="text-sidebar-foreground/60">Tirana</span>
      <span className="num text-sidebar-foreground/60 ml-2">{time(now, 'UTC').slice(0, 5)} UTC</span>
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

  const signOut = () => { dispatch(logout()); nav('/login'); };

  return (
    // The green frame (sidebar + top bar) with the work sheet laid on it.
    <div className="h-screen grid grid-rows-[56px_1fr] grid-cols-[232px_1fr] frame-texture text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--teal))] grid place-items-center text-white">
          <Heart size={16} fill="currentColor" strokeWidth={0} />
        </div>
        <div className="leading-none">
          <div className="text-[17px] font-semibold tracking-tight text-white">Vitalis</div>
          <div className="text-[12px] text-sidebar-foreground/65 mt-0.5">Command</div>
        </div>
      </div>

      <header className="flex items-center gap-6 pr-5">
        <div
          className={cn(
            'flex items-center gap-2 rounded-full pl-2.5 pr-3 h-7 text-[13px] font-medium',
            live ? 'bg-white/10 text-white' : 'bg-[hsl(var(--warn))] text-white',
          )}
          aria-live="polite"
        >
          <span className={cn('w-2 h-2 rounded-full', live ? 'bg-[hsl(173_79%_55%)] animate-live' : 'bg-white')} />
          {live ? 'Live' : 'Reconnecting'}
        </div>
        <Clock />
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-white">{user?.name ?? 'Operator'}</div>
            <div className="text-[12px] text-sidebar-foreground/65 capitalize">{user?.role ?? ''}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 grid place-items-center text-sm font-semibold text-white">
            {(user?.name ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <button
            onClick={signOut}
            className="w-8 h-8 grid place-items-center rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <aside className="flex flex-col min-h-0 pt-8">
        <nav className="flex flex-col gap-1 pl-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'relative flex items-center gap-3 pl-3 pr-4 h-10 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  // The open folder tab: the sheet's colour, joined to it.
                  ? 'bg-background text-primary font-medium rounded-l-xl tab-join'
                  : 'text-sidebar-foreground/80 hover:text-white hover:bg-white/[0.07] rounded-xl mr-3',
              )}
            >
              <Icon size={17} strokeWidth={2} />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-5 text-[12px] leading-relaxed text-sidebar-foreground/55">
          Dispatch network · Tirana
          <div className="num">41.3275° N, 19.8187° E</div>
        </div>
      </aside>

      <main className="min-w-0 min-h-0 overflow-auto bg-background rounded-tl-[20px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-foreground"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

/** Page title row: a plain title and one line saying what the page is for. */
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <header className="flex items-end justify-between gap-4 px-6 pt-7 pb-5">
    <div>
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
);
