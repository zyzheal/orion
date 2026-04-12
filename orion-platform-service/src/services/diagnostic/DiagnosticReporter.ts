/**
 * 诊断报告生成器
 *
 * 职责：
 * - 生成结构化诊断报告
 * - 格式化时间线和推荐动作
 * - 预估修复复杂度
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DiagnosticSession,
  DiagnosticReport,
  TimelineEntry,
  Finding,
  RootCause,
  RecommendedAction,
  FixComplexity,
} from './types';

/**
 * 修复复杂度评估
 */
export interface FixComplexityEstimate {
  /** 复杂度等级 */
  complexity: FixComplexity;
  /** 预估修复时间 (ms) */
  estimatedFixTimeMs: number;
  /** 需要的人工干预程度 */
  manualInterventionRequired: boolean;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
  /** 复杂度说明 */
  description: string;
}

/**
 * 诊断报告生成器
 */
export class DiagnosticReporter {
  /**
   * 生成诊断报告
   */
  generateReport(session: DiagnosticSession): DiagnosticReport {
    // 生成时间线
    const timeline = this.formatTimeline(session);

    // 生成推荐动作
    const recommendations = this.generateRecommendations(session);

    // 预估修复时间
    const estimatedFixTimeMs = this.estimateFixTime(session);

    // 生成摘要
    const summary = this.generateSummary(session);

    const report: DiagnosticReport = {
      id: uuidv4(),
      sessionId: session.id,
      summary,
      findings: session.findings,
      rootCause: session.rootCause,
      recommendations,
      timeline,
      estimatedFixTimeMs,
      generatedAt: new Date(),
      tenantId: session.tenantId,
    };

    return report;
  }

