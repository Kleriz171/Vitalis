import React from 'react';
import ReactDOM from 'react-dom/client';
import { Home } from './home/Home';
import { LangProvider } from './i18n';
import { Verify } from './Verify';
import { Track } from './Track';
import { Privacy } from './Privacy';
import { Terms } from './Terms';
import { MedicalId } from './MedicalId';
import './styles.css';

// A few pages don't need a router: /verify/:token checks a certificate, /track/:token follows a
// live SOS (link texted to the emergency contact), /id/:token is a medical ID QR's profile,
// /privacy and /terms are the legal pages, everything else is home.
const verifyToken = window.location.pathname.match(/^\/verify\/([^/]+)\/?$/)?.[1];
const trackToken = window.location.pathname.match(/^\/track\/([^/]+)\/?$/)?.[1];
const medicalIdToken = window.location.pathname.match(/^\/id\/([^/]+)\/?$/)?.[1];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {verifyToken ? <Verify token={decodeURIComponent(verifyToken)} />
      : trackToken ? <Track token={decodeURIComponent(trackToken)} />
      : medicalIdToken ? <MedicalId token={decodeURIComponent(medicalIdToken)} />
      : /^\/privacy\/?$/.test(window.location.pathname) ? <Privacy />
      : /^\/terms\/?$/.test(window.location.pathname) ? <Terms />
      : <LangProvider><Home /></LangProvider>}
  </React.StrictMode>,
);
