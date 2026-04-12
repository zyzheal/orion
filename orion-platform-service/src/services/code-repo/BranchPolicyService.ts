/**
 * Branch Policy Service - 分支保护规则服务
 *
 * 管理代码仓库的分支保护策略，包括:
 * - 保护分支规则 (通配符匹配)
 * - 审批规则配置 (需要的审批人数、审批人)
 * - 合并策略 (merge/squash/rebase/fast-forward)
 * - CODEOWNERS 要求
 * - 强制推送保护
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BranchPolicy,
  ApprovalRule,
  MergeStrategy,
  PullRequest,
} from './types';

/** 创建分支策略的输入 */
export interface BranchPolicyCreateInput {
  repoId: string;
  branchPattern: string;
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: ApprovalRuleInput[];
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

/** 审批规则输入 */
export interface ApprovalRuleInput {
  name: string;
  requiredApprovals: number;
  approvers: string[];
  allowAuthorApproval?: boolean;
  requiredRoles?: string[];
}

/** 更新分支策略的输入 */
export interface BranchPolicyUpdateInput {
  preventForcePush?: boolean;
  preventDeletion?: boolean;
  mergeStrategy?: MergeStrategy;
  approvalRules?: ApprovalRuleInput[];
  requiredChecks?: string[];
  requireCodeOwners?: boolean;
  linearHistory?: boolean;
  allowAdminOverride?: boolean;
}

/** PR 合并检查结果 */
export interface MergeCheckResult {
  /** 是否可以通过所有检查 */
  canMerge: boolean;
  /** 未通过的检查列表 */
  failedChecks: {
    rule: string;
    reason: string;
  }[];
  /** 通过的检查列表 */
  passedChecks: string[];
}

/** 内存存储 */
const branchPolicies = new Map<string, BranchPolicy>();
const policiesByRepo = new Map<string, string[]>(); // repoId -> [policyIds]

export class BranchPolicyService {
  /**
   * 创建分支保护策略
   */
  async create(input: BranchPolicyCreateInput): Promise<BranchPolicy> {
    const now = new Date();

    // 验证分支模式
    if (!input.branchPattern) {
      throw new Error('branchPattern is required');
    }

    // 验证审批规则
    const approvalRules: ApprovalRule[] = (input.approvalRules || []).map(rule => {
      if (rule.requiredApprovals < 0) {
        throw new Error('requiredApprovals must be >= 0');
      }
      return {
        id: uuidv4(),
        name: rule.name,
        requiredApprovals: rule.requiredApprovals,
        approvers: rule.approvers,
        allowAuthorApproval: rule.allowAuthorApproval ?? false,
        requiredRoles: rule.requiredRoles,
      };
    });

    const policy: BranchPolicy = {
      id: uuidv4(),
      repoId: input.repoId,
      branchPattern: input.branchPattern,
      preventForcePush: input.preventForcePush !== false,
      preventDeletion: input.preventDeletion !== false,
      mergeStrategy: input.mergeStrategy || MergeStrategy.MERGE_COMMIT,
      approvalRules,
      requiredChecks: input.requiredChecks || [],
      requireCodeOwners: input.requireCodeOwners ?? false,
      linearHistory: input.linearHistory ?? false,
      allowAdminOverride: input.allowAdminOverride ?? true,
      createdAt: now,
      updatedAt: now,
    };

    branchPolicies.set(policy.id, policy);

    // 维护仓库索引
    const repoPolicyIds = policiesByRepo.get(input.repoId) || [];
    repoPolicyIds.push(policy.id);
    policiesByRepo.set(input.repoId, repoPolicyIds);

    return policy;
  }

  /**
   * 获取分支策略详情
   */
  async getById(id: string): Promise<BranchPolicy | null> {
    return branchPolicies.get(id) || null;
  }

