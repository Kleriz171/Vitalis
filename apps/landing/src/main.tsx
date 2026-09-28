import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Verify } from './Verify';
import './styles.css';

// Two pages don't need a router: /verify/:token is the certificate check, everything else is home.
const verifyToken = window.location.pathname.match(/^\/verify\/([^/]+)\/?$/)?.[1];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {verifyToken ? <Verify token={decodeURIComponent(verifyToken)} /> : <App />}
  </React.StrictMode>,
);
