/**
 * ObservabilityController - 可观测性 API 控制器
 *
 * 处理自定义告警规则、根因分析、静默规则的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CustomAlertRuleService, CreateRuleInput, UpdateRuleInput, RuleFilters, AlertRuleTemplate } from '../../services/alert/CustomAlertRuleService';
import { RootCauseAnalysisService, RcaAlert, TimeWindow } from '../../services/alert/RootCauseAnalysisService';
import { AlertSilenceService, CreateSilenceInput } from '../../services/alert/AlertSilenceService';

export class ObservabilityController {
  private alertRuleService: CustomAlertRuleService;
  private rcaService: RootCauseAnalysisService;
  private silenceService: AlertSilenceService;

  constructor(
    alertRuleService: CustomAlertRuleService,
    rcaService: RootCauseAnalysisService,
    silenceService: AlertSilenceService,
  ) {
    this.alertRuleService = alertRuleService;
    this.rcaService = rcaService;
    this.silenceService = silenceService;
  }

  // ==================== Custom Alert Rules ====================

  async createAlertRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as CreateRuleInput & { createdBy?: string };
      const tenantId = this.getTenantId(request);

      if (!body.name || !body.ruleType || !body.condition || !body.severity) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, ruleType, condition, severity',
        });
        return;
      }

      const rule = await this.alertRuleService.createRule(tenantId, body, body.createdBy);

      await reply.status(201).send({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        severity: rule.severity,
        enabled: rule.enabled,
        createdAt: rule.createdAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create alert rule',
      });
    }
  }

  async listAlertRules(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as Record<string, string | undefined>;

      const filters: RuleFilters = {};
      if (query.ruleType) filters.ruleType = query.ruleType as RuleFilters['ruleType'];
      if (query.severity) filters.severity = query.severity as RuleFilters['severity'];
      if (query.enabled !== undefined) filters.enabled = query.enabled === 'true';

      const rules = await this.alertRuleService.getRules(tenantId, filters);

      await reply.send({
        data: rules,
        total: rules.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list alert rules',
      });
    }
  }

  async getAlertRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const rule = await this.alertRuleService.getRuleById(params.id);

      if (!rule) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Alert rule '${params.id}' not found`,
        });
        return;
      }

      await reply.send({ rule });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get alert rule',
      });
    }
  }

  async updateAlertRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as UpdateRuleInput;

      const rule = await this.alertRuleService.updateRule(params.id, body);

      if (!rule) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Alert rule '${params.id}' not found`,
        });
        return;
      }

      await reply.send({ rule });
    } catch (error) {
      if (error instanceof Error) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update alert rule',
      });
    }
  }

  async deleteAlertRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const deleted = await this.alertRuleService.deleteRule(params.id);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Alert rule '${params.id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete alert rule',
      });
    }
  }

  async evaluateAlertRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as { metricValue?: number } | undefined;

      const result = await this.alertRuleService.evaluateRule(params.id, body?.metricValue);

      await reply.send({ evaluation: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to evaluate alert rule',
      });
    }
  }

  // ==================== Alert Rule Templates ====================

  async getAlertRuleTemplates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { category?: string };
      const templates: AlertRuleTemplate[] = this.alertRuleService.getRuleTemplates(query.category);
      await reply.send({ data: templates, total: templates.length });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get alert rule templates',
      });
    }
  }

  async createAlertRuleFromTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { templateId: string; overrides?: Partial<CreateRuleInput>; createdBy?: string };
      const tenantId = this.getTenantId(request);

      if (!body.templateId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: templateId',
        });
        return;
      }

      const rule = await this.alertRuleService.createRuleFromTemplate(
        tenantId,
        body.templateId,
        body.overrides,
        body.createdBy,
      );

      await reply.status(201).send({ success: true, data: rule });
    } catch (error) {
      if (error instanceof Error) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create alert rule from template',
      });
    }
  }

  // ==================== Root Cause Analysis ====================

  async triggerRca(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as {
        affectedServices: string[];
        alerts: Array<{
          id: string;
          name: string;
          service: string;
          severity: 'critical' | 'warning' | 'info';
          firedAt: string;
          message: string;
        }>;
        timeWindow: { startTime: string; endTime: string };
      };
      const tenantId = this.getTenantId(request);

      if (!body.affectedServices || !body.alerts || !body.timeWindow) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: affectedServices, alerts, timeWindow',
        });
        return;
      }

      const result = await this.rcaService.analyze(
        body.affectedServices,
        body.alerts.map((a) => ({
          ...a,
          firedAt: new Date(a.firedAt),
        })),
        {
          startTime: new Date(body.timeWindow.startTime),
          endTime: new Date(body.timeWindow.endTime),
        },
        tenantId,
      );

      await reply.status(201).send({ analysis: result });
    } catch (error) {
      await reply.status(500).send({
        error: 'RCA_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform root cause analysis',
      });
    }
  }

  async getRcaResult(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { analysisId: string };
      const result = this.rcaService.getAnalysis(params.analysisId);

      if (!result) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `RCA analysis '${params.analysisId}' not found`,
        });
        return;
      }

      await reply.send({ analysis: result });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get RCA result',
      });
    }
  }

  async getTopRootCauses(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as { limit?: string; startTime?: string; endTime?: string };

      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      const timeWindow =
        query.startTime && query.endTime
          ? { startTime: new Date(query.startTime), endTime: new Date(query.endTime) }
          : undefined;

      const causes = this.rcaService.getTopRootCauses(tenantId, timeWindow, limit);

      await reply.send({
        data: causes,
        total: causes.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get top root causes',
      });
    }
  }

  // ==================== Alert Silences ====================

  async createSilence(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as CreateSilenceInput & { createdBy?: string };
      const tenantId = this.getTenantId(request);

      if (!body.name || !body.matchers || !body.endsAt) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, matchers, endsAt',
        });
        return;
      }

      const silence = await this.silenceService.createSilence(
        tenantId,
        {
          name: body.name,
          description: body.description,
          silenceType: body.silenceType,
          matchers: body.matchers,
          startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
          endsAt: new Date(body.endsAt),
        },
        body.createdBy,
      );

      await reply.status(201).send({
        id: silence.id,
        name: silence.name,
        silenceType: silence.silenceType,
        startsAt: silence.startsAt,
        endsAt: silence.endsAt,
        enabled: silence.enabled,
      });
    } catch (error) {
      if (error instanceof Error) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to create silence',
      });
    }
  }

  async listSilences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as { active?: string };

      const silences = query.active === 'true'
        ? await this.silenceService.getActiveSilences(tenantId)
        : await this.silenceService.getAllSilences(tenantId);

      await reply.send({
        data: silences,
        total: silences.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list silences',
      });
    }
  }

  async deleteSilence(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const deleted = await this.silenceService.deleteSilence(params.id);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Silence '${params.id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete silence',
      });
    }
  }

  async expireSilences(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const count = await this.silenceService.expireSilences();
      await reply.send({ expired: count });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to expire silences',
      });
    }
  }

  // ==================== RCA Timeline ====================

  async getRcaTimeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { deploymentId: string };
      const query = request.query as { start?: string; end?: string };

      const existing = this.rcaService.getTimeline(params.deploymentId);
      if (existing) {
        await reply.send({ timeline: existing });
        return;
      }

      const start = query.start ? new Date(query.start) : new Date(Date.now() - 3600000);
      const end = query.end ? new Date(query.end) : new Date();

      const timeline = this.rcaService.generateTimelineReport(
        params.deploymentId,
        { start, end },
      );

      await reply.send({ timeline });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get RCA timeline',
      });
    }
  }

  // ==================== Dependency Graph ====================

  async getDependencyGraph(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const graph = this.rcaService.getDependencyGraph();
      await reply.send({ data: graph });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get dependency graph',
      });
    }
  }

  async analyzeDependencyRootCause(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { affectedServices: string[] };
      if (!body.affectedServices || body.affectedServices.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: affectedServices',
        });
        return;
      }

      const roots = this.rcaService.identifyRootCauseViaDependencyGraph(body.affectedServices);
      await reply.send({ data: roots });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze dependency root cause',
      });
    }
  }

  // ==================== Temporal Correlation ====================

  async analyzeTemporalCorrelation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as {
        alerts: Array<{
          id: string; name: string; service: string;
          severity: 'critical' | 'warning' | 'info';
          firedAt: string; message: string;
        }>;
        windowMs?: number;
      };

      if (!body.alerts || body.alerts.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: alerts',
        });
        return;
      }

      const alerts: RcaAlert[] = body.alerts.map((a) => ({
        ...a,
        firedAt: new Date(a.firedAt),
      }));

      const result = this.rcaService.analyzeTemporalCorrelation(alerts, body.windowMs);
      await reply.send({ data: result });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze temporal correlation',
      });
    }
  }

  // ==================== Helpers ====================

  private getTenantId(request: FastifyRequest): string {
    return (request.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000000';
  }
}