  /**
   * 格式化时间线
   */
  formatTimeline(session: DiagnosticSession): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];

    // 添加症状检测事件
    for (const symptom of session.symptoms) {
      timeline.push({
        timestamp: symptom.timestamp,
        description: `[${symptom.severity.toUpperCase()}] ${symptom.source}: ${symptom.description}`,
        eventType: 'symptom_detected',
      });
    }

    // 添加发现事件
    for (const finding of session.findings) {
      timeline.push({
        timestamp: session.createdAt,
        description: `Finding: ${finding.description}`,
        eventType: 'finding_made',
      });
    }

    // 添加根因识别事件
    if (session.rootCause) {
      timeline.push({
        timestamp: session.completedAt || new Date(),
        description: `Root Cause: ${session.rootCause.description} (Confidence: ${session.rootCause.confidence}%)`,
        eventType: 'root_cause_identified',
      });
    }

    // 按时间排序
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }

  /**
   * 格式化推荐动作
   */
  formatRecommendations(recommendations: RecommendedAction[]): string[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    const sorted = [...recommendations].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return sorted.map((rec, index) => {
      const automationLabel =
        rec.automationLevel === 'fully_auto'
          ? '[Auto]'
          : rec.automationLevel === 'semi_auto'
          ? '[Semi-Auto]'
          : '[Manual]';

      const timeEstimate = rec.estimatedTimeMs
        ? ` (~${Math.round(rec.estimatedTimeMs / 60000)}min)`
        : '';

      const commands =
        rec.commands && rec.commands.length > 0
          ? `\n  Commands: ${rec.commands.join(' && ')}`
          : '';

      return `${index + 1}. [${rec.priority.toUpperCase()}] ${automationLabel} ${rec.description}${timeEstimate}${commands}`;
    });
  }

  /**
   * 评估修复复杂度
   */
  estimateFixComplexity(session: DiagnosticSession): FixComplexityEstimate {
    if (!session.rootCause) {
      return {
        complexity: 'expert',
        estimatedFixTimeMs: 3600000,
        manualInterventionRequired: true,
        riskLevel: 'high',
        description: 'Root cause unknown - expert investigation required',
      };
    }

    const actions = session.rootCause.recommendedActions;
    const totalActions = actions.length;
    const manualActions = actions.filter((a) => a.automationLevel === 'manual').length;
    const criticalActions = actions.filter((a) => a.priority === 'critical').length;

    let totalEstimatedTime = 0;
    for (const action of actions) {
      totalEstimatedTime += action.estimatedTimeMs || 300000;
    }

    // 计算复杂度评分
    let complexityScore = 0;

    // 基于动作数量
    complexityScore += totalActions * 10;

    // 基于手动动作比例
    if (totalActions > 0) {
      complexityScore += (manualActions / totalActions) * 30;
    }

    // 基于关键动作数量
    complexityScore += criticalActions * 15;

    // 基于症状数量
    complexityScore += session.symptoms.length * 5;

    // 基于置信度（置信度低意味着更复杂）
    complexityScore += (100 - session.rootCause.confidence) * 0.2;

    let complexity: FixComplexity;
    let riskLevel: 'low' | 'medium' | 'high';

    if (complexityScore < 20) {
      complexity = 'trivial';
      riskLevel = 'low';
    } else if (complexityScore < 40) {
      complexity = 'simple';
      riskLevel = 'low';
    } else if (complexityScore < 60) {
      complexity = 'moderate';
      riskLevel = 'medium';
    } else if (complexityScore < 80) {
      complexity = 'complex';
      riskLevel = 'high';
    } else {
      complexity = 'expert';
      riskLevel = 'high';
    }

    return {
      complexity,
      estimatedFixTimeMs: totalEstimatedTime,
      manualInterventionRequired: manualActions > 0 || complexity === 'expert',
      riskLevel,
      description: this.getComplexityDescription(complexity, totalActions, manualActions),
    };
  }

  /**
   * 清空报告历史（无状态，此方法仅为 API 兼容）
   */
  clear(): void {
    // Reporter is stateless
  }

  // ==================== 私有方法 ====================

  /**
   * 生成报告摘要
   */
  private generateSummary(session: DiagnosticSession): string {
    const symptomCount = session.symptoms.length;
    const findingCount = session.findings.length;
    const rootCauseDesc = session.rootCause
      ? session.rootCause.description
      : 'Root cause not identified';
    const confidence = session.confidence;

    const triggerDescription = this.getTriggerDescription(session.triggerType);

    return (
      `Diagnostic session triggered by ${triggerDescription} ` +
      `(${session.triggerId}). ` +
      `Analyzed ${symptomCount} symptom(s) and identified ${findingCount} finding(s). ` +
      `Root cause: ${rootCauseDesc}. ` +
      `Confidence: ${confidence}%.`
    );
  }

  /**
   * 获取触发类型描述
   */
  private getTriggerDescription(triggerType: string): string {
    const descriptions: Record<string, string> = {
      incident: 'incident alert',
      deployment_failure: 'deployment failure',
      pipeline_failure: 'pipeline failure',
      health_check_failure: 'health check failure',
      manual: 'manual request',
      scheduled: 'scheduled check',
    };
    return descriptions[triggerType] || triggerType;
  }

  /**
   * 生成推荐动作
   */
  private generateRecommendations(session: DiagnosticSession): RecommendedAction[] {
    if (!session.rootCause) {
      return [
        {
          description: 'Manual investigation required - root cause not automatically identified',
          actionType: 'investigate',
          priority: 'high',
          estimatedTimeMs: 900000,
          automationLevel: 'manual',
        },
      ];
    }

    return session.rootCause.recommendedActions;
  }

  /**
   * 预估修复时间
   */
  private estimateFixTime(session: DiagnosticSession): number {
    if (!session.rootCause || session.rootCause.recommendedActions.length === 0) {
      return 3600000; // 1 hour default
    }

    let total = 0;
    for (const action of session.rootCause.recommendedActions) {
      total += action.estimatedTimeMs || 300000;
    }
    return total;
  }

  /**
   * 获取复杂度描述
   */
  private getComplexityDescription(
    complexity: FixComplexity,
    totalActions: number,
    manualActions: number
  ): string {
    const descriptions: Record<string, string> = {
      trivial: `Trivial fix - ${totalActions} action(s), all can be automated`,
      simple: `Simple fix - ${totalActions} action(s), mostly automated`,
      moderate: `Moderate complexity - ${totalActions} action(s), ${manualActions} require manual intervention`,
      complex: `Complex fix - ${totalActions} action(s), ${manualActions} require manual intervention, careful planning needed`,
      expert: `Expert level - ${totalActions} action(s), ${manualActions} require manual intervention, escalate to senior engineer`,
    };
    return descriptions[complexity] || 'Unknown complexity';
  }
}
