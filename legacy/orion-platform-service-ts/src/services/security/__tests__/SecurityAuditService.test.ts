/**
 * SecurityAuditService Unit Tests
 *
 * Tests: audit plan CRUD, audit execution, report generation,
 * finding tracking, finding management
 */

import { SecurityAuditService } from '../SecurityAuditService';
import { OrionError, ErrorCode } from '../../../errors';

// Mock Phase3Repository
jest.mock('../../../repositories/Phase3Repository', () => {
  const mockPlanRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByTenant: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
  };

  const mockExecutionRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByPlanId: jest.fn().mockResolvedValue([]),
    findLatestByPlan: jest.fn(),
    update: jest.fn(),
  };

  const mockFindingRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    findByExecutionId: jest.fn().mockResolvedValue([]),
    findByTenant: jest.fn().mockResolvedValue([]),
    countByExecution: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
  };

  return {
    AuditPlanRepository: jest.fn(() => mockPlanRepo),
    AuditExecutionRepository: jest.fn(() => mockExecutionRepo),
    AuditFindingRepository: jest.fn(() => mockFindingRepo),
  };
});

describe('SecurityAuditService', () => {
  let service: SecurityAuditService;
  const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SecurityAuditService(mockDb as any);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create instance with db', () => {
      expect(service).toBeInstanceOf(SecurityAuditService);
    });

    it('should create instance without db', () => {
      const noDbService = new SecurityAuditService();
      expect(noDbService).toBeInstanceOf(SecurityAuditService);
    });
  });

  // ==================== Audit Plan CRUD ====================

  describe('createAuditPlan', () => {
    it('should create an audit plan', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      const expected = {
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Quarterly Security Audit',
        audit_type: 'security',
        status: 'draft',
      };
      mockRepo.create.mockResolvedValue(expected);

      const result = await service.createAuditPlan('tenant-1', {
        name: 'Quarterly Security Audit',
        auditType: 'security',
      });

      expect(result).toEqual(expected);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          name: 'Quarterly Security Audit',
          audit_type: 'security',
          status: 'draft',
          schedule_type: 'manual',
        }),
      );
    });

    it('should use provided optional fields', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.create.mockResolvedValue({ id: 'plan-2' });

      await service.createAuditPlan('tenant-1', {
        name: 'Test Plan',
        auditType: 'compliance',
        description: 'A test plan',
        scheduleType: 'cron',
        cronExpression: '0 0 * * 1',
        reviewers: [{ name: 'Alice' }],
        createdBy: 'user-1',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'A test plan',
          schedule_type: 'cron',
          cron_expression: '0 0 * * 1',
          reviewers: [{ name: 'Alice' }],
          created_by: 'user-1',
        }),
      );
    });

    it('should throw when no db configured', async () => {
      const noDbService = new SecurityAuditService();

      await expect(
        noDbService.createAuditPlan('tenant-1', { name: 'test', auditType: 'security' }),
      ).rejects.toThrow(OrionError);
    });
  });

  describe('getAuditPlan', () => {
    it('should return plan by id', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({ id: 'plan-1', name: 'Test' });

      const result = await service.getAuditPlan('plan-1');

      expect(result).toEqual({ id: 'plan-1', name: 'Test' });
    });

    it('should return undefined for non-existent plan', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await service.getAuditPlan('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('listAuditPlans', () => {
    it('should list plans for tenant', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.findByTenant.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

      const result = await service.listAuditPlans('tenant-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('updateAuditPlan', () => {
    it('should update plan fields', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.update.mockResolvedValue({ id: 'plan-1', name: 'Updated' });

      const result = await service.updateAuditPlan('plan-1', {
        name: 'Updated',
        auditType: 'compliance',
      });

      expect(mockRepo.update).toHaveBeenCalledWith('plan-1', {
        name: 'Updated',
        audit_type: 'compliance',
      });
    });
  });

  describe('deleteAuditPlan', () => {
    it('should delete a plan', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.deleteAuditPlan('plan-1');

      expect(result).toBe(true);
    });
  });

  // ==================== Audit Execution ====================

  describe('executeAudit', () => {
    it('should execute a security audit', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        audit_type: 'security',
        scope: {},
      });

      mockExecRepo.create.mockResolvedValue({ id: 'exec-1', status: 'running' });
      mockExecRepo.update.mockResolvedValue({ id: 'exec-1', status: 'completed', findings_count: 2 });
      mockFindingRepo.countByExecution.mockResolvedValue(2);
      mockFindingRepo.create.mockResolvedValue({ id: 'finding-1' });

      const result = await service.executeAudit('tenant-1', 'plan-1');

      expect(result.status).toBe('completed');
      expect(mockExecRepo.create).toHaveBeenCalled();
      expect(mockPlanRepo.update).toHaveBeenCalledWith('plan-1', { status: 'active' });
    });

    it('should throw NOT_FOUND when plan does not exist', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.executeAudit('tenant-1', 'non-existent'),
      ).rejects.toThrow('Audit plan not found');
    });

    it('should throw VALIDATION_ERROR when tenant mismatch', async () => {
      const { AuditPlanRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditPlanRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'other-tenant',
      });

      await expect(
        service.executeAudit('tenant-1', 'plan-1'),
      ).rejects.toThrow('does not belong to this tenant');
    });

    it('should run compliance checks', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        audit_type: 'compliance',
        scope: {},
      });
      mockExecRepo.create.mockResolvedValue({ id: 'exec-2' });
      mockExecRepo.update.mockResolvedValue({ id: 'exec-2', status: 'completed' });
      mockFindingRepo.countByExecution.mockResolvedValue(0);

      const result = await service.executeAudit('tenant-1', 'plan-1');

      expect(result).toBeDefined();
    });

    it('should run access checks', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        audit_type: 'access',
        scope: {},
      });
      mockExecRepo.create.mockResolvedValue({ id: 'exec-3' });
      mockExecRepo.update.mockResolvedValue({ id: 'exec-3', status: 'completed' });
      mockFindingRepo.countByExecution.mockResolvedValue(1);
      mockFindingRepo.create.mockResolvedValue({ id: 'finding-1' });

      const result = await service.executeAudit('tenant-1', 'plan-1');

      expect(result).toBeDefined();
    });

    it('should run full audit (security + compliance + access)', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        audit_type: 'full',
        scope: {},
      });
      mockExecRepo.create.mockResolvedValue({ id: 'exec-4' });
      mockExecRepo.update.mockResolvedValue({ id: 'exec-4', status: 'completed' });
      mockFindingRepo.countByExecution.mockResolvedValue(3);
      mockFindingRepo.create.mockResolvedValue({ id: 'finding-x' });

      const result = await service.executeAudit('tenant-1', 'plan-1');

      expect(result).toBeDefined();
      // Full audit should have run all check types
    });

    it('should handle unknown audit type', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        audit_type: 'unknown_type',
        scope: {},
      });
      mockExecRepo.create.mockResolvedValue({ id: 'exec-5' });
      mockExecRepo.update.mockResolvedValue({ id: 'exec-5', status: 'completed' });
      mockFindingRepo.countByExecution.mockResolvedValue(1);
      mockFindingRepo.create.mockResolvedValue({ id: 'finding-unknown' });

      const result = await service.executeAudit('tenant-1', 'plan-1');

      expect(result).toBeDefined();
      // Should have created a finding for unknown audit type
      expect(mockFindingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Unknown audit type',
          severity: 'medium',
        }),
      );
    });
  });

  // ==================== Execution Management ====================

  describe('getExecution', () => {
    it('should return execution by id', async () => {
      const { AuditExecutionRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditExecutionRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({ id: 'exec-1', status: 'completed' });

      const result = await service.getExecution('exec-1');

      expect(result).toEqual({ id: 'exec-1', status: 'completed' });
    });
  });

  describe('listExecutions', () => {
    it('should list executions for a plan', async () => {
      const { AuditExecutionRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditExecutionRepository.mock.results[0]?.value;
      mockRepo.findByPlanId.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

      const result = await service.listExecutions('plan-1');

      expect(result).toHaveLength(2);
    });
  });

  // ==================== Audit Report ====================

  describe('generateAuditReport', () => {
    it('should generate audit report', async () => {
      const { AuditPlanRepository, AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({
        id: 'plan-1',
        tenant_id: 'tenant-1',
        name: 'Q1 Security Audit',
      });
      mockExecRepo.findLatestByPlan.mockResolvedValue({
        id: 'exec-1',
        plan_id: 'plan-1',
        status: 'completed',
      });
      mockFindingRepo.findByExecutionId.mockResolvedValue([
        { id: 'f1', severity: 'high', status: 'open', category: 'encryption' },
        { id: 'f2', severity: 'medium', status: 'closed', category: 'access' },
        { id: 'f3', severity: 'high', status: 'open', category: 'encryption' },
      ]);

      const report = await service.generateAuditReport('tenant-1', 'plan-1');

      expect(report.plan.id).toBe('plan-1');
      expect(report.execution.id).toBe('exec-1');
      expect(report.findings).toHaveLength(3);
      expect(report.summary.totalFindings).toBe(3);
      expect(report.summary.bySeverity['high']).toBe(2);
      expect(report.summary.bySeverity['medium']).toBe(1);
      expect(report.summary.byStatus['open']).toBe(2);
      expect(report.summary.byCategory['encryption']).toBe(2);
    });

    it('should throw when no executions found', async () => {
      const { AuditPlanRepository, AuditExecutionRepository } = require('../../../repositories/Phase3Repository');
      const mockPlanRepo = AuditPlanRepository.mock.results[0]?.value;
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;

      mockPlanRepo.findById.mockResolvedValue({ id: 'plan-1', tenant_id: 'tenant-1' });
      mockExecRepo.findLatestByPlan.mockResolvedValue(undefined);

      await expect(
        service.generateAuditReport('tenant-1', 'plan-1'),
      ).rejects.toThrow('No executions found');
    });
  });

  // ==================== Findings ====================

  describe('trackAuditFindings', () => {
    it('should track findings for latest execution', async () => {
      const { AuditExecutionRepository, AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockExecRepo = AuditExecutionRepository.mock.results[0]?.value;
      const mockFindingRepo = AuditFindingRepository.mock.results[0]?.value;

      mockExecRepo.findLatestByPlan.mockResolvedValue({
        id: 'exec-1',
        tenant_id: 'tenant-1',
      });
      mockFindingRepo.findByExecutionId.mockResolvedValue([
        { id: 'f1', title: 'Finding 1', severity: 'high' },
      ]);

      const result = await service.trackAuditFindings('tenant-1', 'plan-1');

      expect(result).toHaveLength(1);
    });

    it('should throw when no executions found', async () => {
      const { AuditExecutionRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditExecutionRepository.mock.results[0]?.value;
      mockRepo.findLatestByPlan.mockResolvedValue(undefined);

      await expect(
        service.trackAuditFindings('tenant-1', 'plan-1'),
      ).rejects.toThrow('No executions found');
    });

    it('should throw when tenant mismatch', async () => {
      const { AuditExecutionRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditExecutionRepository.mock.results[0]?.value;
      mockRepo.findLatestByPlan.mockResolvedValue({
        id: 'exec-1',
        tenant_id: 'other-tenant',
      });

      await expect(
        service.trackAuditFindings('tenant-1', 'plan-1'),
      ).rejects.toThrow('does not belong to this tenant');
    });
  });

  describe('getFinding', () => {
    it('should return finding by id', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({ id: 'f1', title: 'Finding 1' });

      const result = await service.getFinding('f1');

      expect(result).toEqual({ id: 'f1', title: 'Finding 1' });
    });
  });

  describe('closeFinding', () => {
    it('should close a finding', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'f1',
        tenant_id: 'tenant-1',
        description: 'Original description',
      });
      mockRepo.update.mockResolvedValue({
        id: 'f1',
        status: 'closed',
        closed_at: new Date(),
      });

      const result = await service.closeFinding('tenant-1', 'f1', 'Fixed by applying patch');

      expect(result.status).toBe('closed');
      expect(mockRepo.update).toHaveBeenCalledWith('f1', expect.objectContaining({
        status: 'closed',
      }));
    });

    it('should close finding without resolution', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'f1',
        tenant_id: 'tenant-1',
        description: 'Original desc',
      });
      mockRepo.update.mockResolvedValue({ id: 'f1', status: 'closed' });

      await service.closeFinding('tenant-1', 'f1');

      expect(mockRepo.update).toHaveBeenCalledWith('f1', expect.objectContaining({
        status: 'closed',
      }));
    });

    it('should throw when finding not found', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.closeFinding('tenant-1', 'non-existent'),
      ).rejects.toThrow('Finding not found');
    });

    it('should throw when tenant mismatch', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'f1',
        tenant_id: 'other-tenant',
      });

      await expect(
        service.closeFinding('tenant-1', 'f1'),
      ).rejects.toThrow('does not belong to this tenant');
    });
  });

  describe('updateFinding', () => {
    it('should update finding status and assignment', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({
        id: 'f1',
        tenant_id: 'tenant-1',
      });
      mockRepo.update.mockResolvedValue({ id: 'f1', status: 'in_progress' });

      await service.updateFinding('tenant-1', 'f1', {
        status: 'in_progress',
        assignedTo: 'user-1',
        recommendation: 'Fix ASAP',
      });

      expect(mockRepo.update).toHaveBeenCalledWith('f1', {
        status: 'in_progress',
        assigned_to: 'user-1',
        recommendation: 'Fix ASAP',
      });
    });

    it('should handle partial updates', async () => {
      const { AuditFindingRepository } = require('../../../repositories/Phase3Repository');
      const mockRepo = AuditFindingRepository.mock.results[0]?.value;
      mockRepo.findById.mockResolvedValue({ id: 'f1', tenant_id: 'tenant-1' });
      mockRepo.update.mockResolvedValue({ id: 'f1' });

      await service.updateFinding('tenant-1', 'f1', { status: 'resolved' });

      expect(mockRepo.update).toHaveBeenCalledWith('f1', { status: 'resolved' });
    });
  });
});
