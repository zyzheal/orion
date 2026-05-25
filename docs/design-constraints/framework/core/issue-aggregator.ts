/**
 * Issue Aggregator — aggregates, deduplicates, and ranks AST analysis results
 * before passing them to the three AI skills.
 *
 * Purpose: Solve the "error amplification" problem where 1 AST false positive
 * causes 3 skills to each generate N fix plans, wasting 3x developer effort.
 *
 * Features:
 *   - Deduplication: Same issue on same file/line from multiple detectors → 1 issue
 *   - Consensus scoring: 2+ detectors report same issue → higher confidence
 *   - Priority merging: P0 + P1 → P0 (higher priority wins)
 *   - Skill routing: Tags each issue with which skill(s) should handle it
 */

import { InteractionIssue, ScanResult, InteractionIssueType } from './detectors/base';

/**
 * Which AI skills should handle this issue type.
 */
const SKILL_ROUTING: Partial<Record<InteractionIssueType, string[]>> = {
  // A 设计层 → design-doc-reviewer
  'missing-feedback': ['design-doc-reviewer'],
  'missing-loading': ['design-doc-reviewer', 'task-decomposer'],
  'missing-empty': ['design-doc-reviewer', 'task-decomposer'],
  'missing-submit': ['design-doc-reviewer', 'task-decomposer'],
  'missing-edit': ['design-doc-reviewer', 'task-decomposer'],
  'missing-state-machine': ['design-doc-reviewer'],
  'missing-animation': ['design-doc-reviewer', 'task-decomposer'],
  'missing-skeleton': ['design-doc-reviewer', 'task-decomposer'],
  'missing-empty-search': ['design-doc-reviewer', 'task-decomposer'],
  'missing-truncate': ['design-doc-reviewer', 'task-decomposer'],
  'missing-pagination': ['design-doc-reviewer', 'task-decomposer'],
  'missing-batch': ['design-doc-reviewer', 'task-decomposer'],
  'missing-data-empty': ['design-doc-reviewer', 'task-decomposer'],
  // B 开发层 → code-design-analyzer
  'missing-network-error': ['code-design-analyzer'],
  'missing-business-error': ['code-design-analyzer'],
  'missing-permission-error': ['code-design-analyzer'],
  'missing-timeout': ['code-design-analyzer'],
  'missing-optimistic-lock': ['code-design-analyzer'],
  'missing-concurrent-edit': ['code-design-analyzer'],
  'missing-undo': ['code-design-analyzer'],
  'missing-danger-confirm': ['code-design-analyzer', 'task-decomposer'],
  // NEW detectors
  'token-violation': ['code-design-analyzer'],
  'missing-error-boundary': ['code-design-analyzer'],
  'missing-props-type': ['code-design-analyzer'],
  // S 安全层 → code-design-analyzer
  'missing-auth-guard': ['code-design-analyzer'],
  'missing-sensitive-log-mask': ['code-design-analyzer'],
  'missing-sql-parameterization': ['code-design-analyzer'],
  'missing-cors-config': ['code-design-analyzer'],
  'missing-tenant-isolation': ['code-design-analyzer'],
  // B2 优化层 → code-design-analyzer
  'missing-lazy-load': ['code-design-analyzer'],
  'missing-request-cancel': ['code-design-analyzer'],
  'missing-request-merge': ['code-design-analyzer'],
  // NEW detectors — responsive/a11y/state/style
  'missing-responsive': ['code-design-analyzer'],
  'missing-a11y': ['code-design-analyzer'],
  'missing-state-transition': ['code-design-analyzer'],
  'style-improvement': ['code-design-analyzer'],
};

/**
 * Default skill routing for unknown issue types.
 */
const DEFAULT_SKILL_ROUTING = ['code-design-analyzer'];

/**
 * Severity priority mapping (higher = more urgent).
 */
const SEVERITY_PRIORITY: Record<string, number> = {
  P0: 3,
  P1: 2,
  P2: 1,
};

/**
 * Aggregated issue with skill routing and consensus info.
 */
export interface AggregatedIssue extends InteractionIssue {
  /** Which skills should handle this issue. */
  targetSkills: string[];
  /** Number of detectors that reported this same issue. */
  detectorCount: number;
  /** Whether this issue was deduplicated from multiple reports. */
  isDeduplicated: boolean;
}

/**
 * Aggregation result with summary statistics.
 */
export interface AggregationResult {
  issues: AggregatedIssue[];
  stats: {
    totalBeforeDedup: number;
    totalAfterDedup: number;
    dedupRate: number;
    p0Count: number;
    p1Count: number;
    p2Count: number;
    avgConfidence: number;
    skillDistribution: Record<string, number>;
  };
}

/**
 * Aggregate scan results from multiple files/detectors.
 * Performs deduplication, consensus scoring, and skill routing.
 */