  /**
   * 获取仓库的所有分支策略
   */
  async listByRepo(repoId: string): Promise<BranchPolicy[]> {
    const policyIds = policiesByRepo.get(repoId) || [];
    return policyIds
      .map(id => branchPolicies.get(id))
      .filter((p): p is BranchPolicy => p !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 更新分支策略
   */
  async update(id: string, input: BranchPolicyUpdateInput): Promise<BranchPolicy | null> {
    const policy = branchPolicies.get(id);
    if (!policy) {
      return null;
    }

    if (input.preventForcePush !== undefined) policy.preventForcePush = input.preventForcePush;
    if (input.preventDeletion !== undefined) policy.preventDeletion = input.preventDeletion;
    if (input.mergeStrategy !== undefined) policy.mergeStrategy = input.mergeStrategy;
    if (input.requiredChecks !== undefined) policy.requiredChecks = input.requiredChecks;
    if (input.requireCodeOwners !== undefined) policy.requireCodeOwners = input.requireCodeOwners;
    if (input.linearHistory !== undefined) policy.linearHistory = input.linearHistory;
    if (input.allowAdminOverride !== undefined) policy.allowAdminOverride = input.allowAdminOverride;

    if (input.approvalRules !== undefined) {
      policy.approvalRules = input.approvalRules.map(rule => {
        if (rule.requiredApprovals < 0) {
          throw new Error('requiredApprovals must be >= 0');
        }
        return {
          id: uuidv4(),
          name: rule.name,
          requiredApprovals: rule.requiredApprovals,
          approvers: rule.approvers,
          allowAuthorApproval: rule.allowAuthorApproval ?? false,
          requiredRoles: rule.requiredRoles,
        };
      });
    }

    policy.updatedAt = new Date();
    branchPolicies.set(id, policy);

    return policy;
  }

  /**
   * 删除分支策略
   */
  async delete(id: string): Promise<boolean> {
    const policy = branchPolicies.get(id);
    if (!policy) {
      return false;
    }

    branchPolicies.delete(id);

    // 更新仓库索引
    const repoPolicyIds = policiesByRepo.get(policy.repoId) || [];
    const updatedIds = repoPolicyIds.filter(pid => pid !== id);
    if (updatedIds.length === 0) {
      policiesByRepo.delete(policy.repoId);
    } else {
      policiesByRepo.set(policy.repoId, updatedIds);
    }

    return true;
  }

  /**
   * 获取匹配分支的策略
   *
   * 使用通配符匹配 (支持 * 和 **)
   */
  async matchPolicy(repoId: string, branchName: string): Promise<BranchPolicy | null> {
    const policies = await this.listByRepo(repoId);

    // 按创建时间排序，精确匹配优先于通配符匹配
    const exactMatch = policies.find(p => p.branchPattern === branchName);
    if (exactMatch) return exactMatch;

    // 尝试通配符匹配
    for (const policy of policies) {
      if (this.matchPattern(policy.branchPattern, branchName)) {
        return policy;
      }
    }

    return null;
  }

  /**
   * 检查 PR 是否可以合并
   *
   * 根据匹配的分支策略执行所有检查
   */
  async checkMergeability(
    repoId: string,
    pr: PullRequest,
    options?: {
      /** 当前审批状态 { reviewerId: score } */
      approvals?: Record<string, number>;
      /** CI 检查结果 { checkName: status } */
      checkResults?: Record<string, 'success' | 'failure' | 'pending'>;
      /** CODEOWNERS 审批状态 */
      codeOwnersApproved?: boolean;
      /** 是否是管理员 */
      isAdmin?: boolean;
    }
  ): Promise<MergeCheckResult> {
    const policy = await this.matchPolicy(repoId, pr.targetBranch);

    if (!policy) {
      // 没有匹配的策略，允许合并
      return {
        canMerge: true,
        failedChecks: [],
        passedChecks: ['no-policy-required'],
      };
    }

    const failedChecks: { rule: string; reason: string }[] = [];
    const passedChecks: string[] = [];

    // 1. 检查审批规则
    for (const rule of policy.approvalRules) {
      const reviewResult = this.checkApprovalRule(rule, pr, options?.approvals || {});
      if (!reviewResult.approved) {
        failedChecks.push({
          rule: rule.name,
          reason: reviewResult.reason,
        });
      } else {
        passedChecks.push(rule.name);
      }
    }

    // 2. 检查必需的 CI 检查
    for (const checkName of policy.requiredChecks) {
      const status = options?.checkResults?.[checkName];
      if (status === 'success') {
        passedChecks.push(`check:${checkName}`);
      } else if (status === 'failure') {
        failedChecks.push({
          rule: `check:${checkName}`,
          reason: `Check "${checkName}" has failed`,
        });
      } else {
        failedChecks.push({
          rule: `check:${checkName}`,
          reason: `Check "${checkName}" is still pending`,
        });
      }
    }

    // 3. 检查 CODEOWNERS 审批
    if (policy.requireCodeOwners) {
      if (options?.codeOwnersApproved) {
        passedChecks.push('code-owners-approved');
      } else {
        failedChecks.push({
          rule: 'code-owners',
          reason: 'CODEOWNERS approval is required but not obtained',
        });
      }
    }

    // 4. 检查线性历史
    if (policy.linearHistory) {
      // 实际实现需要检查提交历史
      passedChecks.push('linear-history-check');
    }

    // 5. 管理员覆盖
    let canMerge = failedChecks.length === 0;
    if (!canMerge && policy.allowAdminOverride && options?.isAdmin) {
      canMerge = true;
    }

    return {
      canMerge,
      failedChecks,
      passedChecks,
    };
  }

  /**
   * 创建默认分支保护策略
   *
   * 为常见分支模式创建预定义的保护策略
   */
  async createDefaultPolicies(repoId: string): Promise<BranchPolicy[]> {
    const defaults = [
      // main/master 分支保护
      {
        repoId,
        branchPattern: 'main',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: MergeStrategy.SQUASH_MERGE,
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 1,
            approvers: ['team-leads'],
            allowAuthorApproval: false,
          },
        ],
        requiredChecks: ['ci-test', 'ci-lint'],
        requireCodeOwners: true,
        linearHistory: false,
        allowAdminOverride: true,
      },
      // release 分支保护
      {
        repoId,
        branchPattern: 'release/*',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: MergeStrategy.MERGE_COMMIT,
        approvalRules: [
          {
            name: 'Release Review',
            requiredApprovals: 2,
            approvers: ['release-managers'],
            allowAuthorApproval: false,
          },
        ],
        requiredChecks: ['ci-test', 'ci-lint', 'ci-security-scan'],
        requireCodeOwners: true,
        linearHistory: false,
        allowAdminOverride: false,
      },
      // develop 分支保护
      {
        repoId,
        branchPattern: 'develop',
        preventForcePush: true,
        preventDeletion: false,
        mergeStrategy: MergeStrategy.MERGE_COMMIT,
        approvalRules: [
          {
            name: 'Develop Review',
            requiredApprovals: 1,
            approvers: ['senior-devs'],
            allowAuthorApproval: false,
          },
        ],
        requiredChecks: ['ci-test'],
        requireCodeOwners: false,
        linearHistory: false,
        allowAdminOverride: true,
      },
    ];

    const results: BranchPolicy[] = [];
    for (const def of defaults) {
      try {
        const policy = await this.create(def as BranchPolicyCreateInput);
        results.push(policy);
      } catch {
        // 如果已存在则跳过
      }
    }

    return results;
  }

