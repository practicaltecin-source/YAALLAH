import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

// Load db.json safely in Vercel Node runtime
let initialDb: any = { teams: [], programs: [], participants: [], results: [], settings: {} };
try {
  const dbPath = path.join(process.cwd(), 'db.json');
  if (fs.existsSync(dbPath)) {
    initialDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load db.json fallback:', e);
}

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
    const dbData = cachedDb || { teams: [], programs: [], participants: [], results: [], settings: {} };
    return res.status(200).json({ success: true, db: dbData, ...dbData });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const dbPayload = body?.db || body;
      if (dbPayload && Array.isArray(dbPayload.teams)) {
        cachedDb = dbPayload;
        return res.status(200).json({ success: true, db: cachedDb });
      }
      return res.status(400).json({ error: 'Invalid DB payload' });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to process DB update' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