export function aggregateResults(
  results: ScanResult[],
  options: { minConfidence?: number; enableDedup?: boolean } = {},
): AggregationResult {
  const { minConfidence = 50, enableDedup = true } = options;

  // Flatten all issues
  const allIssues: InteractionIssue[] = [];
  for (const result of results) {
    allIssues.push(...result.issues);
  }

  const totalBeforeDedup = allIssues.length;

  // Filter by confidence
  const filteredIssues = allIssues.filter(
    i => (i.confidence ?? 0) >= minConfidence,
  );

  // Deduplicate
  const dedupedIssues = enableDedup
    ? deduplicateIssues(filteredIssues)
    : filteredIssues.map(enhanceIssue);

  // Build aggregation result
  const p0Count = dedupedIssues.filter(i => i.severity === 'P0').length;
  const p1Count = dedupedIssues.filter(i => i.severity === 'P1').length;
  const p2Count = dedupedIssues.filter(i => i.severity === 'P2').length;
  const avgConfidence =
    dedupedIssues.length > 0
      ? dedupedIssues.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / dedupedIssues.length
      : 0;

  // Skill distribution
  const skillDistribution: Record<string, number> = {};
  for (const issue of dedupedIssues) {
    for (const skill of issue.targetSkills) {
      skillDistribution[skill] = (skillDistribution[skill] || 0) + 1;
    }
  }

  return {
    issues: dedupedIssues,
    stats: {
      totalBeforeDedup,
      totalAfterDedup: dedupedIssues.length,
      dedupRate: totalBeforeDedup > 0 ? (totalBeforeDedup - dedupedIssues.length) / totalBeforeDedup : 0,
      p0Count,
      p1Count,
      p2Count,
      avgConfidence,
      skillDistribution,
    },
  };
}

/**
 * Deduplicate issues that report the same problem on the same file/line.
 * Merges severity (takes higher), confidence (takes average), and skills (takes union).
 */
function deduplicateIssues(issues: InteractionIssue[]): AggregatedIssue[] {
  const issueMap = new Map<string, AggregatedIssue>();

  for (const issue of issues) {
    // Dedup key: file + line + issue type
    const key = `${issue.file}:${issue.line}:${issue.type}`;

    if (issueMap.has(key)) {
      // Merge with existing issue
      const existing = issueMap.get(key)!;
      existing.detectorCount++;
      existing.isDeduplicated = true;

      // Take higher severity
      const existingPriority = SEVERITY_PRIORITY[existing.severity] ?? 0;
      const newPriority = SEVERITY_PRIORITY[issue.severity] ?? 0;
      if (newPriority > existingPriority) {
        existing.severity = issue.severity;
      }

      // Average confidence
      existing.confidence = Math.round(
        ((existing.confidence ?? 0) * (existing.detectorCount - 1) + (issue.confidence ?? 0)) /
          existing.detectorCount,
      );

      // Union of target skills
      const newSkills = getSkillRouting(issue.type);
      for (const skill of newSkills) {
        if (!existing.targetSkills.includes(skill)) {
          existing.targetSkills.push(skill);
        }
      }
    } else {
      issueMap.set(key, enhanceIssue(issue));
    }
  }

  // Sort by severity (P0 first) then confidence (higher first)
  return Array.from(issueMap.values()).sort((a, b) => {
    const priorityA = SEVERITY_PRIORITY[a.severity] ?? 0;
    const priorityB = SEVERITY_PRIORITY[b.severity] ?? 0;
    if (priorityA !== priorityB) return priorityB - priorityA;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

/**
 * Enhance a single issue with skill routing and metadata.
 */
function enhanceIssue(issue: InteractionIssue): AggregatedIssue {
  return {
    ...issue,
    confidence: issue.confidence ?? 60,
    requiresConfirmation: issue.requiresConfirmation ?? false,
    targetSkills: getSkillRouting(issue.type),
    detectorCount: 1,
    isDeduplicated: false,
  };
}

/**
 * Get the target skills for an issue type.
 */
function getSkillRouting(type: InteractionIssueType): string[] {
  return SKILL_ROUTING[type] ?? DEFAULT_SKILL_ROUTING;
}

/**
 * Group issues by target skill for parallel processing.
 */
export function groupBySkill(issues: AggregatedIssue[]): Record<string, AggregatedIssue[]> {
  const groups: Record<string, AggregatedIssue[]> = {};

  for (const issue of issues) {
    for (const skill of issue.targetSkills) {
      if (!groups[skill]) {
        groups[skill] = [];
      }
      groups[skill].push(issue);
    }
  }

  return groups;
}

/**
 * Group issues by file for batch processing.
 */
export function groupByFile(issues: AggregatedIssue[]): Record<string, AggregatedIssue[]> {
  const groups: Record<string, AggregatedIssue[]> = {};

  for (const issue of issues) {
    if (!groups[issue.file]) {
      groups[issue.file] = [];
    }
    groups[issue.file].push(issue);
  }

  return groups;
}

/**
 * Get a summary of the aggregation result suitable for display.
 */
export function formatAggregationSummary(result: AggregationResult): string {
  const lines = [
    '┌────────────────────────────────────────────────────────────┐',
    '│  Issue Aggregation Summary                                  │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Total issues (before dedup): ${result.stats.totalBeforeDedup.toString().padStart(32)}│`,
    `│  Total issues (after dedup):  ${result.stats.totalAfterDedup.toString().padStart(32)}│`,
    `│  Dedup rate:                  ${(result.stats.dedupRate * 100).toFixed(1).padStart(31)}%│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  P0 issues:                   ${result.stats.p0Count.toString().padStart(32)}│`,
    `│  P1 issues:                   ${result.stats.p1Count.toString().padStart(32)}│`,
    `│  P2 issues:                   ${result.stats.p2Count.toString().padStart(32)}│`,
    `│  Avg confidence:              ${result.stats.avgConfidence.toFixed(1).padStart(31)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  Skill distribution:                                       │',
  ];

  for (const [skill, count] of Object.entries(result.stats.skillDistribution)) {
    lines.push(`│    ${skill.padEnd(40)} ${count.toString().padStart(6)}│`);
  }

  lines.push('└────────────────────────────────────────────────────────────┘');
  return lines.join('\n');
}
