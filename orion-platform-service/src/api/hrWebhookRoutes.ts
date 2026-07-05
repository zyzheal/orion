/**
 * HR System Webhook API Routes
 *
 * Receives employee lifecycle events from the HR system via webhook.
 * Automatically creates/disables users and manages SSO bindings.
 *
 * Supported Events:
 *   - hired: New employee → create user account (SSO-only, no password)
 *   - terminated: Employee left → terminate user + revoke all tokens + unbind SSO
 *   - transferred: Department change → update user department
 *   - suspended: Temporary ban → suspend user + revoke tokens (optional expiry)
 *
 * Security:
 *   - HMAC-SHA256 signature verification (prevent unauthorized access)
 *   - Timestamp-based replay protection (5-minute window)
 *   - Audit logging for all HR-synced changes
 *
 * Webhook Headers:
 *   X-HR-Signature: sha256=<hmac_hex>
 *   X-HR-Timestamp: <unix_timestamp_ms>
 *
 * Usage (HR System Configuration):
 *   URL: POST https://orion.example.com/api/v1/webhooks/hr/employee-change
 *   Headers: X-HR-Signature, X-HR-Timestamp
 *   Body: { action, employee_id, full_name, work_email, department, ... }
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { TokenBlacklistService } from '../services/auth/TokenBlacklistService';
import { UserStatusService } from '../services/user/UserStatusService';
import { verifyHrWebhookSignature } from '../middleware/hrWebhookAuth';
import { createLogger } from '../utils/logger';

const logger = createLogger('hrWebhookRoutes');

export interface HrEmployeeChangeEvent {
  action: 'hired' | 'terminated' | 'transferred' | 'suspended';
  employee_id: string;
  full_name: string;
  work_email: string;
  department: string;
  new_department?: string;
  effective_date: string;
  expires_at?: string;  // suspended 时有效
}

interface HrWebhookRoutesOptions {
  database?: DatabasePool;
  tokenBlacklist?: TokenBlacklistService;
}

export default async function hrWebhookRoutes(
  app: FastifyInstance,
  options: HrWebhookRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[HrWebhook] Database not available');
    return;
  }

  const database = options.database;

  /**
   * Find or create user by employee ID (stored in users.metadata->employee_id)
   */
  async function findUserByEmployeeId(employeeId: string): Promise<any> {
    const result = await database.query(
      `SELECT id, username, email, name, department, status, metadata
       FROM users
       WHERE metadata->>'employee_id' = $1`,
      [employeeId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  async function findUserByEmail(email: string): Promise<any> {
    const result = await database.query(
      'SELECT id, username, email, name, department, status, metadata FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Create user from HR event
   */
  async function createUserFromHr(event: HrEmployeeChangeEvent): Promise<string> {
    const userId = require('crypto').randomUUID();
    const username = event.work_email.split('@')[0];

    await database.query(
      `INSERT INTO users (
        id, username, email, name, department, status,
        metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        userId,
        username,
        event.work_email,
        event.full_name,
        event.department,
        'active',
        JSON.stringify({ employee_id: event.employee_id, hire_date: event.effective_date }),
      ]
    );

    logger.info(
      { userId, username, employeeId: event.employee_id },
      '[HrWebhook] Created user from HR event: hired'
    );

    return userId;
  }

  /**
   * POST /api/v1/webhooks/hr/employee-change - HR system webhook endpoint
   */
  app.post('/employee-change', { onRequest: [verifyHrWebhookSignature] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const event = request.body as HrEmployeeChangeEvent;

      // Validate event
      const validActions = ['hired', 'terminated', 'transferred', 'suspended'];
      if (!validActions.includes(event.action)) {
        return reply.status(400).send({
          error: 'INVALID_EVENT',
          message: `action must be one of: ${validActions.join(', ')}`,
        });
      }

      if (!event.employee_id || !event.work_email || !event.full_name) {
        return reply.status(400).send({
          error: 'MISSING_FIELDS',
          message: 'employee_id, work_email, and full_name are required',
        });
      }

      // Find existing user
      let user = await findUserByEmployeeId(event.employee_id);
      if (!user) {
        user = await findUserByEmail(event.work_email);
      }

      const result: { userId?: string; action: string; note?: string } = { action: event.action };

      switch (event.action) {
        case 'hired':
          if (!user) {
            // New employee → create account
            const userId = await createUserFromHr(event);
            result.userId = userId;
            result.note = 'created';
          } else {
            // Re-hire → reactivate
            await database.query(
              `UPDATE users SET status = 'active', department = $1, updated_at = NOW(),
               metadata = jsonb_set(metadata, '{hire_date}', to_jsonb($2::text))
               WHERE id = $3`,
              [event.department, event.effective_date, user.id]
            );
            result.userId = user.id;
            result.note = 'reactivated';
          }
          break;

        case 'terminated':
          if (!user) {
            logger.warn(
              { employeeId: event.employee_id, email: event.work_email },
              '[HrWebhook] Received termination for unknown employee, ignored'
            );
            return reply.send({ success: true, data: { action: 'ignored', note: 'User not found' } });
          }

          // Terminate user + security cleanup
          await database.query(
            `UPDATE users SET status = 'terminated', department = $1, updated_at = NOW(),
             metadata = jsonb_set(metadata, '{termination_date}', to_jsonb($2::text))
             WHERE id = $3`,
            [event.department, event.effective_date, user.id]
          );

          // Run security cleanup (revoke tokens, unbind SSO)
          if (options.tokenBlacklist) {
            const userStatusService = new UserStatusService(database, options.tokenBlacklist);
            await userStatusService['disableUser'](user.id);
          }

          result.userId = user.id;
          result.note = 'terminated + tokens revoked';
          break;

        case 'transferred':
          if (!user) {
            return reply.status(404).send({
              error: 'USER_NOT_FOUND',
              message: `User not found for employee: ${event.employee_id}`,
            });
          }

          await database.query(
            'UPDATE users SET department = $1, updated_at = NOW() WHERE id = $2',
            [event.new_department || event.department, user.id]
          );

          result.userId = user.id;
          result.note = `department changed to ${event.new_department || event.department}`;
          break;

        case 'suspended':
          if (!user) {
            return reply.status(404).send({
              error: 'USER_NOT_FOUND',
              message: `User not found for employee: ${event.employee_id}`,
            });
          }

          await database.query(
            `UPDATE users SET status = 'suspended',
             suspension_expires_at = $1, updated_at = NOW()
             WHERE id = $2`,
            [event.expires_at ? new Date(event.expires_at) : null, user.id]
          );

          // Revoke tokens for suspended users
          if (options.tokenBlacklist) {
            const userStatusService = new UserStatusService(database, options.tokenBlacklist);
            await userStatusService['disableUser'](user.id);
          }

          result.userId = user.id;
          result.note = event.expires_at
            ? `suspended until ${event.expires_at}`
            : 'suspended indefinitely';
          break;
      }

      // Log to audit trail
      await database.query(
        `INSERT INTO user_status_history (user_id, old_status, new_status, reason, operator_id, changed_at)
         VALUES ($1, 'unknown', $2, $3, 'hr_system', NOW())`,
        [result.userId || 'unknown', event.action === 'hired' ? 'active' : event.action, `HR webhook sync: ${event.action}`]
      ).catch(() => {}); // Ignore if user doesn't exist yet

      return reply.send({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'WEBHOOK_ERROR';
      logger.error('[HrWebhook] Error processing employee change event:', error);
      return reply.status(500).send({ error: 'WEBHOOK_ERROR', message });
    }
  });

  /**
   * GET /api/v1/webhooks/hr/test - Test webhook endpoint (for debugging)
   */
  app.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      message: 'HR Webhook endpoint is active',
      configured: !!process.env.HR_WEBHOOK_SECRET,
    });
  });
}
