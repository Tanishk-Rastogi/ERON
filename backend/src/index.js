require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const Sentry = require('@sentry/node');
const url = require('url');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Scoped broadcast helper mimicking io.emit
const ioMock = {
  emit: (type, payload) => {
    const msg = JSON.stringify({ type, ...payload });
    wss.clients.forEach(client => {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        if (payload.referral && client.hospitalId) {
          const ref = payload.referral;
          if (ref.originHospitalId !== client.hospitalId && ref.targetHospitalId !== client.hospitalId && ref.acceptedHospitalId !== client.hospitalId) {
             return;
          }
        }
        client.send(msg);
      }
    });
  }
};

// Sentry initialization (Mocked if DSN is missing, but setup for production)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app })
    ],
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(cors());
app.use(express.json());

// Socket.io injection into req
app.use((req, res, next) => {
  req.io = ioMock;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const hospitalRoutes = require('./routes/hospitals');
const referralRoutes = require('./routes/referrals');
const ambulanceRoutes = require('./routes/ambulances');
const demoRoutes = require('./routes/demo');
const smsRoutes = require('./routes/sms');
const analyticsRoutes = require('./routes/analytics');
const messagesRoutes = require('./routes/messages');

app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/demo', demoRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/messages', messagesRoutes);

// Basic Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Sentry Error Handler
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const parameters = url.parse(req.url, true);
  const token = parameters.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforlocaldev123');
      ws.hospitalId = decoded.hospital_id || decoded.hospitalId;
    } catch(e) {}
  }
  console.log('Client connected via WebSocket, hospitalId:', ws.hospitalId);
  ws.on('close', () => {
    console.log('Client disconnected, hospitalId:', ws.hospitalId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
