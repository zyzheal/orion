/**
 * PromptSanitizer - Prompt 清洗服务
 *
 * 功能：
 * 1. 过滤/转义恶意 Prompt 内容
 * 2. 移除角色扮演指令（"你现在是..."）
 * 3. 移除指令覆盖（"忽略之前的..."）
 * 4. 保留用户意图但去除攻击成分
 * 5. 支持可配置的清洗策略
 */

import { createLogger } from '../utils/logger';
import { ExtendedPromptThreat, ExtendedThreatType } from './PromptInjectionDetector';
import { ThreatType } from './PromptSecurity';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 清洗策略类型
 */
export type SanitizationStrategy =
  | 'remove' // 完全移除
  | 'replace' // 替换为占位符
  | 'escape' // 转义特殊字符
  | 'neutralize' // 中性化处理（保留但无害化）
  | 'truncate' // 截断
  | 'warn'; // 保留但添加警告标记

/**
 * 清洗规则定义
 */
export interface SanitizationRule {
  threatType: ExtendedThreatType;
  strategy: SanitizationStrategy;
  replacement?: string;
  preserveIntent?: boolean; // 是否尝试保留用户意图
  priority: number;
}

/**
 * 清洗器配置
 */
export interface SanitizerConfig {
  defaultStrategy: SanitizationStrategy;
  defaultReplacement: string;
  preserveUserIntent: boolean;
  logSanitizations: boolean;
  maxIterations: number; // 最大清洗迭代次数（防止循环）
  customRules: SanitizationRule[];
}

/**
 * 清洗结果
 */
export interface SanitizationResult {
  originalPrompt: string;
  sanitizedPrompt: string;
  appliedSanitizations: AppliedSanitization[];
  sanitizationCount: number;
  intentPreserved: boolean;
  metadata: {
    sanitizedAt: Date;
    version: string;
    originalLength: number;
    sanitizedLength: number;
    reductionRatio: number;
  };
}

/**
 * 已应用的清洗操作
 */
export interface AppliedSanitization {
  threatType: ExtendedThreatType;
  strategy: SanitizationStrategy;
  originalContent: string;
  sanitizedContent: string;
  position: { start: number; end: number };
}

const DEFAULT_CONFIG: SanitizerConfig = {
  defaultStrategy: 'replace',
  defaultReplacement: '[CONTENT_SANITIZED]',
  preserveUserIntent: true,
  logSanitizations: true,
  maxIterations: 10,
  customRules: [],
};

/**
 * 默认清洗规则
 */
const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  // 指令覆盖 - 完全移除
  {
    threatType: ThreatType.INSTRUCTION_OVERRIDE,
    strategy: 'remove',
    priority: 1,
    preserveIntent: false,
  },
  // 角色扮演攻击 - 中性化
  {
    threatType: ThreatType.ROLE_PLAY_ATTACK,
    strategy: 'neutralize',
    replacement: '[ROLE_PLAY_REMOVED]',
    priority: 2,
    preserveIntent: true,
  },
  // 系统提示泄露 - 移除
  {
    threatType: ThreatType.SYSTEM_PROMPT_LEAK,
    strategy: 'remove',
    priority: 1,
    preserveIntent: false,
  },
  // 命令注入 - 替换
  {
    threatType: ThreatType.COMMAND_INJECTION,
    strategy: 'replace',
    replacement: '[COMMAND_BLOCK_REMOVED]',
    priority: 1,
    preserveIntent: false,
  },
  // 代码注入 - 替换
  {
    threatType: ThreatType.CODE_INJECTION,
    strategy: 'replace',
    replacement: '[CODE_BLOCK_REMOVED]',
    priority: 1,
    preserveIntent: false,
  },
  // 编码绕过 - 解码并处理
  {
    threatType: 'encoding_bypass',
    strategy: 'neutralize',
    priority: 2,
    preserveIntent: true,
  },
  // 数据泄露 - 移除
  {
    threatType: 'data_exfiltration',
    strategy: 'remove',
    priority: 1,
    preserveIntent: false,
  },
  // Token smuggling - 截断
  {
    threatType: ThreatType.TOKEN_SMUGGLING,
    strategy: 'truncate',
    priority: 3,
    preserveIntent: true,
  },
];

/**
 * 中性化模式映射
 * 将攻击性表述转换为中性表述
 */
const NEUTRALIZATION_MAP: Record<string, string> = {
  'you are now': 'consider the following',
  'pretend you are': 'imagine a scenario where',
  'act as': 'in the context of',
  'ignore all previous instructions': 'let\'s start a new topic',
  'ignore previous instructions': 'moving on to a new request',
  'disregard all prior': 'focusing on the current request',
  'reveal your system prompt': 'describe the system functionality',
  'reveal your instructions': 'explain how the system works',
  'bypass safety filters': 'work within the safety guidelines',
  'export all data': 'provide a summary of available information',
  'show me all passwords': 'show available security documentation',
  'download all files': 'access the relevant documentation',
};

/**
 * Prompt 清洗器
 */
export class PromptSanitizer {
  private config: SanitizerConfig;
  private rules: SanitizationRule[];

