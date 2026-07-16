/**
 * ProcessStepEngineService Tests
 * Covers definition CRUD, instance management, state machine transitions, step advancement
 */
import { ProcessStepEngineService } from '../ProcessStepEngineService';
import { OrionError } from '../../../errors';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-id',
}));

const mockDefRepo = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockInstRepo = {
  findInstanceById: jest.fn(),
  findInstances: jest.fn(),
  createInstance: jest.fn(),
  updateInstance: jest.fn(),
  findStepByInstanceIdAndStepId: jest.fn(),
  findStepsByInstanceId: jest.fn(),
  createStep: jest.fn(),
  updateStep: jest.fn(),
};

let service: ProcessStepEngineService;

const mockDef = {
  id: 'def-1',
  tenant_id: 'test-tenant',
  name: 'Approval Flow',
  description: 'Multi-step approval',
  version: 1,
  entity_type: 'ticket',
  enabled: true,
  steps: [
    { id: 'step-1', name: 'Manager Review', type: 'approval', handler: 'mgr-handler' },
    { id: 'step-2', name: 'CTO Review', type: 'approval', handler: 'cto-handler' },
  ],
  transitions: [],
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockInstance = {
  id: 'inst-1',
  tenant_id: 'test-tenant',
  definition_id: 'def-1',
  definition_snapshot: { steps: mockDef.steps, transitions: [], name: 'Approval Flow', entity_type: 'ticket' },
  entity_type: 'ticket',
  entity_id: 'ticket-1',
  current_step_id: 'step-1',
  status: 'running',
  started_at: new Date(),
  completed_at: null,
  created_by: 'user-1',
  updated_at: new Date(),
};

const mockStep = {
  id: 'step-inst-1',
  tenant_id: 'test-tenant',
  instance_id: 'inst-1',
  step_id: 'step-1',
  step_name: 'Manager Review',
  step_type: 'approval',
  handler_key: 'mgr-handler',
  status: 'pending',
  input_data: null,
  output_data: null,
  started_at: null,
  completed_at: null,
  operator: null,
  comment: null,
  created_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  service = new ProcessStepEngineService(mockDefRepo as any, mockInstRepo as any);
});

