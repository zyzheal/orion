/**
 * Approval Workflow Integration Tests
 *
 * Tests complete approval workflow:
 * - Multi-level approval creation
 * - Approval and rejection flow
 * - Status transitions
 * - Tenant isolation
 */

import { ApprovalService, ApprovalStatus, ApprovalRequest } from '../ApprovalService';
import { ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { v4 as uuidv4 } from 'uuid';

// Helper: convert camelCase to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper: convert object keys from camelCase to snake_case
function toSnakeCase(obj: any): any {
  const result: any = {};
  for (const key in obj) {
    result[camelToSnake(key)] = obj[key];
  }
  return result;
}

// Mock database for ApprovalRepository
class MockDatabase {
  private approvals: Map<string, any> = new Map();
  private steps: Map<string, any> = new Map();

  async transaction<T>(fn: (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) => Promise<T>): Promise<T> {
    // Mock: just execute the function sequentially (no real transaction isolation needed for tests)
    return fn(this);
  }

  async query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> {
    // Handle INSERT INTO approvals
    if (text.includes('INSERT INTO approvals')) {
      // Parse column names from SQL (these are camelCase from service)
      const columnsMatch = text.match(/INSERT INTO approvals \(([^)]+)\)/);
      if (!columnsMatch) return { rows: [], rowCount: 0 };
      const camelColumns = columnsMatch[1].split(', ').map(c => c.trim());

      // Convert to snake_case for database storage
      const snakeColumns = camelColumns.map(camelToSnake);

      // Build row with snake_case field names
      const id = params && camelColumns.includes('id')
        ? params[camelColumns.indexOf('id')] as string
        : `approval-${uuidv4()}`;
      const row: any = { id };
      camelColumns.forEach((col, i) => {
        if (params && i < params.length) {
          const snakeCol = camelToSnake(col);
          row[snakeCol] = params[i];
        }
      });
      row.created_at = row.created_at || new Date();

      this.approvals.set(id, row);
      return { rows: [row], rowCount: 1 };
    }

    // Handle INSERT INTO approval_steps
    if (text.includes('INSERT INTO approval_steps')) {
      const columnsMatch = text.match(/INSERT INTO approval_steps \(([^)]+)\)/);
      if (!columnsMatch) return { rows: [], rowCount: 0 };
      const camelColumns = columnsMatch[1].split(', ').map(c => c.trim());
      const snakeColumns = camelColumns.map(camelToSnake);

      const id = `step-${uuidv4()}`;
      const row: any = { id };
      camelColumns.forEach((col, i) => {
        if (params && i < params.length) {
          const snakeCol = camelToSnake(col);
          row[snakeCol] = params[i];
        }
      });
      row.status = row.status || 'pending';

      this.steps.set(id, row);
      return { rows: [row], rowCount: 1 };
    }

    // Handle SELECT FROM approvals WHERE id
    if (text.includes('SELECT') && text.includes('FROM approvals WHERE id =')) {
      const id = params?.[0] as string;
      const row = this.approvals.get(id);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    // Handle SELECT FROM approvals WHERE tenant_id
    if (text.includes('SELECT') && text.includes('FROM approvals WHERE tenant_id =')) {
      const tenantId = params?.[0] as string;
      const status = params?.[1] as string | undefined;
      const rows = Array.from(this.approvals.values())
        .filter(r => r.tenant_id === tenantId)
        .filter(r => status ? r.status === status : true);
      return { rows, rowCount: rows.length };
    }

    // Handle SELECT FROM approval_steps WHERE approval_id
    if (text.includes('SELECT') && text.includes('FROM approval_steps WHERE approval_id =')) {
      const approvalId = params?.[0] as string;
      const rows = Array.from(this.steps.values())
        .filter(s => s.approval_id === approvalId)
        .sort((a, b) => a.step_index - b.step_index);
      return { rows, rowCount: rows.length };
    }

    // Handle UPDATE approvals SET status
    if (text.includes('UPDATE approvals SET status =')) {
      const status = params?.[0] as string;
      const completedAt = params?.[1] as Date | null;
      // Find the id parameter (last one in the array)
      const id = params?.[params.length - 1] as string;
      const row = this.approvals.get(id);
      if (!row) return { rows: [], rowCount: 0 };

      const updatedRow = {
        ...row,
        status,
        completed_at: completedAt ?? (status === 'approved' || status === 'rejected' ? new Date() : null),
      };

      // Handle current_step update if present in query
      if (text.includes('current_step =')) {
        updatedRow.current_step = status === 'approved' ? row.total_steps : row.current_step;
      }

      this.approvals.set(id, updatedRow);
      return { rows: [updatedRow], rowCount: 1 };
    }

    // Handle UPDATE approvals SET current_step
    if (text.includes('UPDATE approvals SET current_step =') && !text.includes('status')) {
      const id = params?.[0] as string;
      const row = this.approvals.get(id);
      if (!row || row.status !== 'pending') return { rows: [], rowCount: 0 };
      const updatedRow = {
        ...row,
        current_step: row.current_step + 1,
      };
      this.approvals.set(id, updatedRow);
      return { rows: [updatedRow], rowCount: 1 };
    }

    // Handle UPDATE approval_steps SET status
    if (text.includes('UPDATE approval_steps SET status =')) {
      const status = params?.[0] as string;
      const comment = params?.[1] as string | null;
      const actedAt = params?.[2] as Date | null;
      const stepId = params?.[params.length - 1] as string;

      const step = this.steps.get(stepId);
      if (!step) return { rows: [], rowCount: 0 };
      const updatedStep = {
        ...step,
        status,
        comment,
        acted_at: actedAt ?? (status !== 'pending' ? new Date() : null),
      };
      this.steps.set(stepId, updatedStep);
      return { rows: [updatedStep], rowCount: 1 };
    }

    // Default: return empty result
    return { rows: [], rowCount: 0 };
  }
}

