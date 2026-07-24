/**
 * AutomationRuleController - Handles automation rule API requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from '../BaseController';
import { AutomationRuleService, AutomationRuleServiceError } from '../../../services/ticketing/AutomationRuleService';
import {
  AutomationRule,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationRuleExecution,
} from '../../../services/ticketing/types';

export class AutomationRuleController extends BaseController {
  private automationRuleService: AutomationRuleService;

  constructor(automationRuleService: AutomationRuleService) {
    super();
    this.automationRuleService = automationRuleService;
  }

  // ==================== Rule CRUD ====================

  async createRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, description, enabled, priority, conditions, actions } = body;

      if (!name || !conditions || !actions) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, conditions, actions',
        });
        return;
      }

      const input: CreateAutomationRuleInput = {
        name,
        description,
        enabled: enabled ?? true,
        priority: priority ?? 0,
        conditions,
        actions,
      };

      const rule = await this.automationRuleService.createRule(input);
      await reply.status(201).send({ success: true, data: { rule } });
    } catch (error: any) {
      if (error instanceof AutomationRuleServiceError) {
        await reply.status(400).send({ error: 'AUTOMATION_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
    }
  }

  async getRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { ruleId } = request.params as { ruleId: string };

      const rule = await this.automationRuleService.getRule(tenantId, ruleId);
      if (!rule) {
        await reply.status(404).send({ error: 'NOT_FOUND', message: `Automation rule not found: ${ruleId}` });
        return;
      }

      await reply.status(200).send({ success: true, data: { rule } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async listRules(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as any || {};
      const { enabled, limit, offset } = query;

      const rules = await this.automationRuleService.listRules(tenantId, {
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      await reply.status(200).send({ success: true, data: { rules } });
    } catch (error: any) {
      await reply.status(500).send({ error: 'FETCH_ERROR', message: error.message });
    }
  }

  async updateRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { ruleId } = request.params as { ruleId: string };
      const body = request.body as any || {};

      const updates: UpdateAutomationRuleInput = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (body.priority !== undefined) updates.priority = Number(body.priority);
      if (body.conditions !== undefined) updates.conditions = body.conditions;
      if (body.actions !== undefined) updates.actions = body.actions;

      const rule = await this.automationRuleService.updateRule(tenantId, ruleId, updates);
      await reply.status(200).send({ success: true, data: { rule } });
    } catch (error: any) {
      if (error instanceof AutomationRuleServiceError) {
        await reply.status(400).send({ error: 'AUTOMATION_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'UPDATE_ERROR', message: error.message });
    }
  }

  async deleteRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { ruleId } = request.params as { ruleId: string };

      await this.automationRuleService.deleteRule(tenantId, ruleId);
      await reply.status(200).send({ success: true, message: 'Automation rule deleted' });
    } catch (error: any) {
      if (error instanceof AutomationRuleServiceError) {
        await reply.status(400).send({ error: 'AUTOMATION_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
    }
  }

  // ==================== Rule Execution ====================

  async executeRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { ruleId } = request.params as { ruleId: string };
      const body = request.body as any || {};
      const { ticketId, ticket, triggeredBy } = body;

      if (!ticketId || !ticket) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: ticketId, ticket',
        });
        return;
      }

      const context = {
        ticketId,
        triggeredBy: triggeredBy || 'manual',
        ticket,
      };

      const execution = await this.automationRuleService.executeRule(tenantId, ruleId, context);
      await reply.status(200).send({ success: true, data: { execution } });
    } catch (error: any) {
      if (error instanceof AutomationRuleServiceError) {
        await reply.status(400).send({ error: 'AUTOMATION_ERROR', message: error.message });
        return;
      }
      await reply.status(500).send({ error: 'EXECUTE_ERROR', message: error.message });
    }
  }
}
