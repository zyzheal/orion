/**
 * BranchPolicyService Tests
 *
 * Tests for BranchPolicyService covering:
 * - Branch policy CRUD operations
 * - Branch pattern matching (glob-style)
 * - PR mergeability checks (approvals, CI checks, code owners, admin override)
 * - Default policy generation
 * - Database unavailable fallback
 */

import { BranchPolicyService } from '../BranchPolicyService';
import { BranchPolicyRepository } from '../../../repositories/BranchPolicyRepository';
import { BranchPolicy, CreateBranchPolicyInput, ApprovalRule } from '../types';

// ==================== Mock Helpers ====================

function makeMockRepository() {
  const policies: Map<string, BranchPolicy> = new Map();

  const repo: jest.Mocked<BranchPolicyRepository> = {
    create: jest.fn(async (input: any) => {
      const now = new Date();
      const policy: BranchPolicy = {
        id: input.id,
        repoId: input.repoId,
        branchPattern: input.branchPattern,
        preventForcePush: input.preventForcePush ?? false,
        preventDeletion: input.preventDeletion ?? true,
        mergeStrategy: input.mergeStrategy ?? 'merge',
        approvalRules: input.approvalRules ?? [],
        requiredChecks: input.requiredChecks ?? [],
        requireCodeOwners: input.requireCodeOwners ?? false,
        linearHistory: input.linearHistory ?? false,
        allowAdminOverride: input.allowAdminOverride ?? false,
        createdAt: now,
        updatedAt: now,
      };
      policies.set(policy.id, policy);
      return policy;
    }),

    findById: jest.fn(async (id: string) => policies.get(id) || null),

    findByRepo: jest.fn(async (repoId: string) =>
      Array.from(policies.values()).filter(p => p.repoId === repoId)
    ),

    findAll: jest.fn(async () => Array.from(policies.values())),

    update: jest.fn(async (id: string, input: any) => {
      const existing = policies.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        updatedAt: new Date(),
      };
      policies.set(id, updated);
      return updated;
    }),

    delete: jest.fn(async (id: string) => policies.delete(id)),
  } as any;

  return { repo, policies };
}

function makeCreateInput(overrides: Partial<CreateBranchPolicyInput> = {}): CreateBranchPolicyInput {
  return {
    repoId: 'repo-1',
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
      },
    ],
    requiredChecks: ['ci/build', 'ci/test'],
    requireCodeOwners: true,
    ...overrides,
  };
}

// ==================== CRUD Tests ====================

