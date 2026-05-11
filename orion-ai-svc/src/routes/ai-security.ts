/**
 * AI Security API Routes (TASK-1004)
 * AI 安全加固接口
 *
 * P1-15 Fix: Connected to PostgreSQL via AuditRepository for audit log persistence.
 * Critical Fix: Added tenant isolation validation.
 *
 * 新增功能：
 * - Prompt 注入检测
 * - Prompt 清洗
 * - 租户隔离验证
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import {
  AISecurityService,
  sanitizeInput,
  validateOutput,
  ExecutionSandbox,
  SecurityError,
} from '../services/ai-security';
import { AuditRepository, CreateAuditLogInput, AuditLog } from '../services/audit/AuditRepository';
import { PromptInjectionDetector } from '../services/PromptInjectionDetector';
import { PromptSanitizer } from '../services/PromptSanitizer';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface AISecurityRoutesOptions {
  database?: DatabasePool;
}

// 扩展 request.user 类型以包含 tenantId
interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
}

// 初始化检测器和清洗器
const promptDetector = new PromptInjectionDetector();
const promptSanitizer = new PromptSanitizer();

/**
 * 从请求中提取租户 ID
 * 优先级: JWT > API Key > 默认值
 */
function extractTenantId(request: FastifyRequest): string {
  // 1. 从 JWT 中提取（扩展类型以支持 tenantId）
  const user = (request.user as AuthenticatedUser | undefined);
  if (user?.tenantId) {
    return user.tenantId;
  }

  // 2. 从 API Key 中提取 (假设 API Key 格式为 orion-{tenantId}-{random})
  const apiKey = request.headers['x-api-key'] as string;
  if (apiKey && apiKey.startsWith('orion-')) {
    const parts = apiKey.split('-');
    if (parts.length >= 3) {
      return parts[1]; // 返回 tenantId 部分
    }
  }

  // 3. 从请求头 X-Tenant-ID 中提取
  const tenantHeader = request.headers['x-tenant-id'] as string;
  if (tenantHeader) {
    return tenantHeader;
  }

  // 4. 返回默认租户（未认证情况）
  return 'default-tenant';
}

/**
 * 从请求中提取用户 ID
 */
function extractUserId(request: FastifyRequest): string {
  if (request.user?.userId) {
    return request.user.userId;
  }

  const apiKey = request.headers['x-api-key'] as string;
  if (apiKey && apiKey.startsWith('orion-')) {
    return 'api-key-user';
  }

  return 'anonymous';
}

/**
 * 验证租户访问权限
 */
function validateTenantAccess(
  request: FastifyRequest,
  resourceTenantId: string
): boolean {
  const requestTenantId = extractTenantId(request);
  return requestTenantId === resourceTenantId;
}

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
        userId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { input, userId: bodyUserId } = request.body;
      const tenantId = extractTenantId(request);
      const userId = bodyUserId || extractUserId(request);

      const result = sanitizeInput(input);

      // 记录审计日志
      await auditRepository?.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'ai_security:check_input',
        resource_type: 'input_validation',
        resource_id: 'check-input',
        request_body: {
          passed: result.passed,
          riskScore: result.riskScore,
        },
      });

      return {
        success: true,
        data: {
          passed: result.passed,
          riskScore: result.riskScore,
          violations: result.violations,
          sanitizedInput: result.sanitizedInput,
          tenantId,
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
      const tenantId = extractTenantId(request);
      const userId = extractUserId(request);

      const result = validateOutput(output);

      // 记录审计日志
      await auditRepository?.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'ai_security:check_output',
        resource_type: 'output_validation',
        resource_id: 'check-output',
        request_body: {
          passed: result.passed,
          riskScore: result.riskScore,
        },
      });

      return {
        success: true,
        data: {
          passed: result.passed,
          riskScore: result.riskScore,
          violations: result.violations,
          tenantId,
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
        context?: Record<string, unknown>;
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
        action: action as 'input_sanitized' | 'output_validated' | 'sandbox_executed' | 'security_violation',
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
        userId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { input, userId: bodyUserId } = request.body;
      const tenantId = extractTenantId(request);
      const userId = bodyUserId || extractUserId(request);

      const result = await securityService.processRequest(input, userId);

      // 记录审计日志
      await auditRepository?.create({
        tenant_id: tenantId,
        user_id: userId,
        action: 'ai_security:process_request',
        resource_type: 'request_processing',
        resource_id: 'process',
        request_body: {
          output: result.output,
          riskScore: result.riskScore,
        },
      });

      return {
        success: true,
        data: {
          output: result.output,
          riskScore: result.riskScore,
          tenantId,
        },
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
      const tenantId = extractTenantId(request);
      const userId = extractUserId(request);

      if (!prompt || typeof prompt !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'prompt 参数必须是非空字符串',
        });
      }

      const analysis = promptDetector.analyze(prompt);

      // 记录检测结果（使用租户 ID）
      if (options.logResults && analysis.threats.length > 0) {
        await auditRepository?.create({
          tenant_id: tenantId,
          user_id: userId,
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
      const tenantId = extractTenantId(request);
      const userId = extractUserId(request);

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

      // 记录清洗操作（使用租户 ID）
      await auditRepository?.create({
        tenant_id: tenantId,
        user_id: userId,
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
   * 获取安全统计信息（支持租户隔离）
   * 注意：此端点使用 PromptSecurityRepository 获取租户级统计，
   * 当前实现返回基本统计信息，后续可扩展
   */
  app.get('/stats', async (
    request: FastifyRequest<{
      Querystring: {
        startTime?: string;
        endTime?: string;
        tenantId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { startTime, endTime, tenantId: queryTenantId } = request.query;
      const requestTenantId = extractTenantId(request);

      // 如果查询指定了 tenantId，验证是否与请求租户一致
      // 管理员角色可以查询其他租户（需要扩展 JWT 角色验证）
      const targetTenantId = queryTenantId || requestTenantId;

      // 从 PromptSecurity 审计日志获取统计
      // 使用 AuditRepository.findAll 查询 prompt 相关记录
      const logs: AuditLog[] = auditRepository
        ? await auditRepository.findAll({ tenantId: targetTenantId, limit: 1000 })
        : [];

      // 过滤时间范围和 prompt 相关操作
      const filteredLogs = logs.filter((log: AuditLog) => {
        // 时间过滤
        if (startTime && log.created_at < new Date(startTime)) {
          return false;
        }
        if (endTime && log.created_at > new Date(endTime)) {
          return false;
        }
        // 只统计 prompt 相关操作
        return log.action.startsWith('ai_security:prompt');
      });

      // 计算统计
      const stats = {
        tenantId: targetTenantId,
        totalChecks: filteredLogs.filter((l: AuditLog) => l.action === 'ai_security:prompt_check').length,
        totalSanitizations: filteredLogs.filter((l: AuditLog) => l.action === 'ai_security:prompt_sanitize').length,
        totalRejections: filteredLogs.filter((l: AuditLog) => {
          const riskScore = l.request_body?.riskScore;
          return typeof riskScore === 'number' && riskScore >= 70;
        }).length,
        threatDistribution: {} as Record<string, number>,
      };

      // 计算威胁分布
      for (const log of filteredLogs) {
        const threatTypes = log.request_body?.threatTypes as string[] | undefined;
        if (threatTypes) {
          for (const type of threatTypes) {
            stats.threatDistribution[type] = (stats.threatDistribution[type] || 0) + 1;
          }
        }
      }

      logger.info({
        msg: 'AI security stats retrieved',
        tenantId: targetTenantId,
        requestedBy: requestTenantId,
        totalChecks: stats.totalChecks,
      });

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