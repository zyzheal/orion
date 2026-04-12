/**
 * 诊断知识库
 *
 * 存储从历史事件中学到的诊断模式，支持症状匹配和经验积累
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DiagnosticPattern,
  SymptomPattern,
  Symptom,
  DiagnosticOutcome,
  DiagnosticCategory,
  SymptomSeverity,
  RootCause,
} from './types';

/**
 * 知识库搜索结果
 */
export interface KnowledgeBaseSearchResult {
  /** 匹配的模式 */
  pattern: DiagnosticPattern;
  /** 匹配度 (0-100) */
  matchScore: number;
  /** 匹配的症状 */
  matchedSymptoms: Symptom[];
}

/**
 * 诊断知识库
 */
export class DiagnosticKnowledgeBase {
  private patterns: Map<string, DiagnosticPattern>;
  private outcomes: Map<string, DiagnosticOutcome>;

  constructor() {
    this.patterns = new Map();
    this.outcomes = new Map();
  }

  /**
   * 添加诊断模式
   */
  addPattern(params: {
    name: string;
    symptoms: SymptomPattern[];
    rootCause: string;
    solution: string;
    category: DiagnosticCategory;
  }): DiagnosticPattern {
    const pattern: DiagnosticPattern = {
      id: uuidv4(),
      name: params.name,
      symptoms: params.symptoms,
      rootCause: params.rootCause,
      solution: params.solution,
      frequency: 0,
      category: params.category,
      averageConfidence: 0,
      createdAt: new Date(),
    };

    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  /**
   * 更新诊断模式
   */
  updatePattern(
    patternId: string,
    updates: Partial<Omit<DiagnosticPattern, 'id' | 'createdAt'>>
  ): DiagnosticPattern | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;

    Object.assign(pattern, updates);
    this.patterns.set(patternId, pattern);
    return pattern;
  }

  /**
   * 删除诊断模式
   */
  deletePattern(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * 根据 ID 获取模式
   */
  getPattern(patternId: string): DiagnosticPattern | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * 获取所有模式
   */
  getAllPatterns(): DiagnosticPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 搜索模式
   */
  searchPatterns(params: {
    category?: DiagnosticCategory;
    keyword?: string;
    minFrequency?: number;
    limit?: number;
  }): DiagnosticPattern[] {
    let results = Array.from(this.patterns.values());

    if (params.category) {
      results = results.filter((p) => p.category === params.category);
    }

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.rootCause.toLowerCase().includes(keyword) ||
          p.solution.toLowerCase().includes(keyword)
      );
    }

    if (params.minFrequency !== undefined) {
      results = results.filter((p) => p.frequency >= params.minFrequency!);
    }

    // 按频率排序
    results.sort((a, b) => b.frequency - a.frequency);

    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * 匹配症状，查找最相关的诊断模式
   */
  matchSymptoms(symptoms: Symptom[]): KnowledgeBaseSearchResult[] {
    const results: KnowledgeBaseSearchResult[] = [];

    for (const pattern of this.patterns.values()) {
      const { score, matched } = this.calculateMatchScore(pattern, symptoms);
      if (score > 0) {
        results.push({
          pattern,
          matchScore: score,
          matchedSymptoms: matched,
        });
      }
    }

    // 按匹配度排序
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }

  /**
   * 记录诊断结果，用于模式学习
   */
  recordOutcome(outcome: {
    sessionId: string;
    patternId: string;
    confirmed: boolean;
    actualRootCause?: string;
    fixTimeMs?: number;
  }): DiagnosticOutcome {
    const recordedOutcome: DiagnosticOutcome = {
      sessionId: outcome.sessionId,
      patternId: outcome.patternId,
      confirmed: outcome.confirmed,
      actualRootCause: outcome.actualRootCause,
      fixTimeMs: outcome.fixTimeMs,
      recordedAt: new Date(),
    };

    this.outcomes.set(outcome.sessionId, recordedOutcome);

    // 更新模式的频率和置信度
    const pattern = this.patterns.get(outcome.patternId);
    if (pattern) {
      pattern.frequency += 1;
      pattern.lastMatched = new Date();

      // 更新平均置信度
      const relatedOutcomes = Array.from(this.outcomes.values()).filter(
        (o) => o.patternId === outcome.patternId
      );
      const confirmedCount = relatedOutcomes.filter((o) => o.confirmed).length;
      pattern.averageConfidence =
        relatedOutcomes.length > 0
          ? Math.round((confirmedCount / relatedOutcomes.length) * 100)
          : 0;

      this.patterns.set(outcome.patternId, pattern);
    }

    return recordedOutcome;
  }

