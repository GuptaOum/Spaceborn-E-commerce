import crypto from 'node:crypto';

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyPaymentSignature(providerOrderId: string, paymentId: string, signature: string, secret: string) {
  return safeEqualHex(hmacSha256Hex(secret, `${providerOrderId}|${paymentId}`), signature);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
  return safeEqualHex(hmacSha256Hex(secret, rawBody), signature);
}
