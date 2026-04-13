/**
 * AI Security API Routes (TASK-1004)
 * AI 安全加固接口
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AISecurityService,
  sanitizeInput,
  validateOutput,
  ExecutionSandbox,
  SecurityError,
} from '../ai-security';

const securityService = new AISecurityService();

export default async function aiSecurityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/ai-security/check-input
   * 检查输入内容安全性
   */
  app.post('/check-input', async (
    request: FastifyRequest<{
      Body: {
        input: string;
        userId: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { input, userId } = request.body;
      const result = sanitizeInput(input);

      return {
        success: true,
        data: {
          passed: result.passed,
          riskScore: result.riskScore,
          violations: result.violations,
          sanitizedInput: result.sanitizedInput,
        },
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : '安全检查失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/check-output
   * 检查输出内容安全性
   */
  app.post('/check-output', async (
    request: FastifyRequest<{
      Body: {
        output: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { output } = request.body;
      const result = validateOutput(output);

      return {
        success: true,
        data: {
          passed: result.passed,
          riskScore: result.riskScore,
          violations: result.violations,
        },
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : '安全检查失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/execute
   * 在沙箱中执行代码
   */
  app.post('/execute', async (
    request: FastifyRequest<{
      Body: {
        code: string;
        context?: Record<string, any>;
        timeout?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { code, context = {}, timeout = 5000 } = request.body;
      const sandbox = new ExecutionSandbox(timeout);
      const result = await sandbox.execute(code, context);

      return {
        success: true,
        data: { result },
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : '代码执行失败',
      });
    }
  });

  /**
   * GET /api/v1/ai-security/logs
   * 获取审计日志
   */
  app.get('/logs', async (
    request: FastifyRequest<{
      Querystring: {
        action?: string;
        userId?: string;
        sessionId?: string;
        startTime?: string;
        endTime?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { action, userId, sessionId, startTime, endTime } = request.query;

      const logs = securityService.getAuditLogs({
        action: action as any,
        userId,
        sessionId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      });

      return {
        success: true,
        data: { logs, total: logs.length },
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : '获取日志失败',
      });
    }
  });

  /**
   * GET /api/v1/ai-security/logs/export
   * 导出审计日志
   */
  app.get('/logs/export', async (
    request: FastifyRequest<{
      Querystring: {
        format?: 'json' | 'csv';
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { format = 'json' } = request.query;
      const data = securityService.exportAuditLogs(format);

      reply.header('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
      reply.header('Content-Disposition', `attachment; filename=audit-logs.${format}`);

      return data;
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : '导出日志失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/process
   * 处理 AI 请求（完整安全流程）
   */
  app.post('/process', async (
    request: FastifyRequest<{
      Body: {
        input: string;
        userId: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { input, userId } = request.body;
      const result = await securityService.processRequest(input, userId);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : '请求处理失败',
      });
    }
  });
}
