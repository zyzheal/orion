/**
 * Cron Scheduler API Routes
 * 分布式定时任务调度 API 路由
 *
 * Prefix: /api/v1/cron (handled by register)
 * P0-1 Fix: Changed from hardcoded /cron/ paths to relative paths
 * P0-2 Fix: Accept database pool via options for future persistence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { CronSchedulerService } from '../services/scheduler/CronSchedulerService';

interface CronRoutesOptions {
  database?: DatabasePool;
}

export default async function cronRoutes(app: FastifyInstance, options: CronRoutesOptions = {}): Promise<void> {
  const cronSchedulerService = new CronSchedulerService();

  // 初始化调度器
  cronSchedulerService.start();

  // ==================== Cron Job 管理路由 ====================

  // POST /cron/jobs - 添加定时任务
  app.post('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const job = request.body as any;

    // 验证必填字段
    if (!job.id || !job.name || !job.schedule || !job.task) {
      reply.code(400).send({ error: 'Missing required fields: id, name, schedule, task' });
      return;
    }

    cronSchedulerService.addJob(job);

    reply.code(201).send({
      success: true,
      message: 'Cron job added successfully',
      data: { jobId: job.id }
    });
  });

  // GET /cron/jobs - 获取定时任务列表
  app.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const jobs = await cronSchedulerService.getJobs();

    reply.send({
      success: true,
      data: jobs
    });
  });

  // GET /cron/jobs/:id - 获取定时任务详情
  app.get('/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const job = cronSchedulerService.getJob(id);

    if (!job) {
      reply.code(404).send({ error: 'Cron job not found' });
      return;
    }

    reply.send({
      success: true,
      data: job
    });
  });

  // PUT /cron/jobs/:id - 更新定时任务
  app.put('/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const job = cronSchedulerService.getJob(id);
    if (!job) {
      reply.code(404).send({ error: 'Cron job not found' });
      return;
    }

    // 更新字段
    Object.assign(job, updates);

    reply.send({
      success: true,
      message: 'Cron job updated successfully',
      data: job
    });
  });

  // DELETE /cron/jobs/:id - 删除定时任务
  app.delete('/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    cronSchedulerService.removeJob(id);

    reply.send({
      success: true,
      message: 'Cron job removed successfully'
    });
  });

  // POST /cron/jobs/:id/enable - 启用定时任务
  app.post('/jobs/:id/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    cronSchedulerService.enableJob(id);

    reply.send({
      success: true,
      message: 'Cron job enabled successfully'
    });
  });

  // POST /cron/jobs/:id/disable - 禁用定时任务
  app.post('/jobs/:id/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    cronSchedulerService.disableJob(id);

    reply.send({
      success: true,
      message: 'Cron job disabled successfully'
    });
  });

  // POST /cron/jobs/:id/execute - 手动执行定时任务
  app.post('/jobs/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const execution = await cronSchedulerService.executeJob(id);

      reply.send({
        success: true,
        data: execution
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==================== 执行历史路由 ====================

  // GET /cron/executions - 获取执行历史
  app.get('/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.query as { jobId?: string };

    const executions = cronSchedulerService.getExecutionHistory(jobId);

    reply.send({
      success: true,
      data: executions
    });
  });

  // GET /cron/executions/:executionId - 获取执行详情
  app.get('/executions/:executionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { executionId } = request.params as { executionId: string };

    const executions = cronSchedulerService.getExecutionHistory();
    const execution = executions.find(exec => exec.executionId === executionId);

    if (!execution) {
      reply.code(404).send({ error: 'Execution not found' });
      return;
    }

    reply.send({
      success: true,
      data: execution
    });
  });

  // ==================== 运行状态路由 ====================

  // GET /cron/running - 获取正在运行的任务
  app.get('/running', async (request: FastifyRequest, reply: FastifyReply) => {
    const runningJobs = cronSchedulerService.getRunningJobs();

    reply.send({
      success: true,
      data: runningJobs
    });
  });

  // GET /cron/status - 获取调度器状态
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const runningJobs = cronSchedulerService.getRunningJobs();
    const jobs = await cronSchedulerService.getJobs();

    reply.send({
      success: true,
      data: {
        totalJobs: jobs.length,
        runningJobs: runningJobs.length,
        runningJobIds: runningJobs
      }
    });
  });

  // ==================== 调度器控制路由 ====================

  // POST /cron/start - 启动调度器
  app.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    cronSchedulerService.start();

    reply.send({
      success: true,
      message: 'Cron scheduler started'
    });
  });

  // POST /cron/stop - 停止调度器
  app.post('/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    cronSchedulerService.stop();

    reply.send({
      success: true,
      message: 'Cron scheduler stopped'
    });
  });
}
