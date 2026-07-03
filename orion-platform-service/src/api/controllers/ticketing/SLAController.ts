/**
 * SLAController - Handles SLA policy and tracking API requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SlaService, SlaServiceError } from '../../../services/ticketing/SlaService';
import {
  SLATarget,
  CreateSLAPolicyInput,
  UpdateSLAPolicyInput,
  TicketSLAStatus,
  SLAViolation,
  SLAComplianceReport,
  TicketPriority,
} from '../../../services/ticketing/types';

const VALID_PRIORITIES: TicketPriority[] = ['critical', 'high', 'medium', 'low'];

function getTenantId(request: FastifyRequest): string {
  return (request as any).user?.tenantId || (request.headers['x-tenant-id'] as string) || 'default';
}

export class SLAController {
  private slaService: SlaService;

  constructor(slaService: SlaService) {
    this.slaService = slaService;
  }

  // ==================== SLA Policy CRUD ====================

  async createPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, priority, targetResponseTimeMs, targetResolutionTimeMs, enabled } = body;

      if (!name || !priority || !targetResponseTimeMs || !targetResolutionTimeMs) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, priority, targetResponseTimeMs, targetResolutionTimeMs',
        });
        return;
      }

      if (!VALID_PRIORITIES.includes(priority)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        });
        return;
      }

      const input: CreateSLAPolicyInput = {
        name,
        priority,
        targetResponseTimeMs: Number(targetResponseTimeMs),
        targetResolutionTimeMs: Number(targetResolutionTimeMs),
        enabled: enabled ?? true,
      };

      const policy = await this.slaService.createSlaPolicy(input);
      await reply.status(201).send({ success: true, data: { policy } });
    } catch (error: any) {
      if (error instanceof SlaServiceError) {
        await reply.status(400).send({ error: 'SLA_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  }

  async getPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const { policyId } = request.params as { policyId: string };

      const policy = await this.slaService.getSlaPolicy(tenantId, policyId);
      if (!policy) {
        await reply.status(404).send({ error: 'NOT_FOUND', message: `SLA policy not found: ${policyId}` });
        return;
      }

      await reply.status(200).send({ success: true, data: { policy } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async listPolicies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as any || {};
      const { enabled, priority } = query;

      const policies = await this.slaService.listSlaPolicies(tenantId, {
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        priority: priority as TicketPriority,
      });

      await reply.status(200).send({ success: true, data: { policies } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async updatePolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const { policyId } = request.params as { policyId: string };
      const body = request.body as any || {};

      const updates: UpdateSLAPolicyInput = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.targetResponseTimeMs !== undefined) updates.targetResponseTimeMs = Number(body.targetResponseTimeMs);
      if (body.targetResolutionTimeMs !== undefined) updates.targetResolutionTimeMs = Number(body.targetResolutionTimeMs);
      if (body.enabled !== undefined) updates.enabled = body.enabled;

      const policy = await this.slaService.updateSlaPolicy(tenantId, policyId, updates);
      await reply.status(200).send({ success: true, data: { policy } });
    } catch (error: any) {
      if (error instanceof SlaServiceError) {
        await reply.status(400).send({ error: 'SLA_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'UPDATE_ERROR', message: error.message });
    }
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const { policyId } = request.params as { policyId: string };

      await this.slaService.deleteSlaPolicy(tenantId, policyId);
      await reply.status(200).send({ success: true, message: 'SLA policy deleted' });
    } catch (error: any) {
      if (error instanceof SlaServiceError) {
        await reply.status(400).send({ error: 'SLA_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
    }
  }

  // ==================== SLA Tracking ====================

  async getTicketSLAStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const { ticketId } = request.params as { ticketId: string };

      const status = await this.slaService.getSlaStatus(tenantId, ticketId);
      if (!status) {
        await reply.status(404).send({ error: 'NOT_FOUND', message: `SLA status not found for ticket: ${ticketId}` });
        return;
      }

      await reply.status(200).send({ success: true, data: { status } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async getBreaches(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const query = request.query as any || {};
      const start = query.start ? new Date(query.start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = query.end ? new Date(query.end as string) : new Date();

      const breaches = await this.slaService.getBreachedSLAs(tenantId, { start, end });
      await reply.status(200).send({ success: true, data: { breaches } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async getCompliance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = getTenantId(request);
      const { policyId } = request.params as { policyId: string };
      const query = request.query as any || {};
      const start = query.start ? new Date(query.start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = query.end ? new Date(query.end as string) : new Date();

      const compliance = await this.slaService.getSlaCompliance(tenantId, policyId, { start, end });
      await reply.status(200).send({ success: true, data: { compliance } });
    } catch (error: any) {
      if (error instanceof SlaServiceError) {
        await reply.status(400).send({ error: 'SLA_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }
}
