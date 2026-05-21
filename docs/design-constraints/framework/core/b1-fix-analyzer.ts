/**
 * B1 修复规范检测器
 * 检测修复能力相关的 12 项设计约束
 *
 * B1-01~B1-04: 测试与热更新
 * B1-05~B1-07: 日志规范
 * B1-08~B1-10: 降级与熔断
 * B1-11~B1-12: 回滚方案
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface FixIssue {
  file: string;
  line: number;
  column: number;
  type: FixIssueType;
  severity: 'P0' | 'P1';
  message: string;
  suggestion: string;
  checkId: string; // B1-XX
  code?: string;
}

export type FixIssueType =
  // B1-01: 测试覆盖
  | 'missing-test'
  | 'insufficient-test-coverage'
  // B1-03~B1-04: 热更新
  | 'missing-config-hot-reload'
  | 'missing-ui-hot-reload'
  // B1-05~B1-07: 日志问题
  | 'insufficient-logging'
  | 'wrong-log-level'
  | 'sensitive-log'
  // B1-08~B1-10: 降级熔断
  | 'missing-fallback'
  | 'missing-circuit-breaker'
  | 'missing-degradation-message'
  // B1-11~B1-12: 回滚方案
  | 'missing-db-rollback'
  | 'missing-config-rollback';

export interface FixScanResult {
  file: string;
  issues: FixIssue[];
  stats: {
    hasTests: boolean;
    hasFallback: boolean;
    hasCircuitBreaker: boolean;
    hasConfigCenter: boolean;
    hasHotReload: boolean;
  };
}

// ============ B1 修复规范分析器 ============

export class B1FixAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: FixIssue[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  /**
   * 执行 B1 修复规范分析
   */
  analyze(): FixScanResult {
    this.issues = [];

    // B1-05: 足够上下文信息 (P0)
    this.detectInsufficientLogging();

    // B1-06: 日志级别正确 (P1)
    this.detectWrongLogLevel();

    // B1-07: 敏感信息不记录 (P0)
    this.detectSensitiveLog();

    // B1-08: 服务降级方案 (P0)
    this.detectMissingFallback();

    // B1-09: 熔断器实现 (P1)
    this.detectMissingCircuitBreaker();

    // B1-10: 降级后用户提示 (P0)
    this.detectMissingDegradationMessage();

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      stats,
    };
  }

  /**
   * 收集统计信息
   */
  private collectStats() {
    return {
      hasTests: this.detectHasTests(),
      hasFallback: /fallback|catch\s*\(/.test(this.content),
      hasCircuitBreaker: /circuitBreaker|circuit.?breaker/i.test(this.content),
      hasConfigCenter: /consul|etcd|zookeeper|nacos/i.test(this.content),
      hasHotReload: /hmr|hot.?reload/i.test(this.content),
    };
  }

  /**
   * 检测是否有测试文件
   */
  private detectHasTests(): boolean {
    const baseName = this.filePath.replace(/\.(ts|tsx)$/, '');
    const testExtensions = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
    const possibleTestFiles = testExtensions.map(ext => baseName + ext);

    return possibleTestFiles.some(f => fs.existsSync(f));
  }

  // ============ B1-05: 足够上下文信息 (P0) ============

  /**
   * 检测日志缺少上下文信息
   * 检测 logger.info 缺少 userId, requestId, traceId 等关键上下文
   */
  private detectInsufficientLogging(): void {
    const lines = this.content.split('\n');

    // 检测是否使用日志框架（logger, log, console）
    const hasLogger = /logger\.|this\.logger|log\./.test(this.content);

    if (!hasLogger) return;

    // 检测日志行中是否缺少上下文变量
    const contextPatterns = [
      'userId', 'userId', 'requestId', 'traceId', 'correlationId',
      'tenantId', 'orgId', 'projectId', 'resourceId'
    ];

    lines.forEach((line, i) => {
      // 只检测 info/warn 级别的日志，error 通常已经包含足够信息
      const isInfoLog = /logger\.info\(|log\.info\(|logger\.log\(/.test(line);
      const isWarnLog = /logger\.warn\(|log\.warn\(/.test(line);

      if (isInfoLog || isWarnLog) {
        // 检查是否包含上下文变量
        const hasContext = contextPatterns.some(ctx => line.includes(ctx));
        if (!hasContext) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('logger') + 1 || line.indexOf('log') + 1,
            type: 'insufficient-logging',
            severity: 'P0',
            message: '日志缺少上下文信息（如 userId, requestId）',
            suggestion: '添加 userId, requestId, traceId 等上下文变量',
            checkId: 'B1-05',
            code: line.trim().substring(0, 80),
          });
        }
      }
    });
  }

  // ============ B1-06: 日志级别正确 (P1) ============

  /**
   * 检测日志级别使用错误
   * - console.log 用于错误场景
   * - 错误场景使用 console.log 而非 console.error
   */
  private detectWrongLogLevel(): void {
    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 检测错误处理中使用 console.log
      const isInCatch = /catch\s*\(/.test(lines[i - 1] || '');
      const isInErrorHandler = /\.catch\(|onError|errorHandler/i.test(lines[i - 1] || '');
      const isConsoleLog = /console\.log\(/.test(line);

      if ((isInCatch || isInErrorHandler) && isConsoleLog) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: line.indexOf('console') + 1,
          type: 'wrong-log-level',
          severity: 'P1',
          message: '错误处理中使用 console.log，应使用 console.error',
          suggestion: '错误场景使用 console.error 或 logger.error',
          checkId: 'B1-06',
          code: line.trim().substring(0, 80),
        });
      }

      // 检测 throw 后使用 console.log
      const isAfterThrow = /throw\s+/.test(lines[i - 1] || '');
      if (isAfterThrow && isConsoleLog) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: line.indexOf('console') + 1,
          type: 'wrong-log-level',
          severity: 'P1',
          message: 'throw 语句后使用 console.log，应使用 console.error',
          suggestion: '使用 console.error 记录错误信息',
          checkId: 'B1-06',
          code: line.trim().substring(0, 80),
        });
      }
    });
  }

  // ============ B1-07: 敏感信息不记录 (P0) ============

  /**
   * 检测日志中包含敏感信息
   * 敏感词列表: password, token, secret, apiKey, accessKey, privateKey 等
   */
  private detectSensitiveLog(): void {
    // 敏感词正则（精确匹配，避免误报）
    const sensitivePatterns = [
      // 密码类
      { regex: /password['":\s]*[=:][^\n,]{1,50}/i, word: 'password' },
      { regex: /pwd['":\s]*[=:][^\n,]{1,50}/i, word: 'pwd' },
      { regex: /passwd['":\s]*[=:][^\n,]{1,50}/i, word: 'passwd' },
      // Token 类
      { regex: /token['":\s]*[=:][^\n,]{1,50}/i, word: 'token' },
      { regex: /access_token['":\s]*[=:][^\n,]{1,50}/i, word: 'access_token' },
      { regex: /refresh_token['":\s]*[=:][^\n,]{1,50}/i, word: 'refresh_token' },
      // 密钥类
      { regex: /secret['":\s]*[=:][^\n,]{1,50}/i, word: 'secret' },
      { regex: /api[_-]?key['":\s]*[=:][^\n,]{1,50}/i, word: 'apiKey' },
      { regex: /api[_-]?secret['":\s]*[=:][^\n,]{1,50}/i, word: 'apiSecret' },
      { regex: /access[_-]?key['":\s]*[=:][^\n,]{1,50}/i, word: 'accessKey' },
      { regex: /private[_-]?key['":\s]*[=:][^\n,]{1,50}/i, word: 'privateKey' },
      // 凭证类
      { regex: /credential['":\s]*[=:][^\n,]{1,50}/i, word: 'credential' },
      { regex: /authorization['":\s]*[=:][^\n,]{1,50}/i, word: 'authorization' },
      // 密钥文件
      { regex: /--key['"]*\s+['"]?\w+['"]?\s*[^\n]*/i, word: '--key' },
      { regex: /-k['"]\s*['"]?\w+['"]?\s*[^\n]*/i, word: '-k' },
    ];

    // 只检测日志语句中的敏感信息
    const logPatterns = [
      'console.log', 'console.info', 'console.warn', 'console.error',
      'logger.info', 'logger.warn', 'logger.error', 'logger.debug',
      'log.info', 'log.warn', 'log.error'
    ];

    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 只检查日志语句
      const isLogLine = logPatterns.some(p => line.includes(p));
      if (!isLogLine) return;

      // 排除注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;

      for (const p of sensitivePatterns) {
        if (p.regex.test(line)) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('console') + 1 || line.indexOf('logger') + 1,
            type: 'sensitive-log',
            severity: 'P0',
            message: `日志中可能包含敏感信息: ${p.word}`,
            suggestion: '使用掩码或脱敏处理，如 "***" 替换实际值',
            checkId: 'B1-07',
            code: line.trim().substring(0, 80),
          });
          break; // 一行只报一次
        }
      }
    });
  }

  // ============ B1-08: 服务降级方案 (P0) ============

  /**
   * 检测缺少服务降级/fallback 方案
   * 检测外部服务调用是否缺少 try-catch 和 fallback 逻辑
   */
  private detectMissingFallback(): void {
    // 检测外部服务调用模式
    const externalCallPatterns = [
      /await\s+\w+\.(get|post|put|delete|request)\(/i,
      /axios\.(get|post|put|delete|request)\(/i,
      /fetch\(/,
      /http\.(get|post|put|delete)\(/i,
    ];

    const hasExternalCall = externalCallPatterns.some(p => p.test(this.content));

    if (!hasExternalCall) return;

    // 检测是否有 try-catch 或 fallback 逻辑
    const hasTryCatch = /try\s*\{/.test(this.content);
    const hasFallback = /fallback|defaultValue|defaultResult|defaultData/i.test(this.content);

    // 如果有外部调用但没有 fallback，则警告
    if (hasExternalCall && !hasFallback && hasTryCatch) {
      // 检查 try-catch 是否正确处理错误
      const tryCatchMatch = this.content.match(/try\s*\{[\s\S]*?\}\s*catch\s*\([\s\S]*?\{([\s\S]*?)\}/);
      if (tryCatchMatch) {
        const catchBlock = tryCatchMatch[1] || '';
        // catch 块只有 throw 而没有 fallback 返回值
        if (!/return/.test(catchBlock) && /throw/.test(catchBlock)) {
          this.issues.push({
            file: this.filePath,
            line: 1,
            column: 1,
            type: 'missing-fallback',
            severity: 'P0',
            message: '外部服务调用缺少降级/fallback 方案',
            suggestion: 'catch 块中返回默认值或缓存数据作为降级方案',
            checkId: 'B1-08',
          });
        }
      }
    }

    // 更严格的检测：外部调用在 if 语句中但没有 else 分支提供 fallback
    const ifWithoutElse = /if\s*\([^)]+\)\s*\{[^}]*await\s+\w+\.(get|post|put|delete)/i;
    if (ifWithoutElse.test(this.content) && !/}\s*else/.test(this.content)) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-fallback',
        severity: 'P0',
        message: '条件调用外部服务时缺少 else 分支的 fallback',
        suggestion: '添加 else 分支提供降级方案',
        checkId: 'B1-08',
      });
    }
  }

  // ============ B1-09: 熔断器实现 (P1) ============

  /**
   * 检测缺少熔断器实现
   * 检测外部服务调用是否使用熔断器
   */
  private detectMissingCircuitBreaker(): void {
    // 检测外部服务调用
    const externalCallPatterns = [
      /await\s+\w+\.(get|post|put|delete|request)\(/i,
      /axios\.(get|post|put|delete|request)\(/i,
      /fetch\(/,
    ];

    const hasExternalCall = externalCallPatterns.some(p => p.test(this.content));

    if (!hasExternalCall) return;

    // 检测是否有熔断器相关代码
    const hasCircuitBreaker = /circuitBreaker|circuit.?breaker|CircuitBreaker/i.test(this.content);
    const hasRetryWithBackoff = /retry.*backoff|backoff.*retry/i.test(this.content);
    const hasResilience4j = /resilience4j|Resilience4j/i.test(this.content);

    if (!hasCircuitBreaker && !hasRetryWithBackoff && !hasResilience4j) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-circuit-breaker',
        severity: 'P1',
        message: '外部服务调用缺少熔断器实现',
        suggestion: '使用 circuit-breaker 模式或添加重试退避策略',
        checkId: 'B1-09',
      });
    }
  }

  // ============ B1-10: 降级后用户提示 (P0) ============

  /**
   * 检测服务降级时是否向用户展示友好提示
   * 检测 catch 块中是否调用 message.error 或 notification
   */
  private detectMissingDegradationMessage(): void {
    // 检测是否有 try-catch
    const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch\s*\(/i.test(this.content);

    if (!hasTryCatch) return;

    // 提取所有 catch 块
    const catchBlocks = this.content.match(/catch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/g);

    if (!catchBlocks) return;

    // 检测 message.error 或 notification
    const hasUserMessage = /message\.(error|warning|info|success)|notification\.(error|warning|info|success)|antd\.message/i.test(this.content);

    // 如果有 try-catch 但没有向用户展示消息，可能是问题
    if (hasTryCatch && !hasUserMessage) {
      // 更精确地检查 catch 块中是否有用户提示
      let hasMessageInCatch = false;
      for (const block of catchBlocks) {
        if (/message\.|notification\./.test(block)) {
          hasMessageInCatch = true;
          break;
        }
      }

      if (!hasMessageInCatch) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-degradation-message',
          severity: 'P0',
          message: '服务降级时缺少向用户展示的友好提示',
          suggestion: '使用 message.error 或 notification 展示降级提示',
          checkId: 'B1-10',
        });
      }
    }
  }
}

// ============ 批量扫描器 ============

export class B1FixScanner {
  private frontendPath: string;
  private backendPath: string;

  constructor(frontendPath: string = 'orion-frontend/src/', backendPath: string = 'orion-platform-service/src/') {
    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
  }

  /**
   * 扫描所有文件
   */
  async scan(): Promise<FixIssue[]> {
    const allIssues: FixIssue[] = [];

    // 扫描前端文件
    if (fs.existsSync(this.frontendPath)) {
      const frontendIssues = await this.scanDirectory(this.frontendPath, ['.ts', '.tsx']);
      allIssues.push(...frontendIssues);
    }

    // 扫描后端文件
    if (fs.existsSync(this.backendPath)) {
      const backendIssues = await this.scanDirectory(this.backendPath, ['.ts']);
      allIssues.push(...backendIssues);
    }

    return allIssues;
  }

  /**
   * 扫描目录下的所有 TypeScript 文件
   */
  private async scanDirectory(dir: string, extensions: string[]): Promise<FixIssue[]> {
    const issues: FixIssue[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          // 跳过 node_modules、.git、dist 等目录
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') &&
                entry.name !== 'node_modules' &&
                entry.name !== 'dist' &&
                entry.name !== 'build') {
              traverse(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const analyzer = new B1FixAnalyzer(fullPath);
                const result = analyzer.analyze();
                issues.push(...result.issues);
              } catch (e) {
                // 跳过解析错误的文件
              }
            }
          }
        }
      } catch (e) {
        // 忽略读取错误
      }
    };

    traverse(dir);
    return issues;
  }

  /**
   * 按检查项分组统计
   */
  groupByCheckId(issues: FixIssue[]): Record<string, FixIssue[]> {
    const grouped: Record<string, FixIssue[]> = {};

    for (const issue of issues) {
      if (!grouped[issue.checkId]) {
        grouped[issue.checkId] = [];
      }
      grouped[issue.checkId].push(issue);
    }

    return grouped;
  }

  /**
   * 按严重程度统计
   */
  countBySeverity(issues: FixIssue[]): Record<string, number> {
    const counts: Record<string, number> = { P0: 0, P1: 0 };

    for (const issue of issues) {
      counts[issue.severity]++;
    }

    return counts;
  }

  /**
   * 生成扫描报告
   */
  generateReport(issues: FixIssue[]): string {
    const byCheckId = this.groupByCheckId(issues);
    const bySeverity = this.countBySeverity(issues);

    let report = '# B1 修复规范检测报告\n\n';
    report += `## 总体统计\n\n`;
    report += `- 总问题数: ${issues.length}\n`;
    report += `- P0 严重: ${bySeverity.P0}\n`;
    report += `- P1 警告: ${bySeverity.P1}\n\n`;
    report += `## 按检查项统计\n\n`;

    const checkNames: Record<string, string> = {
      'B1-05': '足够上下文信息',
      'B1-06': '日志级别正确',
      'B1-07': '敏感信息不记录',
      'B1-08': '服务降级方案',
      'B1-09': '熔断器实现',
      'B1-10': '降级后用户提示',
    };

    for (const [checkId, checkIssues] of Object.entries(byCheckId)) {
      const name = checkNames[checkId] || checkId;
      const p0Count = checkIssues.filter(i => i.severity === 'P0').length;
      const p1Count = checkIssues.filter(i => i.severity === 'P1').length;

      report += `### ${checkId} - ${name}\n`;
      report += `- P0: ${p0Count}, P1: ${p1Count}\n`;
      report += `- 涉及文件: ${new Set(checkIssues.map(i => i.file)).size}\n\n`;
    }

    return report;
  }
}

// ============ 辅助函数 ============

/**
 * 检测文件是否为前端文件
 */
export function isFrontendFile(filePath: string): boolean {
  return filePath.includes('orion-frontend/');
}

/**
 * 检测文件是否为后端文件
 */
export function isBackendFile(filePath: string): boolean {
  return filePath.includes('orion-platform-service/');
}

/**
 * 创建默认扫描器
 */
export function createDefaultScanner(): B1FixScanner {
  return new B1FixScanner(
    path.join(process.cwd(), 'orion-frontend/src/'),
    path.join(process.cwd(), 'orion-platform-service/src/')
  );
}

// ============ 导出 ============

export default {
  B1FixAnalyzer,
  B1FixScanner,
  createDefaultScanner,
  isFrontendFile,
  isBackendFile,
};