describe('Approval Workflow Integration Tests', () => {
  let service: ApprovalService;
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    service = new ApprovalService(db);
  });

  describe('Multi-Level Approval Workflow', () => {
    it('should create approval with multiple approvers', async () => {
      // Create approval request with 3 approvers
      const approval = await service.createApproval(
        'Production Deployment Approval',
        'user-1',
        ['approver-1', 'approver-2', 'approver-3'],
        2, // Requires 2 approvals out of 3
        'Deploy version 2.0 to production',
        { tenantId: 'tenant-1', resourceType: 'deployment', resourceId: 'deploy-123' }
      );

      expect(approval).toBeDefined();
      expect(approval.id).toBeDefined();
      expect(approval.title).toBe('Production Deployment Approval');
      expect(approval.status).toBe(ApprovalStatus.PENDING);
      expect(approval.approverIds).toHaveLength(3);
      expect(approval.requiredApprovals).toBe(2);
      expect(approval.requesterId).toBe('user-1');

      // Verify approver IDs are correct
      expect(approval.approverIds).toContain('approver-1');
      expect(approval.approverIds).toContain('approver-2');
      expect(approval.approverIds).toContain('approver-3');
    });

    it('should approve when required approvals reached', async () => {
      // Create approval requiring 2 approvals out of 3 approvers
      const approval = await service.createApproval(
        'Feature Release',
        'user-1',
        ['approver-1', 'approver-2', 'approver-3'],
        2,
        'Release new feature to production',
        { tenantId: 'tenant-1' }
      );

      expect(approval.status).toBe(ApprovalStatus.PENDING);

      // First approver approves
      const afterFirstApprove = await service.approve(approval.id, 'approver-1');
      expect(afterFirstApprove.status).toBe(ApprovalStatus.PENDING);
      expect(afterFirstApprove.approvals).toContain('approver-1');

      // Check approval status via service
      const approvalDetails = await service.getApproval(approval.id);
      expect(approvalDetails?.approvals).toContain('approver-1');

      // Second approver approves (reaches required 2)
      const afterSecondApprove = await service.approve(approval.id, 'approver-2');
      expect(afterSecondApprove.status).toBe(ApprovalStatus.APPROVED);
      expect(afterSecondApprove.approvals).toHaveLength(2);
      expect(afterSecondApprove.approvals).toContain('approver-1');
      expect(afterSecondApprove.approvals).toContain('approver-2');

      // Verify approval is completed
      const finalApproval = await service.getApproval(approval.id);
      expect(finalApproval?.status).toBe(ApprovalStatus.APPROVED);
    });

    it('should handle rejection workflow', async () => {
      // Create approval
      const approval = await service.createApproval(
        'Emergency Change',
        'user-1',
        ['approver-1', 'approver-2'],
        2,
        'Emergency database migration',
        { tenantId: 'tenant-1' }
      );

      // First approver approves
      await service.approve(approval.id, 'approver-1');

      // Second approver rejects
      const afterReject = await service.reject(approval.id, 'approver-2');
      expect(afterReject.status).toBe(ApprovalStatus.REJECTED);
      expect(afterReject.rejections).toContain('approver-2');

      // Verify approval is rejected
      const rejectedApproval = await service.getApproval(approval.id);
      expect(rejectedApproval?.status).toBe(ApprovalStatus.REJECTED);
    });

    it('should prevent approval after rejection', async () => {
      const approval = await service.createApproval(
        'Test Approval',
        'user-1',
        ['approver-1', 'approver-2'],
        1,
        'Test',
        { tenantId: 'tenant-1' }
      );

      // Reject the approval
      await service.reject(approval.id, 'approver-1');

      // Try to approve after rejection
      await expect(service.approve(approval.id, 'approver-2')).rejects.toThrow('Approval not pending');
    });

    it('should prevent non-authorized user from approving', async () => {
      const approval = await service.createApproval(
        'Restricted Approval',
        'user-1',
        ['approver-1', 'approver-2'],
        1,
        'High-security deployment',
        { tenantId: 'tenant-1' }
      );

      // Non-authorized user tries to approve
      await expect(service.approve(approval.id, 'non-approver')).rejects.toThrow('Not authorized to approve');
    });
  });

  describe('Approval Request Management', () => {
    it('should get approval request details', async () => {
      const approval = await service.createApproval(
        'Details Test',
        'user-1',
        ['approver-1'],
        1,
        'Test description',
        { tenantId: 'tenant-1', resourceId: 'resource-123' }
      );

      // Get approval details
      const details = await service.getApproval(approval.id);
      expect(details).toBeDefined();
      expect(details?.id).toBe(approval.id);
      expect(details?.title).toBe('Details Test');
      expect(details?.requesterId).toBe('user-1');
    });

    it('should list pending approvals by tenant', async () => {
      // Create multiple approvals for different tenants
      await service.createApproval(
        'Tenant 1 Approval 1',
        'user-1',
        ['approver-1'],
        1,
        'Desc',
        { tenantId: 'tenant-1' }
      );

      await service.createApproval(
        'Tenant 1 Approval 2',
        'user-2',
        ['approver-2'],
        1,
        'Desc',
        { tenantId: 'tenant-1' }
      );

      await service.createApproval(
        'Tenant 2 Approval',
        'user-3',
        ['approver-3'],
        1,
        'Desc',
        { tenantId: 'tenant-2' }
      );

      // Approve one from tenant-1
      const tenant1Approvals = await service.listPending('tenant-1');
      expect(tenant1Approvals).toHaveLength(2);

      // Approve one
      await service.approve(tenant1Approvals[0].id, tenant1Approvals[0].approverIds[0]);

      // Check pending again
      const remainingPending = await service.listPending('tenant-1');
      expect(remainingPending).toHaveLength(1);

      // Tenant 2 should have 1 pending
      const tenant2Approvals = await service.listPending('tenant-2');
      expect(tenant2Approvals).toHaveLength(1);
    });

    it('should handle single-approver approval', async () => {
      const approval = await service.createApproval(
        'Single Approver Test',
        'user-1',
        ['approver-1'],
        1,
        'Single approval needed',
        { tenantId: 'tenant-1' }
      );

      expect(approval.approverIds).toHaveLength(1);
      expect(approval.requiredApprovals).toBe(1);

      // Single approval should mark as approved
      const afterApprove = await service.approve(approval.id, 'approver-1');
      expect(afterApprove.status).toBe(ApprovalStatus.APPROVED);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate approvals by tenant', async () => {
      const tenant1Approval = await service.createApproval(
        'Tenant 1 Resource',
        'user-1',
        ['approver-1'],
        1,
        'Tenant 1 specific',
        { tenantId: 'tenant-1' }
      );

      const tenant2Approval = await service.createApproval(
        'Tenant 2 Resource',
        'user-2',
        ['approver-2'],
        1,
        'Tenant 2 specific',
        { tenantId: 'tenant-2' }
      );

      // List pending by tenant
      const tenant1Pending = await service.listPending('tenant-1');
      expect(tenant1Pending).toHaveLength(1);
      expect(tenant1Pending[0].id).toBe(tenant1Approval.id);

      const tenant2Pending = await service.listPending('tenant-2');
      expect(tenant2Pending).toHaveLength(1);
      expect(tenant2Pending[0].id).toBe(tenant2Approval.id);

      // Cross-tenant approval should fail
      await expect(service.approve(tenant1Approval.id, 'approver-2')).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle all approvers approving', async () => {
      const approval = await service.createApproval(
        'All Approve Test',
        'user-1',
        ['approver-1', 'approver-2', 'approver-3'],
        2,
        'All should approve',
        { tenantId: 'tenant-1' }
      );

      // First two approve (reaches required 2)
      await service.approve(approval.id, 'approver-1');
      const afterSecondApprove = await service.approve(approval.id, 'approver-2');

      expect(afterSecondApprove.status).toBe(ApprovalStatus.APPROVED);
      expect(afterSecondApprove.approvals).toHaveLength(2);

      // Third approver cannot approve anymore (approval already approved)
      await expect(service.approve(approval.id, 'approver-3')).rejects.toThrow('Approval not pending');
    });

    it('should handle duplicate approval attempts', async () => {
      const approval = await service.createApproval(
        'Duplicate Test',
        'user-1',
        ['approver-1', 'approver-2'],
        1,
        'Test',
        { tenantId: 'tenant-1' }
      );

      // First approval (reaches required 1, approval becomes approved)
      const afterFirstApprove = await service.approve(approval.id, 'approver-1');
      expect(afterFirstApprove.status).toBe(ApprovalStatus.APPROVED);

      // Try to approve again (should fail because approval is already approved)
      await expect(service.approve(approval.id, 'approver-1')).rejects.toThrow('Approval not pending');
    });

    it('should return undefined for non-existent approval', async () => {
      const result = await service.getApproval('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should handle approval with no approvers', async () => {
      // Create approval with empty approver list
      await expect(
        service.createApproval(
          'No Approver Test',
          'user-1',
          [],
          0,
          'Test',
          { tenantId: 'tenant-1' }
        )
      ).resolves.toBeDefined();

      const approval = await service.createApproval(
        'No Approver Test',
        'user-1',
        [],
        0,
        'Test',
        { tenantId: 'tenant-1' }
      );

      expect(approval.approverIds).toHaveLength(0);
      expect(approval.requiredApprovals).toBe(0);
    });
  });

  describe('Approval Flow Scenarios', () => {
    it('should simulate production deployment approval flow', async () => {
      // Step 1: Developer requests production deployment approval
      const approval = await service.createApproval(
        'Production Deployment v3.0',
        'developer-1',
        ['team-lead-1', 'security-reviewer', 'ops-manager'],
        2, // Requires at least team lead + one other
        'Deploy new version to production with security fixes',
        {
          tenantId: 'tenant-1',
          resourceType: 'deployment',
          resourceId: 'deploy-prod-456',
        }
      );

      expect(approval.status).toBe(ApprovalStatus.PENDING);

      // Step 2: Team lead approves first
      const afterTeamLead = await service.approve(approval.id, 'team-lead-1');
      expect(afterTeamLead.approvals).toContain('team-lead-1');
      expect(afterTeamLead.status).toBe(ApprovalStatus.PENDING); // Still needs one more

      // Step 3: Security reviewer checks and approves
      const afterSecurity = await service.approve(approval.id, 'security-reviewer');
      expect(afterSecurity.status).toBe(ApprovalStatus.APPROVED);
      expect(afterSecurity.approvals).toHaveLength(2);

      // Step 4: Verify deployment is approved
      const finalState = await service.getApproval(approval.id);
      expect(finalState?.status).toBe(ApprovalStatus.APPROVED);

      // Ops manager cannot approve anymore (approval already approved)
      await expect(service.approve(approval.id, 'ops-manager')).rejects.toThrow('Approval not pending');
    });

    it('should handle emergency approval with quick rejection', async () => {
      // Emergency change request
      const approval = await service.createApproval(
        'Emergency: Database Schema Change',
        'dba-1',
        ['cto', 'security-lead'],
        2,
        'Critical: Fix production database issue',
        { tenantId: 'tenant-1', resourceType: 'database-change' }
      );

      // CTO approves quickly
      await service.approve(approval.id, 'cto');

      // Security lead rejects due to risk
      const afterReject = await service.reject(approval.id, 'security-lead');
      expect(afterReject.status).toBe(ApprovalStatus.REJECTED);

      // Change should be blocked
      const finalApproval = await service.getApproval(approval.id);
      expect(finalApproval?.status).toBe(ApprovalStatus.REJECTED);
    });
  });
});