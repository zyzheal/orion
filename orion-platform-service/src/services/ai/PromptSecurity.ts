/**
 * PromptSecurity - AI prompt injection protection
 * Detects 6 threat types: command_injection, role_play_attack, system_prompt_leak,
 * token_smuggling, code_injection, instruction_override
 */
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface PromptAnalysis {
  isSafe: boolean;
  threats: PromptThreat[];
  riskScore: number; // 0-100
  sanitizedPrompt: string;
}

export interface PromptThreat {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedPattern: string;
}

export enum ThreatType {
  COMMAND_INJECTION = 'command_injection',
  ROLE_PLAY_ATTACK = 'role_play_attack',
  SYSTEM_PROMPT_LEAK = 'system_prompt_leak',
  TOKEN_SMUGGLING = 'token_smuggling',
  CODE_INJECTION = 'code_injection',
  INSTRUCTION_OVERRIDE = 'instruction_override',
}

export interface PromptSecurityConfig {
  maxPromptLength?: number;
  enableCommandInjectionCheck?: boolean;
  enableRolePlayCheck?: boolean;
  enableSystemPromptLeakCheck?: boolean;
  enableInstructionOverrideCheck?: boolean;
  customBlocklist?: string[];
}

const DEFAULT_BLOCKLIST = [
  'ignore previous instructions',
  'disregard all prior',
  'you are now',
  'pretend you are',
  'system prompt',
  'your instructions',
  'reveal your',
  'bypass safety',
];

export class PromptSecurity {
  private config: Required<PromptSecurityConfig>;

  constructor(config?: PromptSecurityConfig) {
    this.config = {
      maxPromptLength: config?.maxPromptLength || 10000,
      enableCommandInjectionCheck: config?.enableCommandInjectionCheck ?? true,
      enableRolePlayCheck: config?.enableRolePlayCheck ?? true,
      enableSystemPromptLeakCheck: config?.enableSystemPromptLeakCheck ?? true,
      enableInstructionOverrideCheck: config?.enableInstructionOverrideCheck ?? true,
      customBlocklist: config?.customBlocklist || DEFAULT_BLOCKLIST,
    };
  }

  /**
   * Analyze prompt security
   */
  analyze(prompt: string): PromptAnalysis {
    const threats: PromptThreat[] = [];

    // Length check
    if (prompt.length > this.config.maxPromptLength) {
      threats.push({
        type: ThreatType.TOKEN_SMUGGLING,
        severity: 'medium',
        description: `Prompt exceeds max length (${prompt.length} > ${this.config.maxPromptLength})`,
        matchedPattern: `length:${prompt.length}`,
      });
    }

    // Instruction override attack
    if (this.config.enableInstructionOverrideCheck) {
      const lower = prompt.toLowerCase();
      for (const pattern of this.config.customBlocklist) {
        if (lower.includes(pattern.toLowerCase())) {
          threats.push({
            type: ThreatType.INSTRUCTION_OVERRIDE,
            severity: 'high',
            description: 'Instruction override attempt detected',
            matchedPattern: pattern,
          });
        }
      }
    }

    // Role-play attack
    if (this.config.enableRolePlayCheck) {
      const rolePlayPatterns = [/you are now\s+\w+/i, /pretend (you are|to be)/i, /act as/i];
      for (const pattern of rolePlayPatterns) {
        const match = prompt.match(pattern);
        if (match) {
          threats.push({
            type: ThreatType.ROLE_PLAY_ATTACK,
            severity: 'medium',
            description: 'Role-play attack detected',
            matchedPattern: match[0],
          });
        }
      }
    }

    // System prompt leak
    if (this.config.enableSystemPromptLeakCheck) {
      const leakPatterns = [/system prompt/i, /your instructions/i, /reveal your/i, /bypass/i];
      for (const pattern of leakPatterns) {
        const match = prompt.match(pattern);
        if (match) {
          threats.push({
            type: ThreatType.SYSTEM_PROMPT_LEAK,
            severity: 'high',
            description: 'System prompt leak attempt detected',
            matchedPattern: match[0],
          });
        }
      }
    }

    // Command injection
    if (this.config.enableCommandInjectionCheck) {
      const cmdPatterns = [/```(?:bash|sh|shell|cmd)/i, /\$\(/, /`[^`]+`/, /eval\(/];
      for (const pattern of cmdPatterns) {
        const match = prompt.match(pattern);
        if (match) {
          threats.push({
            type: ThreatType.COMMAND_INJECTION,
            severity: 'critical',
            description: 'Command injection detected',
            matchedPattern: match[0],
          });
        }
      }
    }

    const riskScore = this.calculateRiskScore(threats);
    const isSafe = riskScore < 30;

    return {
      isSafe,
      threats,
      riskScore,
      sanitizedPrompt: this.sanitize(prompt),
    };
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(threats: PromptThreat[]): number {
    const severityWeights = { low: 5, medium: 15, high: 30, critical: 50 };
    let score = 0;
    for (const threat of threats) {
      score += severityWeights[threat.severity];
    }
    return Math.min(score, 100);
  }

  /**
   * Sanitize prompt (remove suspicious patterns)
   */
  private sanitize(prompt: string): string {
    let sanitized = prompt;
    sanitized = sanitized.replace(/```(?:bash|sh|shell|cmd)[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
    return sanitized;
  }
}
