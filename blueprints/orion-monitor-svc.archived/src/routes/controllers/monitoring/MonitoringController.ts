/**
 * MonitoringController stub.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { MonitoringService } from '../../../services/monitoring';

export class MonitoringController {
  constructor(private service: MonitoringService) {}

  async startService(_request: FastifyRequest, reply: FastifyReply) {
    await this.service.start();
    return reply.send({ status: 'started' });
  }

  async stopService(_request: FastifyRequest, reply: FastifyReply) {
    await this.service.stop();
    return reply.send({ status: 'stopped' });
  }

  async healthCheck(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ status: 'ok' });
  }

  async collectSystemMetrics(_request: FastifyRequest, reply: FastifyReply) {
    await this.service.collectMetrics();
    return reply.send({ status: 'collected' });
  }

  async getRegisteredMetrics(_request: FastifyRequest, reply: FastifyReply) {
    const metrics = await this.service.getMetrics();
    return reply.send({ metrics });
  }

  async recordMetric(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { name: string; value: number; labels?: Record<string, string> };
    await this.service.recordMetric(body.name, body.value, body.labels);
    return reply.send({ status: 'recorded' });
  }

  async registerMetric(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { name: string; labels: string[] };
    await this.service.registerMetric(body.name, body.labels);
    return reply.send({ status: 'registered' });
  }

  async getMetricSeries(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const series = await this.service.getMetricSeries(name);
    return reply.send({ series });
  }

  async getMetricSummary(request: FastifyRequest, reply: FastifyReply) {
    const { name } = request.params as { name: string };
    const summary = await this.service.getMetricSummary(name);
    return reply.send({ summary });
  }

  async createRule(request: FastifyRequest, reply: FastifyReply) {
    const rule = await this.service.createRule(request.body);
    return reply.code(201).send(rule);
  }

  async getRules(_request: FastifyRequest, reply: FastifyReply) {
    const rules = await this.service.getRules();
    return reply.send({ rules });
  }

  async getRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const rule = await this.service.getRule(id);
    return reply.send({ rule });
  }

  async updateRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const rule = await this.service.updateRule(id, request.body);
    return reply.send({ rule });
  }

  async deleteRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const deleted = await this.service.deleteRule(id);
    return reply.send({ deleted });
  }

  async toggleRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.toggleRule(id);
    return reply.send({ result });
  }

  async suppressRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.suppressRule(id);
    return reply.send({ result });
  }

  async unsuppressRule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.unsuppressRule(id);
    return reply.send({ result });
  }

  async evaluateRules(_request: FastifyRequest, reply: FastifyReply) {
    const results = await this.service.evaluateRules();
    return reply.send({ results });
  }

  async getAlerts(_request: FastifyRequest, reply: FastifyReply) {
    const alerts = await this.service.getAlerts();
    return reply.send({ alerts });
  }

  async getActiveAlerts(_request: FastifyRequest, reply: FastifyReply) {
    const alerts = await this.service.getActiveAlerts();
    return reply.send({ alerts });
  }

  async getAlert(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const alert = await this.service.getAlert(id);
    return reply.send({ alert });
  }

  async acknowledgeAlert(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.acknowledgeAlert(id);
    return reply.send({ result });
  }

  async resolveAlert(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.resolveAlert(id);
    return reply.send({ result });
  }

  async escalateAlert(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.escalateAlert(id);
    return reply.send({ result });
  }

  async createChannel(request: FastifyRequest, reply: FastifyReply) {
    const channel = await this.service.createChannel(request.body);
    return reply.code(201).send(channel);
  }

  async getChannels(_request: FastifyRequest, reply: FastifyReply) {
    const channels = await this.service.getChannels();
    return reply.send({ channels });
  }

  async toggleChannel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.service.toggleChannel(id);
    return reply.send({ result });
  }

  async createEscalationPolicy(request: FastifyRequest, reply: FastifyReply) {
    const policy = await this.service.createEscalationPolicy(request.body);
    return reply.code(201).send(policy);
  }

  async getEscalationPolicies(_request: FastifyRequest, reply: FastifyReply) {
    const policies = await this.service.getEscalationPolicies();
    return reply.send({ policies });
  }

  async getNotificationHistory(_request: FastifyRequest, reply: FastifyReply) {
    const history = await this.service.getNotificationHistory();
    return reply.send({ history });
  }

  async getDashboard(_request: FastifyRequest, reply: FastifyReply) {
    const data = await this.service.getDashboard();
    return reply.send({ data });
  }

  async addWidgetConfig(request: FastifyRequest, reply: FastifyReply) {
    const widget = await this.service.addWidgetConfig(request.body);
    return reply.code(201).send(widget);
  }

  async getWidgetConfigs(_request: FastifyRequest, reply: FastifyReply) {
    const widgets = await this.service.getWidgetConfigs();
    return reply.send({ widgets });
  }

  async getAggregatedMetrics(_request: FastifyRequest, reply: FastifyReply) {
    const metrics = await this.service.getAggregatedMetrics();
    return reply.send({ metrics });
  }

  async detectAnomalies(request: FastifyRequest, reply: FastifyReply) {
    const { metric } = request.query as { metric: string };
    const anomalies = await this.service.detectAnomalies(metric);
    return reply.send({ anomalies });
  }

  async getAnomalySummary(_request: FastifyRequest, reply: FastifyReply) {
    const summary = await this.service.getAnomalySummary();
    return reply.send({ summary });
  }
}
