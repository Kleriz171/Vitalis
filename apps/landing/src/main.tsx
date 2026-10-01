import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Verify } from './Verify';
import { Track } from './Track';
import './styles.css';

// Three pages don't need a router: /verify/:token checks a certificate, /track/:token follows a
// live SOS (link texted to the emergency contact), everything else is home.
const verifyToken = window.location.pathname.match(/^\/verify\/([^/]+)\/?$/)?.[1];
const trackToken = window.location.pathname.match(/^\/track\/([^/]+)\/?$/)?.[1];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {verifyToken ? <Verify token={decodeURIComponent(verifyToken)} />
      : trackToken ? <Track token={decodeURIComponent(trackToken)} />
      : <App />}
  </React.StrictMode>,
);
