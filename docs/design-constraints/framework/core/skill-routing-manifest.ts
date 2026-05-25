/**
 * Skill Routing Manifest — single source of truth for issue-type → skill mapping.
 *
 * Purpose: Gap 7 — Eliminates duplicate/conflicting detection rules across
 * design-constraint, code-design-analyzer, task-decomposer, and CLAUDE.md.
 *
 * All code-level detection is centralized in design-constraint's AST analyzer.
 * code-design-analyzer and task-decomposer consume AST results via this routing
 * manifest instead of running their own independent checks.
 *
 * Usage:
 *   getSkillOwner(issueType)     — which skill is authoritative for this issue?
 *   getConsumerSkills(issueType) — which skills should also be informed?
 *   isDuplicatedCheck(issueType) — is this issue redundantly detected elsewhere?
 */

import { InteractionIssueType } from './detectors/base';

/**
 * Which skill is the AUTHORITY for each detection dimension.
 *
 * Authority = the skill that runs the actual detection logic.
 * Other skills should NOT duplicate this check — they should consume results.
 */
const AUTHORITY_MAP: Record<string, { authority: string; consumers: string[]; description: string }> = {
  // ── A1: 数据结构设计 ──
  // MissingPropsTypeDetector handles type definition checks
  'missing-props-type': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'Props 类型定义检查' },
  'token-violation': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'Design Token 合规检查' },
  'missing-error-boundary': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'ErrorBoundary 缺失检查' },

  // ── A2: 交互逻辑设计 ──
  'missing-feedback': { authority: 'design-constraint', consumers: ['code-design-analyzer', 'task-decomposer'], description: '异步操作反馈缺失' },
  'missing-loading': { authority: 'design-constraint', consumers: ['code-design-analyzer', 'task-decomposer', 'design-doc-reviewer'], description: 'Loading 状态缺失' },
  'missing-empty': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '空列表无 Empty 组件' },
  'missing-submit': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '表单提交按钮缺失' },
  'missing-edit': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '编辑入口缺失' },
  'missing-state-machine': { authority: 'design-constraint', consumers: ['design-doc-reviewer'], description: '状态机定义不完整' },
  'missing-animation': { authority: 'design-constraint', consumers: ['design-doc-reviewer'], description: '动画过渡缺失' },
  'missing-network-error': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '网络错误处理缺失' },
  'missing-business-error': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '业务错误提示缺失' },
  'missing-permission-error': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '权限不足提示缺失' },
  'missing-timeout': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '超时处理缺失' },
  'missing-optimistic-lock': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '乐观锁/冲突检测缺失' },
  'missing-concurrent-edit': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '并发操作提示缺失' },
  'missing-undo': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '撤销功能缺失' },
  'missing-skeleton': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '骨架屏/占位符缺失' },
  'missing-empty-search': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '空搜索结果引导缺失' },

  // ── A3: 流程细节设计 ──
  'missing-truncate': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '超长文本截断缺失' },
  'missing-pagination': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '分页功能缺失' },
  'missing-batch': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '批量操作缺失' },
  'missing-danger-confirm': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '危险操作二次确认缺失' },
  'missing-data-empty': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '数据为空处理缺失' },

  // ── S1-S5: 安全层 ──
  'missing-auth-guard': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'API 路由缺少认证守卫' },
  'missing-tenant-isolation': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '查询缺少租户隔离' },
  'missing-sql-parameterization': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'SQL 拼接无参数化' },
  'missing-sensitive-log-mask': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '日志记录敏感信息' },
  'missing-cors-config': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'CORS 配置缺失' },
};

/**
 * Issues that CLAUDE.md currently duplicates (should reference design-constraint instead).
 */
export const CLAUDE_MD_DUPLICATES = [
  'missing-feedback',
  'missing-loading',
  'missing-empty',
  'missing-submit',
  'missing-edit',
  'missing-danger-confirm',
];

/**
 * Get the authority skill for an issue type.
 */
export function getSkillOwner(issueType: InteractionIssueType | string): string {
  return AUTHORITY_MAP[issueType]?.authority ?? 'design-constraint';
}

/**
 * Get skills that should consume the result (not re-detect).
 */
export function getConsumerSkills(issueType: InteractionIssueType | string): string[] {
  return AUTHORITY_MAP[issueType]?.consumers ?? [];
}

/**
 * Check if an issue type is redundantly detected by multiple skills.
 */
export function isDuplicatedCheck(issueType: InteractionIssueType | string): boolean {
  return CLAUDE_MD_DUPLICATES.includes(issueType);
}

/**
 * Generate a routing summary for display.
 */
export function formatRoutingSummary(): string {
  const lines = [
    '┌─────────────────────────────────────────────────────────────────────────────┐',
    '│  Skill Routing Manifest — Single Source of Truth                           │',
    '├──────────────────────────────┬───────────────────┬──────────────────────────┤',
    '│  Issue Type                  │ Authority         │ Consumers                │',
    '├──────────────────────────────┼───────────────────┼──────────────────────────┤',
  ];

  for (const [type, { authority, consumers }] of Object.entries(AUTHORITY_MAP).sort((a, b) => a[0].localeCompare(b[0]))) {
    const consumersStr = consumers.join(', ');
    lines.push(`│  ${type.padEnd(28)}│ ${authority.padEnd(17)}│ ${consumersStr.padEnd(24)}│`);
  }

  lines.push('└──────────────────────────────┴───────────────────┴──────────────────────────┘');
  return lines.join('\n');
}
