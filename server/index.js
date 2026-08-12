import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { createApiRouter } from './routes.js';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static production build from dist/
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });


// Active WebSocket connections pool
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[WebSocket] Client connected. Active clients:', clients.size);

  // Send initial state sync
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    hospitals: db.getHospitals(),
    referrals: db.getReferrals()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[WebSocket Message Received]:', data.type);

      // Handle live ambulance GPS pings
      if (data.type === 'AMBULANCE_PING') {
        const { ambulanceId, lat, lng } = data;
        const amb = db.ambulances.find(a => a.id === ambulanceId);
        if (amb) {
          amb.currentLat = lat;
          amb.currentLng = lng;
          amb.lastPingAt = new Date().toISOString();

          broadcast({
            type: 'AMBULANCE_LOCATION_UPDATED',
            ambulanceId,
            lat,
            lng,
            timestamp: amb.lastPingAt
          });
        }
      }
    } catch (err) {
      console.error('[WebSocket Message Error]:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[WebSocket] Client disconnected. Active clients:', clients.size);
  });
});

/**
 * Broadcasts JSON event to all connected WebSocket clients
 */
function broadcast(payload) {
  const jsonStr = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  }
}

// Mount REST API Router
app.use('/api', createApiRouter(broadcast));

// Serve SPA fallback for client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), clientsCount: clients.size });
});


server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ERON Backend Server running on http://localhost:${PORT}`);
  console.log(` WebSocket server active on ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
