/**
 * Billing API Routes (Phase 4 - Quota & Billing)
 *
 * Routes under /api/v1/billing
 * Usage metering, billing records, billing summary
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { BillingService } from '../services/billing/BillingService';

const billingService = new BillingService();

export default async function billingRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Usage Metering ====================

  // Record usage
  app.post('/billing/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const record = await billingService.recordUsage(body, tenantId);
    return reply.status(201).send({ success: true, data: record });
  });

  // Get usage by tenant
  app.get('/billing/usage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const records = await billingService.getUsageByTenant(tenantId, {
      service: query.service,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
    });
    return reply.send({ success: true, data: records });
  });

  // Get usage summary
  app.get('/billing/usage/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const period = query.period || new Date().toISOString().slice(0, 7);
    const summary = await billingService.getUsageSummary(tenantId, period);
    return reply.send({ success: true, data: summary });
  });

  // ==================== Billing Records ====================

  // Generate billing record for a period
  app.post('/billing/records', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const period = body.period || new Date().toISOString().slice(0, 7);
    const record = await billingService.generateBillingRecord(tenantId, period);
    return reply.status(201).send({ success: true, data: record });
  });

  // List billing records
  app.get('/billing/records', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const records = await billingService.getBillingRecords(tenantId, {
      status: query.status,
      period: query.period,
    });
    return reply.send({ success: true, data: records });
  });

  // Get billing record by ID
  app.get('/billing/records/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const record = await billingService.getBillingRecord(params.id);
    if (!record) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Billing record not found' });
    }
    return reply.send({ success: true, data: record });
  });

  // Mark as paid
  app.post('/billing/records/:id/pay', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const record = await billingService.markAsPaid(params.id, body?.amount);
    if (!record) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Billing record not found' });
    }
    return reply.send({ success: true, data: record });
  });

  // Update billing status
  app.put('/billing/records/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const record = await billingService.updateBillingStatus(params.id, body.status);
    if (!record) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Billing record not found' });
    }
    return reply.send({ success: true, data: record });
  });

  // ==================== Billing Summary ====================

  app.get('/billing/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const summary = await billingService.getBillingSummary(tenantId);
    return reply.send({ success: true, data: summary });
  });
}
