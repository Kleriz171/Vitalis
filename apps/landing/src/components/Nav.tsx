import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './Button';

const links = [
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how' },
  { label: 'Trust', href: '#trust' },
  { label: 'For teams', href: '#teams' },
];

export const Nav = () => (
  <motion.header
    initial={{ y: -24, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className="sticky top-0 z-40 glass border-b border-border/60"
  >
    <div className="mx-auto max-w-7xl px-6 md:px-10 h-16 flex items-center justify-between">
      <Logo />
      <nav className="hidden md:flex items-center gap-1">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="relative px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button href="http://localhost:5173/login" variant="ghost" size="sm">
          Sign in
        </Button>
        <Button href="http://localhost:5173" size="sm">
          Open command portal <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  </motion.header>
);
