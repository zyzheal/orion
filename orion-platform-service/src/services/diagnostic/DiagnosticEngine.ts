/**
 * 诊断引擎 - 核心诊断逻辑
 *
 * 职责：
 * - 基于决策树的诊断流程
 * - 症状关联与聚类分析
 * - 根因识别与置信度评分
 * - 诊断会话管理
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DiagnosticSession,
  Symptom,
  Finding,
  RootCause,
  RecommendedAction,
  DiagnosticSessionStatus,
  DiagnosticTriggerType,
  DiagnosticCategory,
  SymptomSeverity,
} from './types';
import {
  DiagnosticDecisionTree,
  createDefaultDiagnosticDecisionTree,
  DecisionTreeResult,
} from './DiagnosticDecisionTree';
import { DiagnosticKnowledgeBase, KnowledgeBaseSearchResult } from './DiagnosticKnowledgeBase';
import { OrionError, ErrorCode } from '../../../errors';

/**
 * 症状聚类结果
 */
export interface SymptomCluster {
  /** 聚类 ID */
  id: string;
  /** 聚类中的症状 */
  symptoms: Symptom[];
  /** 共同类别 */
  commonCategory: DiagnosticCategory;
  /** 最高严重程度 */
  maxSeverity: SymptomSeverity;
}

/**
 * 诊断引擎配置
 */
export interface DiagnosticEngineConfig {
  /** 使用自定义决策树 */
  decisionTree?: DiagnosticDecisionTree;
  /** 使用自定义知识库 */
  knowledgeBase?: DiagnosticKnowledgeBase;
  /** 是否使用默认决策树 */
  useDefaultTree?: boolean;
}

/**
 * 诊断引擎
 */
export class DiagnosticEngine {
  private sessions: Map<string, DiagnosticSession>;
  private decisionTree: DiagnosticDecisionTree;
  private knowledgeBase: DiagnosticKnowledgeBase;

  constructor(config?: DiagnosticEngineConfig) {
    this.sessions = new Map();
    this.decisionTree =
      config?.decisionTree ||
      (config?.useDefaultTree !== false ? createDefaultDiagnosticDecisionTree() : new DiagnosticDecisionTree());
    this.knowledgeBase = config?.knowledgeBase || new DiagnosticKnowledgeBase();
  }

  /**
   * 启动诊断会话
   */
  startDiagnostic(params: {
    triggerType: DiagnosticTriggerType;
    triggerId: string;
    initialSymptoms: Symptom[];
    tenantId?: string;
  }): DiagnosticSession {
    const session: DiagnosticSession = {
      id: uuidv4(),
      triggerType: params.triggerType,
      triggerId: params.triggerId,
      symptoms: params.initialSymptoms.map((s) => ({
        ...s,
        timestamp: s.timestamp || new Date(),
      })),
      findings: [],
      rootCause: null,
      confidence: 0,
      status: 'running',
      createdAt: new Date(),
      tenantId: params.tenantId,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * 添加症状到诊断会话
   */
  addSymptom(sessionId: string, symptom: Symptom): DiagnosticSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Diagnostic session ${sessionId} not found`);
    }

    const newSymptom: Symptom = {
      ...symptom,
      timestamp: symptom.timestamp || new Date(),
    };

    session.symptoms.push(newSymptom);
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 症状关联与聚类分析
   *
   * 将相关症状分组，识别共同模式和影响范围
   */
  correlateSymptoms(sessionId: string): {
    clusters: SymptomCluster[];
    findings: Finding[];
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Diagnostic session ${sessionId} not found`);
    }

    const symptoms = session.symptoms;
    const clusters = this.clusterSymptoms(symptoms);
    const findings = this.generateFindings(clusters, symptoms);

    // 更新会话的发现
    session.findings = findings;
    this.sessions.set(sessionId, session);

