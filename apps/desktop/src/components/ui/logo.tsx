import logo from '../../assets/logo.png';

/** The Vitalis logo tile (brand/logo-tile.png, built by scripts/brand-assets.py). */
export const Logo = ({ size = 36, className = '' }: { size?: number; className?: string }) => (
  <img src={logo} width={size} height={size} alt="" aria-hidden className={`shrink-0 ${className}`} />
);
