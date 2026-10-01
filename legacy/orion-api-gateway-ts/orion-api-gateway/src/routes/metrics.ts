/**
 * Metrics Route - Prometheus 指标端点
 *
 * 暴露 /metrics 端点供 Prometheus 抓取，
 * 同时定义 HTTP 请求级别的计数器和直方图指标。
 */

import { FastifyInstance } from 'fastify';
import { register, Counter, Histogram, Gauge } from 'prom-client';

/** HTTP 请求耗时直方图 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

/** HTTP 请求总量计数器 */
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

/** 活跃连接数 */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

/**
 * 注册 /metrics 路由
 */
export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
