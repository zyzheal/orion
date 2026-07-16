/**
 * HR Webhook Signature Verification Middleware
 *
 * Verifies HMAC-SHA256 signatures on incoming HR system webhooks.
 * Prevents unauthorized access and replay attacks.
 *
 * Expected Headers:
 *   X-HR-Signature: sha256=<hex_hmac>
 *   X-HR-Timestamp: <unix_timestamp_ms>
 *   X-HR-Event: employee_change (optional, for event type verification)
 *
 * Verification:
 *   1. Check timestamp within allowed skew (default: 5 minutes)
 *   2. Compute HMAC-SHA256 of request body using shared secret
 *   3. Compare with provided signature (constant-time comparison)
 */

import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../utils/logger';

const logger = createLogger('hrWebhookAuth');

const ALLOWED_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify HR webhook signature
 *
 * Rejects requests with:
 *   - Missing signature or timestamp headers
 *   - Timestamp outside allowed skew window (replay protection)
 *   - Invalid HMAC signature
 */
export async function verifyHrWebhookSignature(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const signature = request.headers['x-hr-signature'] as string | undefined;
  const timestamp = request.headers['x-hr-timestamp'] as string | undefined;

  if (!signature || !timestamp) {
    return reply.status(401).send({
      error: 'MISSING_HEADERS',
      message: 'Missing X-HR-Signature or X-HR-Timestamp header',
    });
  }

  // 1. Check timestamp (replay protection)
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return reply.status(401).send({
      error: 'INVALID_TIMESTAMP',
      message: 'X-HR-Timestamp must be a valid Unix timestamp in milliseconds',
    });
  }

  const now = Date.now();
  const timeDiff = Math.abs(now - requestTime);
  if (timeDiff > ALLOWED_TIMESTAMP_SKEW_MS) {
    logger.warn(
      { requestTime, now, timeDiff },
      '[HrWebhook] Rejected: timestamp outside allowed skew window'
    );
    return reply.status(401).send({
      error: 'EXPIRED_TIMESTAMP',
      message: `Request timestamp is too old (skew: ${timeDiff}ms, allowed: ${ALLOWED_TIMESTAMP_SKEW_MS}ms)`,
    });
  }

  // 2. Compute expected signature
  const webhookSecret = process.env.HR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('[HrWebhook] HR_WEBHOOK_SECRET not configured');
    return reply.status(500).send({
      error: 'MISCONFIGURED',
      message: 'HR webhook secret not configured on server',
    });
  }

  const rawBody = JSON.stringify(request.body);
  const stringToSign = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(stringToSign)
    .digest('hex');

  // 3. Constant-time signature comparison (prevent timing attacks)
  const providedSignature = signature.startsWith('sha256=')
    ? signature.substring(7)
    : signature;

  if (!crypto.timingSafeEqual(
    Buffer.from(providedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )) {
    logger.warn(
      { provided: providedSignature.substring(0, 8), expected: expectedSignature.substring(0, 8) },
      '[HrWebhook] Rejected: invalid signature'
    );
    return reply.status(401).send({
      error: 'INVALID_SIGNATURE',
      message: 'Webhook signature verification failed',
    });
  }

  // Signature verified - allow request to proceed
  logger.debug('[HrWebhook] Signature verified');
}

/**
 * Generate HR webhook signature (for testing / HR system integration)
 */
export function generateHrWebhookSignature(payload: any, secret: string, timestamp?: number): {
  signature: string;
  timestamp: number;
} {
  const ts = timestamp || Date.now();
  const stringToSign = `${ts}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');

  return {
    signature: `sha256=${signature}`,
    timestamp: ts,
  };
}