describe('ProcessStepEngineService', () => {
  // ==================== Definition CRUD ====================
  describe('getDefinition', () => {
    it('should return definition when found', async () => {
      mockDefRepo.findById.mockResolvedValue(mockDef);
      const result = await service.getDefinition('def-1');
      expect(result.name).toBe('Approval Flow');
    });

    it('should throw NOT_FOUND when missing', async () => {
      mockDefRepo.findById.mockResolvedValue(null);
      await expect(service.getDefinition('missing')).rejects.toThrow(OrionError);
    });
  });

  describe('createDefinition', () => {
    it('should create with userId', async () => {
      mockDefRepo.create.mockResolvedValue(mockDef);
      const result = await service.createDefinition({
        name: 'Approval Flow',
        entity_type: 'ticket',
        steps: mockDef.steps,
        transitions: [],
      }, 'user-1');
      expect(result.name).toBe('Approval Flow');
    });
  });

  describe('updateDefinition', () => {
    it('should verify existence then update', async () => {
      mockDefRepo.findById.mockResolvedValue(mockDef);
      mockDefRepo.update.mockResolvedValue({ ...mockDef, name: 'Updated' });
      const result = await service.updateDefinition('def-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw when not found', async () => {
      mockDefRepo.findById.mockResolvedValue(null);
      await expect(service.updateDefinition('missing', { name: 'x' })).rejects.toThrow(OrionError);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete when no running instances', async () => {
      mockDefRepo.findById.mockResolvedValue(mockDef);
      mockInstRepo.findInstances.mockResolvedValue({ rows: [], total: 0 });
      mockDefRepo.delete.mockResolvedValue(true);
      expect(await service.deleteDefinition('def-1')).toBe(true);
    });

    it('should throw CONFLICT when running instances exist', async () => {
      mockDefRepo.findById.mockResolvedValue(mockDef);
      mockInstRepo.findInstances.mockResolvedValue({ rows: [mockInstance], total: 1 });
      await expect(service.deleteDefinition('def-1')).rejects.toThrow('running instances');
    });
  });

  // ==================== Instance Management ====================
  describe('getInstance', () => {
    it('should return instance when found', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      const result = await service.getInstance('inst-1');
      expect(result.status).toBe('running');
    });

    it('should throw NOT_FOUND when missing', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(null);
      await expect(service.getInstance('missing')).rejects.toThrow(OrionError);
    });
  });

  describe('startInstance', () => {
    it('should create instance with definition snapshot and first step', async () => {
      mockDefRepo.findById.mockResolvedValue(mockDef);
      mockInstRepo.createInstance.mockResolvedValue(mockInstance);
      mockInstRepo.createStep.mockResolvedValue(mockStep);
      mockInstRepo.updateInstance.mockResolvedValue(mockInstance);
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);

      const result = await service.startInstance('def-1', {
        entityType: 'ticket',
        entityId: 'ticket-1',
        operator: 'user-1',
        data: { key: 'value' },
      });

      expect(result.id).toBe('inst-1');
      expect(mockInstRepo.createInstance).toHaveBeenCalledWith(expect.objectContaining({
        definition_id: 'def-1',
        entity_type: 'ticket',
        entity_id: 'ticket-1',
        status: 'running',
      }));
      expect(mockInstRepo.createStep).toHaveBeenCalledWith(expect.objectContaining({
        step_id: 'step-1',
        step_name: 'Manager Review',
        status: 'pending',
      }));
    });

    it('should throw when definition is disabled', async () => {
      mockDefRepo.findById.mockResolvedValue({ ...mockDef, enabled: false });
      await expect(service.startInstance('def-1', { entityType: 'ticket', entityId: 't-1' })).rejects.toThrow('disabled');
    });

    it('should throw when definition not found', async () => {
      mockDefRepo.findById.mockResolvedValue(null);
      await expect(service.startInstance('missing', { entityType: 'ticket', entityId: 't-1' })).rejects.toThrow(OrionError);
    });
  });

  // ==================== State Machine ====================
  describe('advanceStep', () => {
    it('should advance from pending to running', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(mockStep);
      mockInstRepo.updateStep.mockResolvedValue({ ...mockStep, status: 'running' });

      const result = await service.advanceStep('inst-1', 'step-1', 'running', { operator: 'user-1' });
      expect(result.status).toBe('running');
    });

    it('should advance to success and trigger next step creation', async () => {
      const runningStep = { ...mockStep, status: 'running', started_at: new Date() };
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(runningStep);
      mockInstRepo.updateStep.mockResolvedValue({ ...runningStep, status: 'success' });
      mockInstRepo.createStep.mockResolvedValue({ ...mockStep, step_id: 'step-2', step_name: 'CTO Review' });
      mockInstRepo.updateInstance.mockResolvedValue(mockInstance);

      await service.advanceStep('inst-1', 'step-1', 'success', { operator: 'user-1' });

      expect(mockInstRepo.createStep).toHaveBeenCalledWith(expect.objectContaining({
        step_id: 'step-2',
        step_name: 'CTO Review',
      }));
    });

    it('should throw on invalid transition (pending→success)', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(mockStep);
      await expect(service.advanceStep('inst-1', 'step-1', 'success', {})).rejects.toThrow('Invalid transition');
    });

    it('should throw when instance not found', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(null);
      await expect(service.advanceStep('missing', 'step-1', 'running', {})).rejects.toThrow(OrionError);
    });

    it('should throw when step not found', async () => {
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(null);
      await expect(service.advanceStep('inst-1', 'missing', 'running', {})).rejects.toThrow(OrionError);
    });

    it('should mark failed and update instance status to aborted', async () => {
      const runningStep = { ...mockStep, status: 'running', started_at: new Date() };
      mockInstRepo.findInstanceById.mockResolvedValue(mockInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(runningStep);
      mockInstRepo.updateStep.mockResolvedValue({ ...runningStep, status: 'failed' });
      mockInstRepo.updateInstance.mockResolvedValue(mockInstance);

      await service.advanceStep('inst-1', 'step-1', 'failed', { operator: 'user-1' });
      expect(mockInstRepo.updateInstance).toHaveBeenCalledWith('inst-1', { status: 'aborted' });
    });

    it('should complete instance when last step succeeds', async () => {
      const lastStepInstance = {
        ...mockInstance,
        current_step_id: 'step-2',
        definition_snapshot: {
          steps: mockDef.steps,
          transitions: [],
          name: 'Approval Flow',
          entity_type: 'ticket',
        },
      };
      const runningStep2 = { ...mockStep, step_id: 'step-2', status: 'running', started_at: new Date() };
      mockInstRepo.findInstanceById.mockResolvedValue(lastStepInstance);
      mockInstRepo.findStepByInstanceIdAndStepId.mockResolvedValue(runningStep2);
      mockInstRepo.updateStep.mockResolvedValue({ ...runningStep2, status: 'success' });
      mockInstRepo.updateInstance.mockResolvedValue(lastStepInstance);

      await service.advanceStep('inst-1', 'step-2', 'success', {});
      expect(mockInstRepo.updateInstance).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        status: 'completed',
      }));
    });
  });

  describe('getStepHistory', () => {
    it('should delegate to instRepo', async () => {
      mockInstRepo.findStepsByInstanceId.mockResolvedValue([mockStep]);
      const result = await service.getStepHistory('inst-1');
      expect(result).toHaveLength(1);
    });
  });
});
