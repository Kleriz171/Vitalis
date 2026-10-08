import logo from '../assets/logo.png';

export const Logo = ({ light = false }: { light?: boolean }) => (
  <span className="inline-flex items-center gap-2.5">
    <img src={logo} width={36} height={36} alt="" aria-hidden />
    <span className={light ? 'text-lg font-bold text-white' : 'text-lg font-bold text-ink'}>Vitalis</span>
  </span>
);
