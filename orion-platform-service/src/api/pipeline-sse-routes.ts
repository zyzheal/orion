/**
 * Pipeline SSE Routes
 *
 * 提供 Pipeline 执行日志的实时 SSE 推送
 * Prefix: /api/v1/pipelines/sse
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import { PipelineLogSSEService } from '../services/pipeline/PipelineLogSSEService';

const localBus = new EventEmitter();
const pipelineLogSSE = new PipelineLogSSEService(localBus);

interface SSEQuery {
  pipelineId: string;
  runId: string;
  logLevel?: string; // 'info,warn,error'
}

/**
 * 注册 Pipeline SSE 路由
 */
export default async function registerPipelineSSERoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/pipelines/sse/logs - SSE 实时日志推送
  app.get('/pipelines/sse/logs', async (request: FastifyRequest<{ Querystring: SSEQuery }>, reply: FastifyReply) => {
    const { pipelineId, runId, logLevel } = request.query;
    const userId = (request.user as any)?.id || 'anonymous';

    if (!pipelineId || !runId) {
      return reply.status(400).send({
        error: 'Missing required parameters: pipelineId, runId',
      });
    }

    // 设置 SSE Headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    // 解析日志级别过滤
    const logLevels = logLevel?.split(',').map(l => l.trim()) as PipelineLogEvent['level'][] | undefined;

    // 创建 SSE 连接
    const connId = pipelineLogSSE.createConnection(pipelineId, runId, userId, reply, {
      includeLogs: true,
      includeStatus: true,
      logLevel: logLevels,
    });

    // 保持连接打开
    reply.raw.on('close', () => {
      pipelineLogSSE.removeConnection(connId);
    });

    // 不调用 reply.send()，保持连接打开
    return reply;
  });

  // GET /api/v1/pipelines/sse/status - SSE 实时状态推送
  app.get('/pipelines/sse/status', async (request: FastifyRequest<{ Querystring: SSEQuery }>, reply: FastifyReply) => {
    const { pipelineId, runId } = request.query;
    const userId = (request.user as any)?.id || 'anonymous';

    if (!pipelineId) {
      return reply.status(400).send({
        error: 'Missing required parameter: pipelineId',
      });
    }

    // 设置 SSE Headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // 创建 SSE 连接 (仅状态更新)
    const connId = pipelineLogSSE.createConnection(pipelineId, runId || 'latest', userId, reply, {
      includeLogs: false,
      includeStatus: true,
    });

    reply.raw.on('close', () => {
      pipelineLogSSE.removeConnection(connId);
    });

    return reply;
  });

  // POST /api/v1/pipelines/sse/publish/log - 发布日志事件 (内部 API)
  app.post('/pipelines/sse/publish/log', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { pipelineId, runId, stageId, stageName, stepName, logLine, level } = request.body;

    if (!pipelineId || !runId || !stageId || !logLine) {
      return reply.status(400).send({
        error: 'Missing required fields: pipelineId, runId, stageId, logLine',
      });
    }

    pipelineLogSSE.publishLogEvent({
      pipelineId,
      runId,
      stageId,
      stageName,
      stepName,
      logLine,
      timestamp: new Date(),
      level: level || 'info',
    });

    return reply.send({ success: true });
  });

  // POST /api/v1/pipelines/sse/publish/status - 发布状态事件 (内部 API)
  app.post('/pipelines/sse/publish/status', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { pipelineId, runId, status, stageId, stageName, progress } = request.body;

    if (!pipelineId || !runId || !status) {
      return reply.status(400).send({
        error: 'Missing required fields: pipelineId, runId, status',
      });
    }

    pipelineLogSSE.publishStatusEvent({
      pipelineId,
      runId,
      status,
      stageId,
      stageName,
      progress,
      timestamp: new Date(),
    });

    return reply.send({ success: true });
  });

  // GET /api/v1/pipelines/sse/stats - SSE 连接统计
  app.get('/pipelines/sse/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = pipelineLogSSE.getStats();
    return reply.send({
      totalConnections: stats.totalConnections,
      connectionsByUser: Object.fromEntries(stats.connectionsByUser),
    });
  });

  // 注册优雅关闭钩子
  app.addHook('onClose', async () => {
    await pipelineLogSSE.shutdown();
  });
}