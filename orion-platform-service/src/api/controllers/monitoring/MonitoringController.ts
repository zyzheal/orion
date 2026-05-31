/**
 * TASK-703: Monitoring & Alerting Controller
 *
 * Handles API requests for metrics, alerts, rules, channels,
 * escalation policies, and dashboard data.
 *
 * Uses database-backed MonitoringService for persistence where available,
 * with in-memory sub-services for real-time metric collection and rule evaluation.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  MonitoringService,
  MonitoringServiceError,
} from '../../../services/monitoring';
import {
  AlertSeverity,
  AlertStatus,
  ChannelType,
  NotificationStatus,
} from '../../../services/monitoring/types';
import { TimeWindow } from '../../../services/monitoring/MonitoringDashboard';
import { WidgetConfig } from '../../../services/monitoring/MonitoringDashboard';

export class MonitoringController {
  private monitoringService: MonitoringService;

  constructor(monitoringService?: MonitoringService) {
    if (monitoringService) {
      this.monitoringService = monitoringService;
    } else {
      this.monitoringService = new MonitoringService();
    }
  }

  // ==================== Error Handling ====================

  private handleServiceError(error: unknown, reply: FastifyReply, defaultCode = 500) {
    if (error instanceof MonitoringServiceError) {
      const status = error.code === 'NO_DATABASE' ? 503
        : error.code === 'CONFIG_NOT_FOUND' || error.code === 'ALERT_NOT_FOUND' || error.code === 'RULE_NOT_FOUND' || error.code === 'CHANNEL_NOT_FOUND' ? 404
        : 400;
      return reply.status(status).send({
        error: error.name,
        message: error.message,
        code: error.code,
      });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return reply.status(defaultCode).send({ error: 'INTERNAL_ERROR', message });
  }

  // ==================== Service Control ====================

  /**
   * Start monitoring service
   * POST /api/v1/monitoring/start
   */
  async startService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.monitoringService.start();
      await reply.status(200).send({
        success: true,
        message: 'Monitoring service started',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'START_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Stop monitoring service
   * POST /api/v1/monitoring/stop
   */
  async stopService(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.monitoringService.stop();
      await reply.status(200).send({
        success: true,
        message: 'Monitoring service stopped',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'STOP_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Health check
   * GET /api/v1/monitoring/health
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    const health = this.monitoringService.getHealthStatus();
    await reply.status(200).send({
      success: true,
      data: { health },
    });
  }

  // ==================== Metrics ====================

  /**
   * Record a metric
   * POST /api/v1/monitoring/metrics
   */
  async recordMetric(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, value, tags, unit } = body;

      if (!name || value === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, value',
        });
        return;
      }

      this.monitoringService.metricCollector.recordMetric(name, value, tags);

      await reply.status(201).send({
        success: true,
        message: 'Metric recorded',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'RECORD_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Register a custom metric
   * POST /api/v1/monitoring/metrics/register
   */
  async registerMetric(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { name, unit, defaultTags, description } = body;

      if (!name || !unit) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, unit',
        });
        return;
      }

      this.monitoringService.metricCollector.registerMetric({
        name,
        unit,
        defaultTags,
        description,
      });

      await reply.status(201).send({
        success: true,
        message: 'Metric registered',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'REGISTER_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Get metric series
   * GET /api/v1/monitoring/metrics/:name/series
   */
  async getMetricSeries(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const series = await this.monitoringService.metricCollector.getMetricSeriesAsync({
      name: params.name,
      tags: query.tags ? JSON.parse(query.tags) : undefined,
      startTime: query.startTime ? new Date(query.startTime) : undefined,
      endTime: query.endTime ? new Date(query.endTime) : undefined,
      maxPoints: query.maxPoints ? parseInt(query.maxPoints) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { series },
    });
  }

  /**
   * Get metric summary
   * GET /api/v1/monitoring/metrics/:name/summary
   */
  async getMetricSummary(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const summary = await this.monitoringService.metricCollector.getMetricSummaryAsync(
      params.name,
      query.tags ? JSON.parse(query.tags) : undefined,
      query.windowMs ? parseInt(query.windowMs) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  /**
   * Get registered metrics
   * GET /api/v1/monitoring/metrics
   */
  async getRegisteredMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = this.monitoringService.metricCollector.getRegisteredMetrics();
    await reply.status(200).send({
      success: true,
      data: { metrics },
    });
  }

  // ==================== Alert Rules ====================

  /**
   * Create an alert rule
   * POST /api/v1/monitoring/rules
   */
  async createRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        name,
        metric,
        condition,
        threshold,
        severity,
        enabled,
        cooldownMs,
        tags,
        rateOfChangePercent,
        description,
        evaluationWindowMs,
      } = body;

      if (!name || !metric || !condition || threshold === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, metric, condition, threshold',
        });
        return;
      }

      const validConditions = ['>', '<', '>=', '<=', '==', '!=', 'rate_of_change'];
      if (!validConditions.includes(condition)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid condition. Must be one of: ${validConditions.join(', ')}`,
        });
        return;
      }

      const validSeverities: AlertSeverity[] = ['critical', 'warning', 'info'];
      if (severity && !validSeverities.includes(severity)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        });
        return;
      }

      // Try database-backed method, fall back to in-memory
      try {
        const rule = await this.monitoringService.createRule({
          tenant_id: (body as any).tenant_id || 'default',
          name,
          metric,
          condition,
          threshold,
          severity: severity || 'warning',
          enabled: enabled !== false,
          cooldown_ms: cooldownMs ?? 300000,
          tags,
          rate_of_change_percent: rateOfChangePercent,
          description,
          evaluation_window_ms: evaluationWindowMs,
        });

        await reply.status(201).send({
          success: true,
          data: { rule },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          // Fall back to in-memory
          const rule = {
            id: `rule-${Date.now()}`,
            name,
            metric,
            condition,
            threshold,
            severity: severity || 'warning',
            enabled: enabled !== false,
            cooldownMs: cooldownMs ?? 300000,
            tags,
            rateOfChangePercent,
            description,
            evaluationWindowMs,
          };
          this.monitoringService.addRule(rule);
          await reply.status(201).send({
            success: true,
            data: { rule },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get all rules
   * GET /api/v1/monitoring/rules
   */
  async getRules(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Try database-backed method first
      try {
        const rules = await this.monitoringService.listRules();
        await reply.status(200).send({
          success: true,
          data: { rules },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          // Fall back to in-memory
          const rules = this.monitoringService.alertRuleEngine.getAllRules();
          await reply.status(200).send({
            success: true,
            data: { rules },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get a rule
   * GET /api/v1/monitoring/rules/:id
   */
  async getRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      try {
        const rule = await this.monitoringService.getRule(params.id);
        await reply.status(200).send({
          success: true,
          data: { rule },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const rule = this.monitoringService.alertRuleEngine.getRule(params.id);
          if (!rule) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Rule ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { rule },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Update a rule
   * PUT /api/v1/monitoring/rules/:id
   */
  async updateRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      try {
        const rule = await this.monitoringService.updateRule(params.id, body);
        await reply.status(200).send({
          success: true,
          data: { rule },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const rule = this.monitoringService.alertRuleEngine.updateRule(params.id, body);
          if (!rule) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Rule ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { rule },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Delete a rule
   * DELETE /api/v1/monitoring/rules/:id
   */
  async deleteRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      try {
        await this.monitoringService.deleteRule(params.id);
        await reply.status(200).send({
          success: true,
          message: 'Rule deleted',
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const deleted = this.monitoringService.alertRuleEngine.removeRule(params.id);
          if (!deleted) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Rule ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            message: 'Rule deleted',
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Toggle a rule
   * PATCH /api/v1/monitoring/rules/:id/toggle
   */
  async toggleRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const enabled = body.enabled !== false;
      try {
        const rule = await this.monitoringService.toggleRule(params.id, enabled);
        await reply.status(200).send({
          success: true,
          data: { rule },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const toggled = this.monitoringService.alertRuleEngine.toggleRule(params.id, enabled);
          if (!toggled) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Rule ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { enabled },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Suppress a rule
   * POST /api/v1/monitoring/rules/:id/suppress
   */
  async suppressRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      await this.monitoringService.suppressRule(params.id);
      await reply.status(200).send({
        success: true,
        message: `Rule ${params.id} suppressed`,
      });
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Unsuppress a rule
   * POST /api/v1/monitoring/rules/:id/unsuppress
   */
  async unsuppressRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      await this.monitoringService.unsuppressRule(params.id);
      await reply.status(200).send({
        success: true,
        message: `Rule ${params.id} unsuppressed`,
      });
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Evaluate rules manually
   * POST /api/v1/monitoring/rules/evaluate
   */
  async evaluateRules(request: FastifyRequest, reply: FastifyReply) {
    try {
      const newAlerts = await this.monitoringService.evaluateRules();
      await reply.status(200).send({
        success: true,
        data: {
          newAlerts,
          count: newAlerts.length,
        },
      });
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  // ==================== Alerts ====================

  /**
   * Get all alerts
   * GET /api/v1/monitoring/alerts
   */
  async getAlerts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      try {
        const result = await this.monitoringService.listAlerts({
          status: query.status,
          severity: query.severity,
        });
        await reply.status(200).send({
          success: true,
          data: { alerts: result.data, total: result.total, page: result.page, limit: result.limit },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const alerts = this.monitoringService.getAlerts({
            status: query.status as AlertStatus,
            severity: query.severity as AlertSeverity,
            ruleId: query.ruleId,
          });
          await reply.status(200).send({
            success: true,
            data: { alerts },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get active alerts
   * GET /api/v1/monitoring/alerts/active
   */
  async getActiveAlerts(request: FastifyRequest, reply: FastifyReply) {
    const alerts = this.monitoringService.getActiveAlerts();
    await reply.status(200).send({
      success: true,
      data: { alerts, count: alerts.length },
    });
  }

  /**
   * Get an alert
   * GET /api/v1/monitoring/alerts/:id
   */
  async getAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      try {
        const alert = await this.monitoringService.getAlert(params.id);
        await reply.status(200).send({
          success: true,
          data: { alert },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const alert = this.monitoringService.alertRuleEngine.getAlert(params.id);
          if (!alert) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Alert ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { alert },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Acknowledge an alert
   * POST /api/v1/monitoring/alerts/:id/acknowledge
   */
  async acknowledgeAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { acknowledgedBy } = body;
      try {
        const alert = await this.monitoringService.acknowledgeAlert(params.id, acknowledgedBy || 'api');
        await reply.status(200).send({
          success: true,
          data: { alert },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const alert = this.monitoringService.alertRuleEngine.acknowledgeAlert(params.id, acknowledgedBy || 'api');
          if (!alert) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Alert ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { alert },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Resolve an alert
   * POST /api/v1/monitoring/alerts/:id/resolve
   */
  async resolveAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      try {
        const alert = await this.monitoringService.resolveAlert(params.id);
        await reply.status(200).send({
          success: true,
          data: { alert },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const alert = this.monitoringService.alertRuleEngine.resolveAlert(params.id);
          if (!alert) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Alert ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { alert },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Start escalation for an alert
   * POST /api/v1/monitoring/alerts/:id/escalate
   */
  async escalateAlert(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { policyId } = body;

    if (!policyId) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: policyId',
      });
      return;
    }

    const policy = this.monitoringService.notificationService.getEscalationPolicy(policyId);
    if (!policy) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Escalation policy ${policyId} not found`,
      });
      return;
    }

    this.monitoringService.notificationService.startEscalation(params.id, policyId);

    await reply.status(200).send({
      success: true,
      message: 'Escalation started',
    });
  }

  // ==================== Notification Channels ====================

  /**
   * Create a notification channel
   * POST /api/v1/monitoring/channels
   */
  async createChannel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, type, config, enabled, severityFilter } = body;

      if (!name || !type || !config) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, type, config',
        });
        return;
      }

      const validTypes: ChannelType[] = ['email', 'webhook', 'slack'];
      if (!validTypes.includes(type)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      try {
        const channel = await this.monitoringService.createChannel({
          tenant_id: body.tenant_id || 'default',
          name,
          type,
          config,
          enabled: enabled !== false,
          severity_filter: severityFilter,
        });

        await reply.status(201).send({
          success: true,
          data: { channel },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          // Fall back to in-memory
          const channel = {
            id: id || `channel-${Date.now()}`,
            name,
            type,
            config,
            enabled: enabled !== false,
            severityFilter,
          };
          this.monitoringService.notificationService.addChannel(channel);
          await reply.status(201).send({
            success: true,
            data: { channel },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get all channels
   * GET /api/v1/monitoring/channels
   */
  async getChannels(request: FastifyRequest, reply: FastifyReply) {
    try {
      try {
        const channels = await this.monitoringService.listChannels();
        await reply.status(200).send({
          success: true,
          data: { channels },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const channels = this.monitoringService.notificationService.getAllChannels();
          await reply.status(200).send({
            success: true,
            data: { channels },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Toggle a channel
   * PATCH /api/v1/monitoring/channels/:id/toggle
   */
  async toggleChannel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const enabled = body.enabled !== false;

      try {
        const channel = await this.monitoringService.toggleChannel(params.id, enabled);
        await reply.status(200).send({
          success: true,
          data: { channel },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const toggled = this.monitoringService.notificationService.toggleChannel(params.id, enabled);
          if (!toggled) {
            await reply.status(404).send({
              error: 'NOT_FOUND',
              message: `Channel ${params.id} not found`,
            });
            return;
          }
          await reply.status(200).send({
            success: true,
            data: { enabled },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  // ==================== Escalation Policies ====================

  /**
   * Create an escalation policy
   * POST /api/v1/monitoring/escalation
   */
  async createEscalationPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { id, name, steps, repeatCount, enabled, description } = body;

      if (!name || !steps || !Array.isArray(steps)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, steps (array)',
        });
        return;
      }

      try {
        const policy = await this.monitoringService.createPolicy({
          tenant_id: body.tenant_id || 'default',
          name,
          steps,
          repeat_count: repeatCount ?? 0,
          enabled: enabled !== false,
          description,
        });

        await reply.status(201).send({
          success: true,
          data: { policy },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const policy = {
            id: id || `policy-${Date.now()}`,
            name,
            steps,
            repeatCount: repeatCount ?? 0,
            enabled: enabled !== false,
            description,
          };
          this.monitoringService.notificationService.addEscalationPolicy(policy);
          await reply.status(201).send({
            success: true,
            data: { policy },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get all escalation policies
   * GET /api/v1/monitoring/escalation
   */
  async getEscalationPolicies(request: FastifyRequest, reply: FastifyReply) {
    try {
      try {
        const policies = await this.monitoringService.listPolicies();
        await reply.status(200).send({
          success: true,
          data: { policies },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const policies = this.monitoringService.notificationService.getAllEscalationPolicies();
          await reply.status(200).send({
            success: true,
            data: { policies },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  // ==================== Notification History ====================

  /**
   * Get notification history
   * GET /api/v1/monitoring/notifications
   */
  async getNotificationHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      try {
        const history = await this.monitoringService.getNotificationHistory({
          alertId: query.alertId,
          channelId: query.channelId,
          status: query.status as NotificationStatus,
          limit: query.limit ? parseInt(query.limit) : undefined,
        });
        await reply.status(200).send({
          success: true,
          data: { history },
        });
      } catch (err) {
        if (err instanceof MonitoringServiceError && err.code === 'NO_DATABASE') {
          const history = this.monitoringService.notificationService.getNotificationHistory({
            alertId: query.alertId,
            channelId: query.channelId,
            status: query.status as NotificationStatus,
            limit: query.limit ? parseInt(query.limit) : undefined,
          });
          await reply.status(200).send({
            success: true,
            data: { history },
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  // ==================== Dashboard ====================

  /**
   * Get dashboard data
   * GET /api/v1/monitoring/dashboard
   */
  async getDashboard(request: FastifyRequest, reply: FastifyReply) {
    const dashboard = await this.monitoringService.getDashboardData();
    await reply.status(200).send({
      success: true,
      data: { dashboard },
    });
  }

  /**
   * Add a widget configuration
   * POST /api/v1/monitoring/dashboard/widgets
   */
  async addWidgetConfig(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { title, metrics, timeWindow, tags } = body;

      if (!title || !metrics || !Array.isArray(metrics)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: title, metrics (array)',
        });
        return;
      }

      const validWindows: TimeWindow[] = ['1m', '5m', '15m', '1h', '6h', '24h', '7d'];
      if (timeWindow && !validWindows.includes(timeWindow)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid timeWindow. Must be one of: ${validWindows.join(', ')}`,
        });
        return;
      }

      const config: WidgetConfig = {
        title,
        metrics,
        timeWindow: timeWindow || '1h',
        tags,
      };

      this.monitoringService.dashboard.addWidgetConfig(config);

      await reply.status(201).send({
        success: true,
        data: { widget: config },
      });
    } catch (error: any) {
      this.handleServiceError(error, reply);
    }
  }

  /**
   * Get widget configurations
   * GET /api/v1/monitoring/dashboard/widgets
   */
  async getWidgetConfigs(request: FastifyRequest, reply: FastifyReply) {
    const widgets = this.monitoringService.dashboard.getWidgetConfigs();
    await reply.status(200).send({
      success: true,
      data: { widgets },
    });
  }

  /**
   * Get aggregated metrics
   * GET /api/v1/monitoring/dashboard/aggregated
   */
  async getAggregatedMetrics(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const { metrics, timeWindow } = query;

    if (!metrics) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required query param: metrics (comma-separated)',
      });
      return;
    }

    const metricList = metrics.split(',');
    const aggregated = this.monitoringService.dashboard.getAggregatedMetrics(
      metricList,
      (timeWindow as TimeWindow) || '1h'
    );

    await reply.status(200).send({
      success: true,
      data: { aggregated },
    });
  }

  // ==================== Anomalies ====================

  /**
   * Detect anomalies for a metric
   * GET /api/v1/monitoring/anomalies
   */
  async detectAnomalies(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const { metric, timeWindow, threshold } = query;

    if (!metric) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required query param: metric',
      });
      return;
    }

    const anomalies = this.monitoringService.dashboard.detectAnomalies(
      metric,
      (timeWindow as TimeWindow) || '1h',
      undefined,
      threshold ? parseFloat(threshold) : undefined
    );

    await reply.status(200).send({
      success: true,
      data: { anomalies, count: anomalies.length },
    });
  }

  /**
   * Get anomaly summary
   * GET /api/v1/monitoring/anomalies/summary
   */
  async getAnomalySummary(request: FastifyRequest, reply: FastifyReply) {
    const summary = this.monitoringService.dashboard.getAnomalySummary();
    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  /**
   * Collect system metrics manually
   * POST /api/v1/monitoring/collect
   */
  async collectSystemMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = this.monitoringService.metricCollector.collectSystemMetrics();
    await reply.status(200).send({
      success: true,
      data: { metrics, count: metrics.length },
    });
  }
}
