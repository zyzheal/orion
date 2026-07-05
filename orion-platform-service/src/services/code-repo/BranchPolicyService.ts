/**
 * BranchPolicyService - PostgreSQL Repository-based Branch Policy Management
 *
 * Provides branch protection strategy CRUD, pattern matching, and PR
 * mergeability checks using BranchPolicyRepository backed by PostgreSQL.
 *
 * Features:
 * - CRUD operations for branch policies
 * - Glob-style branch pattern matching
 * - PR mergeability validation (approvals, checks, code owners, admin override)
 * - Default policy generation for common branch patterns
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { BranchPolicyRepository } from '../../repositories/BranchPolicyRepository';
import {
  BranchPolicy,
  CreateBranchPolicyInput,
  UpdateBranchPolicyInput,
  PullRequest,
  MergeCheckOptions,
  MergeCheckResult,
  MergeCheckBlock,
  ApprovalRule,
} from './types';
import { OrionError, ErrorCode } from '../../errors';

export class BranchPolicyService {
  private repository: BranchPolicyRepository | null;

  /**
   * @param repository - PostgreSQL repository instance or DatabasePool.
   *                     Pass null to fall back to in-memory mode.
   */
  constructor(repository: BranchPolicyRepository | DatabasePool | null) {
    if (!repository) {
      this.repository = null;
    } else if (
      'findById' in repository &&
      'findByRepo' in repository &&
      'create' in repository
    ) {
      // Already a BranchPolicyRepository (or mock)
      this.repository = repository as BranchPolicyRepository;
    } else {
      // It's a raw DatabasePool - build the repository
      this.repository = new BranchPolicyRepository(repository as DatabasePool);
    }
  }

  // ==================== Core CRUD ====================

  /**
   * Create a new branch policy.
   */
  async create(input: CreateBranchPolicyInput): Promise<BranchPolicy> {
    if (!this.repository) {
      throw new OrionError('BranchPolicyRepository not configured', ErrorCode.SERVICE_UNAVAILABLE);
    }

    // Generate IDs for approval rules
    const approvalRules: ApprovalRule[] = (input.approvalRules || []).map(rule => ({
      id: uuidv4(),
      name: rule.name,
      requiredApprovals: rule.requiredApprovals,
      approvers: rule.approvers,
      allowAuthorApproval: rule.allowAuthorApproval,
      requiredRoles: rule.requiredRoles,
    }));

    return this.repository.create({
      id: uuidv4(),
      repoId: input.repoId,
      branchPattern: input.branchPattern,
      preventForcePush: input.preventForcePush ?? false,
      preventDeletion: input.preventDeletion ?? true,
      mergeStrategy: input.mergeStrategy ?? 'merge',
      approvalRules,
      requiredChecks: input.requiredChecks ?? [],
      requireCodeOwners: input.requireCodeOwners ?? false,
      linearHistory: input.linearHistory ?? false,
      allowAdminOverride: input.allowAdminOverride ?? false,
    });
  }

  /**
   * Get a branch policy by ID.
   */
  async getById(id: string): Promise<BranchPolicy | null> {
    if (!this.repository) return null;
    return this.repository.findById(id);
  }

  /**
   * List all policies for a repository.
   */
  async listByRepo(repoId: string): Promise<BranchPolicy[]> {
    if (!this.repository) return [];
    return this.repository.findByRepo(repoId);
  }

  /**
   * List all policies across all repositories.
   */
  async listAll(): Promise<BranchPolicy[]> {
    if (!this.repository) return [];
    return this.repository.findAll();
  }

  /**
   * Update a branch policy by ID.
   */
  async update(id: string, input: UpdateBranchPolicyInput): Promise<BranchPolicy | null> {
    if (!this.repository) return null;

    // Generate IDs for approval rules if provided
    if (input.approvalRules) {
      const approvalRules: ApprovalRule[] = input.approvalRules.map(rule => ({
        id: (rule as ApprovalRule).id || uuidv4(),
        name: rule.name,
        requiredApprovals: rule.requiredApprovals,
        approvers: rule.approvers,
        allowAuthorApproval: rule.allowAuthorApproval,
        requiredRoles: rule.requiredRoles,
      }));

      return this.repository.update(id, {
        ...input,
        approvalRules,
      });
    }

    return this.repository.update(id, input as unknown as import('../../repositories/BranchPolicyRepository').UpdateBranchPolicyInput);
  }

  /**
   * Delete a branch policy by ID.
   */
  async delete(id: string): Promise<boolean> {
    if (!this.repository) return false;
    return this.repository.delete(id);
  }

  // ==================== Branch Pattern Matching ====================

  /**
   * Match a branch name against policies for a repository.
   * Uses glob-style pattern matching.
   *
   * Pattern rules:
   * - `*` matches any characters except `/`
   * - `**` matches any characters including `/`
   * - `?` matches any single character except `/`
   * - Exact match if no wildcards
   */
  async matchPolicy(repoId: string, branchName: string): Promise<BranchPolicy | null> {
    if (!this.repository) return null;

    const policies = await this.repository.findByRepo(repoId);

    // Sort by specificity: longer patterns first (more specific)
    policies.sort((a, b) => b.branchPattern.length - a.branchPattern.length);

    for (const policy of policies) {
      if (this.matchesPattern(branchName, policy.branchPattern)) {
        return policy;
      }
    }

    return null;
  }

  /**
   * Glob-style pattern matching for branch names.
   */
  private matchesPattern(branchName: string, pattern: string): boolean {
    // Exact match
    if (branchName === pattern) return true;

    // Convert glob pattern to regex
    let regexStr = '';
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === '*' && i + 1 < pattern.length && pattern[i + 1] === '*') {
        // ** matches anything including /
        regexStr += '.*';
        i += 2;
        // Skip trailing / if present after **
        if (i < pattern.length && pattern[i] === '/') {
          i++;
        }
      } else if (char === '*') {
        // * matches anything except /
        regexStr += '[^/]*';
        i++;
      } else if (char === '?') {
        // ? matches any single character except /
        regexStr += '[^/]';
        i++;
      } else {
        // Escape special regex characters
        regexStr += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        i++;
      }
    }

    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(branchName);
  }

  // ==================== PR Mergeability Check ====================

  /**
   * Check if a PR can be merged according to the matching branch policy.
   */
  async checkMergeability(
    repoId: string,
    pullRequest: PullRequest,
    options: MergeCheckOptions = {}
  ): Promise<MergeCheckResult> {
    const blocks: MergeCheckBlock[] = [];
    const warnings: string[] = [];

    // Find matching policy for the target branch
    const policy = await this.matchPolicy(repoId, pullRequest.targetBranch);

    if (!policy) {
      // No policy means no restrictions
      return {
        canMerge: true,
        policy: null,
        blocks: [],
        warnings: ['No branch policy configured for this target branch'],
      };
    }

    // Check approval rules
    const approvalBlocks = this.checkApprovals(policy, options.approvals || {}, pullRequest.author);
    blocks.push(...approvalBlocks);

    // Check required CI/CD checks
    const checkBlocks = this.checkRequiredChecks(policy, options.checkResults || {});
    blocks.push(...checkBlocks);

    // Check code owners requirement
    if (policy.requireCodeOwners && !options.codeOwnersApproved) {
      blocks.push({
        rule: 'code-owners',
        reason: 'CODEOWNERS approval is required',
        severity: 'error',
      });
    }

    // Check admin override
    if (options.isAdmin && policy.allowAdminOverride) {
      // Admin can bypass all blocks
      const errorBlocks = blocks.filter(b => b.severity === 'error');
      if (errorBlocks.length > 0) {
        warnings.push(
          `Admin override applied. Bypassed ${errorBlocks.length} blocking rule(s).`
        );
      }
      // Remove all error blocks for admin override
      return {
        canMerge: true,
        policy,
        blocks: blocks.filter(b => b.severity === 'warning'),
        warnings,
      };
    }

    const canMerge = blocks.every(b => b.severity === 'warning');

    return {
      canMerge,
      policy,
      blocks,
      warnings,
    };
  }

  /**
   * Check if approval requirements are met.
   */
  private checkApprovals(
    policy: BranchPolicy,
    approvals: Record<string, number>,
    author: string
  ): MergeCheckBlock[] {
    const blocks: MergeCheckBlock[] = [];

    for (const rule of policy.approvalRules) {
      // Find matching approver group
      let matchedApprovals = 0;

      for (const approver of rule.approvers) {
        if (approvals[approver] !== undefined) {
          matchedApprovals += approvals[approver];
        }
      }

      // If no specific approvers matched, check total approvals
      if (matchedApprovals === 0) {
        const totalApprovals = Object.values(approvals).reduce((sum, count) => sum + count, 0);
        matchedApprovals = totalApprovals;
      }

      // Check if author is among approvers (if not allowed)
      if (!rule.allowAuthorApproval && approvals[author] !== undefined && approvals[author] > 0) {
        // Count author's approval only if allowed
        matchedApprovals -= approvals[author];
      }

      if (matchedApprovals < rule.requiredApprovals) {
        blocks.push({
          rule: `approval-${rule.name}`,
          reason: `Requires ${rule.requiredApprovals} approvals from ${rule.name}, got ${matchedApprovals}`,
          severity: 'error',
        });
      }
    }

    return blocks;
  }

  /**
   * Check if required CI/CD checks have passed.
   */
  private checkRequiredChecks(
    policy: BranchPolicy,
    checkResults: Record<string, 'success' | 'failure' | 'pending'>
  ): MergeCheckBlock[] {
    const blocks: MergeCheckBlock[] = [];

    for (const checkName of policy.requiredChecks) {
      const result = checkResults[checkName];

      if (result === undefined) {
        blocks.push({
          rule: `check-${checkName}`,
          reason: `Required check "${checkName}" has not been triggered`,
          severity: 'error',
        });
      } else if (result === 'pending') {
        blocks.push({
          rule: `check-${checkName}`,
          reason: `Required check "${checkName}" is still running`,
          severity: 'warning',
        });
      } else if (result === 'failure') {
        blocks.push({
          rule: `check-${checkName}`,
          reason: `Required check "${checkName}" failed`,
          severity: 'error',
        });
      }
      // 'success' is fine, no action needed
    }

    return blocks;
  }

  // ==================== Default Policies ====================

  /**
   * Create default branch protection policies for a repository.
   * Creates policies for common patterns: main/master, release/*, develop.
   */
  async createDefaultPolicies(repoId: string): Promise<BranchPolicy[]> {
    const defaults: CreateBranchPolicyInput[] = [
      {
        repoId,
        branchPattern: 'main',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: 'squash',
        approvalRules: [
          {
            name: 'Core Team',
            requiredApprovals: 2,
            approvers: ['@team-core'],
            allowAuthorApproval: false,
            requiredRoles: ['maintainer'],
          },
        ],
        requiredChecks: ['ci/build', 'ci/test', 'ci/lint'],
        requireCodeOwners: true,
        linearHistory: true,
        allowAdminOverride: true,
      },
      {
        repoId,
        branchPattern: 'master',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: 'squash',
        approvalRules: [
          {
            name: 'Core Team',
            requiredApprovals: 2,
            approvers: ['@team-core'],
            allowAuthorApproval: false,
            requiredRoles: ['maintainer'],
          },
        ],
        requiredChecks: ['ci/build', 'ci/test', 'ci/lint'],
        requireCodeOwners: true,
        linearHistory: true,
        allowAdminOverride: true,
      },
      {
        repoId,
        branchPattern: 'release/**',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: 'merge',
        approvalRules: [
          {
            name: 'Release Team',
            requiredApprovals: 1,
            approvers: ['@team-release'],
            allowAuthorApproval: true,
          },
        ],
        requiredChecks: ['ci/build', 'ci/test'],
        requireCodeOwners: false,
        linearHistory: false,
        allowAdminOverride: true,
      },
      {
        repoId,
        branchPattern: 'develop',
        preventForcePush: false,
        preventDeletion: true,
        mergeStrategy: 'squash',
        approvalRules: [
          {
            name: 'Dev Team',
            requiredApprovals: 1,
            approvers: ['@team-dev'],
            allowAuthorApproval: true,
          },
        ],
        requiredChecks: ['ci/build'],
        requireCodeOwners: false,
        linearHistory: false,
        allowAdminOverride: false,
      },
    ];

    const created: BranchPolicy[] = [];

    for (const def of defaults) {
      try {
        const policy = await this.create(def);
        created.push(policy);
      } catch {
        // Skip if already exists or other error
      }
    }

    return created;
  }
}
