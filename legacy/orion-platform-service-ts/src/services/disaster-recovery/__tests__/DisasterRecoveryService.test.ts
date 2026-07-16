/**
 * DisasterRecoveryService Unit Tests
 */

import { DisasterRecoveryService, DisasterRecoveryError } from '../DisasterRecoveryService';
import { DisasterRecoveryRepository } from '../../../repositories/DisasterRecoveryRepository';

// Mock types
interface MockRepository {
  findAllPlans: jest.Mock;
  findPlanById: jest.Mock;
  createPlan: jest.Mock;
  updatePlan: jest.Mock;
  updateLastTested: jest.Mock;
  deletePlan: jest.Mock;
  findAllFailoverTests: jest.Mock;
  findFailoverTestById: jest.Mock;
  createFailoverTest: jest.Mock;
  completeFailoverTest: jest.Mock;
  deleteFailoverTest: jest.Mock;
  findAllBackupConfigs: jest.Mock;
  findBackupConfigById: jest.Mock;
  createBackupConfig: jest.Mock;
  updateBackupConfig: jest.Mock;
  deleteBackupConfig: jest.Mock;
}

describe('DisasterRecoveryService', () => {
  let service: DisasterRecoveryService;
  let mockRepo: MockRepository;

  const mockPlanRow = {
    id: 'plan-123',
    tenant_id: 'tenant-1',
    plan_name: 'Primary DR Plan',
    rto_target: 300, // 5 minutes in seconds
    rpo_target: 60, // 1 minute in seconds
    priority: 'high',
    status: 'active',
    services: [{ name: 'api-service', type: 'kubernetes' }],
    failover_strategy: 'active-passive',
    backup_regions: ['us-west-2', 'us-east-1'],
    last_tested_at: new Date('2026-01-01'),
    created_by: 'admin',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockFailoverTestRow = {
    id: 'test-123',
    tenant_id: 'tenant-1',
    plan_id: 'plan-123',
    test_name: 'DR Drill - Primary',
    test_type: 'drill',
    started_at: new Date('2026-01-01'),
    completed_at: new Date('2026-01-01'),
    actual_rto: 180,
    actual_rpo: 45,
    result: 'passed',
    affected_services: ['api-service'],
    findings: 'All systems transitioned successfully',
    created_by: 'admin',
    created_at: new Date('2026-01-01'),
  };

  const mockBackupConfigRow = {
    id: 'backup-123',
    tenant_id: 'tenant-1',
    source_type: 'database',
    source_id: 'db-primary',
    backup_schedule: '0 2 * * *',
    retention_days: 30,
    storage_location: 's3://backups/db-primary',
    encryption: true,
    compression: 'gzip',
    last_backup_at: new Date('2026-01-01'),
    last_backup_size: 1024000,
    enabled: true,
    created_by: 'admin',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockRepo = {
      findAllPlans: jest.fn(),
      findPlanById: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      updateLastTested: jest.fn(),
      deletePlan: jest.fn(),
      findAllFailoverTests: jest.fn(),
      findFailoverTestById: jest.fn(),
      createFailoverTest: jest.fn(),
      completeFailoverTest: jest.fn(),
      deleteFailoverTest: jest.fn(),
      findAllBackupConfigs: jest.fn(),
      findBackupConfigById: jest.fn(),
      createBackupConfig: jest.fn(),
      updateBackupConfig: jest.fn(),
      deleteBackupConfig: jest.fn(),
    };
    service = new DisasterRecoveryService(mockRepo as unknown as DisasterRecoveryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Constructor Tests ====================

  describe('constructor', () => {
    it('should create service with repository', () => {
      expect(service).toBeDefined();
    });

    it('should allow null repository (degraded mode)', () => {
      const degradedService = new DisasterRecoveryService(null);
      expect(degradedService).toBeDefined();
    });
  });

  // ==================== createPlan Tests ====================

  describe('createPlan', () => {
    const validInput = {
      tenantId: 'tenant-1',
      planName: 'Test DR Plan',
      rtoTarget: 300,
      rpoTarget: 60,
      priority: 'high',
      services: [{ name: 'api-service', type: 'kubernetes' }],
      failoverStrategy: 'active-passive',
      backupRegions: ['us-west-2', 'us-east-1'],
      createdBy: 'admin',
    };

    it('should create plan successfully', async () => {
      mockRepo.createPlan.mockResolvedValue(mockPlanRow);

      const result = await service.createPlan(validInput);

      // Service maps the row from DB, so returns the DB values
      expect(result.planName).toBe('Primary DR Plan');
      expect(result.rtoTarget).toBe(300);
      expect(result.rpoTarget).toBe(60);
      expect(mockRepo.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          planName: 'Test DR Plan',
          rtoTarget: 300,
          rpoTarget: 60,
        }),
      );
    });

    it('should throw error when plan name is empty', async () => {
      await expect(
        service.createPlan({ ...validInput, planName: '' }),
      ).rejects.toThrow('Plan name is required');
    });

    it('should throw error when RTO is not positive', async () => {
      await expect(
        service.createPlan({ ...validInput, rtoTarget: 0 }),
      ).rejects.toThrow('RTO target must be a positive number');
    });

    it('should throw error when RPO is not positive', async () => {
      await expect(
        service.createPlan({ ...validInput, rpoTarget: -1 }),
      ).rejects.toThrow('RPO target must be a positive number');
    });

    it('should throw error when failover strategy is missing', async () => {
      await expect(
        service.createPlan({ ...validInput, failoverStrategy: '' }),
      ).rejects.toThrow('Failover strategy is required');
    });

    it('should use default status when not provided', async () => {
      mockRepo.createPlan.mockResolvedValue(mockPlanRow);

      await service.createPlan(validInput);

      expect(mockRepo.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });
  });

  // ==================== getPlan Tests ====================

  describe('getPlan', () => {
    it('should return plan when found', async () => {
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);

      const result = await service.getPlan('tenant-1', 'plan-123');

      expect(result.id).toBe('plan-123');
      expect(result.planName).toBe('Primary DR Plan');
      expect(mockRepo.findPlanById).toHaveBeenCalledWith('tenant-1', 'plan-123');
    });

    it('should throw error when plan not found', async () => {
      mockRepo.findPlanById.mockResolvedValue(undefined);

      await expect(service.getPlan('tenant-1', 'nonexistent')).rejects.toThrow(
        "DR plan not found: nonexistent",
      );
    });
  });

  // ==================== listPlans Tests ====================

  describe('listPlans', () => {
    it('should return all plans for tenant', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);

      const result = await service.listPlans('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].planName).toBe('Primary DR Plan');
      expect(mockRepo.findAllPlans).toHaveBeenCalledWith('tenant-1');
    });

    it('should return empty array when no plans exist', async () => {
      mockRepo.findAllPlans.mockResolvedValue([]);

      const result = await service.listPlans('tenant-1');

      expect(result).toEqual([]);
    });
  });

  // ==================== updatePlan Tests ====================

  describe('updatePlan', () => {
    it('should update plan successfully', async () => {
      const updatedRow = { ...mockPlanRow, plan_name: 'Updated Plan Name' };
      mockRepo.findPlanById
        .mockResolvedValueOnce(mockPlanRow) // getPlan call
        .mockResolvedValueOnce(mockPlanRow); // updatePlan call
      mockRepo.updatePlan.mockResolvedValue(updatedRow);

      const result = await service.updatePlan('tenant-1', 'plan-123', {
        planName: 'Updated Plan Name',
      });

      expect(result.planName).toBe('Updated Plan Name');
      expect(mockRepo.updatePlan).toHaveBeenCalledWith(
        'tenant-1',
        'plan-123',
        expect.objectContaining({ planName: 'Updated Plan Name' }),
      );
    });

    it('should throw error when plan not found', async () => {
      mockRepo.findPlanById.mockResolvedValue(undefined);

      await expect(
        service.updatePlan('tenant-1', 'nonexistent', { planName: 'New Name' }),
      ).rejects.toThrow("DR plan not found: nonexistent");
    });
  });

  // ==================== deletePlan Tests ====================

  describe('deletePlan', () => {
    it('should delete plan successfully', async () => {
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);
      mockRepo.deletePlan.mockResolvedValue(true);

      const result = await service.deletePlan('tenant-1', 'plan-123');

      expect(result).toBe(true);
      expect(mockRepo.deletePlan).toHaveBeenCalledWith('tenant-1', 'plan-123');
    });

    it('should throw error when plan not found', async () => {
      mockRepo.findPlanById.mockResolvedValue(undefined);

      await expect(service.deletePlan('tenant-1', 'nonexistent')).rejects.toThrow(
        "DR plan not found: nonexistent",
      );
    });

    it('should throw error when delete fails', async () => {
      mockRepo.findPlanById
        .mockResolvedValueOnce(mockPlanRow) // getPlan call
        .mockResolvedValueOnce(mockPlanRow); // check exists again
      mockRepo.deletePlan.mockResolvedValue(false);

      await expect(service.deletePlan('tenant-1', 'plan-123')).rejects.toThrow(
        'Failed to delete DR plan: plan-123',
      );
    });
  });

  // ==================== triggerFailover Tests ====================

  describe('triggerFailover', () => {
    it('should trigger failover successfully', async () => {
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);
      mockRepo.createFailoverTest.mockResolvedValue(mockFailoverTestRow);
      mockRepo.updatePlan.mockResolvedValue({ ...mockPlanRow, status: 'failing-over' });

      const result = await service.triggerFailover('tenant-1', 'plan-123', 'admin');

      expect(result.status).toBe('running');
      expect(result.message).toContain('Failover triggered');
      expect(mockRepo.createFailoverTest).toHaveBeenCalledWith(
        expect.objectContaining({
          testType: 'real',
        }),
      );
    });

    it('should throw error when plan not found', async () => {
      mockRepo.findPlanById
        .mockResolvedValueOnce(undefined) // triggerFailover getPlan
        .mockResolvedValueOnce(undefined); // updatePlan call

      await expect(
        service.triggerFailover('tenant-1', 'nonexistent', 'admin'),
      ).rejects.toThrow("DR plan not found: nonexistent");
    });
  });

  // ==================== testFailover Tests ====================

  describe('testFailover', () => {
    it('should create failover test successfully', async () => {
      const customTestRow = { ...mockFailoverTestRow, test_name: 'Scheduled DR Drill' };
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);
      mockRepo.createFailoverTest.mockResolvedValue(customTestRow);
      mockRepo.updatePlan.mockResolvedValue({ ...mockPlanRow, status: 'testing' });
      mockRepo.updateLastTested.mockResolvedValue();

      const result = await service.testFailover(
        'tenant-1',
        'plan-123',
        'Scheduled DR Drill',
        'admin',
      );

      expect(result.status).toBe('running');
      expect(result.testName).toBe('Scheduled DR Drill');
    });

    it('should throw error when plan not found', async () => {
      mockRepo.findPlanById
        .mockResolvedValueOnce(undefined) // testFailover getPlan
        .mockResolvedValueOnce(undefined); // updatePlan calls

      await expect(
        service.testFailover('tenant-1', 'nonexistent', 'Test', 'admin'),
      ).rejects.toThrow("DR plan not found: nonexistent");
    });
  });

  // ==================== completeFailoverTest Tests ====================

  describe('completeFailoverTest', () => {
    it('should complete test with results', async () => {
      mockRepo.completeFailoverTest.mockResolvedValue({
        ...mockFailoverTestRow,
        completed_at: new Date(),
        result: 'passed',
      });
      mockRepo.updateLastTested.mockResolvedValue();

      const result = await service.completeFailoverTest('tenant-1', 'test-123', {
        actualRto: 180,
        actualRpo: 45,
        testResult: 'passed',
        findings: 'All systems OK',
      });

      expect(result.result).toBe('passed');
      expect(result.actualRto).toBe(180);
    });
  });

  // ==================== listFailoverTests Tests ====================

  describe('listFailoverTests', () => {
    it('should return tests for tenant', async () => {
      mockRepo.findAllFailoverTests.mockResolvedValue([mockFailoverTestRow]);

      const result = await service.listFailoverTests('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].testName).toBe('DR Drill - Primary');
    });

    it('should filter by planId when provided', async () => {
      mockRepo.findAllFailoverTests.mockResolvedValue([mockFailoverTestRow]);

      await service.listFailoverTests('tenant-1', 'plan-123');

      expect(mockRepo.findAllFailoverTests).toHaveBeenCalledWith('tenant-1', 'plan-123');
    });
  });

  // ==================== Backup Config Tests ====================

  describe('createBackupConfig', () => {
    const validBackupInput = {
      tenantId: 'tenant-1',
      sourceType: 'database',
      sourceId: 'db-primary',
      storageLocation: 's3://backups',
      createdBy: 'admin',
    };

    it('should create backup config successfully', async () => {
      mockRepo.createBackupConfig.mockResolvedValue(mockBackupConfigRow);

      const result = await service.createBackupConfig(validBackupInput);

      expect(result.sourceType).toBe('database');
      expect(result.storageLocation).toBe('s3://backups/db-primary');
    });

    it('should throw error when sourceType is missing', async () => {
      await expect(
        service.createBackupConfig({ ...validBackupInput, sourceType: '' }),
      ).rejects.toThrow('sourceType and sourceId are required');
    });

    it('should throw error when sourceId is missing', async () => {
      await expect(
        service.createBackupConfig({ ...validBackupInput, sourceId: '' }),
      ).rejects.toThrow('sourceType and sourceId are required');
    });
  });

  describe('listBackupConfigs', () => {
    it('should return all backup configs', async () => {
      mockRepo.findAllBackupConfigs.mockResolvedValue([mockBackupConfigRow]);

      const result = await service.listBackupConfigs('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].sourceId).toBe('db-primary');
    });
  });

  // ==================== RTO/RPO Status Tests ====================

  describe('getRTOStatus', () => {
    it('should return RTO compliance status for all plans', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findAllFailoverTests.mockResolvedValue([mockFailoverTestRow]);

      const result = await service.getRTOStatus('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].planName).toBe('Primary DR Plan');
      expect(result[0].compliance).toBe('compliant'); // 180 <= 300
    });

    it('should return non-compliant when RTO exceeded', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findAllFailoverTests.mockResolvedValue([
        { ...mockFailoverTestRow, actual_rto: 500 }, // Exceeds 300
      ]);

      const result = await service.getRTOStatus('tenant-1');

      expect(result[0].compliance).toBe('non-compliant');
    });

    it('should return not-tested when no tests completed', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findAllFailoverTests.mockResolvedValue([]);

      const result = await service.getRTOStatus('tenant-1');

      expect(result[0].compliance).toBe('not-tested');
    });
  });

  describe('getRPOStatus', () => {
    it('should return RPO compliance status', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findAllFailoverTests.mockResolvedValue([mockFailoverTestRow]);

      const result = await service.getRPOStatus('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].compliance).toBe('compliant'); // 45 <= 60
    });

    it('should return non-compliant when RPO exceeded', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findAllFailoverTests.mockResolvedValue([
        { ...mockFailoverTestRow, actual_rpo: 120 }, // Exceeds 60
      ]);

      const result = await service.getRPOStatus('tenant-1');

      expect(result[0].compliance).toBe('non-compliant');
    });
  });

  // ==================== Drill Scheduling Tests ====================

  describe('scheduleDrill', () => {
    it('should schedule drill with planId', async () => {
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);
      mockRepo.createFailoverTest.mockResolvedValue(mockFailoverTestRow);

      const result = await service.scheduleDrill('tenant-1', {
        planId: 'plan-123',
        componentType: 'api-service',
        testType: 'scheduled-drill',
      });

      expect(result.planId).toBe('plan-123');
    });

    it('should find plan by componentType when planId not provided', async () => {
      mockRepo.findAllPlans.mockResolvedValue([mockPlanRow]);
      mockRepo.findPlanById.mockResolvedValue(mockPlanRow);
      mockRepo.createFailoverTest.mockResolvedValue(mockFailoverTestRow);

      await service.scheduleDrill('tenant-1', {
        componentType: 'api-service',
      });

      expect(mockRepo.createFailoverTest).toHaveBeenCalled();
    });

    it('should throw error when no matching plan found', async () => {
      mockRepo.findAllPlans.mockResolvedValue([]);

      await expect(
        service.scheduleDrill('tenant-1', { componentType: 'unknown-service' }),
      ).rejects.toThrow('No DR plan found for component: unknown-service');
    });
  });

  // ==================== runAutomatedFailoverTest Tests ====================

  describe('runAutomatedFailoverTest', () => {
    it('should return automated test initiation result', async () => {
      const result = await service.runAutomatedFailoverTest('api-service');

      expect(result.status).toBe('running');
      expect(result.componentType).toBe('api-service');
      expect(result.message).toContain('Automated failover test');
    });
  });

  // ==================== DB Unavailable Tests ====================

  describe('degraded mode (no repository)', () => {
    let noDbService: DisasterRecoveryService;

    beforeEach(() => {
      noDbService = new DisasterRecoveryService(null);
    });

    it('should throw DB_UNAVAILABLE when creating plan', async () => {
      await expect(
        noDbService.createPlan({
          tenantId: 'tenant-1',
          planName: 'Test',
          rtoTarget: 300,
          rpoTarget: 60,
          priority: 'high',
          services: [],
          failoverStrategy: 'active-passive',
          backupRegions: [],
          createdBy: 'admin',
        }),
      ).rejects.toThrow('Database not available');
    });

    it('should throw DB_UNAVAILABLE when listing plans', async () => {
      await expect(noDbService.listPlans('tenant-1')).rejects.toThrow(
        'Database not available',
      );
    });
  });
});