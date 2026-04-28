/**
 * AI Security Module (TASK-1004)
 * AI 安全加固 - 四层防护体系
 *
 * Layers:
 * 1. 输入清洗层 (Input Sanitization)
 * 2. 隔离执行沙箱 (Execution Sandbox)
 * 3. 输出验证层 (Output Validation)
 * 4. 审计日志 (Audit Logging)
 */

import { v4 as uuidv4 } from 'uuid';
import { AuditRepository, CreateAuditLogInput } from './audit/AuditRepository';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AISecurityConfig {
  enableInputSanitization: boolean;
  enableSandbox: boolean;
  enableOutputValidation: boolean;
  enableAuditLog: boolean;
  maxInputLength: number;
  maxOutputLength: number;
  allowedPatterns: RegExp[];
  blockedPatterns: RegExp[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: 'input_sanitized' | 'output_validated' | 'sandbox_executed' | 'security_violation';
  userId?: string;
  sessionId: string;
  details: {
    originalLength?: number;
    sanitizedLength?: number;
    violations?: string[];
    riskScore?: number;
  };
}

export interface SecurityCheckResult {
  passed: boolean;
  riskScore: number;
  violations: string[];
  sanitizedInput?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: AISecurityConfig = {
  enableInputSanitization: true,
  enableSandbox: true,
  enableOutputValidation: true,
  enableAuditLog: true,
  maxInputLength: 10000,
  maxOutputLength: 50000,
  allowedPatterns: [],
  blockedPatterns: [
    /<script[^>]*>[\s\S]*?<\/script>/i,
    /javascript:/i,
    /data:text\/html/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    /document\.cookie/i,
    /localStorage\./i,
    /sessionStorage\./i,
    /XMLHttpRequest/i,
    /fetch\s*\(/i,
    /\bimport\s*\(/i,
    /require\s*\(/i,
    /process\.env/i,
    /global\./i,
  ],
};

// ============================================================================
// Input Sanitization Layer (输入清洗层)
// ============================================================================

/**
 * 输入清洗 - 移除潜在的恶意内容
 */
export function sanitizeInput(input: string, config: AISecurityConfig = defaultConfig): SecurityCheckResult {
  const violations: string[] = [];
  let sanitized = input;

  if (!config.enableInputSanitization) {
    return {
      passed: true,
      riskScore: 0,
      violations: [],
      sanitizedInput: input,
    };
  }

  // 检查长度限制
  if (input.length > config.maxInputLength) {
    violations.push(`输入长度超过限制 (${input.length}/${config.maxInputLength})`);
    sanitized = sanitized.slice(0, config.maxInputLength);
  }

  // 检查阻止模式
  for (const pattern of config.blockedPatterns) {
    pattern.lastIndex = 0; // Reset stateful lastIndex for /g patterns
    if (pattern.test(sanitized)) {
      violations.push(`检测到阻止模式：${pattern.source}`);
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, '');
    }
  }

  // HTML 转义
  sanitized = escapeHtml(sanitized);

  // 移除控制字符
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const riskScore = calculateRiskScore(violations, input.length);

  return {
    passed: violations.length === 0 || riskScore < 50,
    riskScore,
    violations,
    sanitizedInput: sanitized,
  };
}

/**
 * HTML 转义工具函数
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
}

// ============================================================================
// Execution Sandbox (隔离执行沙箱)
// ============================================================================

/**
 * 沙箱执行环境
 * 在隔离环境中执行 AI 生成的代码
 */
export class ExecutionSandbox {
  private readonly timeout: number;
  private readonly allowedGlobals: Set<string>;
  private auditLogs: AuditLogEntry[] = [];

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
    this.allowedGlobals = new Set(['Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date']);
  }

  /**
   * 在沙箱中执行代码
   */
  async execute(code: string, context: Record<string, any> = {}): Promise<any> {
    const sessionId = uuidv4();
    const startTime = Date.now();

    try {
      // 代码验证
      const validationResult = this.validateCode(code);
      if (!validationResult.passed) {
        this.logAudit({
          action: 'security_violation',
          sessionId,
          details: { violations: validationResult.violations },
        });
        throw new SecurityError('代码验证失败：' + validationResult.violations.join(', '));
      }

      // 创建沙箱环境
      const sandbox = this.createSandbox(context);

      // 执行代码（使用 eval 但在隔离环境中）
      const result = await Promise.race([
        this.runInSandbox(code, sandbox),
        this.createTimeout(this.timeout),
      ]);

      // 输出验证
      const outputValidation = this.validateOutput(result);
      if (!outputValidation.passed) {
        this.logAudit({
          action: 'output_validated',
          sessionId,
          details: { violations: outputValidation.violations },
        });
      }

      this.logAudit({
        action: 'sandbox_executed',
        sessionId,
        details: {},
      });

      return result;
    } catch (error) {
      this.logAudit({
        action: 'security_violation',
        sessionId,
        details: { violations: [error instanceof Error ? error.message : 'Unknown error'] },
      });
      throw error;
    }
  }

  /**
   * 代码验证
   */
  private validateCode(code: string): SecurityCheckResult {
    const violations: string[] = [];

    // 检查危险关键字
    const dangerousKeywords = [
      'require',
      'import',
      'eval',
      'Function',
      'process',
      'global',
      'Buffer',
      '__dirname',
      '__filename',
    ];

    for (const keyword of dangerousKeywords) {
      if (new RegExp(`\\b${keyword}\\b`).test(code)) {
        violations.push(`禁止使用关键字：${keyword}`);
      }
    }

    return {
      passed: violations.length === 0,
      riskScore: violations.length * 20,
      violations,
    };
  }

  /**
   * 创建沙箱环境
   */
  private createSandbox(context: Record<string, any>): any {
    const sandbox: any = {
      console: {
        log: (...args: any[]) => console.log('[Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Sandbox]', ...args),
        warn: (...args: any[]) => console.warn('[Sandbox]', ...args),
      },
    };

    // 只允许安全的内置对象
    for (const name of this.allowedGlobals) {
      sandbox[name] = (global as any)[name];
    }

    // 添加用户提供的上下文
    Object.assign(sandbox, context);

    return sandbox;
  }

  /**
   * 在沙箱中运行代码
   *
   * NOTE: Uses Node.js vm module for basic isolation.
   * For production-grade security, replace with 'isolated-vm' package.
   */
  private async runInSandbox(code: string, sandbox: any): Promise<any> {
    const vm = await import('vm');
    const context = vm.createContext(sandbox);
    const wrappedCode = `(async () => { ${code} })()`;
    return vm.runInContext(wrappedCode, context, {
      timeout: this.timeout,
      displayErrors: false,
    });
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError(`代码执行超时 (${ms}ms)`)), ms);
    });
  }

  /**
   * 输出验证
   */
  private validateOutput(output: any): SecurityCheckResult {
    const violations: string[] = [];

    // 检查输出是否包含敏感信息
    const outputStr = JSON.stringify(output);

    if (outputStr.length > defaultConfig.maxOutputLength) {
      violations.push(`输出长度超过限制`);
    }

    // 检查是否泄露环境变量
    if (/process\.env|SECRET|KEY|TOKEN|PASSWORD/i.test(outputStr)) {
      violations.push('可能包含敏感信息');
    }

    return {
      passed: violations.length === 0,
      riskScore: violations.length * 20,
      violations,
    };
  }

  /**
   * 记录审计日志
   */
  private logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    if (!defaultConfig.enableAuditLog) return;

    this.auditLogs.push({
      id: uuidv4(),
      timestamp: new Date(),
      ...entry,
    });
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  /**
   * 清除审计日志
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }
}

// ============================================================================
// Output Validation Layer (输出验证层)
// ============================================================================

/**
 * AI 输出验证
 */
