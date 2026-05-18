import { Logo } from '../components/Logo';

export const Footer = () => (
  <footer className="border-t border-border/70 mt-8">
    <div className="mx-auto max-w-7xl px-6 md:px-10 py-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
      <Logo />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <a className="hover:text-foreground" href="#platform">Platform</a>
        <a className="hover:text-foreground" href="#how">How it works</a>
        <a className="hover:text-foreground" href="#trust">Trust</a>
        <a className="hover:text-foreground" href="#teams">For teams</a>
        <a className="hover:text-foreground" href="http://localhost:5173">Command portal</a>
        <a className="hover:text-foreground" href="http://localhost:5174">Mobile app</a>
      </div>
      <div className="text-xs text-muted-foreground font-mono">© Vitalis prototype · v0.1.0</div>
    </div>
  </footer>
);
