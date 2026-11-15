import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { verifyPaystackSignature, normalizePaystackTransaction, validAmountKobo } from './security.js';

const { Pool } = pg;
const env = process.env;
const required = ['DATABASE_URL', 'PAYSTACK_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = required.filter(key => !env[key]);
if (missing.length) throw new Error('Missing required server configuration: ' + missing.join(', '));
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
const port = Number(env.PORT || 8787);
const send = (res, status, payload) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(payload)); };
const parseBody = async req => {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('Request too large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
};
async function currentUser(req) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return null;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
    headers: { authorization: 'Bearer ' + token, apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === 'string' ? user : null;
}
async function paystack(path, options = {}) {
  const response = await fetch('https://api.paystack.co' + path, {
    ...options, headers: { authorization: 'Bearer ' + env.PAYSTACK_SECRET_KEY, 'content-type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Payment provider request failed');
  const result = await response.json();
  if (!result.status) throw new Error('Payment provider rejected request');
  return result.data;
}
async function processVerifiedPayment(reference) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payment = (await client.query('SELECT * FROM public.studio_payments WHERE provider_reference=$1 FOR UPDATE', [reference])).rows[0];
    if (!payment) { await client.query('ROLLBACK'); return 'unknown'; }
    if (payment.status === 'verified') { await client.query('COMMIT'); return 'already_verified'; }
    const booking = (await client.query('SELECT * FROM public.studio_bookings WHERE id=$1 FOR UPDATE', [payment.booking_id])).rows[0];
    if (!booking || booking.status !== 'held' || new Date(booking.hold_expires_at) <= new Date()) {
      await client.query('ROLLBACK'); return 'manual_reconciliation_required';
    }
    // Network calls must not occur inside a database transaction in production.
    // This version is a scaffold; verification happens before the DB update below.
    await client.query('UPDATE public.studio_payments SET status=$1,verified_at=now() WHERE id=$2', ['verified', payment.id]);
    await client.query('UPDATE public.studio_bookings SET status=$1 WHERE id=$2', ['confirmed', booking.id]);
    await client.query('UPDATE public.studio_booking_resources SET status=$1 WHERE booking_id=$2', ['confirmed', booking.id]);
    await client.query('COMMIT');
    return 'confirmed';
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && path === '/api/services') {
      const result = await pool.query('SELECT id,name,booking_mode,duration_minutes,price_kobo,deposit_kobo FROM public.studio_services WHERE active=true ORDER BY name');
      return send(res, 200, { services: result.rows });
    }
    if (req.method === 'POST' && path === '/api/payments/initialize') {
      const user = await currentUser(req);
      if (!user) return send(res, 401, { error: 'Authentication required' });
      const data = JSON.parse((await parseBody(req)).toString('utf8'));
      if (typeof data.bookingId !== 'string') return send(res, 400, { error: 'Invalid booking' });
      const result = await pool.query('SELECT * FROM public.studio_bookings WHERE id=$1 AND customer_id=$2', [data.bookingId, user.id]);
      const booking = result.rows[0];
      if (!booking || booking.status !== 'held' || new Date(booking.hold_expires_at) <= new Date()) return send(res, 409, { error: 'No active booking hold' });
      if (!validAmountKobo(Number(booking.deposit_due_kobo))) return send(res, 409, { error: 'Deposit not configured' });
      if (!user.email) return send(res, 400, { error: 'Verified account email required' });
      const existing = await pool.query("SELECT provider_reference FROM public.studio_payments WHERE booking_id=$1 AND status IN ('pending','verified') ORDER BY created_at DESC LIMIT 1", [booking.id]);
      if (existing.rows.length) return send(res, 409, { error: 'Payment already initiated; contact support for reconciliation' });
      const reference = 'bds_' + randomUUID().replaceAll('-', '');
      await pool.query('INSERT INTO public.studio_payments (booking_id,provider_reference,amount_kobo) VALUES ($1,$2,$3)', [booking.id, reference, booking.deposit_due_kobo]);
      const checkout = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: user.email, amount: Number(booking.deposit_due_kobo), currency: 'NGN', reference, metadata: { booking_id: booking.id } }) });
      return send(res, 200, { authorization_url: checkout.authorization_url, reference });
    }
    if (req.method === 'POST' && path === '/api/webhooks/paystack') {
      const raw = await parseBody(req);
      if (!verifyPaystackSignature(raw, req.headers['x-paystack-signature'], env.PAYSTACK_SECRET_KEY)) return send(res, 401, { error: 'Invalid signature' });
      const event = JSON.parse(raw.toString('utf8'));
      if (event.event !== 'charge.success' || typeof event.data?.reference !== 'string') return send(res, 200, { accepted: true });
      const record = (await pool.query('SELECT provider_reference,amount_kobo FROM public.studio_payments WHERE provider_reference=$1', [event.data.reference])).rows[0];
      if (!record) return send(res, 200, { accepted: true });
      const tx = await paystack('/transaction/verify/' + encodeURIComponent(record.provider_reference));
      if (!normalizePaystackTransaction(tx, { reference: record.provider_reference, amountKobo: Number(record.amount_kobo) })) return send(res, 409, { error: 'Payment verification mismatch' });
      const outcome = await processVerifiedPayment(record.provider_reference);
      return send(res, 200, { accepted: true, outcome });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) { console.error('API error:', error.message); return send(res, 500, { error: 'Request could not be completed' }); }
});
server.listen(port, () => console.log('BDS API listening on port ' + port));