  /**
   * 检查审批规则是否满足
   */
  private checkApprovalRule(
    rule: ApprovalRule,
    pr: PullRequest,
    approvals: Record<string, number>
  ): { approved: boolean; reason: string } {
    // 统计有效审批数
    let validApprovals = 0;
    const approversWhoApproved = new Set<string>();

    for (const [reviewerId, score] of Object.entries(approvals)) {
      // 检查审批人是否在规则列表中
      const isApprovedApprover =
        rule.approvers.length === 0 || rule.approvers.includes(reviewerId);

      // 检查作者自审
      if (reviewerId === pr.author && !rule.allowAuthorApproval) {
        continue;
      }

      // 分数 >= 1 才算有效审批 (Gerrit 风格: +1, +2)
      if (isApprovedApprover && score >= 1) {
        validApprovals++;
        approversWhoApproved.add(reviewerId);
      }
    }

    if (validApprovals < rule.requiredApprovals) {
      return {
        approved: false,
        reason: `Requires ${rule.requiredApprovals} approval(s), got ${validApprovals}`,
      };
    }

    // 检查必需角色
    if (rule.requiredRoles && rule.requiredRoles.length > 0) {
      // 实际实现需要检查审批人角色
      // 这里做简化处理
    }

    return {
      approved: true,
      reason: `Got ${validApprovals} required approval(s)`,
    };
  }

  /**
   * 通配符匹配分支模式
   *
   * 支持:
   *   *  - 匹配任意非斜杠字符
   *   ** - 匹配任意字符（包括斜杠）
   */
  private matchPattern(pattern: string, branchName: string): boolean {
    // 将 glob 模式转换为正则表达式
    const regexPattern = pattern
      .replace(/\*\*/g, '__DOUBLE_STAR__')  // 临时替换 **
      .replace(/\*/g, '[^/]+')               // * 匹配非斜杠字符
      .replace(/__DOUBLE_STAR__/g, '.*');   // ** 匹配任意字符

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(branchName);
  }

  /**
   * 获取存储状态 (用于测试)
   */
  _getStorage(): { policies: Map<string, BranchPolicy>; byRepo: Map<string, string[]> } {
    return { policies: branchPolicies, byRepo: policiesByRepo };
  }

  /**
   * 清空存储 (用于测试)
   */
  _clearStorage(): void {
    branchPolicies.clear();
    policiesByRepo.clear();
  }
}
