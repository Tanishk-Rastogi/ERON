import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import * as Sentry from '@sentry/react';
import './index.css';

ReactDOM.if (import.meta.env.VITE_SENTRY_DSN) { Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()], tracesSampleRate: 1.0, replaysSessionSampleRate: 0.1, replaysOnErrorSampleRate: 1.0 }); }

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
