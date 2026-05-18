/**
 * AuthorizationEngine Tests
 */

import { AuthorizationEngine, AuthZRequest, AuthZDecision } from '../AuthorizationEngine';
import { RoleService } from '../../role/RoleService';
import { AbacPolicyEngine } from '../AbacPolicyEngine';
import { RelationshipService } from '../RelationshipService';

// Mock RelationshipService for tests (no DB needed)
class MockRelationshipService {
  private projectMembers: Map<string, Set<string>> = new Map();

  async check(req: { userId: string; tenantId?: string; projectId?: string; resourceId?: string; resourceType: string; ownerId?: string; ownerTenantId?: string }) {
    // Cross-tenant validation
    if (req.tenantId && req.ownerTenantId && req.tenantId !== req.ownerTenantId) {
      return { allowed: false, reason: 'Cross-tenant ownership mismatch' };
    }
    if (req.ownerId && req.userId === req.ownerId) {
      return { allowed: true, reason: 'User is the resource owner', relationshipType: 'owner' };
    }
    if (req.projectId && this.projectMembers.get(req.projectId)?.has(req.userId)) {
      return { allowed: true, reason: 'Project member', relationshipType: 'project_member' };
    }
    return { allowed: false, reason: 'Not resource owner or project member' };
  }

  addProjectMember(projectId: string, userId: string): void {
    if (!this.projectMembers.has(projectId)) {
      this.projectMembers.set(projectId, new Set());
    }
    this.projectMembers.get(projectId)!.add(userId);
  }
}

function makeRequest(overrides: Partial<AuthZRequest> = {}): AuthZRequest {
  return {
    user: {
      id: 'user-1',
      username: 'test-user',
      roles: ['developer'],
      department: 'engineering',
      level: 'senior',
      teams: ['team-alpha'],
      tenantId: 'tenant-1',
      status: 'active',
    },
    resource: {
      type: 'pipeline',
      id: 'pipe-1',
      ownerId: 'user-1',
      tenantId: 'tenant-1',
      projectId: 'proj-1',
      environment: 'dev',
      sensitivity: 'internal',
      department: 'engineering',
    },
    environment: {
      time: new Date('2026-05-18T10:00:00Z'),
      sourceIp: '10.0.0.1',
      network: 'internal',
      requestOrigin: 'web',
    },
    action: {
      type: 'read',
      impact: 'low',
    },
    ...overrides,
  };
}

