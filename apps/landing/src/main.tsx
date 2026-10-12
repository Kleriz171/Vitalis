import React from 'react';
import ReactDOM from 'react-dom/client';
import { Home } from './home/Home';
import { LangProvider } from './i18n';
import { Verify } from './Verify';
import { Track } from './Track';
import { Privacy } from './Privacy';
import './styles.css';

// A few pages don't need a router: /verify/:token checks a certificate, /track/:token follows a
// live SOS (link texted to the emergency contact), /privacy is the policy, everything else is home.
const verifyToken = window.location.pathname.match(/^\/verify\/([^/]+)\/?$/)?.[1];
const trackToken = window.location.pathname.match(/^\/track\/([^/]+)\/?$/)?.[1];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {verifyToken ? <Verify token={decodeURIComponent(verifyToken)} />
      : trackToken ? <Track token={decodeURIComponent(trackToken)} />
      : /^\/privacy\/?$/.test(window.location.pathname) ? <Privacy />
      : <LangProvider><Home /></LangProvider>}
  </React.StrictMode>,
);
