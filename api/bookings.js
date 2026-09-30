// Vercel Serverless Function - proxies requests to Cloudflare Worker

const WORKER_URL = process.env.WORKER_URL; // e.g. https://asni-worker.YOUR_SUBDOMAIN.workers.dev
const API_SECRET = process.env.API_SECRET; // shared secret to protect worker

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!WORKER_URL) {
        return res.status(500).json({ error: 'WORKER_URL not configured' });
    }

    try {
        const target = `${WORKER_URL}${req.url.replace(/^\/api/, '')}`;

        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Secret': API_SECRET || ''
            }
        };

        if (req.method === 'POST' && req.body) {
            fetchOptions.body = typeof req.body === 'string'
                ? req.body
                : JSON.stringify(req.body);
        }

        const workerRes = await fetch(target, fetchOptions);
        const data = await workerRes.json().catch(() => ({}));

        return res.status(workerRes.status).json(data);
    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(502).json({ error: 'Upstream service unavailable' });
    }
}
