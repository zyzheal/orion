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

  // ── 设计质量 ──
  'missing-responsive': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '响应式设计缺失' },
  'missing-a11y': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '无障碍访问缺失' },
  'missing-state-transition': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '状态转换缺失' },
  'style-improvement': { authority: 'design-constraint', consumers: ['task-decomposer'], description: '样式改进建议' },

  // ── B2: 优化层 ──
  'missing-lazy-load': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '懒加载缺失' },
  'missing-request-cancel': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '请求取消缺失' },
  'missing-request-merge': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '请求合并缺失' },

  // ── B1: 修复规范层 ──
  'missing-test-coverage': { authority: 'design-constraint', consumers: ['code-design-analyzer', 'task-decomposer'], description: '修复缺少测试用例' },
  'missing-fallback': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'catch 块无 fallback 逻辑' },
  'missing-degrade-notice': { authority: 'design-constraint', consumers: ['code-design-analyzer', 'task-decomposer'], description: '服务降级无用户提示' },
  'missing-rollback': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '操作无回滚保护' },
  'missing-circuit-breaker': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '无熔断器实现' },

  // ── 设计质量扩展 ──
  'missing-orionmf-lifecycle': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: 'Orion-MF 子应用生命周期缺失' },
  'missing-secret-hardcode': { authority: 'design-constraint', consumers: ['code-design-analyzer'], description: '密钥硬编码' },
};

/**
 * Version manifest for all four skills.
 * Updated whenever any SKILL.md changes to ensure cross-skill compatibility.
 */
export const VERSION_MANIFEST = {
  'design-constraint': { version: 'v2.6', lastUpdated: '2026-05-25', changes: ['+B1 detector', '+pipeline cmd', '+path discovery'] },
  'code-design-analyzer': { version: 'v2.9', lastUpdated: '2026-05-25', changes: ['+SOLID AST', '+dep impact', '+framework selection'] },
  'design-doc-reviewer': { version: 'v2.5', lastUpdated: '2026-05-25', changes: ['+scenario modeling', '+org review'] },
  'task-decomposer': { version: 'v2.8', lastUpdated: '2026-05-25', changes: ['+auto-fix', '+9-dimension', '+page spec gen'] },
};

/** Minimum compatible versions (updated when breaking changes occur) */
export const COMPATIBILITY_MATRIX: Record<string, Record<string, string>> = {
  'design-constraint': { 'code-design-analyzer': 'v2.9+', 'design-doc-reviewer': 'v2.4+', 'task-decomposer': 'v2.8+' },
  'code-design-analyzer': { 'design-constraint': 'v2.5+', 'design-doc-reviewer': 'v2.4+', 'task-decomposer': 'v2.8+' },
  'design-doc-reviewer': { 'design-constraint': 'v2.5+', 'code-design-analyzer': 'v2.9+', 'task-decomposer': 'v2.8+' },
  'task-decomposer': { 'design-constraint': 'v2.5+', 'code-design-analyzer': 'v2.9+', 'design-doc-reviewer': 'v2.4+' },
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

// ── Design Constraints: Rejected Capabilities ──

/**
 * Capabilities that have been explicitly rejected to prevent over-engineering.
 * No skill should implement these capabilities.
 */
export const DESIGN_CONSTRAINTS = {
  /** Coverage target: maintain ~84% (53 AST + 115 Review), not 100% AST */
  COVERAGE_TARGET: 84,

  /** Fixed skill count: 4 skills, no 5th skill */
  SKILL_COUNT_LOCKED: 4,

  /**
   * Dimension-level coverage policy.
   * When reviewing a profile, if coveragePolicy !== 'ast', DO NOT propose new AST detectors.
   * This is the authoritative source for "why dimension X has no AST detector".
   */
  DIMENSION_POLICY: {
    a1_data_structure: { policy: 'ast', skill: 'design-constraint' },
    a2_interaction: { policy: 'ast', skill: 'design-constraint' },
    a3_flow: { policy: 'ast', skill: 'design-constraint' },
    b1_fix: { policy: 'review', skill: 'code-design-analyzer', reason: '修复合理性无法静态检测' },
    b2_optimize: { policy: 'ast', skill: 'design-constraint' },
    c1_compatibility: { policy: 'review', skill: 'design-doc-reviewer', reason: '兼容性是配置层面' },
    c2_scalability: { policy: 'review', skill: 'design-doc-reviewer', reason: '扩展性是架构设计层面' },
    c3_ecology: { policy: 'review', skill: 'design-doc-reviewer', reason: '生态集成是外部系统对接' },
    c4_observability: { policy: 'ast+review', skill: 'design-constraint+code-design-analyzer', reason: '4 项 AST 已覆盖核心' },
    c5_disaster_recovery: { policy: 'review', skill: 'design-doc-reviewer', reason: '灾备是运行时行为' },
    c6_capacity: { policy: 'review', skill: 'design-doc-reviewer', reason: '容量规划是设计文档层面' },
    c7_deployment: { policy: 'review', skill: 'design-doc-reviewer', reason: '部署是 CI/CD 配置层面' },
    c8_automation: { policy: 'review', skill: 'design-doc-reviewer', reason: '自动化是 CI/CD 配置层面' },
    d_experience: { policy: 'review', skill: 'design-doc-reviewer', reason: '用户体验是产品层面' },
    s_security: { policy: 'ast', skill: 'design-constraint' },
  } as const,

  /** Rejected capabilities that must NOT be implemented */
  REJECTED_CAPABILITIES: [
    {
      id: 'RC-01',
      name: '200项 AST detector 全实现',
      reason: '53 项 AST + 115 项 Review 已覆盖 ~84%，剩余 32 项无法用 AST 静态检测',
      correctApproach: '未覆盖维度由 design-doc-reviewer 文档评审 + code-design-analyzer 架构分析补充',
    },
    {
      id: 'RC-02',
      name: '创建第 5 个独立技能',
      reason: '4 技能已覆盖检测→分析→评审→拆分全链路，第 5 技能无明确职责',
      correctApproach: '新需求归入现有 4 技能之一，遵循 AUTHORITY_MAP 路由',
    },
    {
      id: 'RC-03',
      name: '重复检测同一问题',
      reason: 'design-constraint 是 AST 检测唯一权威，其他技能消费结果不做重复检测',
      correctApproach: '消费 AST 结果，不在 code-design-analyzer/task-decomposer 中重复 grep 检测',
    },
    {
      id: 'RC-04',
      name: '自动编写生产代码',
      reason: '技能只负责检测/评审/拆分，不直接修改生产代码',
      correctApproach: 'task-decomposer 生成子任务 + 验收标准，用户确认后执行',
    },
    {
      id: 'RC-05',
      name: 'CICD 实时监控集成',
      reason: 'CICD 属于运维层，应由运维文档评审覆盖，非 AST 可检测范围',
      correctApproach: '在 CI pipeline 中调用 cli-check.ts 作为静态检查步骤',
    },
  ],

  /** AST applicable layers only — other layers by document review */
  AST_LAYERS: ['A1', 'A2', 'A3', 'B2', 'S'] as const,

  /** Document review layers — not AST detectable */
  DOCUMENT_REVIEW_LAYERS: ['B1', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'D1', 'D2', 'D3', 'D4', 'D5'] as const,
};
