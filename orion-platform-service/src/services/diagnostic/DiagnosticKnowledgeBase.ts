/**
 * 诊断知识库
 *
 * 存储从历史事件中学到的诊断模式，支持症状匹配和经验积累
 *
 * Migration: Now supports PostgreSQL Repository for persistent pattern/outcome storage.
 * When db is provided, patterns and outcomes are persisted to PostgreSQL.
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
import {
  DiagnosticPatternRepository,
  DiagnosticPatternEntity,
} from '../../repositories/DiagnosticPatternRepository';
import {
  DiagnosticOutcomeRepository,
  DiagnosticOutcomeEntity,
} from '../../repositories/DiagnosticOutcomeRepository';

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
  private patternRepo: DiagnosticPatternRepository | null;
  private outcomeRepo: DiagnosticOutcomeRepository | null;
  /** In-memory fallback for patterns */
  private patterns: Map<string, DiagnosticPattern>;
  /** In-memory fallback for outcomes */
  private outcomes: Map<string, DiagnosticOutcome>;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.patterns = new Map();
    this.outcomes = new Map();
    this.patternRepo = db ? new DiagnosticPatternRepository(db) : null;
    this.outcomeRepo = db ? new DiagnosticOutcomeRepository(db) : null;
  }

  /**
   * 添加诊断模式
   */
  async addPattern(params: {
    name: string;
    symptoms: SymptomPattern[];
    rootCause: string;
    solution: string;
    category: DiagnosticCategory;
  }): Promise<DiagnosticPattern> {
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

    if (this.patternRepo) {
      try {
        const entity = await this.patternRepo.create({
          id: pattern.id,
          name: pattern.name,
          symptoms: pattern.symptoms,
          rootCause: pattern.rootCause,
          solution: pattern.solution,
          frequency: 0,
          category: pattern.category,
          averageConfidence: 0,
        });
        return this.entityToPattern(entity);
      } catch (err) {
        // Fall back to in-memory
      }
    }

    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  /**
   * 更新诊断模式
   */
  async updatePattern(
    patternId: string,
    updates: Partial<Omit<DiagnosticPattern, 'id' | 'createdAt'>>
  ): Promise<DiagnosticPattern | null> {
    if (this.patternRepo) {
      try {
        const existing = await this.patternRepo.findById(patternId);
        if (!existing) return null;
        const updated = await this.patternRepo.update(patternId, updates);
        if (!updated) return null;
        return this.entityToPattern(updated);
      } catch {
        // Fall back to in-memory
      }
    }

    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;

    Object.assign(pattern, updates);
    this.patterns.set(patternId, pattern);
    return pattern;
  }

  /**
   * 删除诊断模式
   */
  async deletePattern(patternId: string): Promise<boolean> {
    if (this.patternRepo) {
      try {
        return await this.patternRepo.delete(patternId);
      } catch {
        // Fall back to in-memory
      }
    }
    return this.patterns.delete(patternId);
  }

  /**
   * 根据 ID 获取模式
   */
  async getPattern(patternId: string): Promise<DiagnosticPattern | undefined> {
    if (this.patternRepo) {
      try {
        const entity = await this.patternRepo.findById(patternId);
        return entity ? this.entityToPattern(entity) : undefined;
      } catch {
        // Fall back to in-memory
      }
    }
    return this.patterns.get(patternId);
  }

  /**
   * 获取所有模式
   */
  async getAllPatterns(): Promise<DiagnosticPattern[]> {
    if (this.patternRepo) {
      try {
        const result = await this.patternRepo.findAll({ limit: 1000 });
        return result.entities.map(e => this.entityToPattern(e));
      } catch {
        // Fall back to in-memory
      }
    }
    return Array.from(this.patterns.values());
  }

  /**
   * 搜索模式
   */
  async searchPatterns(params: {
    category?: DiagnosticCategory;
    keyword?: string;
    minFrequency?: number;
    limit?: number;
  }): Promise<DiagnosticPattern[]> {
    if (this.patternRepo) {
      try {
        let results: DiagnosticPatternEntity[];
        if (params.keyword) {
          results = await this.patternRepo.searchByKeyword(params.keyword);
        } else if (params.category) {
          results = await this.patternRepo.findByCategory(params.category);
        } else {
          const allResult = await this.patternRepo.findAll({ limit: params.limit || 1000 });
          results = allResult.entities;
        }

        let patterns = results.map(e => this.entityToPattern(e));

        if (params.category && params.keyword) {
          patterns = patterns.filter(p => p.category === params.category);
        }
        if (params.minFrequency !== undefined) {
          patterns = patterns.filter(p => p.frequency >= params.minFrequency!);
        }

        patterns.sort((a, b) => b.frequency - a.frequency);

        if (params.limit) {
          patterns = patterns.slice(0, params.limit);
        }

        return patterns;
      } catch {
        // Fall back to in-memory
      }
    }

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

    results.sort((a, b) => b.frequency - a.frequency);

    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * 匹配症状，查找最相关的诊断模式
   */
  async matchSymptoms(symptoms: Symptom[]): Promise<KnowledgeBaseSearchResult[]> {
    let allPatterns: DiagnosticPattern[];

    if (this.patternRepo) {
      try {
        const result = await this.patternRepo.findAll({ limit: 1000 });
        allPatterns = result.entities.map(e => this.entityToPattern(e));
      } catch {
        allPatterns = Array.from(this.patterns.values());
      }
    } else {
      allPatterns = Array.from(this.patterns.values());
    }

    const results: KnowledgeBaseSearchResult[] = [];

    for (const pattern of allPatterns) {
      const { score, matched } = this.calculateMatchScore(pattern, symptoms);
      if (score > 0) {
        results.push({
          pattern,
          matchScore: score,
          matchedSymptoms: matched,
        });
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }

  /**
   * 记录诊断结果，用于模式学习
   */
  async recordOutcome(outcome: {
    sessionId: string;
    patternId: string;
    confirmed: boolean;
    actualRootCause?: string;
    fixTimeMs?: number;
  }): Promise<DiagnosticOutcome> {
    const recordedOutcome: DiagnosticOutcome = {
      sessionId: outcome.sessionId,
      patternId: outcome.patternId,
      confirmed: outcome.confirmed,
      actualRootCause: outcome.actualRootCause,
      fixTimeMs: outcome.fixTimeMs,
      recordedAt: new Date(),
    };

    if (this.outcomeRepo) {
      try {
        await this.outcomeRepo.create({
          id: uuidv4(),
          sessionId: outcome.sessionId,
          patternId: outcome.patternId,
          confirmed: outcome.confirmed,
          actualRootCause: outcome.actualRootCause,
          fixTimeMs: outcome.fixTimeMs,
          recordedAt: new Date(),
        });
      } catch {
        // Fall back to in-memory
        this.outcomes.set(outcome.sessionId, recordedOutcome);
      }
    } else {
      this.outcomes.set(outcome.sessionId, recordedOutcome);
    }

    // Update pattern frequency and confidence
    await this.updatePatternStats(outcome.patternId, outcome.confirmed);

    return recordedOutcome;
  }

  /**
   * 获取诊断结果
   */
  async getOutcome(sessionId: string): Promise<DiagnosticOutcome | undefined> {
    if (this.outcomeRepo) {
      try {
        const entity = await this.outcomeRepo.findBySessionId(sessionId);
        return entity ? this.entityToOutcome(entity) : undefined;
      } catch {
        // Fall back to in-memory
      }
    }
    return this.outcomes.get(sessionId);
  }

  /**
   * 获取所有结果
   */
  async getAllOutcomes(): Promise<DiagnosticOutcome[]> {
    if (this.outcomeRepo) {
      try {
        const result = await this.outcomeRepo.findAll({ limit: 10000 });
        return result.entities.map(e => this.entityToOutcome(e));
      } catch {
        // Fall back to in-memory
      }
    }
    return Array.from(this.outcomes.values());
  }

  /**
   * 从诊断会话中学习新模式
   *
   * 当确认根因后，自动从会话中提取新的诊断模式
   */
  async learnFromSession(params: {
    name: string;
    symptoms: Symptom[];
    rootCause: RootCause;
    solution: string;
    category: DiagnosticCategory;
  }): Promise<DiagnosticPattern> {
    // 从症状生成模式模板
    const symptomPatterns: SymptomPattern[] = params.symptoms.map((s) => ({
      type: s.type,
      sourcePattern: s.source ? `${s.source.split('-')[0]}*` : undefined,
      keywords: s.description.split(' ').filter((w) => w.length > 3),
      minSeverity: s.severity,
    }));

    const pattern = await this.addPattern({
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
  async getStats(): Promise<{
    totalPatterns: number;
    totalOutcomes: number;
    patternsByCategory: Record<string, number>;
    topPatterns: { name: string; frequency: number }[];
    averageConfirmationRate: number;
  }> {
    let allPatterns: DiagnosticPattern[];
    let allOutcomes: DiagnosticOutcome[];

    if (this.patternRepo) {
      try {
        const patternResult = await this.patternRepo.findAll({ limit: 10000 });
        allPatterns = patternResult.entities.map(e => this.entityToPattern(e));
      } catch {
        allPatterns = Array.from(this.patterns.values());
      }
    } else {
      allPatterns = Array.from(this.patterns.values());
    }

    if (this.outcomeRepo) {
      try {
        const outcomeResult = await this.outcomeRepo.findAll({ limit: 10000 });
        allOutcomes = outcomeResult.entities.map(e => this.entityToOutcome(e));
      } catch {
        allOutcomes = Array.from(this.outcomes.values());
      }
    } else {
      allOutcomes = Array.from(this.outcomes.values());
    }

    const patternsByCategory: Record<string, number> = {};
    for (const pattern of allPatterns) {
      patternsByCategory[pattern.category] = (patternsByCategory[pattern.category] || 0) + 1;
    }

    const topPatterns = allPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map((p) => ({ name: p.name, frequency: p.frequency }));

    const confirmedCount = allOutcomes.filter((o) => o.confirmed).length;
    const averageConfirmationRate =
      allOutcomes.length > 0 ? Math.round((confirmedCount / allOutcomes.length) * 100) : 0;

    return {
      totalPatterns: allPatterns.length,
      totalOutcomes: allOutcomes.length,
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
   * 更新模式统计
   */
  private async updatePatternStats(patternId: string, confirmed: boolean): Promise<void> {
    if (this.patternRepo) {
      try {
        await this.patternRepo.incrementFrequency(patternId);

        // Calculate new average confidence
        const outcomes = this.outcomeRepo
          ? await this.outcomeRepo.findByPatternId(patternId)
          : Array.from(this.outcomes.values()).filter(o => o.patternId === patternId);

        const confirmedCount = outcomes.filter(o => o.confirmed).length;
        const avgConfidence = outcomes.length > 0
          ? Math.round((confirmedCount / outcomes.length) * 100)
          : 0;
        await this.patternRepo.updateConfidence(patternId, avgConfidence);
        return;
      } catch {
        // Fall back to in-memory
      }
    }

    // In-memory fallback
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.frequency += 1;
      pattern.lastMatched = new Date();

      const relatedOutcomes = Array.from(this.outcomes.values()).filter(
        (o) => o.patternId === patternId
      );
      const confirmedCount = relatedOutcomes.filter((o) => o.confirmed).length;
      pattern.averageConfidence =
        relatedOutcomes.length > 0
          ? Math.round((confirmedCount / relatedOutcomes.length) * 100)
          : 0;

      this.patterns.set(patternId, pattern);
    }
  }

  /**
   * Convert repository entity to domain pattern
   */
  private entityToPattern(entity: DiagnosticPatternEntity): DiagnosticPattern {
    return {
      id: entity.id,
      name: entity.name,
      symptoms: entity.symptoms,
      rootCause: entity.rootCause,
      solution: entity.solution,
      frequency: entity.frequency,
      lastMatched: entity.lastMatched,
      category: entity.category,
      averageConfidence: entity.averageConfidence,
      createdAt: entity.createdAt,
    };
  }

  /**
   * Convert repository entity to domain outcome
   */
  private entityToOutcome(entity: DiagnosticOutcomeEntity): DiagnosticOutcome {
    return {
      sessionId: entity.sessionId,
      patternId: entity.patternId,
      confirmed: entity.confirmed,
      actualRootCause: entity.actualRootCause,
      fixTimeMs: entity.fixTimeMs,
      recordedAt: entity.recordedAt,
    };
  }

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
