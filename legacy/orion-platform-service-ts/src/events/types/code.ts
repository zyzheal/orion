/**
 * Code 事件类型定义
 *
 * 符合 CloudEvents 1.0 规范
 * @see https://cloudevents.io/
 */

/**
 * Code 事件类型
 */
export type CodeEventType =
  | 'code.pr.opened'
  | 'code.pr.merged'
  | 'code.pr.closed'
  | 'code.pr.updated';

/**
 * PR Opened 事件数据
 */
export interface PROpenedEventData {
  /** PR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 作者 */
  author: string;
  /** 源分支 */
  sourceBranch: string;
  /** 目标分支 */
  targetBranch: string;
  /** PR 标题 */
  title?: string;
  /** PR 描述 */
  description?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * PR Merged 事件数据
 */
export interface PRMergedEventData {
  /** PR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 合并人 */
  mergedBy: string;
  /** 目标分支 */
  targetBranch: string;
  /** 合并提交 SHA */
  mergeCommitSha?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * PR Closed 事件数据
 */
export interface PRClosedEventData {
  /** PR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 关闭人 */
  closedBy: string;
  /** 关闭原因 */
  reason?: string;
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * PR Updated 事件数据
 */
export interface PRUpdatedEventData {
  /** PR ID */
  prId: string;
  /** 仓库 ID */
  repoId: string;
  /** 更新人 */
  updatedBy: string;
  /** 更新类型 */
  updateType: 'title' | 'description' | 'commits' | 'files';
  /** 事件时间戳 */
  timestamp: string;
}

/**
 * 事件上下文扩展
 */
export interface CodeEventExtensions {
  /** 租户 ID */
  tenantId: string;
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId: string;
  /** 事件版本 */
  version?: string;
  /** 优先级 */
  priority?: 'low' | 'normal' | 'high' | 'critical';
}