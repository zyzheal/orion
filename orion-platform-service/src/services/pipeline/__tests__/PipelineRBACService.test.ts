/**
 * PipelineRBACService tests
 */

import { PipelineRBACService } from '../PipelineRBACService';

describe('PipelineRBACService', () => {
  let rbacService: PipelineRBACService;

  beforeEach(() => {
    rbacService = new PipelineRBACService();
  });

  describe('setRules', () => {
    it('sets rules for a pipeline', () => {
      rbacService.setRules('pipeline-1', [
        { userId: 'user-1', role: 'pipeline.admin' },
        { userId: 'user-2', role: 'pipeline.viewer' },
      ]);

      expect(rbacService.getUserRole('pipeline-1', 'user-1')).toBe('pipeline.admin');
      expect(rbacService.getUserRole('pipeline-1', 'user-2')).toBe('pipeline.viewer');
    });
  });

  describe('addRule / removeRule', () => {
    it('adds and removes a single rule', () => {
      rbacService.addRule('pipeline-1', 'user-1', 'pipeline.editor');
      expect(rbacService.getUserRole('pipeline-1', 'user-1')).toBe('pipeline.editor');

      rbacService.removeRule('pipeline-1', 'user-1');
      expect(rbacService.getUserRole('pipeline-1', 'user-1')).toBeNull();
    });
  });

  describe('getRules', () => {
    it('returns all rules for a pipeline', () => {
      rbacService.setRules('pipeline-1', [
        { userId: 'user-1', role: 'pipeline.admin' },
        { userId: 'user-2', role: 'pipeline.viewer' },
      ]);

      const rules = rbacService.getRules('pipeline-1');
      expect(rules).toHaveLength(2);
      expect(rules.find(r => r.userId === 'user-1')?.role).toBe('pipeline.admin');
    });

    it('returns empty array for pipeline with no rules', () => {
      expect(rbacService.getRules('nonexistent')).toEqual([]);
    });
  });

  describe('default allow (backward compatible)', () => {
    it('allows all actions when no rules exist', () => {
      const triggerResult = rbacService.canTrigger('pipeline-1', 'any-user');
      expect(triggerResult.allowed).toBe(true);
      expect(triggerResult.reason).toContain('No RBAC rules defined');

      const viewResult = rbacService.canView('pipeline-1', 'any-user');
      expect(viewResult.allowed).toBe(true);

      const cancelResult = rbacService.canCancel('run-1', 'any-user', undefined, 'pipeline-1');
      expect(cancelResult.allowed).toBe(true);

      const approveResult = rbacService.canApprove('run-1', 'any-user', undefined, 'pipeline-1');
      expect(approveResult.allowed).toBe(true);
    });
  });

  describe('role permissions', () => {
    beforeEach(() => {
      rbacService.setRules('pipeline-1', [
        { userId: 'admin-user', role: 'pipeline.admin' },
        { userId: 'editor-user', role: 'pipeline.editor' },
        { userId: 'viewer-user', role: 'pipeline.viewer' },
        { userId: 'approver-user', role: 'pipeline.approver' },
      ]);
    });

    describe('pipeline.admin', () => {
      it('can trigger', () => {
        expect(rbacService.canTrigger('pipeline-1', 'admin-user').allowed).toBe(true);
      });
      it('can view', () => {
        expect(rbacService.canView('pipeline-1', 'admin-user').allowed).toBe(true);
      });
      it('can cancel', () => {
        expect(rbacService.canCancel('run-1', 'admin-user', undefined, 'pipeline-1').allowed).toBe(true);
      });
      it('can approve', () => {
        expect(rbacService.canApprove('run-1', 'admin-user', undefined, 'pipeline-1').allowed).toBe(true);
      });
    });

    describe('pipeline.editor', () => {
      it('can trigger', () => {
        expect(rbacService.canTrigger('pipeline-1', 'editor-user').allowed).toBe(true);
      });
      it('can view', () => {
        expect(rbacService.canView('pipeline-1', 'editor-user').allowed).toBe(true);
      });
      it('cannot cancel', () => {
        expect(rbacService.canCancel('run-1', 'editor-user', undefined, 'pipeline-1').allowed).toBe(false);
      });
      it('cannot approve', () => {
        expect(rbacService.canApprove('run-1', 'editor-user', undefined, 'pipeline-1').allowed).toBe(false);
      });
    });

    describe('pipeline.viewer', () => {
      it('can view', () => {
        expect(rbacService.canView('pipeline-1', 'viewer-user').allowed).toBe(true);
      });
      it('cannot trigger', () => {
        expect(rbacService.canTrigger('pipeline-1', 'viewer-user').allowed).toBe(false);
      });
      it('cannot cancel', () => {
        expect(rbacService.canCancel('run-1', 'viewer-user', undefined, 'pipeline-1').allowed).toBe(false);
      });
      it('cannot approve', () => {
        expect(rbacService.canApprove('run-1', 'viewer-user', undefined, 'pipeline-1').allowed).toBe(false);
      });
    });

    describe('pipeline.approver', () => {
      it('can approve', () => {
        expect(rbacService.canApprove('run-1', 'approver-user', undefined, 'pipeline-1').allowed).toBe(true);
      });
      it('can view', () => {
        expect(rbacService.canView('pipeline-1', 'approver-user').allowed).toBe(true);
      });
      it('cannot trigger', () => {
        expect(rbacService.canTrigger('pipeline-1', 'approver-user').allowed).toBe(false);
      });
    });
  });

  describe('unknown user', () => {
    it('denies access to user with no role', () => {
      rbacService.setRules('pipeline-1', [
        { userId: 'admin-user', role: 'pipeline.admin' },
      ]);

      const result = rbacService.canTrigger('pipeline-1', 'unknown-user');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('has no role defined');
    });
  });

  describe('hasPermission', () => {
    it('returns reason for allowed access', () => {
      const result = rbacService.hasPermission('pipeline-1', 'any-user', 'trigger');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('No RBAC rules defined');
    });

    it('returns reason for denied access', () => {
      rbacService.setRules('pipeline-1', [
        { userId: 'viewer-user', role: 'pipeline.viewer' },
      ]);

      const result = rbacService.hasPermission('pipeline-1', 'viewer-user', 'trigger');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not have');
    });
  });
});
