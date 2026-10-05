import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { App } from './App';
import { MotionConfig } from 'framer-motion';
import { BASE } from './lib/motion';
import './styles/index.css';
import './i18n';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          {/* Honour the OS 'reduce motion' setting everywhere. */}
          <MotionConfig reducedMotion="user" transition={BASE}>
            <App />
          </MotionConfig>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
