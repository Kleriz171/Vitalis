import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Activity, Plane, Boxes, BarChart3, LogOut, Heart, Users, Stethoscope, Zap,
} from 'lucide-react';
import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RootState, logout } from '../../store';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

const baseNav = [
  { to: '/command', label: 'Live operations', icon: Activity, end: true },
  { to: '/command/aeds', label: 'Defibrillators', icon: Zap },
  { to: '/command/drones', label: 'Drones', icon: Plane },
  { to: '/command/ledger', label: 'Ledger', icon: Boxes },
  { to: '/command/analytics', label: 'Analytics', icon: BarChart3 },
];

export const CommandShell = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const navItems = user?.role === 'admin'
    ? [
        ...baseNav,
        { to: '/command/admin/users', label: 'Users', icon: Users },
        { to: '/command/admin/doctor-applications', label: 'Doctor apps', icon: Stethoscope },
      ]
    : baseNav;
  const dispatch = useDispatch();
  const nav = useNavigate();
  const location = useLocation();

  const signOut = () => { dispatch(logout()); nav('/login'); };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Heart size={18} fill="currentColor" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sidebar-foreground">Vitalis</div>
            <div className="text-xs text-muted-foreground">Command</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-primary' : ''} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-accent/50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {(user?.name ?? '?').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user?.name ?? 'Guest'}</div>
                  <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut size={14} /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <header className="flex items-end justify-between gap-4 px-6 md:px-8 pt-6 pb-4 border-b border-border bg-card/40 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
    {actions && (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2"
      >
        {actions}
      </motion.div>
    )}
  </header>
);