  constructor(config?: Partial<SanitizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...DEFAULT_SANITIZATION_RULES, ...this.config.customRules];
    // 按优先级排序
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 清洗 Prompt
   */
  sanitize(prompt: string, threats: ExtendedPromptThreat[]): SanitizationResult {
    let sanitized = prompt;
    const appliedSanitizations: AppliedSanitization[] = [];
    let iterations = 0;

    // 按威胁类型处理（高优先级优先）
    const sortedThreats = [...threats].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const threat of sortedThreats) {
      if (iterations >= this.config.maxIterations) {
        logger.warn({ traceId: getCurrentTraceId() }, 'Sanitization iteration limit reached');
        break;
      }

      // 找到对应的清洗规则
      const rule = this.findRule(threat.type);

      if (!rule) {
        // 使用默认策略
        const result = this.applyDefaultStrategy(sanitized, threat);
        if (result.changed) {
          sanitized = result.prompt;
          appliedSanitizations.push(result.sanitization);
        }
      } else {
        // 应用特定规则
        const result = this.applyRule(sanitized, threat, rule);
        if (result.changed) {
          sanitized = result.prompt;
          appliedSanitizations.push(result.sanitization);
        }
      }

      iterations++;
    }

    // 通用清理：移除多余的空格和换行
    sanitized = this.cleanupWhitespace(sanitized);

    // 记录日志
    if (this.config.logSanitizations && appliedSanitizations.length > 0) {
      logger.info({
        msg: 'Prompt sanitized',
        sanitizationCount: appliedSanitizations.length,
        threatTypes: appliedSanitizations.map(s => s.threatType),
        originalLength: prompt.length,
        sanitizedLength: sanitized.length,
      });
    }

