import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyPaystackSignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function validAmountKobo(value) {
  return Number.isSafeInteger(value) && value > 0;
}
export function isValidBookingWindow(start, end, now = new Date()) {
  const a = new Date(start), b = new Date(end);
  return Number.isFinite(a.getTime()) && Number.isFinite(b.getTime()) &&
    a.getTime() > now.getTime() && b.getTime() > a.getTime() &&
    b.getTime() - a.getTime() <= 24 * 60 * 60 * 1000;
}
export function normalizePaystackTransaction(tx, expected) {
  return tx?.status === 'success' && tx?.reference === expected.reference &&
    tx?.currency === 'NGN' && tx?.amount === expected.amountKobo;
}
