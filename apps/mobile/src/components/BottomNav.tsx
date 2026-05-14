import { NavLink } from 'react-router-dom';
import { Home, Droplets, Stethoscope, Users, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { path: '/app', label: 'Home', icon: Home, end: true },
  { path: '/app/blood', label: 'Blood', icon: Droplets },
  { path: '/app/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/app/community', label: 'Community', icon: Users },
  { path: '/app/profile', label: 'Profile', icon: UserCircle },
];

export const BottomNav = () => (
  <nav className="bottom-nav flex items-center justify-around px-2">
    {items.map(({ path, label, icon: Icon, end }) => (
      <NavLink
        key={path}
        to={path}
        end={end}
        className={({ isActive }) => cn('nav-item relative', isActive && 'active')}
      >
        {({ isActive }) => (
          <>
            <Icon size={22} strokeWidth={isActive ? 2.4 : 1.6} aria-hidden />
            <span className="text-[11px] font-medium mt-0.5">{label}</span>
            {isActive && (
              <span className="absolute bottom-1 w-8 h-0.5 bg-primary rounded-full" aria-hidden />
            )}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
