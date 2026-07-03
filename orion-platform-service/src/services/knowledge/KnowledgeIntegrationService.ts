/**
 * KnowledgeIntegrationService - 知识库集成服务
 *
 * 将知识库集成到审批/部署/自愈等主流程中，提供：
 * - 审批建议：基于历史审批案例提供参考
 * - 部署最佳实践：基于部署类型和环境推荐最佳实践
 * - 故障解决方案：基于症状/指标推荐故障处理方案
 *
 * 封装 KnowledgeService 和 KnowledgeBaseService，为上层业务服务提供统一的知识检索接口。
 */

import { createLogger } from '../utils/logger';
import { KnowledgeService, KnowledgeSearchResult } from './KnowledgeService';
import { KnowledgeBaseService, KBQuery, KBRecommendation } from '../self-healing/KnowledgeBaseService';
import { DatabasePool } from '../database';

const logger = pino({ name: 'KnowledgeIntegration' });

export interface KnowledgeRecommendation {
  source: 'knowledge' | 'knowledge-base';
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalKnowledgeContext {
  title: string;
  description?: string;
  resourceType?: string;
  environment?: string;
  riskLevel?: string;
}

export interface DeploymentKnowledgeContext {
  environment: string;
  strategy: string;
  projectId?: string;
  description?: string;
}

export interface HealingKnowledgeContext {
  incidentType: string;
  severity: string;
  symptoms?: string[];
  affectedComponent?: string;
}

export class KnowledgeIntegrationService {
  private knowledgeService: KnowledgeService;
  private knowledgeBaseService: KnowledgeBaseService;

  constructor(database: DatabasePool) {
    const repository = database; // KnowledgeService expects repository with pool methods
    this.knowledgeService = new KnowledgeService(repository as any);
    this.knowledgeBaseService = new KnowledgeBaseService(database);
  }

