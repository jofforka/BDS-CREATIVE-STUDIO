import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const env = process.env;
const required = ['DATABASE_URL'];
const missing = required.filter(key => !env[key]);
if (missing.length) throw new Error('Missing required server configuration: ' + missing.join(', '));
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
const port = Number(env.PORT || 8787);
const send = (res, status, payload) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(payload)); };
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && path === '/api/services') {
      const result = await pool.query('SELECT id,name,booking_mode,duration_minutes,price_kobo,deposit_kobo FROM public.studio_services WHERE active=true ORDER BY name');
      return send(res, 200, { services: result.rows });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) { console.error('API error:', error.message); return send(res, 500, { error: 'Request could not be completed' }); }
});
server.listen(port, () => console.log('BDS API listening on port ' + port));
