/**
 * Runner API Routes
 *
 * Runner Agent 与 Platform 的通信端点：
 * - POST   /api/v1/runners                         — 注册 Runner
 * - POST   /api/v1/runners/:id/heartbeat           — 心跳
 * - DELETE /api/v1/runners/:id                     — 注销
 * - GET    /api/v1/runners                         — 列表
 * - GET    /api/v1/runners/:id                     — 详情
 * - POST   /api/v1/runners/:id/jobs/:jobId/result  — Job 结果回报
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RunnerController } from './controllers/RunnerController';

export default async function runnerRoutes(app: FastifyInstance, opts: { database?: any }): Promise<void> {
  const controller = new RunnerController(opts.database);

  // POST /api/v1/runners — 注册 Runner
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.register(request, reply);
  });

  // GET /api/v1/runners — 获取 Runner 列表
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listRunners(request, reply);
  });

  // GET /api/v1/runners/:id — 获取 Runner 详情
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRunner(request, reply);
  });

  // POST /api/v1/runners/:id/heartbeat — 心跳
  app.post('/:id/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.heartbeat(request, reply);
  });

  // DELETE /api/v1/runners/:id — 注销 Runner
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deregister(request, reply);
  });

  // POST /api/v1/runners/:id/jobs/:jobId/result — Job 结果回报
  app.post('/:id/jobs/:jobId/result', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reportJobResult(request, reply);
  });
}
