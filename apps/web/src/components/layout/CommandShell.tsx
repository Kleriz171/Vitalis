import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Pulse, Lightning, Drone, Cube, ChartBar, SignOut, Heart, UsersThree, Stethoscope, type Icon,
} from '@phosphor-icons/react';
import { Tile } from '../ui/tile';
import { Digits } from '../ui/digits';
import { ReactNode, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BASE } from '../../lib/motion';
import { RootState, logout } from '../../store';
import { socket } from '../../realtime/socket';
import { cn } from '../../lib/utils';

type NavItem = { to: string; label: string; icon: Icon; end?: boolean };

const baseNav: NavItem[] = [
  { to: '/command', label: 'Live operations', icon: Pulse, end: true },
  { to: '/command/aeds', label: 'Defibrillators', icon: Lightning },
  { to: '/command/drones', label: 'Drones', icon: Drone },
  { to: '/command/ledger', label: 'Ledger', icon: Cube },
  { to: '/command/analytics', label: 'Analytics', icon: ChartBar },
];
const adminNav: NavItem[] = [
  { to: '/command/admin/users', label: 'Users', icon: UsersThree },
  { to: '/command/admin/doctor-applications', label: 'Doctor review', icon: Stethoscope },
];

const ROLE_NAME: Record<string, string> = { eso: 'Emergency services operator', dispatcher: 'Emergency services operator', admin: 'Emergency services operator' };

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
      <Digits value={time(now, 'Europe/Tirane')} className="text-[15px] font-medium text-white" />
      <span className="text-sidebar-foreground/60">Tirana</span>
      <span className="text-sidebar-foreground/60 ml-2"><Digits value={time(now, 'UTC').slice(0, 5)} /> UTC</span>
    </div>
  );
};

export const CommandShell = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  // One operator role does everything: dispatch and administration.
  const items = [...baseNav, ...adminNav];
  const dispatch = useDispatch();
  const nav = useNavigate();
  const location = useLocation();
  const live = useLive();

  const signOut = () => { dispatch(logout()); nav('/login'); };

  return (
    // The green frame (sidebar + top bar) with the work sheet laid on it.
    <div className="h-screen grid grid-rows-[56px_1fr] grid-cols-[232px_1fr] frame-texture text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5">
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--teal))] grid place-items-center text-white shadow-[0_6px_16px_-6px_hsl(173_79%_37%/0.8)]">
          <Heart size={20} weight="fill" />
        </div>
        <div className="leading-none">
          <div className="text-[18px] font-extrabold tracking-[-0.02em] text-white">Vitalis</div>
          <div className="text-[12px] text-sidebar-foreground/65 mt-0.5">Command</div>
        </div>
      </div>

      <header className="flex items-center gap-6 pr-5">
        {/* The dashboard has its own large clock and link light; other pages get the small ones. */}
        {location.pathname !== '/command' && <>
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
        </>}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-white">{user?.name ?? 'Operator'}</div>
            <div className="text-[12px] text-sidebar-foreground/65">{ROLE_NAME[user?.role ?? ''] ?? user?.role ?? ''}</div>
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
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </header>

      <aside className="flex flex-col min-h-0 pt-4">
        <nav className="flex flex-col gap-1 px-3">
          {items.map(({ to, label, icon: I, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'relative flex items-center gap-3 pl-2 pr-3 h-11 rounded-xl text-[14px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-sidebar-foreground/85 hover:text-white hover:bg-white/[0.08]',
              )}
            >
              {({ isActive }) => (
                <>
                  {/* One white pill that slides to whichever section is open. */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={BASE}
                      className="absolute inset-0 rounded-xl bg-white shadow-[0_8px_20px_-10px_hsl(175_80%_5%/0.6)]"
                    />
                  )}
                  <span className={cn('relative w-8 h-8 grid place-items-center rounded-[10px] transition-colors duration-300', isActive ? 'bg-[hsl(173_55%_92%)] text-primary' : 'text-sidebar-foreground/85')}>
                    <I size={19} weight={isActive ? 'duotone' : 'regular'} />
                  </span>
                  <span className="relative truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-5 text-[12px] leading-relaxed text-sidebar-foreground/55">
          Dispatch network · Tirana
          <div>41.3275° N, 19.8187° E</div>
        </div>
      </aside>

      <main className="min-w-0 min-h-0 overflow-auto bg-background">
        {/* The new page rises in; the old one leaves at once, so there is never a blank gap. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={BASE}
          className="text-foreground"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};

/**
 * Page header on the green band, like the phone app: an icon tile, a heavy white title and one
 * line on what the page is for. The first block after it overlaps the band's lower edge.
 */
export const PageHeader = ({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: Icon }) => (
  <header className="page-band frame-texture flex items-start justify-between gap-4 px-6 pt-7 pb-[4.75rem]">
    <div className="flex items-center gap-4 min-w-0">
      {icon && <Tile icon={icon} tone="band" size="lg" />}
      <div className="min-w-0">
        <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.025em] text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-white/75">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="relative z-10 flex items-center gap-2">{actions}</div>}
  </header>
);
