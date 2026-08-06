/**
 * 效能度量评分工具
 * 各域 0-100 分，总分 = 各域加权平均
 */

export type RatingLevel = 'elite' | 'high' | 'medium' | 'low';

export interface DomainScore {
  domain: DomainKey;
  label: string;
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  color: string;
  icon: React.ReactNode;
}

export type DomainKey = 'e2e' | 'management' | 'engineering' | 'compliance' | 'aiEfficiency' | 'risk';

export interface ScoreResult {
  overallScore: number;
  level: RatingLevel;
  levelLabel: string;
  levelColor: string;
  domains: DomainScore[];
}

/** 将 DORA 等级字符串映射到 0-100 分数 */
export function levelToScore(level: string | undefined): number {
  const map: Record<string, number> = {
    elite: 100,
    high: 75,
    medium: 50,
    low: 25,
  };
  return map[(level ?? 'low').toLowerCase()] ?? 25;
}

/** 根据分数确定等级 */
export function scoreToLevel(score: number): { level: RatingLevel; label: string; color: string } {
  if (score >= 80) return { level: 'elite', label: 'Elite (世界级)', color: '#52c41a' };
  if (score >= 60) return { level: 'high', label: 'High (优秀)', color: '#3370E6' };
  if (score >= 40) return { level: 'medium', label: 'Medium (中等)', color: '#faad14' };
  return { level: 'low', label: 'Low (待改进)', color: '#f5222d' };
}

/**
 * 聚合各域评分，计算总分和等级
 * @param scores 各域评分 (0-100)
 * @param weights 各域权重（可选，默认等权）
 */
export function aggregateScores(
  scores: Record<DomainKey, number>,
  weights?: Record<DomainKey, number>
): { overall: number; level: RatingLevel; label: string; color: string } {
  const w = weights ?? { e2e: 1, management: 1, engineering: 1, compliance: 1, aiEfficiency: 1, risk: 1 };
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
  const weightedSum = Object.entries(scores).reduce(
    (sum, [key, score]) => sum + score * (w[key as DomainKey] ?? 1),
    0
  );
  const overall = Math.round((weightedSum / totalWeight) * 10) / 10;
  const { level, label, color } = scoreToLevel(overall);
  return { overall, level, label, color };
}

/** 安全计算百分比（避免除零） */
export function safePercent(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator <= 0) return fallback;
  return Math.round((numerator / denominator) * 100 * 10) / 10;
}

/** 趋势计算：比较当前值与上周值 */
export function computeTrend(current: number, previous: number): { trend: 'up' | 'down' | 'stable'; percent: number } {
  if (previous === 0) return { trend: 'stable', percent: 0 };
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100 * 10) / 10;
  if (Math.abs(diff) < 0.01) return { trend: 'stable', percent: 0 };
  return { trend: diff > 0 ? 'up' : 'down', percent: Math.abs(percent) };
}
