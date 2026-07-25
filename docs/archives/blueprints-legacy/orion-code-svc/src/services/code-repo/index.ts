/**
 * code-repo 模块 barrel 导出
 *
 * 集中导出代码仓库相关的所有服务和类型，
 * 方便 controllers 和其他模块统一引用。
 */

// 从 types.ts 导出类型
export {
  RepoType,
  Repository,
  Branch,
  Commit,
  CommitStatus,
  GitProvider,
  PullRequestStatus,
  PullRequest,
  Review,
  FileComment,
  WebhookEventType,
  CodeRepoWebhookPayload,
  MergeStrategy,
  ApprovalRule,
  BranchPolicy,
  OwnershipRule,
  CodeOwnersFile,
  OwnershipRecommendation,
  ICodeRepoAdapter,
  WebhookConfig,
  WebhookProcessResult,
} from '../../types/code-repo';

// 从现有服务文件导出
export { GitLabAdapter } from '../GitLabAdapter';
export { GerritAdapter } from '../GerritAdapter';
export { BranchPolicyService } from '../BranchPolicyService';
export { CodeOwnershipService } from '../CodeOwnershipService';
export { CodeRepoWebhookService } from '../WebhookService';
