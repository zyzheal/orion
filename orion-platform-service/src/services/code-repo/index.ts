/**
 * Code Repository Integration Module
 *
 * 统一抽象的代码仓库集成模块，支持 GitLab、Gerrit、GitHub 等多种后端。
 *
 * 模块组成:
 *   - types.ts: 类型定义和接口
 *   - GitLabAdapter.ts: GitLab 适配器
 *   - GerritAdapter.ts: Gerrit 适配器
 *   - BranchPolicyService.ts: 分支保护规则服务
 *   - CodeOwnershipService.ts: 代码所有权管理服务
 *   - WebhookService.ts: Webhook 处理服务
 */

// 类型导出
export * from './types';

// 适配器导出
export { GitLabAdapter, type GitLabAdapterConfig } from './GitLabAdapter';
export { GerritAdapter, type GerritAdapterConfig } from './GerritAdapter';

// 服务导出
export { BranchPolicyService, type BranchPolicyCreateInput, type BranchPolicyUpdateInput, type ApprovalRuleInput, type MergeCheckResult } from './BranchPolicyService';
export { CodeOwnershipService, type ParseResult } from './CodeOwnershipService';
export { CodeRepoWebhookService, type WebhookServiceConfig, type IEventPublisher } from './WebhookService';
export type { WebhookProcessResult } from './types';
export { CommitStatusService, type CommitStatusInput, type CommitStatusQuery, type CommitStatusServiceConfig } from './CommitStatusService';
