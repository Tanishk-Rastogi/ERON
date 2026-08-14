import express from 'express';
import cors from 'cors';
import { createApiRouter } from '../server/routes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Serverless fallback broadcast logger
const broadcastFn = (data) => {
  console.log('[Vercel Serverless Broadcast]:', data.type);
};

app.use('/api', createApiRouter(broadcastFn));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', env: 'vercel-serverless', timestamp: new Date().toISOString() });
});

export default app;
