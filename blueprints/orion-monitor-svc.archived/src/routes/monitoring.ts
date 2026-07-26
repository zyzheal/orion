import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import { PrometheusService } from '../services/PrometheusService.js';

interface MonitoringQuery {
  query?: string;
  time?: number;
  start?: number;
  end?: number;
  step?: string;
}

export async function monitoringRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const prometheusService = new PrometheusService();

  // GET /monitoring - Query Prometheus metrics (instant query)
  fastify.get<{ Querystring: MonitoringQuery }>(
    '/monitoring',
    async (request: FastifyRequest<{ Querystring: MonitoringQuery }>, reply: FastifyReply) => {
      const { query, time } = request.query;

      if (!query) {
        return reply.code(400).send({ error: 'Missing required query parameter' });
      }

      const result = await prometheusService.query(query, time ? parseInt(time.toString(), 10) : undefined);

      if (result.status === 'error') {
        return reply.code(502).send({ error: result.error, data: result.data });
      }

      return reply.send(result);
    }
  );

  // GET /monitoring/:id - Query Prometheus metrics by ID (instant query with predefined query)
  fastify.get<{ Params: { id: string }; Querystring: MonitoringQuery }>(
    '/monitoring/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: MonitoringQuery }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { time } = request.query;

      // Map predefined metric IDs to PromQL queries
      const metricQueries: Record<string, string> = {
        'cpu': 'rate(process_cpu_seconds_total[5m])',
        'memory': 'process_resident_memory_bytes',
        'requests': 'rate(http_requests_total[5m])',
        'errors': 'rate(http_requests_total{status=~"5.."}[5m])',
        'latency': 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
        'up': 'up',
        'prometheus_tsdb_head_samples': 'prometheus_tsdb_head_samples',
        'prometheus_target_scrapes_exceeded_sample_limit': 'prometheus_target_scrapes_exceeded_sample_limit',
      };

      const promql = metricQueries[id];
      if (!promql) {
        return reply.code(404).send({ error: `Unknown metric ID: ${id}` });
      }

      const result = await prometheusService.query(promql, time ? parseInt(time.toString(), 10) : undefined);

      if (result.status === 'error') {
        return reply.code(502).send({ error: result.error, data: result.data });
      }

      return reply.send(result);
    }
  );

  // POST /monitoring - Range query
  fastify.post<{ Body: MonitoringQuery }>(
    '/monitoring',
    async (request: FastifyRequest<{ Body: MonitoringQuery }>, reply: FastifyReply) => {
      const { query, start, end, step } = request.body;

      if (!query || !start || !end || !step) {
        return reply.code(400).send({ error: 'Missing required parameters: query, start, end, step' });
      }

      const result = await prometheusService.queryRange(
        query,
        typeof start === 'string' ? parseInt(start, 10) : start,
        typeof end === 'string' ? parseInt(end, 10) : end,
        step
      );

      if (result.status === 'error') {
        return reply.code(502).send({ error: result.error, data: result.data });
      }

      return reply.send(result);
    }
  );
}

export async function alertRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const prometheusService = new PrometheusService();

  // GET /alert - Get Prometheus alerts
  fastify.get('/alert', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await prometheusService.getAlerts();

    if (result.status === 'error') {
      return reply.code(502).send({ error: result.error, data: result.data });
    }

    return reply.send(result);
  });

  // POST /alert - Placeholder for custom alert creation
  fastify.post('/alert', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Custom alert creation would go here
    // For now, return a message about using Prometheus alerts
    return reply.code(501).send({ error: 'Custom alert creation not yet implemented. Use Prometheus alerting rules.' });
  });
}

export async function metricsRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const prometheusService = new PrometheusService();

  // GET /metrics - Query Prometheus metrics
  fastify.get<{ Querystring: MonitoringQuery }>(
    '/metrics',
    async (request: FastifyRequest<{ Querystring: MonitoringQuery }>, reply: FastifyReply) => {
      const { query, time } = request.query;

      if (!query) {
        return reply.code(400).send({ error: 'Missing required query parameter' });
      }

      const result = await prometheusService.query(query, time ? parseInt(time.toString(), 10) : undefined);

      if (result.status === 'error') {
        return reply.code(502).send({ error: result.error, data: result.data });
      }

      return reply.send(result);
    }
  );

  // GET /metrics/range - Query Prometheus metrics with time range
  fastify.get<{ Querystring: MonitoringQuery }>(
    '/metrics/range',
    async (request: FastifyRequest<{ Querystring: MonitoringQuery }>, reply: FastifyReply) => {
      const { query, start, end, step } = request.query;

      if (!query || !start || !end || !step) {
        return reply.code(400).send({ error: 'Missing required parameters: query, start, end, step' });
      }

      const result = await prometheusService.queryRange(
        query,
        parseInt(start.toString(), 10),
        parseInt(end.toString(), 10),
        step
      );

      if (result.status === 'error') {
        return reply.code(502).send({ error: result.error, data: result.data });
      }

      return reply.send(result);
    }
  );
}

export async function targetsRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const prometheusService = new PrometheusService();

  // GET /targets - Get Prometheus scrape targets
  fastify.get('/targets', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await prometheusService.getTargets();

    if (result.status === 'error') {
      return reply.code(502).send({ error: result.error, data: result.data });
    }

    return reply.send(result);
  });
}