describe('BranchPolicyService - CRUD', () => {
  let service: BranchPolicyService;
  let repo: jest.Mocked<BranchPolicyRepository>;

  beforeEach(() => {
    const { repo: mockRepo } = makeMockRepository();
    repo = mockRepo;
    service = new BranchPolicyService(mockRepo);
  });

  it('should create a branch policy', async () => {
    const input = makeCreateInput();
    const policy = await service.create(input);

    expect(policy).toBeDefined();
    expect(policy.repoId).toBe('repo-1');
    expect(policy.branchPattern).toBe('main');
    expect(policy.mergeStrategy).toBe('squash');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('should generate UUID for approval rules', async () => {
    const input = makeCreateInput({
      approvalRules: [{
        name: 'Test Rule',
        requiredApprovals: 1,
        approvers: ['@dev'],
      }],
    });
    const policy = await service.create(input);

    expect(policy.approvalRules).toHaveLength(1);
    expect(policy.approvalRules[0].id).toBeDefined();
    expect(policy.approvalRules[0].name).toBe('Test Rule');
  });

  it('should get policy by ID', async () => {
    const created = await service.create(makeCreateInput());
    const found = await service.getById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });

  it('should return null for non-existent policy', async () => {
    const found = await service.getById('non-existent');
    expect(found).toBeNull();
  });

  it('should list policies by repo', async () => {
    await service.create(makeCreateInput({ repoId: 'repo-1', branchPattern: 'main' }));
    await service.create(makeCreateInput({ repoId: 'repo-1', branchPattern: 'develop' }));
    await service.create(makeCreateInput({ repoId: 'repo-2', branchPattern: 'main' }));

    const policies = await service.listByRepo('repo-1');
    expect(policies).toHaveLength(2);
    expect(policies.every(p => p.repoId === 'repo-1')).toBe(true);
  });

  it('should list all policies', async () => {
    await service.create(makeCreateInput({ repoId: 'repo-1' }));
    await service.create(makeCreateInput({ repoId: 'repo-2' }));

    const policies = await service.listAll();
    expect(policies).toHaveLength(2);
  });

  it('should update a policy', async () => {
    const created = await service.create(makeCreateInput());
    const updated = await service.update(created.id, {
      preventForcePush: false,
      mergeStrategy: 'rebase',
    });

    expect(updated).toBeDefined();
    expect(updated?.preventForcePush).toBe(false);
    expect(updated?.mergeStrategy).toBe('rebase');
  });

  it('should return null when updating non-existent policy', async () => {
    const updated = await service.update('non-existent', { preventForcePush: false });
    expect(updated).toBeNull();
  });

  it('should delete a policy', async () => {
    const created = await service.create(makeCreateInput());
    const deleted = await service.delete(created.id);

    expect(deleted).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(created.id);
  });

  it('should return false when deleting non-existent policy', async () => {
    const deleted = await service.delete('non-existent');
    expect(deleted).toBe(false);
  });
});

// ==================== Pattern Matching Tests ====================

describe('BranchPolicyService - Pattern Matching', () => {
  let service: BranchPolicyService;

  beforeEach(() => {
    const { repo: mockRepo } = makeMockRepository();
    service = new BranchPolicyService(mockRepo);
  });

  it('should match exact branch name', async () => {
    await service.create(makeCreateInput({ branchPattern: 'main' }));

    const matched = await service.matchPolicy('repo-1', 'main');
    expect(matched).toBeDefined();
    expect(matched?.branchPattern).toBe('main');
  });

  it('should match glob pattern with **', async () => {
    await service.create(makeCreateInput({ branchPattern: 'release/**' }));

    const matched = await service.matchPolicy('repo-1', 'release/v1.0');
    expect(matched).toBeDefined();
    expect(matched?.branchPattern).toBe('release/**');
  });

  it('should match nested glob pattern', async () => {
    await service.create(makeCreateInput({ branchPattern: 'feature/**' }));

    const matched = await service.matchPolicy('repo-1', 'feature/user/auth');
    expect(matched).toBeDefined();
  });

  it('should match single-level wildcard *', async () => {
    await service.create(makeCreateInput({ branchPattern: 'hotfix-*' }));

    const matched = await service.matchPolicy('repo-1', 'hotfix-critical');
    expect(matched).toBeDefined();
  });

  it('should not match wildcard across slashes', async () => {
    await service.create(makeCreateInput({ branchPattern: 'hotfix-*' }));

    const matched = await service.matchPolicy('repo-1', 'hotfix/fix-bug');
    expect(matched).toBeNull();
  });

  it('should return most specific match (longer pattern first)', async () => {
    await service.create(makeCreateInput({ branchPattern: 'release/**' }));
    await service.create(makeCreateInput({ branchPattern: 'release/v1.*' }));

    const matched = await service.matchPolicy('repo-1', 'release/v1.0');
    expect(matched).toBeDefined();
    // Longer pattern should match first
    expect(matched?.branchPattern).toBe('release/v1.*');
  });

  it('should return null for no matching policy', async () => {
    await service.create(makeCreateInput({ branchPattern: 'main' }));

    const matched = await service.matchPolicy('repo-1', 'develop');
    expect(matched).toBeNull();
  });

  it('should not match policies from different repos', async () => {
    await service.create(makeCreateInput({ repoId: 'repo-1', branchPattern: 'main' }));

    const matched = await service.matchPolicy('repo-2', 'main');
    expect(matched).toBeNull();
  });

  it('should match with ? single character wildcard', async () => {
    await service.create(makeCreateInput({ branchPattern: 'dev-?' }));

    const matched = await service.matchPolicy('repo-1', 'dev-1');
    expect(matched).toBeDefined();
  });
});

// ==================== Mergeability Check Tests ====================

describe('BranchPolicyService - Mergeability Check', () => {
  let service: BranchPolicyService;

  const mockPR = {
    id: 'pr-1',
    title: 'Test PR',
    sourceBranch: 'feature/test',
    targetBranch: 'main',
    author: 'dev-user',
    status: 'open',
  };

  beforeEach(() => {
    const { repo: mockRepo } = makeMockRepository();
    service = new BranchPolicyService(mockRepo);
  });

  it('should allow merge when no policy exists', async () => {
    const result = await service.checkMergeability('repo-1', mockPR);

    expect(result.canMerge).toBe(true);
    expect(result.policy).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should block merge when approvals are insufficient', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      approvalRules: [{
        name: 'Core Team',
        requiredApprovals: 2,
        approvers: ['@team-core'],
        allowAuthorApproval: false,
      }],
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      approvals: { '@team-core': 1 },
    });

    expect(result.canMerge).toBe(false);
    expect(result.blocks.some(b => b.rule.includes('approval'))).toBe(true);
  });

  it('should allow merge when approvals are sufficient', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      approvalRules: [{
        name: 'Core Team',
        requiredApprovals: 1,
        approvers: ['@reviewer'],
        allowAuthorApproval: true,
      }],
      requireCodeOwners: false,
      requiredChecks: [],
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      approvals: { '@reviewer': 1 },
    });

    expect(result.canMerge).toBe(true);
    expect(result.blocks).toHaveLength(0);
  });

  it('should block merge when required checks fail', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      requiredChecks: ['ci/build', 'ci/test'],
      approvalRules: [],
      requireCodeOwners: false,
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      checkResults: { 'ci/build': 'success', 'ci/test': 'failure' },
    });

    expect(result.canMerge).toBe(false);
    expect(result.blocks.some(b => b.rule.includes('ci/test'))).toBe(true);
  });

  it('should warn when required checks are pending', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      requiredChecks: ['ci/build'],
      approvalRules: [],
      requireCodeOwners: false,
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      checkResults: { 'ci/build': 'pending' },
    });

    expect(result.canMerge).toBe(true); // warnings don't block
    expect(result.blocks.some(b => b.severity === 'warning')).toBe(true);
  });

  it('should block merge when code owners not approved', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      requireCodeOwners: true,
      approvalRules: [],
      requiredChecks: [],
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      codeOwnersApproved: false,
    });

    expect(result.canMerge).toBe(false);
    expect(result.blocks.some(b => b.rule === 'code-owners')).toBe(true);
  });

  it('should allow admin override when enabled', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      approvalRules: [{
        name: 'Core Team',
        requiredApprovals: 2,
        approvers: ['@team-core'],
        allowAuthorApproval: false,
      }],
      allowAdminOverride: true,
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      isAdmin: true,
    });

    expect(result.canMerge).toBe(true);
    expect(result.warnings.some(w => w.includes('Admin override'))).toBe(true);
  });

  it('should not allow admin override when disabled', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      approvalRules: [{
        name: 'Core Team',
        requiredApprovals: 2,
        approvers: ['@team-core'],
        allowAuthorApproval: false,
      }],
      allowAdminOverride: false,
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      isAdmin: true,
    });

    expect(result.canMerge).toBe(false);
  });

  it('should block when required checks are missing', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      requiredChecks: ['ci/build', 'ci/security-scan'],
      approvalRules: [],
      requireCodeOwners: false,
    }));

    const result = await service.checkMergeability('repo-1', mockPR, {
      checkResults: { 'ci/build': 'success' },
    });

    expect(result.canMerge).toBe(false);
    expect(result.blocks.some(b => b.reason.includes('ci/security-scan'))).toBe(true);
  });

  it('should count total approvals when no specific approvers match', async () => {
    await service.create(makeCreateInput({
      branchPattern: 'main',
      approvalRules: [{
        name: 'Any Reviewer',
        requiredApprovals: 2,
        approvers: ['@specific-team'],
        allowAuthorApproval: true,
      }],
      requiredChecks: [],
      requireCodeOwners: false,
    }));

    // No @specific-team approvals, but 2 approvals from others
    const result = await service.checkMergeability('repo-1', mockPR, {
      approvals: { '@random-dev': 1, '@other-dev': 1 },
    });

    expect(result.canMerge).toBe(true);
  });
});