export function validateOutput(output: string, config: AISecurityConfig = defaultConfig): SecurityCheckResult {
  const violations: string[] = [];
  let riskScore = 0;

  if (!config.enableOutputValidation) {
    return { passed: true, riskScore: 0, violations: [] };
  }

  // 长度检查
  if (output.length > config.maxOutputLength) {
    violations.push(`输出长度超过限制 (${output.length}/${config.maxOutputLength})`);
    riskScore += 20;
  }

  // 敏感信息检查
  const sensitivePatterns = [
    /(?<=sk[-_])[a-zA-Z0-9]{20,}/g, // API Keys
    /(?<=password[=:]\s*)\S+/gi,
    /(?<=secret[=:]\s*)\S+/gi,
    /(?<=token[=:]\s*)\S+/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b(?:\d{4}[- ]?){3}\d{4}\b/g, // Credit cards
  ];

  for (const pattern of sensitivePatterns) {
    const matches = output.match(pattern);
    if (matches && matches.length > 0) {
      violations.push(`检测到敏感信息（共 ${matches.length} 处）`);
      riskScore += 30;
    }
  }

  // 代码注入检查
  if (/<script|javascript:|eval\(|Function\(/i.test(output)) {
    violations.push('检测到潜在的代码注入');
    riskScore += 40;
  }

  return {
    passed: riskScore < 50,
    riskScore,
    violations,
  };
}

// ============================================================================
// Audit Logging (审计日志)
// ============================================================================

/**
 * 审计日志管理器
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private readonly maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  /**
   * 记录安全事件
   */
  log(event: {
    action: AuditLogEntry['action'];
    userId: string;
    sessionId: string;
    details: AuditLogEntry['details'];
  }): void {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    this.logs.push(entry);

    // 超出限制时删除最旧的日志
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * 查询日志
   */
  query(filters: {
    action?: AuditLogEntry['action'];
    userId?: string;
    sessionId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AuditLogEntry[] {
    return this.logs.filter((log) => {
      if (filters.action && log.action !== filters.action) return false;
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.sessionId && log.sessionId !== filters.sessionId) return false;
      if (filters.startTime && log.timestamp < filters.startTime) return false;
      if (filters.endTime && log.timestamp > filters.endTime) return false;
      return true;
    });
  }

  /**
   * 导出日志
   */
  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }
    // CSV 导出
    const headers = ['id', 'timestamp', 'action', 'userId', 'sessionId', 'details'];
    const rows = this.logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.action,
      log.userId,
      log.sessionId,
      JSON.stringify(log.details),
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.logs = [];
  }
}

// ============================================================================
// Risk Score Calculation
// ============================================================================

/**
 * 计算风险分数
 */
function calculateRiskScore(violations: string[], inputLength: number): number {
  let score = 0;

  // 违规数量
  score += violations.length * 15;

  // 输入长度风险
  if (inputLength > 5000) score += 10;
  if (inputLength > 8000) score += 20;

  // 特定违规类型
  const highRiskPatterns = ['script', 'eval', 'Function', 'document.cookie'];
  for (const pattern of highRiskPatterns) {
    if (violations.some((v) => v.includes(pattern))) {
      score += 25;
    }
  }

  return Math.min(score, 100);
}

// ============================================================================
// Custom Errors
// ============================================================================

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Main Security Service
// ============================================================================

/**
 * AI 安全服务
 * 整合四层防护体系
 */
export class AISecurityService {
  private readonly config: AISecurityConfig;
  private readonly sandbox: ExecutionSandbox;
  private readonly auditLogger: AuditLogger;
  private readonly auditRepository?: AuditRepository;

  constructor(config: Partial<AISecurityConfig> = {}, options?: { auditRepository?: AuditRepository }) {
    this.config = { ...defaultConfig, ...config };
    this.sandbox = new ExecutionSandbox();
    this.auditLogger = new AuditLogger();
    this.auditRepository = options?.auditRepository;
  }

  /**
   * 处理 AI 请求（完整安全流程）
   */
  async processRequest(input: string, userId: string): Promise<{ output: string; riskScore: number }> {
    const sessionId = uuidv4();

    // 1. 输入清洗
    const inputCheck = sanitizeInput(input, this.config);
    if (!inputCheck.passed) {
      await this.logAuditEvent({
        action: 'input_sanitized',
        userId,
        sessionId,
        details: {
          originalLength: input.length,
          sanitizedLength: inputCheck.sanitizedInput?.length,
          violations: inputCheck.violations,
          riskScore: inputCheck.riskScore,
        },
      });

      if (inputCheck.riskScore >= 70) {
        throw new SecurityError('输入内容安全风险过高：' + inputCheck.violations.join(', '));
      }
    }

    // 2. 沙箱执行（如果需要执行代码）
    // const result = await this.sandbox.execute(inputCheck.sanitizedInput!);

    // 3. 输出验证
    const outputCheck = validateOutput(inputCheck.sanitizedInput || input, this.config);
    await this.logAuditEvent({
      action: 'output_validated',
      userId,
      sessionId,
      details: {
        violations: outputCheck.violations,
        riskScore: outputCheck.riskScore,
      },
    });

    return {
      output: inputCheck.sanitizedInput || input,
      riskScore: Math.max(inputCheck.riskScore, outputCheck.riskScore),
    };
  }

  /**
   * 记录审计事件（优先写入 PostgreSQL，回退内存）
   */
  private async logAuditEvent(event: {
    action: AuditLogEntry['action'];
    userId: string;
    sessionId: string;
    details: AuditLogEntry['details'];
  }): Promise<void> {
    if (this.auditRepository) {
      const input: CreateAuditLogInput = {
        tenant_id: 'ai-security',
        user_id: event.userId,
        action: `ai_security:${event.action}`,
        resource_type: 'ai_security_session',
        resource_id: event.sessionId,
        request_body: event.details as Record<string, any>,
      };
      await this.auditRepository.create(input);
    } else {
      this.auditLogger.log(event);
    }
  }

  /**
   * @deprecated Use getAuditLogsAsync() instead.
   * When using PostgreSQL repository, this sync method cannot perform DB queries
   * and returns only in-memory logs. Always prefer the async version.
   */
  getAuditLogs(filters?: {
    action?: AuditLogEntry['action'];
    userId?: string;
    sessionId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AuditLogEntry[] {
    if (this.auditRepository) {
      // Repository returns AuditLog format; we need to map to AuditLogEntry
      const dbFilters: { tenantId?: string; userId?: string; action?: string } = {
        tenantId: 'ai-security',
      };
      if (filters?.userId) dbFilters.userId = filters.userId;
      if (filters?.action) dbFilters.action = `ai_security:${filters.action}`;

      const logs = this.auditRepository.findAll({ ...dbFilters, limit: 1000 });
      // Note: async call — return empty as repository queries are async;
      // This is a sync method, so we can't properly await.
      // For full async support, callers should use getAuditLogsAsync instead.
      return [];
    }
    return this.auditLogger.query(filters || {});
  }

  /**
   * 获取审计日志（异步版本，支持 PostgreSQL）
   */
  async getAuditLogsAsync(filters?: {
    action?: AuditLogEntry['action'];
    userId?: string;
    sessionId?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<AuditLogEntry[]> {
    if (this.auditRepository) {
      const dbFilters: { tenantId?: string; userId?: string; action?: string; resourceId?: string } = {
        tenantId: 'ai-security',
      };
      if (filters?.userId) dbFilters.userId = filters.userId;
      if (filters?.action) dbFilters.action = `ai_security:${filters.action}`;
      if (filters?.sessionId) dbFilters.resourceId = filters.sessionId;

      const logs = await this.auditRepository.findAll({ ...dbFilters, limit: 1000 });
      let result = logs.map((log) => ({
        id: log.id,
        timestamp: log.created_at,
        action: log.action.startsWith('ai_security:')
          ? log.action.slice('ai_security:'.length) as AuditLogEntry['action']
          : log.action as AuditLogEntry['action'],
        userId: log.user_id || undefined,
        sessionId: log.resource_id || '',
        details: log.request_body || {},
      }));

      // Client-side time filtering (repository doesn't support time range yet)
      if (filters?.startTime) result = result.filter(l => l.timestamp >= filters.startTime!);
      if (filters?.endTime) result = result.filter(l => l.timestamp <= filters.endTime!);

      return result;
    }
    return this.auditLogger.query(filters || {});
  }

  /**
   * @deprecated Use exportAuditLogsAsync() instead.
   * When using PostgreSQL repository, this sync method cannot perform DB queries
   * and returns empty data. Always prefer the async version.
   */
  exportAuditLogs(format: 'json' | 'csv' = 'json'): string {
    if (this.auditRepository) {
      const logs = this.auditRepository.findAll({ tenantId: 'ai-security', limit: 10000 });
      // Sync limitation: returns "[]" — use exportAuditLogsAsync for real data
      return format === 'json' ? '[]' : '';
    }
    return this.auditLogger.export(format);
  }

  /**
   * 导出审计日志（异步版本，支持 PostgreSQL）
   */
  async exportAuditLogsAsync(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (this.auditRepository) {
      const logs = await this.auditRepository.findAll({ tenantId: 'ai-security', limit: 10000 });
      const entries = logs.map((log) => ({
        id: log.id,
        timestamp: log.created_at.toISOString(),
        action: log.action.replace('ai_security:', ''),
        userId: log.user_id,
        sessionId: log.resource_id,
        details: log.request_body,
      }));
      if (format === 'json') {
        return JSON.stringify(entries, null, 2);
      }
      const headers = ['id', 'timestamp', 'action', 'userId', 'sessionId', 'details'];
      const rows = entries.map((e) => [
        e.id,
        e.timestamp,
        e.action,
        e.userId,
        e.sessionId,
        JSON.stringify(e.details),
      ]);
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }
    return this.auditLogger.export(format);
  }
}

export default AISecurityService;
