// Vercel Serverless Function – API Key Proxy
// Env variable: OWM_API_KEY (set di Vercel Dashboard)
// Endpoint: /api/apikey

export default function handler(req, res) {
  const key = process.env.OWM_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: 'OWM_API_KEY environment variable tidak ditemukan. Pastikan sudah diset di Vercel Dashboard.'
    });
  }

  // Security: hanya izinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cache-Control: jangan cache di browser (API key sensitif)
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ key });
}