// ==================== Default Policies Tests ====================

describe('BranchPolicyService - Default Policies', () => {
  let service: BranchPolicyService;

  beforeEach(() => {
    const { repo: mockRepo } = makeMockRepository();
    service = new BranchPolicyService(mockRepo);
  });

  it('should create default policies for common patterns', async () => {
    const policies = await service.createDefaultPolicies('repo-1');

    expect(policies.length).toBeGreaterThan(0);
    const patterns = policies.map(p => p.branchPattern);
    expect(patterns).toContain('main');
    expect(patterns).toContain('develop');
  });

  it('should create policies with strict protection for main branch', async () => {
    const policies = await service.createDefaultPolicies('repo-1');
    const mainPolicy = policies.find(p => p.branchPattern === 'main');

    expect(mainPolicy).toBeDefined();
    expect(mainPolicy?.preventForcePush).toBe(true);
    expect(mainPolicy?.preventDeletion).toBe(true);
  });

  it('should create policies with relaxed protection for develop branch', async () => {
    const policies = await service.createDefaultPolicies('repo-1');
    const devPolicy = policies.find(p => p.branchPattern === 'develop');

    expect(devPolicy).toBeDefined();
    expect(devPolicy?.preventForcePush).toBe(false);
  });
});

// ==================== Database Unavailable Tests ====================

describe('BranchPolicyService - Database Unavailable', () => {
  let service: BranchPolicyService;

  beforeEach(() => {
    service = new BranchPolicyService(null);
  });

  it('should return null from getById when no repository', async () => {
    const result = await service.getById('any-id');
    expect(result).toBeNull();
  });

  it('should return empty array from listByRepo when no repository', async () => {
    const result = await service.listByRepo('repo-1');
    expect(result).toHaveLength(0);
  });

  it('should return empty array from listAll when no repository', async () => {
    const result = await service.listAll();
    expect(result).toHaveLength(0);
  });

  it('should return false from delete when no repository', async () => {
    const result = await service.delete('any-id');
    expect(result).toBe(false);
  });

  it('should throw error on create when no repository', async () => {
    await expect(service.create(makeCreateInput())).rejects.toThrow(
      'BranchPolicyRepository not configured'
    );
  });

  it('should return null on update when no repository', async () => {
    const result = await service.update('any-id', { preventForcePush: false });
    expect(result).toBeNull();
  });

  it('should return null from matchPolicy when no repository', async () => {
    const result = await service.matchPolicy('repo-1', 'main');
    expect(result).toBeNull();
  });

  it('should allow merge when no repository (no policy = no restrictions)', async () => {
    const result = await service.checkMergeability('repo-1', {
      id: 'pr-1',
      title: 'Test',
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      author: 'dev',
      status: 'open',
    });

    expect(result.canMerge).toBe(true);
    expect(result.policy).toBeNull();
  });
});
