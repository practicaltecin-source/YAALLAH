import type { IncomingMessage, ServerResponse } from 'http';
import initialDb from '../db.json';

// Memory cache for Vercel serverless instance initialized with seed database
let cachedDb: any = initialDb;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json(cachedDb || { teams: [], programs: [], participants: [], results: [], settings: {} });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body && Array.isArray(body.teams)) {
        cachedDb = body;
        return res.status(200).json({ success: true, db: cachedDb });
      }
      return res.status(400).json({ error: 'Invalid DB payload' });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to process DB update' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
