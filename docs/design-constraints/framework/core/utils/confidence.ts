/**
 * 置信度计算工具
 * 用于降低误报率，只报告高置信度的检测结果
 */

/**
 * 置信度等级
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 检测结果接口
 */
export interface DetectionResult {
  issue: any;
  confidence: ConfidenceLevel;
  reason: string;
}

/**
 * 计算置信度
 * @param hasDirectMatch - 是否有直接匹配（权重 +2）
 * @param hasContextualMatch - 是否有上下文匹配（权重 +1）
 * @param hasNegativeMatch - 是否有否定匹配（权重 -1，降低置信度）
 * @returns 置信度等级
 *
 * 评分规则:
 * - score >= 2: high (高置信度)
 * - score >= 1: medium (中等置信度)
 * - score < 1: low (低置信度)
 */
export function calculateConfidence(
  hasDirectMatch: boolean,
  hasContextualMatch: boolean,
  hasNegativeMatch: boolean
): ConfidenceLevel {
  let score = 0;

  if (hasDirectMatch) {
    score += 2;
  }
  if (hasContextualMatch) {
    score += 1;
  }
  if (hasNegativeMatch) {
    score -= 1;
  }

  if (score >= 2) {
    return 'high';
  }
  if (score >= 1) {
    return 'medium';
  }
  return 'low';
}

/**
 * 计算数值置信度（0-100）
 * @param hasDirectMatch - 直接匹配
 * @param hasContextualMatch - 上下文匹配
 * @param hasNegativeMatch - 否定匹配
 * @returns 置信度百分比
 */
export function calculateConfidenceScore(
  hasDirectMatch: boolean,
  hasContextualMatch: boolean,
  hasNegativeMatch: boolean
): number {
  let score = 0;

  if (hasDirectMatch) {
    score += 50;
  }
  if (hasContextualMatch) {
    score += 30;
  }
  if (hasNegativeMatch) {
    score -= 20;
  }

  // 确保分数在 0-100 范围内
  return Math.max(0, Math.min(100, score));
}

/**
 * 过滤低置信度结果
 * @param results - 检测结果数组
 * @param minConfidence - 最低置信度阈值，默认为 'medium'
 * @returns 过滤后的结果
 */
export function filterLowConfidence(
  results: DetectionResult[],
  minConfidence: ConfidenceLevel = 'medium'
): DetectionResult[] {
  const confidenceOrder: Record<ConfidenceLevel, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const minLevel = confidenceOrder[minConfidence];

  return results.filter((result) => {
    return confidenceOrder[result.confidence] >= minLevel;
  });
}

/**
 * 过滤低于指定阈值的置信度结果
 * @param results - 检测结果数组
 * @param threshold - 置信度阈值（0-100）
 * @returns 过滤后的结果
 */
export function filterByConfidenceThreshold(
  results: Array<DetectionResult & { score?: number }>,
  threshold: number = 70
): DetectionResult[] {
  return results.filter((result) => {
    // 如果有具体分数，使用分数过滤
    if (result.score !== undefined) {
      return result.score >= threshold;
    }
    // 否则使用等级过滤
    return result.confidence !== 'low';
  });
}

/**
 * 为检测结果添加置信度信息
 * @param issue - 检测到的问题
 * @param hasDirectMatch - 是否有直接匹配
 * @param hasContextualMatch - 是否有上下文匹配
 * @param hasNegativeMatch - 是否有否定匹配
 * @param customReason - 自定义原因描述
 * @returns 带置信度的检测结果
 */
export function createDetectionWithConfidence(
  issue: any,
  hasDirectMatch: boolean,
  hasContextualMatch: boolean,
  hasNegativeMatch: boolean,
  customReason?: string
): DetectionResult {
  const confidence = calculateConfidence(
    hasDirectMatch,
    hasContextualMatch,
    hasNegativeMatch
  );

  const score = calculateConfidenceScore(
    hasDirectMatch,
    hasContextualMatch,
    hasNegativeMatch
  );

  let reason = customReason || '';

  if (!reason) {
    const factors: string[] = [];
    if (hasDirectMatch) factors.push('直接匹配');
    if (hasContextualMatch) factors.push('上下文匹配');
    if (hasNegativeMatch) factors.push('否定匹配');

    reason = factors.length > 0
      ? `基于: ${factors.join('、')}`
      : '无匹配证据';
  }

  return {
    issue,
    confidence,
    reason: `${reason} (置信度: ${score}%)`,
  };
}