/**
 * PromptInjectionDetector - Prompt 注入检测服务
 *
 * 功能：
 * 1. 检测常见 Prompt 注入模式（角色扮演、指令覆盖、数据泄露等）
 * 2. 返回风险评分（0-100）和检测到的攻击类型
 * 3. 支持可配置的规则引擎
 *
 * 检测的威胁类型：
 * - command_injection: 命令注入（bash/shell 命令）
 * - role_play_attack: 角色扮演攻击（"你现在是..."）
 * - system_prompt_leak: 系统提示泄露尝试
 * - token_smuggling: Token  smuggling（超长输入、编码绕过）
 * - code_injection: 代码注入（eval、Function 等）
 * - instruction_override: 指令覆盖（"忽略之前的指令"）
 * - encoding_bypass: 编码绕过（Base64、Unicode、HTML 实体）
 * - data_exfiltration: 数据泄露尝试（请求导出数据）
 */

import { createLogger } from '../../utils/logger';
import { PromptSecurity, ThreatType, PromptThreat, PromptAnalysis } from './PromptSecurity';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('prompt-injection-detector');

/**
 * 检测规则定义
 */
export interface DetectionRule {
  id: string;
  name: string;
  type: ThreatType | 'encoding_bypass' | 'data_exfiltration';
  patterns: RegExp[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  description: string;
}

/**
 * 检测器配置
 */
export interface DetectorConfig {
  maxPromptLength: number;
  riskThresholdHigh: number; // 高风险阈值，超过此值拒绝请求
  riskThresholdMedium: number; // 中风险阈值，超过此值需要清洗
  enableEncodingBypassDetection: boolean;
  enableDataExfiltrationDetection: boolean;
  customRules: DetectionRule[];
  logAllDetections: boolean;
}

/**
 * 扩展的威胁类型
 */
export type ExtendedThreatType = ThreatType | 'encoding_bypass' | 'data_exfiltration';

/**
 * 扩展的威胁信息
 */
export interface ExtendedPromptThreat {
  type: ExtendedThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedPattern: string;
  position?: { start: number; end: number };
  context?: string;
}

/**
 * 扩展的分析结果
 */
export interface ExtendedPromptAnalysis {
  isSafe: boolean;
  threats: ExtendedPromptThreat[];
  riskScore: number;
  sanitizedPrompt: string;
  attackCategories: string[];
  recommendation: 'allow' | 'sanitize' | 'reject';
  metadata: {
    analyzedAt: Date;
    analysisVersion: string;
    promptLength: number;
    detectedPatterns: number;
  };
}

const DEFAULT_CONFIG: DetectorConfig = {
  maxPromptLength: 10000,
  riskThresholdHigh: 70,
  riskThresholdMedium: 30,
  enableEncodingBypassDetection: true,
  enableDataExfiltrationDetection: true,
  customRules: [],
  logAllDetections: true,
};

/**
 * 默认检测规则
 */
const DEFAULT_RULES: DetectionRule[] = [
  // 指令覆盖
  {
    id: 'instruction_override_1',
    name: 'Instruction Override - Ignore Previous',
    type: ThreatType.INSTRUCTION_OVERRIDE,
    patterns: [
      /ignore\s+.*\s*(instructions?|rules|constraints)/i,
      /disregard\s+.*\s*(instructions?|rules)/i,
      /forget\s+.*\s*(instructions?|rules)/i,
      /override\s+.*\s*(instructions?|rules)/i,
      /ignore\s+(all|previous|prior)/i, // 简化匹配
      /disregard\s+(all|any|previous|prior)/i,
    ],
    severity: 'critical',
    enabled: true,
    description: '尝试覆盖或忽略系统指令',
  },
  {
    id: 'instruction_override_2',
    name: 'Instruction Override - New Instructions',
    type: ThreatType.INSTRUCTION_OVERRIDE,
    patterns: [
      /new\s+instructions[:：]/i,
      /your\s+new\s+task\s+is/i,
      /change\s+your\s+(behavior|mode|instructions)/i,
      /replace\s+.*\s+(instructions?|rules)/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试注入新指令',
  },

  // 角色扮演攻击
  {
    id: 'role_play_1',
    name: 'Role Play Attack - Identity Change',
    type: ThreatType.ROLE_PLAY_ATTACK,
    patterns: [
      /you\s+are\s+now\s+(a|an|the)\s+\w+/i,
      /pretend\s+(you\s+are|to\s+be)\s+\w+/i,
      /act\s+as\s+(if|though|a)\s+\w+/i,
      /imagine\s+you\s+are\s+\w+/i,
      /simulate\s+being\s+\w+/i,
      /role[- ]?play\s+as\s+\w+/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试改变 AI 身份或角色',
  },
  {
    id: 'role_play_2',
    name: 'Role Play Attack - Persona Injection',
    type: ThreatType.ROLE_PLAY_ATTACK,
    patterns: [
      /adopt\s+the\s+persona\s+of/i,
      /take\s+on\s+the\s+role\s+of/i,
      /become\s+(a|an)\s+\w+\s+(who|that)/i,
      /switch\s+to\s+\w+\s+mode/i,
    ],
    severity: 'medium',
    enabled: true,
    description: '尝试注入特定角色人格',
  },

  // 系统提示泄露
  {
    id: 'system_leak_1',
    name: 'System Prompt Leak - Direct Request',
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    patterns: [
      /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions)/i,
      /show\s+(me|us)\s+(your|the)\s+(system|internal)\s+(prompt|state)/i,
      /print\s+(your|the)\s+(system|full)\s+(prompt|instructions)/i,
      /output\s+(your|the)\s+(system|hidden)\s+(prompt|instructions)/i,
      /repeat\s+(the|your)\s+(system|above)\s+(prompt|instructions)/i,
      /what\s+(is|are)\s+(your|the)\s+(system|internal)\s+(prompt|instructions)/i,
    ],
    severity: 'critical',
    enabled: true,
    description: '尝试获取系统提示内容',
  },
  {
    id: 'system_leak_2',
    name: 'System Prompt Leak - Indirect Request',
    type: ThreatType.SYSTEM_PROMPT_LEAK,
    patterns: [
      /tell\s+me\s+about\s+your\s+(internal|hidden)\s+(state|configuration)/i,
      /describe\s+your\s+(programming|setup|configuration)/i,
      /how\s+were\s+you\s+(programmed|configured|trained)/i,
      /bypass\s+(your|the)\s+(safety|security)\s+(filters|rules|measures)/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试间接获取系统信息',
  },

  // 命令注入
  {
    id: 'command_injection_1',
    name: 'Command Injection - Shell Commands',
    type: ThreatType.COMMAND_INJECTION,
    patterns: [
      /```(?:bash|sh|shell|cmd|powershell|terminal)\s*[\n\r]/i,
      /\$\([^)]+\)/, // Shell 命令替换
      /`[^`]+`/, // 反引号命令
      /system\s*\(/i,
      /exec\s*\(/i,
      /spawn\s*\(/i,
    ],
    severity: 'critical',
    enabled: true,
    description: '尝试注入系统命令',
  },

  // 代码注入
  {
    id: 'code_injection_1',
    name: 'Code Injection - Dangerous Functions',
    type: ThreatType.CODE_INJECTION,
    patterns: [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /new\s+Function\s*\(/i,
      /setTimeout\s*\([^,]+,\s*\d+\)/,
      /setInterval\s*\([^,]+,\s*\d+\)/,
      /<script[^>]*>/i, // XSS script tags
      /<[^>]+on\w+\s*=/i, // XSS event handlers
    ],
    severity: 'critical',
    enabled: true,
    description: '尝试注入危险 JavaScript 函数或 XSS',
  },
  {
    id: 'code_injection_2',
    name: 'Code Injection - Python/System',
    type: ThreatType.CODE_INJECTION,
    patterns: [
      /import\s+\w+/i,
      /__import__\s*\(/i,
      /os\.system\s*\(/i,
      /subprocess\s*\./i,
      /exec\s*\(/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试注入 Python 或系统代码',
  },

  // 编码绕过
  {
    id: 'encoding_bypass_1',
    name: 'Encoding Bypass - Base64',
    type: 'encoding_bypass',
    patterns: [
      /[A-Za-z0-9+/]{40,}={0,2}/, // 可能是 Base64 编码
      /base64[:：]\s*[A-Za-z0-9+/]+/i,
      /decode\s*\(\s*['"][A-Za-z0-9+/]+['"]\s*\)/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试使用 Base64 编码绕过检测',
  },
  {
    id: 'encoding_bypass_2',
    name: 'Encoding Bypass - Unicode/HTML',
    type: 'encoding_bypass',
    patterns: [
      /\\u[0-9a-fA-F]{4}/, // Unicode 转义
      /\\x[0-9a-fA-F]{2}/, // Hex 转义
      /&#\d+;/, // HTML 数字实体
      /&#x[0-9a-fA-F]+;/, // HTML 十六进制实体
      /&\w+;/, // HTML 实体
    ],
    severity: 'medium',
    enabled: true,
    description: '尝试使用编码绕过检测',
  },

  // 数据泄露
  {
    id: 'data_exfil_1',
    name: 'Data Exfiltration - Export Request',
    type: 'data_exfiltration',
    patterns: [
      /export\s+(all|the|your)\s+(data|information|records)/i,
      /download\s+(all|the)\s+(data|files|records)/i,
      /dump\s+(the|all)\s+(data|database|memory)/i,
      /copy\s+(all|the)\s+(data|information)/i,
    ],
    severity: 'high',
    enabled: true,
    description: '尝试导出数据',
  },
  {
    id: 'data_exfil_2',
    name: 'Data Exfiltration - Sensitive Info',
    type: 'data_exfiltration',
    patterns: [
      /show\s+(me|all)\s+(the|user|password|secret|api|key)\s+/i,
      /list\s+(all|every)\s+(user|password|secret|credential)/i,
      /reveal\s+(password|secret|key|credential|token)/i,
      /(password|secret|api[_-]?key|token)\s*[:：=]\s*\S+/i,
    ],
    severity: 'critical',
    enabled: true,
    description: '尝试获取敏感信息',
  },
];

/**
 * Prompt 注入检测器
 */
export class PromptInjectionDetector {
  private config: DetectorConfig;
  private baseSecurity: PromptSecurity;
  private rules: DetectionRule[];

  constructor(config?: Partial<DetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseSecurity = new PromptSecurity({
      maxPromptLength: this.config.maxPromptLength,
      enableCommandInjectionCheck: true,
      enableRolePlayCheck: true,
      enableSystemPromptLeakCheck: true,
      enableInstructionOverrideCheck: true,
    });
    this.rules = [...DEFAULT_RULES, ...this.config.customRules];
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: DetectionRule): void {
    this.rules.push(rule);
    // 按优先级排序（severity: critical > high > medium > low）
    this.rules.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   */
  getRules(): DetectionRule[] {
    return [...this.rules];
  }

  /**
   * 分析 Prompt 安全性
   */
  analyze(prompt: string): ExtendedPromptAnalysis {
    const startTime = Date.now();
    const threats: ExtendedPromptThreat[] = [];

    // 1. 使用基础安全检查
    const baseResult = this.baseSecurity.analyze(prompt);

    // 转换基础威胁为扩展威胁
    for (const threat of baseResult.threats) {
      threats.push({
        ...threat,
        position: this.findPatternPosition(prompt, threat.matchedPattern),
        context: this.extractContext(prompt, threat.matchedPattern),
      });
    }

    // 2. 应用自定义规则
    const ruleThreats = this.applyRules(prompt);
    threats.push(...ruleThreats);

    // 3. 检测编码绕过（如果启用）
    if (this.config.enableEncodingBypassDetection) {
      const encodingThreats = this.detectEncodingBypass(prompt);
      threats.push(...encodingThreats);
    }

    // 4. 检测数据泄露（如果启用）
    if (this.config.enableDataExfiltrationDetection) {
      const dataExfilThreats = this.detectDataExfiltration(prompt);
      threats.push(...dataExfilThreats);
    }

    // 5. 计算风险评分
    const riskScore = this.calculateExtendedRiskScore(threats);

    // 6. 确定建议操作
    const recommendation = this.getRecommendation(riskScore);

    // 7. 获取攻击类别
    const attackCategories = this.getAttackCategories(threats);

    // 8. 记录日志（如果启用）
    if (this.config.logAllDetections && threats.length > 0) {
      logger.warn({ traceId: getCurrentTraceId(),
        msg: 'Prompt injection detected',
        promptLength: prompt.length,
        riskScore,
        threatCount: threats.length,
        threatTypes: threats.map(t => t.type),
        recommendation,
      });
    }

    return {
      isSafe: riskScore < this.config.riskThresholdMedium,
      threats,
      riskScore,
      sanitizedPrompt: baseResult.sanitizedPrompt,
      attackCategories,
      recommendation,
      metadata: {
        analyzedAt: new Date(),
        analysisVersion: '2.0.0',
        promptLength: prompt.length,
        detectedPatterns: threats.length,
      },
    };
  }

  /**
   * 应用检测规则
   */
  private applyRules(prompt: string): ExtendedPromptThreat[] {
    const threats: ExtendedPromptThreat[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // 根据配置过滤规则
      if (rule.type === 'encoding_bypass' && !this.config.enableEncodingBypassDetection) continue;
      if (rule.type === 'data_exfiltration' && !this.config.enableDataExfiltrationDetection) continue;

      for (const pattern of rule.patterns) {
        pattern.lastIndex = 0; // 重置正则状态
        const match = pattern.exec(prompt);
        if (match) {
          threats.push({
            type: rule.type,
            severity: rule.severity,
            description: rule.description,
            matchedPattern: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            context: this.extractContext(prompt, match[0]),
          });
        }
      }
    }

    // 去重（同一个匹配可能被多个规则检测）
    return this.deduplicateThreats(threats);
  }

  /**
   * 检测编码绕过
   */
  private detectEncodingBypass(prompt: string): ExtendedPromptThreat[] {
    const threats: ExtendedPromptThreat[] = [];

    // Base64 检测
    const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g;
    let match;
    while ((match = base64Pattern.exec(prompt)) !== null) {
      // 尝试解码验证是否为有效 Base64
      try {
        const decoded = Buffer.from(match[0], 'base64').toString('utf-8');
        // 如果解码后包含敏感词，则标记为高风险
        if (/ignore|system|password|secret|bypass/i.test(decoded)) {
          threats.push({
            type: 'encoding_bypass',
            severity: 'critical',
            description: '检测到 Base64 编码的恶意内容',
            matchedPattern: match[0],
            position: { start: match.index, end: match.index + match[0].length },
            context: `解码内容: "${decoded.slice(0, 50)}..."`,
          });
        }
      } catch {
        // 无效 Base64，忽略
      }
    }

    // Unicode 转义检测
    const unicodePattern = /\\u[0-9a-fA-F]{4}/g;
    if (unicodePattern.test(prompt)) {
      threats.push({
        type: 'encoding_bypass',
        severity: 'medium',
        description: '检测到 Unicode 转义序列',
        matchedPattern: 'unicode_escape',
      });
    }

    return threats;
  }

  /**
   * 检测数据泄露尝试
   */
  private detectDataExfiltration(prompt: string): ExtendedPromptThreat[] {
    const threats: ExtendedPromptThreat[] = [];

    // 检测导出请求
    const exportPatterns = [
      /export\s+(all|the|your)\s+(data|information|records)/i,
      /download\s+(all|the)\s+(data|files)/i,
      /dump\s+(the|all)\s+(data|database)/i,
    ];

    for (const pattern of exportPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        threats.push({
          type: 'data_exfiltration',
          severity: 'high',
          description: '尝试导出或泄露数据',
          matchedPattern: match[0],
          position: this.findPatternPosition(prompt, match[0]),
        });
      }
    }

    // 检测敏感信息请求
    const sensitivePatterns = [
      /(password|secret|api[_-]?key|token|credential)\s*(list|show|reveal|print)/i,
      /show\s+me\s+(all|every)\s+(user|password)/i,
    ];

    for (const pattern of sensitivePatterns) {
      const match = prompt.match(pattern);
      if (match) {
        threats.push({
          type: 'data_exfiltration',
          severity: 'critical',
          description: '尝试获取敏感信息',
          matchedPattern: match[0],
          position: this.findPatternPosition(prompt, match[0]),
        });
      }
    }

    return threats;
  }

  /**
   * 计算扩展风险评分
   */
  private calculateExtendedRiskScore(threats: ExtendedPromptThreat[]): number {
    const severityWeights = {
      low: 5,
      medium: 15,
      high: 30,
      critical: 50,
    };

    let score = 0;

    // 1. 累加威胁严重程度
    for (const threat of threats) {
      score += severityWeights[threat.severity];
    }

    // 2. 考虑威胁多样性（多种类型攻击更危险）
    const uniqueTypes = new Set(threats.map(t => t.type));
    if (uniqueTypes.size >= 3) {
      score += 20; // 多种攻击类型额外加分
    }

    // 3. 考虑威胁数量
    if (threats.length >= 5) {
      score += 15; // 大量威胁额外加分
    }

    return Math.min(score, 100);
  }

  /**
   * 确定建议操作
   */
  private getRecommendation(riskScore: number): 'allow' | 'sanitize' | 'reject' {
    if (riskScore >= this.config.riskThresholdHigh) {
      return 'reject';
    }
    if (riskScore >= this.config.riskThresholdMedium) {
      return 'sanitize';
    }
    return 'allow';
  }

  /**
   * 获取攻击类别
   */
  private getAttackCategories(threats: ExtendedPromptThreat[]): string[] {
    const categories = new Set<string>();

    for (const threat of threats) {
      if (threat.type === ThreatType.COMMAND_INJECTION || threat.type === ThreatType.CODE_INJECTION) {
        categories.add('code_execution');
      } else if (threat.type === ThreatType.ROLE_PLAY_ATTACK) {
        categories.add('identity_manipulation');
      } else if (threat.type === ThreatType.INSTRUCTION_OVERRIDE) {
        categories.add('instruction_manipulation');
      } else if (threat.type === ThreatType.SYSTEM_PROMPT_LEAK || threat.type === 'data_exfiltration') {
        categories.add('information_disclosure');
      } else if (threat.type === 'encoding_bypass' || threat.type === ThreatType.TOKEN_SMUGGLING) {
        categories.add('bypass_technique');
      }
    }

    return Array.from(categories);
  }

  /**
   * 找到模式位置
   */
  private findPatternPosition(prompt: string, pattern: string): { start: number; end: number } {
    const index = prompt.indexOf(pattern);
    return {
      start: index,
      end: index + pattern.length,
    };
  }

  /**
   * 提取上下文
   */
  private extractContext(prompt: string, pattern: string, contextLength = 50): string {
    const index = prompt.indexOf(pattern);
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(prompt.length, index + pattern.length + contextLength);

    return prompt.slice(start, end);
  }

  /**
   * 去重威胁
   */
  private deduplicateThreats(threats: ExtendedPromptThreat[]): ExtendedPromptThreat[] {
    const seen = new Map<string, ExtendedPromptThreat>();

    for (const threat of threats) {
      const key = `${threat.type}:${threat.matchedPattern}`;
      if (!seen.has(key)) {
        seen.set(key, threat);
      } else {
        // 保留更高严重级别的威胁
        const existing = seen.get(key)!;
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (severityOrder[threat.severity] < severityOrder[existing.severity]) {
          seen.set(key, threat);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 快速检测（仅检查是否有威胁，不返回详细信息）
   */
  quickCheck(prompt: string): boolean {
    const analysis = this.analyze(prompt);
    return analysis.threats.length === 0;
  }

  /**
   * 获取配置
   */
  getConfig(): DetectorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default PromptInjectionDetector;