    return {
      originalPrompt: prompt,
      sanitizedPrompt: sanitized,
      appliedSanitizations,
      sanitizationCount: appliedSanitizations.length,
      intentPreserved: this.checkIntentPreservation(appliedSanitizations),
      metadata: {
        sanitizedAt: new Date(),
        version: '1.0.0',
        originalLength: prompt.length,
        sanitizedLength: sanitized.length,
        reductionRatio: prompt.length > 0 ? (prompt.length - sanitized.length) / prompt.length : 0,
      },
    };
  }

  /**
   * 找到对应的清洗规则
   */
  private findRule(threatType: ExtendedThreatType): SanitizationRule | undefined {
    return this.rules.find(r => r.threatType === threatType);
  }

  /**
   * 应用清洗规则
   */
  private applyRule(
    prompt: string,
    threat: ExtendedPromptThreat,
    rule: SanitizationRule
  ): { prompt: string; changed: boolean; sanitization: AppliedSanitization } {
    let resultPrompt = prompt;
    let changed = false;
    const originalContent = threat.matchedPattern;

    switch (rule.strategy) {
      case 'remove':
        resultPrompt = this.removeContent(prompt, threat);
        changed = true;
        break;

      case 'replace':
        resultPrompt = this.replaceContent(prompt, threat, rule.replacement || this.config.defaultReplacement);
        changed = true;
        break;

      case 'escape':
        resultPrompt = this.escapeContent(prompt, threat);
        changed = true;
        break;

      case 'neutralize':
        resultPrompt = this.neutralizeContent(prompt, threat);
        changed = true;
        break;

      case 'truncate':
        resultPrompt = this.truncateContent(prompt, threat);
        changed = true;
        break;

      case 'warn':
        resultPrompt = this.addWarning(prompt, threat);
        changed = true;
        break;
    }

    return {
      prompt: resultPrompt,
      changed,
      sanitization: {
        threatType: threat.type,
        strategy: rule.strategy,
        originalContent,
        sanitizedContent: this.extractSanitizedContent(resultPrompt, threat),
        position: threat.position || { start: 0, end: originalContent.length },
      },
    };
  }

  /**
   * 应用默认策略
   */
  private applyDefaultStrategy(
    prompt: string,
    threat: ExtendedPromptThreat
  ): { prompt: string; changed: boolean; sanitization: AppliedSanitization } {
    return this.applyRule(prompt, threat, {
      threatType: threat.type,
      strategy: this.config.defaultStrategy,
      replacement: this.config.defaultReplacement,
      priority: 99,
    });
  }

  /**
   * 移除内容
   */
  private removeContent(prompt: string, threat: ExtendedPromptThreat): string {
    const position = threat.position;
    if (!position) {
      // 如果没有位置信息，尝试通过匹配模式移除
      return prompt.replace(threat.matchedPattern, '');
    }

    // 使用位置信息移除
    return prompt.slice(0, position.start) + prompt.slice(position.end);
  }

  /**
   * 替换内容
   */
  private replaceContent(prompt: string, threat: ExtendedPromptThreat, replacement: string): string {
    const position = threat.position;
    if (!position) {
      return prompt.replace(threat.matchedPattern, replacement);
    }

    return prompt.slice(0, position.start) + replacement + prompt.slice(position.end);
  }

  /**
   * 转义内容
   */
  private escapeContent(prompt: string, threat: ExtendedPromptThreat): string {
    let content = threat.matchedPattern;

    // HTML 转义
    content = content.replace(/</g, '&lt;');
    content = content.replace(/>/g, '&gt;');
    content = content.replace(/"/g, '&quot;');
    content = content.replace(/'/g, '&#39;');

    // 转义特殊字符
    content = content.replace(/\$/g, '\\$');
    content = content.replace(/`/g, '\\`');
    content = content.replace(/\\/g, '\\\\');

    const position = threat.position;
    if (!position) {
      return prompt.replace(threat.matchedPattern, content);
    }

    return prompt.slice(0, position.start) + content + prompt.slice(position.end);
  }

  /**
   * 中性化内容
   * 将攻击性表述转换为中性表述
   */
  private neutralizeContent(prompt: string, threat: ExtendedPromptThreat): string {
    let content = threat.matchedPattern.toLowerCase();

    // 查找中性化映射
    for (const [attack, neutral] of Object.entries(NEUTRALIZATION_MAP)) {
      if (content.includes(attack.toLowerCase())) {
        content = content.replace(attack.toLowerCase(), neutral);
      }
    }

    // 如果没有映射，使用默认替换
    if (content === threat.matchedPattern.toLowerCase()) {
      content = '[NEUTRALIZED_CONTENT]';
    }

    const position = threat.position;
    if (!position) {
      return prompt.replace(threat.matchedPattern, content);
    }

    return prompt.slice(0, position.start) + content + prompt.slice(position.end);
  }

  /**
   * 截断内容
   */
  private truncateContent(prompt: string, threat: ExtendedPromptThreat): string {
    // 如果是长度问题，截断整个 prompt
    if (threat.type === ThreatType.TOKEN_SMUGGLING) {
      const maxLength = 10000;
      if (prompt.length > maxLength) {
        return prompt.slice(0, maxLength) + '\n[CONTENT_TRUNCATED_DUE_TO_LENGTH]';
      }
    }

    // 截断特定威胁内容
    const position = threat.position;
    if (position && threat.matchedPattern.length > 50) {
      const truncated = threat.matchedPattern.slice(0, 50) + '...[TRUNCATED]';
      return prompt.slice(0, position.start) + truncated + prompt.slice(position.end);
    }

    return prompt;
  }

  /**
   * 添加警告标记
   */
  private addWarning(prompt: string, threat: ExtendedPromptThreat): string {
    const position = threat.position;
    const warning = `[WARNING: POTENTIAL_${threat.type.toUpperCase()}]`;

    if (!position) {
      return warning + prompt;
    }

    return prompt.slice(0, position.start) + warning + ' ' + threat.matchedPattern + prompt.slice(position.end);
  }

  /**
   * 清理多余空格
   */
  private cleanupWhitespace(prompt: string): string {
    // 移除连续多个空格
    let cleaned = prompt.replace(/\s{3,}/g, '  ');

    // 移除空行（保留最多一个空行）
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // 移除行首/行尾多余空格
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

    return cleaned;
  }

  /**
   * 提取清洗后的内容片段
   */
  private extractSanitizedContent(prompt: string, threat: ExtendedPromptThreat): string {
    const position = threat.position;
    if (!position) return '';

    // 提取清洗后对应位置的上下文
    const contextLength = 20;
    const start = Math.max(0, position.start - contextLength);
    const end = Math.min(prompt.length, position.start + contextLength);

    return prompt.slice(start, end);
  }

  /**
   * 检查意图是否保留
   */
  private checkIntentPreservation(sanitizations: AppliedSanitization[]): boolean {
    // 如果所有清洗都尝试保留意图，则认为意图保留
    const preserveIntentCount = sanitizations.filter(s => {
      const rule = this.findRule(s.threatType);
      return rule?.preserveIntent === true;
    }).length;

    return preserveIntentCount === sanitizations.length || sanitizations.length === 0;
  }

  /**
   * 清洗代码块
   */
  sanitizeCodeBlock(prompt: string): string {
    // 移除可疑的代码块
    return prompt.replace(
      /```(?:bash|sh|shell|cmd|powershell|terminal)[\s\S]*?```/gi,
      '[CODE_BLOCK_SANITIZED]'
    );
  }

  /**
   * 清洗 Base64 内容
   */
  sanitizeBase64(prompt: string): string {
    // 移除可能的 Base64 编码内容
    return prompt.replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[ENCODED_CONTENT_SANITIZED]');
  }

  /**
   * 清洗 Unicode 转义
   */
  sanitizeUnicode(prompt: string): string {
    // 将 Unicode 转义转换为实际字符，再进行清洗
    let result = prompt;

    // 处理 \uXXXX 格式
    result = result.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // 处理 \xXX 格式
    result = result.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    return result;
  }

  /**
   * 获取配置
   */
  getConfig(): SanitizerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SanitizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加清洗规则
   */
  addRule(rule: SanitizationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除清洗规则
   */
  removeRule(threatType: ExtendedThreatType): boolean {
    const index = this.rules.findIndex(r => r.threatType === threatType);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
}

export default PromptSanitizer;