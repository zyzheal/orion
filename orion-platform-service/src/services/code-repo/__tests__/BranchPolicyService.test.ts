/**
 * BranchPolicyService 单元测试
 */

import { BranchPolicyService } from '../BranchPolicyService';
import { MergeStrategy, PullRequestStatus, PullRequest } from '../types';

describe('BranchPolicyService', () => {
  let service: BranchPolicyService;

  beforeEach(() => {
    service = new BranchPolicyService();
    service._clearStorage();
  });

  describe('create', () => {
    it('should create a branch policy with all fields', async () => {
      const policy = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        preventForcePush: true,
        preventDeletion: true,
        mergeStrategy: MergeStrategy.SQUASH_MERGE,
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 2,
            approvers: ['senior-devs'],
            allowAuthorApproval: false,
          },
        ],
        requiredChecks: ['ci-test', 'ci-lint'],
        requireCodeOwners: true,
        linearHistory: true,
        allowAdminOverride: false,
      });

      expect(policy.id).toBeDefined();
      expect(policy.repoId).toBe('test-repo');
      expect(policy.branchPattern).toBe('main');
      expect(policy.preventForcePush).toBe(true);
      expect(policy.preventDeletion).toBe(true);
      expect(policy.mergeStrategy).toBe(MergeStrategy.SQUASH_MERGE);
      expect(policy.approvalRules).toHaveLength(1);
      expect(policy.approvalRules[0].name).toBe('Code Review');
      expect(policy.requiredChecks).toEqual(['ci-test', 'ci-lint']);
      expect(policy.requireCodeOwners).toBe(true);
      expect(policy.linearHistory).toBe(true);
      expect(policy.allowAdminOverride).toBe(false);
    });

    it('should create a branch policy with default values', async () => {
      const policy = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
      });

      expect(policy.preventForcePush).toBe(true);
      expect(policy.preventDeletion).toBe(true);
      expect(policy.mergeStrategy).toBe(MergeStrategy.MERGE_COMMIT);
      expect(policy.approvalRules).toEqual([]);
      expect(policy.requiredChecks).toEqual([]);
      expect(policy.requireCodeOwners).toBe(false);
      expect(policy.linearHistory).toBe(false);
      expect(policy.allowAdminOverride).toBe(true);
    });

    it('should throw error if branchPattern is missing', async () => {
      await expect(
        service.create({
          repoId: 'test-repo',
          branchPattern: '',
        })
      ).rejects.toThrow('branchPattern is required');
    });

    it('should throw error for negative requiredApprovals', async () => {
      await expect(
        service.create({
          repoId: 'test-repo',
          branchPattern: 'main',
          approvalRules: [
            {
              name: 'Review',
              requiredApprovals: -1,
              approvers: ['devs'],
            },
          ],
        })
      ).rejects.toThrow('requiredApprovals must be >= 0');
    });
  });

  describe('getById', () => {
    it('should return policy by ID', async () => {
      const created = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
      });

      const found = await service.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('listByRepo', () => {
    it('should list all policies for a repository', async () => {
      await service.create({ repoId: 'repo1', branchPattern: 'main' });
      await service.create({ repoId: 'repo1', branchPattern: 'develop' });
      await service.create({ repoId: 'repo2', branchPattern: 'main' });

      const policies = await service.listByRepo('repo1');
      expect(policies).toHaveLength(2);
    });

    it('should return empty array for repo with no policies', async () => {
      const policies = await service.listByRepo('non-existent');
      expect(policies).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update policy fields', async () => {
      const created = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        mergeStrategy: MergeStrategy.MERGE_COMMIT,
      });

      const updated = await service.update(created.id, {
        mergeStrategy: MergeStrategy.SQUASH_MERGE,
        preventForcePush: false,
      });

      expect(updated).not.toBeNull();
      expect(updated!.mergeStrategy).toBe(MergeStrategy.SQUASH_MERGE);
      expect(updated!.preventForcePush).toBe(false);
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.update('non-existent', { preventForcePush: false });
      expect(result).toBeNull();
    });

    it('should update approvalRules', async () => {
      const created = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
      });

      const updated = await service.update(created.id, {
        approvalRules: [
          {
            name: 'New Rule',
            requiredApprovals: 3,
            approvers: ['leads'],
          },
        ],
      });

      expect(updated!.approvalRules).toHaveLength(1);
      expect(updated!.approvalRules[0].name).toBe('New Rule');
      expect(updated!.approvalRules[0].requiredApprovals).toBe(3);
    });
  });

  describe('delete', () => {
    it('should delete a policy', async () => {
      const created = await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
      });

      const deleted = await service.delete(created.id);
      expect(deleted).toBe(true);

      const found = await service.getById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const result = await service.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('matchPolicy', () => {
    beforeEach(async () => {
      await service.create({ repoId: 'repo1', branchPattern: 'main' });
      await service.create({ repoId: 'repo1', branchPattern: 'release/*' });
      await service.create({ repoId: 'repo1', branchPattern: 'feature/**' });
    });

    it('should match exact branch name', async () => {
      const policy = await service.matchPolicy('repo1', 'main');
      expect(policy).not.toBeNull();
      expect(policy!.branchPattern).toBe('main');
    });

    it('should match wildcard pattern with *', async () => {
      const policy = await service.matchPolicy('repo1', 'release/v1.0');
      expect(policy).not.toBeNull();
      expect(policy!.branchPattern).toBe('release/*');
    });

    it('should match double wildcard pattern with **', async () => {
      const policy = await service.matchPolicy('repo1', 'feature/sub/nested');
      expect(policy).not.toBeNull();
      expect(policy!.branchPattern).toBe('feature/**');
    });

    it('should return null if no pattern matches', async () => {
      const policy = await service.matchPolicy('repo1', 'unknown-branch');
      expect(policy).toBeNull();
    });
  });

  describe('checkMergeability', () => {
    const mockPR: PullRequest = {
      id: 'pr-1',
      externalId: '1',
      repoId: 'test-repo',
      repoName: 'test-repo',
      title: 'Test PR',
      status: PullRequestStatus.OPEN,
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      author: 'developer',
      assignees: [],
      reviewers: [],
      labels: [],
      isMergeable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow merge when no policy matches', async () => {
      const result = await service.checkMergeability('test-repo', mockPR);
      expect(result.canMerge).toBe(true);
      expect(result.failedChecks).toEqual([]);
    });

    it('should fail when approvals are insufficient', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 2,
            approvers: ['senior-devs'],
            allowAuthorApproval: false,
          },
        ],
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        approvals: { 'senior-devs': 1 },
      });

      expect(result.canMerge).toBe(false);
      expect(result.failedChecks).toHaveLength(1);
      expect(result.failedChecks[0].rule).toBe('Code Review');
    });

    it('should pass when approvals are sufficient', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 1,
            approvers: ['reviewer-1'],
            allowAuthorApproval: false,
          },
        ],
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        approvals: { 'reviewer-1': 1 },
      });

      expect(result.canMerge).toBe(true);
      expect(result.failedChecks).toEqual([]);
      expect(result.passedChecks).toContain('Code Review');
    });

    it('should fail when CI checks are pending', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        requiredChecks: ['ci-test'],
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        checkResults: { 'ci-test': 'pending' },
      });

      expect(result.canMerge).toBe(false);
      expect(result.failedChecks[0].rule).toBe('check:ci-test');
    });

    it('should pass when CI checks are successful', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        requiredChecks: ['ci-test'],
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        checkResults: { 'ci-test': 'success' },
      });

      expect(result.canMerge).toBe(true);
    });

    it('should allow admin override', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 1,
            approvers: ['reviewer-1'],
          },
        ],
        allowAdminOverride: true,
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        approvals: {},
        isAdmin: true,
      });

      expect(result.canMerge).toBe(true);
    });

    it('should fail when code owners not approved', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        requireCodeOwners: true,
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        codeOwnersApproved: false,
      });

      expect(result.canMerge).toBe(false);
    });

    it('should not allow author self-approval', async () => {
      await service.create({
        repoId: 'test-repo',
        branchPattern: 'main',
        approvalRules: [
          {
            name: 'Code Review',
            requiredApprovals: 1,
            approvers: ['developer'],
            allowAuthorApproval: false,
          },
        ],
      });

      const result = await service.checkMergeability('test-repo', mockPR, {
        approvals: { 'developer': 1 },
      });

      expect(result.canMerge).toBe(false);
    });
  });

  describe('createDefaultPolicies', () => {
    it('should create default policies for a repository', async () => {
      const policies = await service.createDefaultPolicies('test-repo');
      expect(policies.length).toBeGreaterThan(0);

      // Verify main branch policy exists
      const mainPolicy = policies.find(p => p.branchPattern === 'main');
      expect(mainPolicy).toBeDefined();
      expect(mainPolicy!.preventForcePush).toBe(true);
      expect(mainPolicy!.requireCodeOwners).toBe(true);
    });
  });
});
