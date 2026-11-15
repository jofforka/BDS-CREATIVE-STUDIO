import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaystackSignature, validAmountKobo, isValidBookingWindow, normalizePaystackTransaction } from '../src/security.js';
test('Paystack signature accepts exact HMAC only', () => {
 const body = Buffer.from('{"event":"charge.success"}');
 const signature = createHmac('sha512', 'secret').update(body).digest('hex');
 assert.equal(verifyPaystackSignature(body, signature, 'secret'), true);
 assert.equal(verifyPaystackSignature(body, signature, 'wrong'), false);
 assert.equal(verifyPaystackSignature(body, 'invalid', 'secret'), false);
});
test('amounts are safe positive integers', () => {
 assert.equal(validAmountKobo(100), true); assert.equal(validAmountKobo(0), false);
 assert.equal(validAmountKobo(1.2), false); assert.equal(validAmountKobo(Number.MAX_SAFE_INTEGER + 1), false);
});
test('booking windows reject past, zero and excessive durations', () => {
 const now = new Date('2026-11-15T12:00:00Z');
 assert.equal(isValidBookingWindow('2026-11-16T12:00:00Z', '2026-11-16T14:00:00Z', now), true);
 assert.equal(isValidBookingWindow('2026-11-14T12:00:00Z', '2026-11-14T14:00:00Z', now), false);
 assert.equal(isValidBookingWindow('2026-11-16T12:00:00Z', '2026-11-16T12:00:00Z', now), false);
});
test('payment verification requires exact reference, amount, currency and success', () => {
 const expected={reference:'ref',amountKobo:5000};
 assert.equal(normalizePaystackTransaction({status:'success',reference:'ref',currency:'NGN',amount:5000},expected),true);
 assert.equal(normalizePaystackTransaction({status:'success',reference:'ref',currency:'USD',amount:5000},expected),false);
 assert.equal(normalizePaystackTransaction({status:'success',reference:'ref',currency:'NGN',amount:4000},expected),false);
});
