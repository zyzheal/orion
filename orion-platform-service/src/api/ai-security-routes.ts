/**
 * AI Security API Routes (TASK-1004)
 * AI 安全加固接口
 *
 * P1-15 Fix: Connected to PostgreSQL via AuditRepository for audit log persistence.
 *
 * 新增功能：
 * - Prompt 注入检测
 * - Prompt 清洗
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import {
  AISecurityService,
  sanitizeInput,
  validateOutput,
  ExecutionSandbox,
  SecurityError,
} from '../services/ai-security';
import { AuditRepository } from '../services/audit/AuditRepository';
import { PromptInjectionDetector } from '../services/ai/PromptInjectionDetector';
import { PromptSanitizer } from '../services/ai/PromptSanitizer';

interface AISecurityRoutesOptions {
  database?: DatabasePool;
}

// 初始化检测器和清洗器
const promptDetector = new PromptInjectionDetector();
const promptSanitizer = new PromptSanitizer();

export default async function aiSecurityRoutes(
  app: FastifyInstance,
  options: AISecurityRoutesOptions = {}
): Promise<void> {
  const auditRepository = options.database ? new AuditRepository(options.database) : undefined;
  const securityService = new AISecurityService({}, { auditRepository });

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

      const logs = await securityService.getAuditLogsAsync({
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
      const data = await securityService.exportAuditLogsAsync(format);

      const contentType = format === 'json' ? 'application/json' : 'text/csv';
      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename=audit-logs.${format}`);
      reply.type(contentType).send(data);
      return reply;
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

  // ========== 新增：Prompt 注入检测和清洗 API ==========

  /**
   * POST /api/v1/ai-security/check-prompt
   * 检测 Prompt 注入风险
   */
  app.post('/check-prompt', async (
    request: FastifyRequest<{
      Body: {
        prompt: string;
        options?: {
          logResults?: boolean;
          includeContext?: boolean;
        };
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { prompt, options = {} } = request.body;

      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'prompt 参数必须是非空字符串',
        });
      }

      const analysis = promptDetector.analyze(prompt);

      // 记录检测结果
      if (options.logResults && analysis.threats.length > 0) {
        await auditRepository?.create({
          tenant_id: 'ai-security',
          user_id: 'system',
          action: 'ai_security:prompt_check',
          resource_type: 'prompt_analysis',
          resource_id: analysis.metadata.analysisVersion,
          request_body: {
            riskScore: analysis.riskScore,
            threatCount: analysis.threats.length,
            threatTypes: analysis.threats.map(t => t.type),
            recommendation: analysis.recommendation,
          },
        });
      }

      return {
        success: true,
        data: {
          isSafe: analysis.isSafe,
          riskScore: analysis.riskScore,
          recommendation: analysis.recommendation,
          threats: options.includeContext
            ? analysis.threats.map(t => ({
                type: t.type,
                severity: t.severity,
                description: t.description,
                matchedPattern: t.matchedPattern,
                context: t.context,
              }))
            : analysis.threats.map(t => ({
                type: t.type,
                severity: t.severity,
                description: t.description,
              })),
          attackCategories: analysis.attackCategories,
          metadata: analysis.metadata,
        },
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Prompt 检测失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/sanitize-prompt
   * 清洗 Prompt 内容
   */
  app.post('/sanitize-prompt', async (
    request: FastifyRequest<{
      Body: {
        prompt: string;
        options?: {
          strategy?: 'remove' | 'replace' | 'neutralize' | 'escape';
          preserveIntent?: boolean;
        };
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { prompt, options = {} } = request.body;

      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'prompt 参数必须是非空字符串',
        });
      }

      // 先检测威胁
      const analysis = promptDetector.analyze(prompt);

      if (analysis.threats.length === 0) {
        return {
          success: true,
          data: {
            originalPrompt: prompt,
            sanitizedPrompt: prompt,
            sanitizationCount: 0,
            intentPreserved: true,
            message: '未检测到威胁，无需清洗',
          },
        };
      }

      // 清洗 Prompt
      const sanitization = promptSanitizer.sanitize(prompt, analysis.threats);

      // 记录清洗操作
      await auditRepository?.create({
        tenant_id: 'ai-security',
        user_id: 'system',
        action: 'ai_security:prompt_sanitize',
        resource_type: 'prompt_sanitization',
        resource_id: sanitization.metadata.version,
        request_body: {
          sanitizationCount: sanitization.sanitizationCount,
          originalLength: sanitization.metadata.originalLength,
          sanitizedLength: sanitization.metadata.sanitizedLength,
          threatTypes: sanitization.appliedSanitizations.map(s => s.threatType),
        },
      });

      return {
        success: true,
        data: {
          originalPrompt: sanitization.originalPrompt,
          sanitizedPrompt: sanitization.sanitizedPrompt,
          sanitizationCount: sanitization.sanitizationCount,
          intentPreserved: sanitization.intentPreserved,
          appliedSanitizations: sanitization.appliedSanitizations.map(s => ({
            threatType: s.threatType,
            strategy: s.strategy,
            originalContent: s.originalContent.slice(0, 100),
          })),
          riskScore: analysis.riskScore,
          metadata: sanitization.metadata,
        },
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Prompt 清洗失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/check-and-sanitize
   * 检测并清洗 Prompt（一体化接口）
   */
  app.post('/check-and-sanitize', async (
    request: FastifyRequest<{
      Body: {
        prompt: string;
        riskThresholdHigh?: number;
        riskThresholdMedium?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { prompt, riskThresholdHigh = 70, riskThresholdMedium = 30 } = request.body;

      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'prompt 参数必须是非空字符串',
        });
      }

      // 检测
      const analysis = promptDetector.analyze(prompt);

      // 根据风险等级决定操作
      if (analysis.riskScore >= riskThresholdHigh) {
        // 高风险：拒绝
        return {
          success: false,
          data: {
            action: 'reject',
            reason: `风险评分过高 (${analysis.riskScore}/${riskThresholdHigh})`,
            riskScore: analysis.riskScore,
            threats: analysis.threats,
            sanitizedPrompt: null,
          },
          error: 'PROMPT_RISK_TOO_HIGH',
        };
      }

      if (analysis.riskScore >= riskThresholdMedium) {
        // 中风险：清洗
        const sanitization = promptSanitizer.sanitize(prompt, analysis.threats);

        return {
          success: true,
          data: {
            action: 'sanitize',
            originalPrompt: prompt,
            sanitizedPrompt: sanitization.sanitizedPrompt,
            riskScore: analysis.riskScore,
            sanitizationCount: sanitization.sanitizationCount,
            intentPreserved: sanitization.intentPreserved,
            threats: analysis.threats.map(t => ({
              type: t.type,
              severity: t.severity,
            })),
          },
        };
      }

      // 低风险：允许
      return {
        success: true,
        data: {
          action: 'allow',
          originalPrompt: prompt,
          sanitizedPrompt: prompt,
          riskScore: analysis.riskScore,
          threats: [],
        },
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : '检测和清洗失败',
      });
    }
  });

  /**
   * GET /api/v1/ai-security/rules
   * 获取检测规则列表
   */
  app.get('/rules', async (
    request: FastifyRequest<{
      Querystring: {
        threatType?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { threatType } = request.query;
      const rules = promptDetector.getRules();

      // 过滤规则
      const filteredRules = threatType
        ? rules.filter(r => r.type === threatType)
        : rules;

      return {
        success: true,
        data: {
          rules: filteredRules.map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            severity: r.severity,
            enabled: r.enabled,
            description: r.description,
          })),
          total: filteredRules.length,
        },
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : '获取规则失败',
      });
    }
  });

  /**
   * POST /api/v1/ai-security/stats
   * 获取安全统计信息
   */
  app.get('/stats', async (
    request: FastifyRequest<{
      Querystring: {
        startTime?: string;
        endTime?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { startTime, endTime } = request.query;

      // 从审计日志获取统计
      const logs = await securityService.getAuditLogsAsync({
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      });

      // 计算统计
      const stats = {
        totalChecks: logs.filter(l => l.action === 'prompt_check').length,
        totalSanitizations: logs.filter(l => l.action === 'prompt_sanitize').length,
        totalRejections: logs.filter(l =>
          l.details.riskScore !== undefined && l.details.riskScore >= 70
        ).length,
        threatDistribution: {} as Record<string, number>,
      };

      // 计算威胁分布
      for (const log of logs) {
        if (log.details.threatTypes) {
          for (const type of log.details.threatTypes as string[]) {
            stats.threatDistribution[type] = (stats.threatDistribution[type] || 0) + 1;
          }
        }
      }

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : '获取统计失败',
      });
    }
  });
}
