export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { url, payload, db } = body || {};
    const targetUrl = url || db?.settings?.sheetWebhookUrl || db?.settings?.appsScriptUrl;

    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'No target webhook URL provided' });
    }

    const syncData = payload || {
      action: 'write',
      db,
      lastModified: Date.now()
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(syncData),
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    return res.status(200).json({
      success: response.ok,
      status: response.status,
      message: text ? text.slice(0, 500) : 'Webhook triggered successfully'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to proxy request to Google Sheets Webhook'
    });
  }
}