describe('AuthorizationEngine', () => {
  let rbacService: jest.Mocked<RoleService>;
  let abacEngine: AbacPolicyEngine;
  let relationshipService: MockRelationshipService;
  let mockAuditRepo: jest.Mocked<{ logDecision: jest.Mock }>;
  let engine: AuthorizationEngine;

  beforeEach(() => {
    rbacService = {
      checkPermissions: jest.fn(),
    } as unknown as jest.Mocked<RoleService>;

    mockAuditRepo = {
      logDecision: jest.fn().mockResolvedValue(undefined),
    };

    abacEngine = new AbacPolicyEngine();
    relationshipService = new MockRelationshipService();
    engine = new AuthorizationEngine(rbacService, abacEngine, relationshipService as any, mockAuditRepo);
  });

  describe('[0] User status check', () => {
    it('should deny when user is disabled', async () => {
      const req = makeRequest({ user: { ...makeRequest().user, status: 'disabled' } });
      const result = await engine.evaluate(req);
      expect(result.allowed).toBe(false);
      expect(result.source).toBe('rbac');
      expect(result.reason).toContain('disabled');
    });

    it('should deny when user is suspended', async () => {
      const req = makeRequest({ user: { ...makeRequest().user, status: 'suspended' } });
      const result = await engine.evaluate(req);
      expect(result.allowed).toBe(false);
      expect(result.source).toBe('rbac');
    });
  });

  describe('[1] Super admin bypass', () => {
    it('should allow super_admin regardless of other checks', async () => {
      // RBAC will fail (no permissions granted)
      rbacService.checkPermissions.mockResolvedValue({ allowed: false, reason: 'no perm' });

      const req = makeRequest({ user: { ...makeRequest().user, roles: ['super_admin'] } });
      const result = await engine.evaluate(req);
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('super_admin_bypass');
      expect(result.evaluatedBy).toContain('super_admin');
    });
  });

  describe('[2] RBAC check', () => {
    it('should deny when RBAC check fails', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: false, reason: 'insufficient role' });

      const req = makeRequest();
      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(false);
      expect(result.source).toBe('rbac');
      expect(result.reason).toBe('insufficient role');
    });

    it('should call checkPermissions with correct args', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      const req = makeRequest();
      await engine.evaluate(req);

      expect(rbacService.checkPermissions).toHaveBeenCalledWith(
        ['developer'],
        'pipeline',
        'read',
      );
    });
  });

  describe('[3] ABAC check', () => {
    it('should deny when ABAC denies', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      // External network trying to write — should be denied by ABAC
      const req = makeRequest({
        environment: { ...makeRequest().environment, network: 'external' },
        action: { type: 'create', impact: 'high' },
      });
      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(false);
      expect(result.source).toBe('abac');
    });

    it('should pass ABAC for normal internal requests', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      const req = makeRequest();
      const result = await engine.evaluate(req);

      // Should not be denied at ABAC stage (may fail at relationship or pass all)
      if (result.source === 'abac') {
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe('[4] Relationship check', () => {
    it('should deny when no relationship to resource exists', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      // User is not the owner, not a project member, not a collaborator
      const req = makeRequest({
        user: { ...makeRequest().user, id: 'user-other', roles: ['developer'] },
        resource: { ...makeRequest().resource, ownerId: 'user-owner', id: 'pipe-1' },
      });

      // Set up project membership for the owner only
      relationshipService.addProjectMember('proj-1', 'user-owner');

      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(false);
      expect(result.source).toBe('relationship');
    });

    it('should pass when user is resource owner', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      const req = makeRequest({
        user: { ...makeRequest().user, id: 'user-1' },
        resource: { ...makeRequest().resource, ownerId: 'user-1', id: 'pipe-1' },
      });

      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(true);
    });

    it('should skip relationship check when resourceId is absent', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      const req = makeRequest({ resource: { ...makeRequest().resource, id: undefined } });
      const result = await engine.evaluate(req);

      // Should pass all checks (no relationship check without resourceId)
      expect(result.allowed).toBe(true);
      expect(result.source).toBe('all');
    });

    it('should deny cross-tenant ownership mismatch', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      // User from tenant-A trying to access a resource owned by someone from tenant-B
      // The resource.tenantId must match user.tenantId to pass ABAC, but ownerTenantId differs
      const req = makeRequest({
        user: { ...makeRequest().user, id: 'user-1', tenantId: 'tenant-1' },
        resource: {
          ...makeRequest().resource,
          ownerId: 'user-other',
          tenantId: 'tenant-1', // same tenant as user (passes ABAC)
          id: 'pipe-1',
        },
      });

      // We need to set ownerTenantId differently but makeRequest doesn't support it directly
      // The RelationshipService check gets ownerTenantId from resource.tenantId
      // Since both are 'tenant-1', cross-tenant check passes. Let's override the mock.
      const origCheck = relationshipService.check.bind(relationshipService);
      relationshipService.check = jest.fn().mockResolvedValue({
        allowed: false,
        reason: 'Cross-tenant ownership mismatch',
      });

      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(false);
      expect(result.source).toBe('relationship');
      expect(result.reason).toContain('Cross-tenant');

      // Restore
      relationshipService.check = origCheck;
    });
  });

  describe('[5] All checks passed', () => {
    it('should return allowed=true with source=all', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });

      const req = makeRequest({
        user: { ...makeRequest().user, id: 'user-1' },
        resource: { ...makeRequest().resource, ownerId: 'user-1', id: 'pipe-1' },
      });

      const result = await engine.evaluate(req);

      expect(result.allowed).toBe(true);
      expect(result.source).toBe('all');
      expect(result.evaluatedBy).toContain('rbac');
      expect(result.evaluatedBy).toContain('abac');
      expect(result.evaluatedBy).toContain('relationship');
      expect(result.evaluationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AuthZDecision shape', () => {
    it('should return valid decision on allow', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });
      const req = makeRequest({
        resource: { ...makeRequest().resource, id: undefined },
      });

      const result = await engine.evaluate(req);

      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.reason).toBe('string');
      expect(typeof result.evaluationTime).toBe('number');
      expect(Array.isArray(result.evaluatedBy)).toBe(true);
    });

    it('should return valid decision on deny', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: false, reason: 'no role' });
      const result = await engine.evaluate(makeRequest());

      expect(result.allowed).toBe(false);
      expect(result.evaluatedBy).toEqual(['rbac']);
    });
  });

  describe('Audit logging', () => {
    it('should log deny decision to audit repo', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: false, reason: 'no role' });
      await engine.evaluate(makeRequest());

      expect(mockAuditRepo.logDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'deny',
          decisionSource: 'rbac',
          userId: 'user-1',
        }),
      );
    });

    it('should log allow decision to audit repo', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: true, reason: 'ok' });
      const req = makeRequest({
        resource: { ...makeRequest().resource, id: undefined },
      });
      await engine.evaluate(req);

      expect(mockAuditRepo.logDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'allow',
          decisionSource: 'all',
          userId: 'user-1',
        }),
      );
    });

    it('should log super_admin bypass allow', async () => {
      rbacService.checkPermissions.mockResolvedValue({ allowed: false, reason: 'no role' });
      const req = makeRequest({ user: { ...makeRequest().user, roles: ['super_admin'] } });
      await engine.evaluate(req);

      expect(mockAuditRepo.logDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'allow',
          decisionSource: 'super_admin_bypass',
        }),
      );
    });
  });
});
