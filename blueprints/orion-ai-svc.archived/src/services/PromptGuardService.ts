/**
 * PromptGuardService - AI Prompt 注入防护服务
 *
 * 轻量级统一入口,提供:
 * 1. 检测常见注入模式
 * 2. 风险评分
 * 3. Prompt 清洗
 *
 * 对接现有的 PromptSecurity、PromptInjectionDetector、PromptSanitizer
 */

import pino from 'pino';
import { PromptSecurity, ThreatType, PromptThreat, PromptAnalysis } from './PromptSecurity';
import { PromptInjectionDetector, ExtendedPromptAnalysis, DetectionRule } from './PromptInjectionDetector';
import { PromptSanitizer, SanitizationResult } from './PromptSanitizer';

const logger = pino({ name: 'prompt-guard', level: process.env.LOG_LEVEL || 'info' });

export interface GuardResult {
  safe: boolean;
  threats: string[];
  sanitizedPrompt?: string;
  riskScore?: number;
}

export interface DetailedGuardResult extends GuardResult {
  analysis: ExtendedPromptAnalysis;
  sanitization?: SanitizationResult;
  recommendation: 'allow' | 'sanitize' | 'reject';
}

export interface GuardConfig {
  maxPromptLength?: number;
  riskThresholdHigh?: number;
  riskThresholdMedium?: number;
  enableDetailedAnalysis?: boolean;
}

const DEFAULT_CONFIG: Required<GuardConfig> = {
  maxPromptLength: 10000,
  riskThresholdHigh: 70,
  riskThresholdMedium: 30,
  enableDetailedAnalysis: false,
};

export class PromptGuardService {
  private config: Required<GuardConfig>;
  private detector: PromptInjectionDetector;
  private sanitizer: PromptSanitizer;

  constructor(config?: GuardConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detector = new PromptInjectionDetector({
      maxPromptLength: this.config.maxPromptLength,
      riskThresholdHigh: this.config.riskThresholdHigh,
      riskThresholdMedium: this.config.riskThresholdMedium,
    });
    this.sanitizer = new PromptSanitizer();
  }

  /**
   * 快速检测 - 仅返回是否安全
   */
  async check(prompt: string): Promise<GuardResult> {
    const analysis = this.detector.quickCheck(prompt);
    return {
      safe: analysis,
      threats: analysis ? [] : ['Potential prompt injection detected'],
    };
  }

  /**
   * 检测并返回风险评分
   */
  async analyze(prompt: string): Promise<GuardResult> {
    const analysis = this.detector.analyze(prompt);
    return {
      safe: analysis.isSafe,
      threats: analysis.threats.map(t => `${t.type}: ${t.description}`),
      riskScore: analysis.riskScore,
    };
  }

  /**
   * 检测并清洗 Prompt
   * 如果风险过高,返回清洗后的版本
   */
  async sanitize(prompt: string): Promise<GuardResult> {
    const analysis = this.detector.analyze(prompt);

    if (analysis.isSafe) {
      return {
        safe: true,
        threats: [],
        sanitizedPrompt: prompt,
        riskScore: analysis.riskScore,
      };
    }

    const sanitization = this.sanitizer.sanitize(prompt, analysis.threats);

    return {
      safe: analysis.recommendation !== 'reject',
      threats: analysis.threats.map(t => `${t.type}: ${t.description}`),
      sanitizedPrompt: sanitization.sanitizedPrompt,
      riskScore: analysis.riskScore,
    };
  }

  /**
   * 详细分析 - 返回完整信息
   */
  async analyzeDetailed(prompt: string): Promise<DetailedGuardResult> {
    const analysis = this.detector.analyze(prompt);
    let sanitization: SanitizationResult | undefined;

    if (!analysis.isSafe && analysis.recommendation === 'sanitize') {
      sanitization = this.sanitizer.sanitize(prompt, analysis.threats);
    }

    return {
      safe: analysis.isSafe,
      threats: analysis.threats.map(t => `${t.type}: ${t.description}`),
      riskScore: analysis.riskScore,
      sanitizedPrompt: sanitization?.sanitizedPrompt,
      recommendation: analysis.recommendation,
      analysis,
      sanitization,
    };
  }

  /**
   * 验证并处理 - 用于路由中间件
   * 如果风险过高,拒绝请求
   * 如果有风险,自动清洗
   */
  async guard(prompt: string): Promise<{
    success: boolean;
    prompt: string;
    error?: string;
    riskScore?: number;
  }> {
    if (!prompt || typeof prompt !== 'string') {
      return {
        success: false,
        prompt: '',
        error: 'Prompt is required and must be a string',
      };
    }

    if (prompt.length > this.config.maxPromptLength) {
      return {
        success: false,
        prompt: '',
        error: `Prompt exceeds maximum length of ${this.config.maxPromptLength} characters`,
      };
    }

    const result = await this.sanitize(prompt);

    if (!result.safe && result.riskScore && result.riskScore >= this.config.riskThresholdHigh) {
      logger.warn({ riskScore: result.riskScore, threats: result.threats }, 'Prompt rejected due to high risk');
      return {
        success: false,
        prompt: result.sanitizedPrompt || prompt,
        error: 'PROMPT_RISK_TOO_HIGH',
        riskScore: result.riskScore,
      };
    }

    return {
      success: true,
      prompt: result.sanitizedPrompt || prompt,
      riskScore: result.riskScore,
    };
  }

  /**
   * 添加自定义检测规则
   */
  addRule(rule: DetectionRule): void {
    this.detector.addRule(rule);
  }

  /**
   * 获取配置
   */
  getConfig(): GuardConfig {
    return { ...this.config };
  }
}

export default PromptGuardService;