  /**
   * 为审批流程提供知识推荐
   * 基于审批标题/描述/类型查询历史相似审批案例和最佳实践
   */
  async getApprovalRecommendations(
    tenantId: string,
    context: ApprovalKnowledgeContext,
    limit: number = 5
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // 1. 从通用知识库搜索相关文档
    const searchQuery = [
      context.title,
      context.description || '',
      context.resourceType || '',
      'approval',
      'best practice',
    ].filter(Boolean).join(' ');

    try {
      const docs = await this.knowledgeService.search(tenantId, searchQuery, { limit: limit * 2 });
      for (const doc of docs) {
        recommendations.push({
          source: 'knowledge',
          id: doc.id,
          title: doc.title,
          content: doc.content,
          relevanceScore: doc.similarity,
          tags: doc.tags,
          metadata: { spaceId: doc.space_id },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to search knowledge docs for approval');
    }

    // 2. 从知识库模式库获取审批相关模式
    try {
      const kbRecommendations = this.knowledgeBaseService.query({
        keywords: ['approval', 'change', 'deployment', context.resourceType],
        category: 'deployment',
        limit: limit,
      });

      for (const rec of kbRecommendations) {
        recommendations.push({
          source: 'knowledge-base',
          id: rec.pattern.id,
          title: rec.pattern.name,
          content: rec.pattern.remediationSteps.map(s => s.action).join('\n'),
          relevanceScore: rec.confidence,
          tags: rec.pattern.symptoms,
          metadata: {
            category: rec.pattern.category,
            successRate: rec.pattern.successRate,
            avgRecoveryTime: rec.pattern.avgRecoveryTime,
          },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to query knowledge base for approval');
    }

    // 3. 按相关性排序并去重
    return this.mergeAndSort(recommendations, limit);
  }

  /**
   * 为部署流程提供知识推荐
   * 基于环境/策略查询部署最佳实践和故障排查指南
   */
  async getDeploymentRecommendations(
    tenantId: string,
    context: DeploymentKnowledgeContext,
    limit: number = 5
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // 1. 从通用知识库搜索部署相关文档
    const searchQuery = [
      context.strategy,
      context.environment,
      'deployment',
      'best practice',
      'rollback',
    ].filter(Boolean).join(' ');

    try {
      const docs = await this.knowledgeService.search(tenantId, searchQuery, { limit: limit * 2 });
      for (const doc of docs) {
        recommendations.push({
          source: 'knowledge',
          id: doc.id,
          title: doc.title,
          content: doc.content,
          relevanceScore: doc.similarity,
          tags: doc.tags,
          metadata: { spaceId: doc.space_id },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to search knowledge docs for deployment');
    }

    // 2. 从知识库模式库获取部署相关模式
    try {
      const kbRecommendations = this.knowledgeBaseService.query({
        keywords: ['deploy', context.strategy, context.environment],
        category: 'deployment',
        affectedComponent: 'deployment',
        limit,
      });

      for (const rec of kbRecommendations) {
        recommendations.push({
          source: 'knowledge-base',
          id: rec.pattern.id,
          title: rec.pattern.name,
          content: rec.pattern.remediationSteps.map(s => `[${s.order}] ${s.action}`).join('\n'),
          relevanceScore: rec.confidence,
          tags: rec.pattern.symptoms,
          metadata: {
            category: rec.pattern.category,
            successRate: rec.pattern.successRate,
            avgRecoveryTime: rec.pattern.avgRecoveryTime,
            riskLevel: rec.pattern.riskLevel,
          },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to query knowledge base for deployment');
    }

    return this.mergeAndSort(recommendations, limit);
  }

  /**
   * 为自愈流程提供知识推荐
   * 基于故障类型/症状查询故障解决方案
   */
  async getHealingRecommendations(
    tenantId: string,
    context: HealingKnowledgeContext,
    limit: number = 5
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // 1. 从通用知识库搜索故障相关文档
    const searchQuery = [
      context.incidentType,
      context.severity,
      ...(context.symptoms || []),
      'incident',
      'troubleshooting',
    ].filter(Boolean).join(' ');

    try {
      const docs = await this.knowledgeService.search(tenantId, searchQuery, { limit: limit * 2 });
      for (const doc of docs) {
        recommendations.push({
          source: 'knowledge',
          id: doc.id,
          title: doc.title,
          content: doc.content,
          relevanceScore: doc.similarity,
          tags: doc.tags,
          metadata: { spaceId: doc.space_id },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to search knowledge docs for healing');
    }

    // 2. 从知识库模式库获取故障模式
    try {
      const kbRecommendations = this.knowledgeBaseService.query({
        keywords: [context.incidentType, ...(context.symptoms || [])],
        category: this.mapIncidentTypeToCategory(context.incidentType),
        affectedComponent: context.affectedComponent,
        limit,
      });

      for (const rec of kbRecommendations) {
        recommendations.push({
          source: 'knowledge-base',
          id: rec.pattern.id,
          title: rec.pattern.name,
          content: rec.pattern.remediationSteps.map(s => `[${s.order}] ${s.action}`).join('\n'),
          relevanceScore: rec.confidence,
          tags: rec.pattern.symptoms,
          metadata: {
            category: rec.pattern.category,
            successRate: rec.pattern.successRate,
            avgRecoveryTime: rec.pattern.avgRecoveryTime,
            riskLevel: rec.pattern.riskLevel,
            rootCauses: rec.pattern.rootCauses,
          },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to query knowledge base for healing');
    }

    return this.mergeAndSort(recommendations, limit);
  }

  /**
   * 统一知识库检索 API
   * 支持跨知识库（通用知识库 + 知识库模式库）检索
   */
  async search(
    tenantId: string,
    query: string,
    options?: {
      spaceId?: string;
      limit?: number;
      includeKnowledgeBase?: boolean;
      category?: string;
    }
  ): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];
    const limit = options?.limit || 10;

    // 1. 从通用知识库搜索
    try {
      const docs = await this.knowledgeService.search(tenantId, query, {
        spaceId: options?.spaceId,
        limit: limit * 2,
      });
      for (const doc of docs) {
        recommendations.push({
          source: 'knowledge',
          id: doc.id,
          title: doc.title,
          content: doc.content,
          relevanceScore: doc.similarity,
          tags: doc.tags,
          metadata: { spaceId: doc.space_id },
        });
      }
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to search knowledge docs');
    }

    // 2. 从知识库模式库搜索（可选）
    if (options?.includeKnowledgeBase !== false) {
      try {
        const kbRecommendations = this.knowledgeBaseService.query({
          keywords: query.split(' '),
          category: options?.category,
          limit,
        });

        for (const rec of kbRecommendations) {
          recommendations.push({
            source: 'knowledge-base',
            id: rec.pattern.id,
            title: rec.pattern.name,
            content: rec.pattern.remediationSteps.map(s => `[${s.order}] ${s.action}`).join('\n'),
            relevanceScore: rec.confidence,
            tags: rec.pattern.symptoms,
            metadata: {
              category: rec.pattern.category,
              successRate: rec.pattern.successRate,
              avgRecoveryTime: rec.pattern.avgRecoveryTime,
              riskLevel: rec.pattern.riskLevel,
              rootCauses: rec.pattern.rootCauses,
            },
          });
        }
      } catch (err) {
        logger.warn({ err }, '[KnowledgeIntegration] Failed to query knowledge base');
      }
    }

    return this.mergeAndSort(recommendations, limit);
  }

  /**
   * 获取知识库统计信息
   */
  async getStats(tenantId: string): Promise<{
    docCount: number;
    patternCount: number;
    categories: Record<string, number>;
  }> {
    try {
      const [docs, stats] = await Promise.all([
        this.knowledgeService.listDocs(tenantId, { limit: 1 }),
        this.knowledgeBaseService.getStats(),
      ]);

      return {
        docCount: docs.length,
        patternCount: stats.totalPatterns,
        categories: stats.byCategory,
      };
    } catch (err) {
      logger.warn({ err }, '[KnowledgeIntegration] Failed to get stats');
      return { docCount: 0, patternCount: 0, categories: {} };
    }
  }

  // ==================== Private Helpers ====================

  /**
   * 合并来自不同知识库的推荐结果，按相关性排序并去重
   */
  private mergeAndSort(
    recommendations: KnowledgeRecommendation[],
    limit: number
  ): KnowledgeRecommendation[] {
    const seen = new Set<string>();
    const merged: KnowledgeRecommendation[] = [];

    // 按相关性降序排序
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

    for (const rec of recommendations) {
      const key = `${rec.source}:${rec.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      merged.push(rec);
      if (merged.length >= limit) break;
    }

    return merged;
  }

  /**
   * 将 incidentType 映射到知识库分类
   */
  private mapIncidentTypeToCategory(incidentType: string): string | undefined {
    const categoryMap: Record<string, string> = {
      high_cpu: 'resource',
      high_memory: 'resource',
      high_error_rate: 'application',
      high_latency: 'network',
      pod_crash: 'pod',
      node_failure: 'node',
      service_down: 'network',
      deployment_failure: 'deployment',
      disk_full: 'resource',
      disk_usage: 'resource',
      network_timeout: 'network',
    };

    return categoryMap[incidentType] || undefined;
  }
}