  /**
   * 获取诊断结果
   */
  getOutcome(sessionId: string): DiagnosticOutcome | undefined {
    return this.outcomes.get(sessionId);
  }

  /**
   * 获取所有结果
   */
  getAllOutcomes(): DiagnosticOutcome[] {
    return Array.from(this.outcomes.values());
  }

  /**
   * 从诊断会话中学习新模式
   *
   * 当确认根因后，自动从会话中提取新的诊断模式
   */
  learnFromSession(params: {
    name: string;
    symptoms: Symptom[];
    rootCause: RootCause;
    solution: string;
    category: DiagnosticCategory;
  }): DiagnosticPattern {
    // 从症状生成模式模板
    const symptomPatterns: SymptomPattern[] = params.symptoms.map((s) => ({
      type: s.type,
      sourcePattern: s.source ? `${s.source.split('-')[0]}*` : undefined,
      keywords: s.description.split(' ').filter((w) => w.length > 3),
      minSeverity: s.severity,
    }));

    const pattern = this.addPattern({
      name: params.name,
      symptoms: symptomPatterns,
      rootCause: params.rootCause.description,
      solution: params.solution,
      category: params.category,
    });

    return pattern;
  }

  /**
   * 获取模式统计信息
   */
  getStats(): {
    totalPatterns: number;
    totalOutcomes: number;
    patternsByCategory: Record<string, number>;
    topPatterns: { name: string; frequency: number }[];
    averageConfirmationRate: number;
  } {
    const patternsByCategory: Record<string, number> = {};
    for (const pattern of this.patterns.values()) {
      patternsByCategory[pattern.category] = (patternsByCategory[pattern.category] || 0) + 1;
    }

    const topPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map((p) => ({ name: p.name, frequency: p.frequency }));

    const outcomes = Array.from(this.outcomes.values());
    const confirmedCount = outcomes.filter((o) => o.confirmed).length;
    const averageConfirmationRate =
      outcomes.length > 0 ? Math.round((confirmedCount / outcomes.length) * 100) : 0;

    return {
      totalPatterns: this.patterns.size,
      totalOutcomes: outcomes.length,
      patternsByCategory,
      topPatterns,
      averageConfirmationRate,
    };
  }

  /**
   * 清空知识库（用于测试）
   */
  clear(): void {
    this.patterns.clear();
    this.outcomes.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 计算模式与症状的匹配度
   */
  private calculateMatchScore(
    pattern: DiagnosticPattern,
    symptoms: Symptom[]
  ): { score: number; matched: Symptom[] } {
    const matched: Symptom[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const symptomPattern of pattern.symptoms) {
      maxPossibleScore += 100;

      // 查找最佳匹配的症状
      let bestSymptomScore = 0;
      let bestMatchedSymptom: Symptom | null = null;

      for (const symptom of symptoms) {
        let score = 0;

        // 类型匹配（最高权重）
        if (symptom.type === symptomPattern.type) {
          score += 50;
        }

        // 来源模式匹配
        if (symptomPattern.sourcePattern) {
          const regex = new RegExp(
            '^' + symptomPattern.sourcePattern.replace(/\*/g, '.*') + '$'
          );
          if (regex.test(symptom.source)) {
            score += 20;
          }
        }

        // 关键词匹配
        if (symptomPattern.keywords && symptomPattern.keywords.length > 0) {
          const description = symptom.description.toLowerCase();
          const matchedKeywords = symptomPattern.keywords.filter((kw) =>
            description.includes(kw.toLowerCase())
          );
          score += (matchedKeywords.length / symptomPattern.keywords.length) * 20;
        }

        // 严重程度匹配
        if (symptomPattern.minSeverity) {
          const severityOrder: Record<string, number> = {
            info: 0,
            warning: 1,
            error: 2,
            critical: 3,
          };
          const symptomLevel = severityOrder[symptom.severity] ?? 0;
          const requiredLevel = severityOrder[symptomPattern.minSeverity] ?? 0;
          if (symptomLevel >= requiredLevel) {
            score += 10;
          }
        }

        if (score > bestSymptomScore) {
          bestSymptomScore = score;
          bestMatchedSymptom = symptom;
        }
      }

      if (bestSymptomScore > 30) {
        // 阈值：至少 30 分才算匹配
        totalScore += bestSymptomScore;
        if (bestMatchedSymptom) {
          matched.push(bestMatchedSymptom);
        }
      }
    }

    const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    return { score: finalScore, matched };
  }
}