    return { clusters, findings };
  }

  /**
   * 识别根因
   *
   * 结合决策树评估和知识库匹配，确定最可能的根因
   */
  identifyRootCause(sessionId: string): DiagnosticSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Diagnostic session ${sessionId} not found`);
    }

    if (session.symptoms.length === 0) {
      session.status = 'failed';
      session.rootCause = {
        description: 'No symptoms provided for diagnosis',
        category: 'unknown',
        confidence: 0,
        evidence: [],
        recommendedActions: [],
      };
      session.confidence = 0;
      this.sessions.set(sessionId, session);
      return session;
    }

    // 1. 决策树评估
    const treeResult = this.decisionTree.evaluate(session.symptoms);

    // 2. 知识库匹配
    const kbResults = this.knowledgeBase.matchSymptoms(session.symptoms);

    // 3. 综合评估根因
    const rootCause = this.synthesizeRootCause(treeResult, kbResults, session.symptoms);

    session.rootCause = rootCause.rootCause;
    session.confidence = rootCause.confidence;

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 完成诊断会话
   */
  completeDiagnostic(sessionId: string): DiagnosticSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Diagnostic session ${sessionId} not found`);
    }

    // 如果还未识别根因，先执行
    if (!session.rootCause && session.status === 'running') {
      this.identifyRootCause(sessionId);
    }

    session.status = 'completed';
    session.completedAt = new Date();
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取诊断会话
   */
  getSession(sessionId: string): DiagnosticSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取诊断历史
   */
  getDiagnosticHistory(params?: {
    triggerType?: DiagnosticTriggerType;
    triggerId?: string;
    tenantId?: string;
    status?: DiagnosticSessionStatus;
    since?: Date;
    limit?: number;
  }): DiagnosticSession[] {
    let results = Array.from(this.sessions.values());

    if (params?.triggerType) {
      results = results.filter((s) => s.triggerType === params.triggerType);
    }
    if (params?.triggerId) {
      results = results.filter((s) => s.triggerId === params.triggerId);
    }
    if (params?.tenantId) {
      results = results.filter((s) => s.tenantId === params.tenantId);
    }
    if (params?.status) {
      results = results.filter((s) => s.status === params.status);
    }
    if (params?.since) {
      results = results.filter((s) => s.createdAt >= params.since!);
    }

    // 按创建时间倒序
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (params?.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * 获取决策树实例
   */
  getDecisionTree(): DiagnosticDecisionTree {
    return this.decisionTree;
  }

  /**
   * 获取知识库实例
   */
  getKnowledgeBase(): DiagnosticKnowledgeBase {
    return this.knowledgeBase;
  }

  /**
   * 清空会话历史（用于测试）
   */
  clearSessions(): void {
    this.sessions.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 症状聚类
   *
   * 将症状按来源和类型进行聚类，识别相关的症状组
   */
  private clusterSymptoms(symptoms: Symptom[]): SymptomCluster[] {
    const clusters: SymptomCluster[] = [];

    // 按来源前缀聚类
    const sourceGroups = new Map<string, Symptom[]>();
    for (const symptom of symptoms) {
      const prefix = symptom.source.split('-')[0] || symptom.source;
      if (!sourceGroups.has(prefix)) {
        sourceGroups.set(prefix, []);
      }
      sourceGroups.get(prefix)!.push(symptom);
    }

    for (const [prefix, groupSymptoms] of sourceGroups) {
      const severityOrder: Record<string, number> = {
        info: 0,
        warning: 1,
        error: 2,
        critical: 3,
      };
      const reverseSeverity: Record<number, SymptomSeverity> = {
        0: 'info',
        1: 'warning',
        2: 'error',
        3: 'critical',
      };

      let maxSevLevel = 0;
      for (const s of groupSymptoms) {
        const level = severityOrder[s.severity] ?? 0;
        if (level > maxSevLevel) maxSevLevel = level;
      }

      // 推断共同类别
      const categoryCounts = new Map<string, number>();
      for (const s of groupSymptoms) {
        const cat = this.inferCategoryFromSymptom(s);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
      let commonCategory = 'infrastructure' as DiagnosticCategory;
      let maxCount = 0;
      for (const [cat, count] of categoryCounts) {
        if (count > maxCount) {
          maxCount = count;
          commonCategory = cat as DiagnosticCategory;
        }
      }

      clusters.push({
        id: uuidv4(),
        symptoms: groupSymptoms,
        commonCategory,
        maxSeverity: reverseSeverity[maxSevLevel] || 'info',
      });
    }

    return clusters;
  }

  /**
   * 从症状推断类别
   */
  private inferCategoryFromSymptom(symptom: Symptom): string {
    const type = symptom.type.toLowerCase();
    const source = symptom.source.toLowerCase();
    const desc = symptom.description.toLowerCase();

    if (type.includes('database') || type.includes('query') || source.includes('db') || desc.includes('database')) {
      return 'database';
    }
    if (type.includes('network') || desc.includes('network') || desc.includes('connection')) {
      return 'network';
    }
    if (type.includes('deploy') || type.includes('container') || type.includes('image')) {
      return 'deployment';
    }
    if (type.includes('pipeline') || type.includes('stage') || type.includes('task')) {
      return 'pipeline';
    }
    if (type.includes('security') || desc.includes('auth') || desc.includes('permission')) {
      return 'security';
    }
    if (type.includes('performance') || type.includes('slow') || desc.includes('latency')) {
      return 'performance';
    }
    if (type.includes('config') || desc.includes('config')) {
      return 'configuration';
    }
    return 'infrastructure';
  }

  /**
   * 生成诊断发现
   *
   * 基于症状聚类生成中间诊断结论
   */
  private generateFindings(clusters: SymptomCluster[], symptoms: Symptom[]): Finding[] {
    const findings: Finding[] = [];

    for (const cluster of clusters) {
      const evidence = cluster.symptoms.map((s) => s.description);
      const relatedSymptomTypes = cluster.symptoms.map((s) => s.type);

      findings.push({
        description: `Detected ${cluster.symptoms.length} related symptoms from source "${cluster.symptoms[0].source.split('-')[0]}" with ${cluster.maxSeverity} severity in ${cluster.commonCategory} category`,
        category: cluster.commonCategory,
        evidence,
        severity: cluster.maxSeverity,
        relatedSymptoms: relatedSymptomTypes,
      });
    }

    // 添加跨聚类发现
    if (clusters.length > 1) {
      const affectedSources = clusters.map((c) => c.symptoms[0].source.split('-')[0]);
      findings.push({
        description: `Multiple components affected: ${affectedSources.join(', ')}. This suggests a systemic issue rather than an isolated component failure.`,
        category: 'infrastructure',
        evidence: symptoms.map((s) => s.description),
        severity: 'critical',
        relatedSymptoms: symptoms.map((s) => s.type),
      });
    }

    return findings;
  }

  /**
   * 综合评估根因
   *
   * 结合决策树结果和知识库匹配，生成综合根因分析
   */
  private synthesizeRootCause(
    treeResult: DecisionTreeResult,
    kbResults: KnowledgeBaseSearchResult[],
    symptoms: Symptom[]
  ): { rootCause: RootCause; confidence: number } {
    const treeRootCause = treeResult.rootCause;
    const bestKbMatch = kbResults.length > 0 ? kbResults[0] : null;

    // 如果有知识库匹配且置信度高，优先使用
    if (bestKbMatch && bestKbMatch.matchScore >= 60) {
      const pattern = bestKbMatch.pattern;
      const kbRootCause: RootCause = {
        description: pattern.rootCause,
        category: pattern.category,
        confidence: Math.min(95, pattern.averageConfidence + Math.round(bestKbMatch.matchScore * 0.3)),
        evidence: [
          `Pattern "${pattern.name}" matched with ${bestKbMatch.matchScore}% confidence`,
          `Pattern has been seen ${pattern.frequency} times previously`,
          ...bestKbMatch.matchedSymptoms.map((s) => `Symptom: ${s.description}`),
        ],
        recommendedActions: [
          {
            description: pattern.solution,
            actionType: 'fix',
            priority: bestKbMatch.matchScore >= 80 ? 'critical' : 'high',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
          },
        ],
      };

      // 如果决策树也有结果，融合证据
      if (treeRootCause) {
        kbRootCause.evidence.push(`Decision tree also suggests: ${treeRootCause.description}`);
        // 取两者的平均置信度
        kbRootCause.confidence = Math.round(
          (kbRootCause.confidence + treeRootCause.confidence) / 2
        );
        // 合并推荐动作
        kbRootCause.recommendedActions.push(...treeRootCause.recommendedActions.slice(0, 2));
      }

      return { rootCause: kbRootCause, confidence: kbRootCause.confidence };
    }

    // 否则使用决策树结果
    if (treeRootCause) {
      return { rootCause: treeRootCause, confidence: treeRootCause.confidence };
    }

    // 都没有匹配的结果
    return {
      rootCause: {
        description: 'Unable to determine root cause from available symptoms',
        category: 'unknown',
        confidence: 0,
        evidence: symptoms.map((s) => `Symptom: ${s.description}`),
        recommendedActions: [
          {
            description: 'Manual investigation required - escalate to on-call engineer',
            actionType: 'notify',
            priority: 'high',
            estimatedTimeMs: 900000,
            automationLevel: 'manual',
          },
        ],
      },
      confidence: 0,
    };
  }
}
