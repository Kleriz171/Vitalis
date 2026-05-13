import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { BottomNav } from './BottomNav';
import { SOSModal } from './SOSModal';

export const MobileShell = () => {
  const [sosOpen, setSosOpen] = useState(false);

  return (
    <div className="mobile-container">
      <div className="mobile-content">
        <Outlet context={{ openSOS: () => setSosOpen(true) }} />
      </div>
      <button
        type="button"
        onClick={() => setSosOpen(true)}
        className="sos-fab"
        aria-label="Open SOS panel"
      >
        SOS
      </button>
      <BottomNav />
      <SOSModal open={sosOpen} onClose={() => setSosOpen(false)} />
    </div>
  );
};
