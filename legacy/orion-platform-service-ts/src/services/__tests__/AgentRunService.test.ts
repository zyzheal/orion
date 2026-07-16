/**
 * AgentRunService Unit Tests
 *
 * Tests for triggering runs, executing steps, listing, cancelling, retrying,
 * and stats functionality.
 */

import {
  AgentRunService,
  AgentRunServiceError,
} from '../agent-run-service';
import { AgentRunRepository, AgentRunEntity } from '../../repositories/AgentRunRepository';
import { AgentProfileService } from '../agent-profile-service';
import { EventBusService } from '../event-bus-service';
import { AgentAction } from '../../models/AgentRun';

// ==================== Mocks ====================

class MockAgentRunRepository {
  createRun = jest.fn();
  findRunById = jest.fn();
  listRuns = jest.fn();
  completeRun = jest.fn();
  failRun = jest.fn();
  cancelRun = jest.fn();
  updateStep = jest.fn();
  createDecision = jest.fn();
  updateDecision = jest.fn();
  getDecisionsByRunId = jest.fn();
  createApproval = jest.fn();
}

class MockAgentProfileService {
  getById = jest.fn();
  list = jest.fn();
}

class MockEventBusService {
  publish = jest.fn();
}

// ==================== Helpers ====================

function makeEntity(overrides: Partial<AgentRunEntity> = {}): AgentRunEntity {
  const now = new Date();
  return {
    id: 'run-1',
    agent_profile_id: 'agent-1',
    trigger_payload: { action: 'fix_bug' },
    status: 'running',
    current_step: 0,
    total_steps: 3,
    result: null,
    error: null,
    started_at: now,
    completed_at: null,
    timeout_at: new Date(now.getTime() + 3600000),
    tenant_id: null,
    ...overrides,
  };
}

function makeDecisionRow(overrides: Partial<any> = {}) {
  return {
    id: 'dec-1',
    run_id: 'run-1',
    agent_id: 'agent-1',
    step_number: 1,
    action: 'read_file',
    action_input: { filePath: '/test.ts' },
    action_output: null,
    reasoning: 'Reading file',
    tool_result: null,
    error: null,
    created_at: new Date(),
    ...overrides,
  };
}

function makeProfile(overrides: Partial<any> = {}) {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    role: 'code_fixer',
    enabled: true,
    ...overrides,
  };
}

// ==================== Tests ====================

describe('AgentRunService', () => {
  let service: AgentRunService;
  let mockRunRepo: MockAgentRunRepository;
  let mockProfileService: MockAgentProfileService;
  let mockEventBus: MockEventBusService;

  beforeEach(() => {
    mockRunRepo = new MockAgentRunRepository();
    mockProfileService = new MockAgentProfileService();
    mockEventBus = new MockEventBusService();

    service = new AgentRunService({
      agentProfileService: mockProfileService as unknown as AgentProfileService,
      runRepository: mockRunRepo as unknown as AgentRunRepository,
      eventBus: mockEventBus as unknown as EventBusService,
    });

    // Default mock behavior
    mockProfileService.getById.mockResolvedValue(makeProfile());
    mockRunRepo.getDecisionsByRunId.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerRun', () => {
    it('should trigger a new agent run with valid input', async () => {
      const input = {
        agentProfileId: 'agent-1',
        triggerPayload: { action: 'fix_bug' },
        totalSteps: 3,
      };

      mockRunRepo.createRun.mockResolvedValue(makeEntity());

      const result = await service.triggerRun(input);

      expect(result.id).toBe('run-1');
      expect(result.status).toBe('running');
      expect(result.agentProfileId).toBe('agent-1');
      expect(result.agentProfileName).toBe('Test Agent');
      expect(mockRunRepo.createRun).toHaveBeenCalledWith(
        'agent-1',
        { action: 'fix_bug' },
        3,
        expect.any(Date),
        undefined,
      );
    });

    it('should throw error if agent profile not found', async () => {
      mockProfileService.getById.mockRejectedValue(new Error('Not found'));

      await expect(
        service.triggerRun({ agentProfileId: 'nonexistent' }),
      ).rejects.toThrow(AgentRunServiceError);

      await expect(
        service.triggerRun({ agentProfileId: 'nonexistent' }),
      ).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND' });
    });

    it('should throw error if agent profile is disabled', async () => {
      mockProfileService.getById.mockResolvedValue(makeProfile({ enabled: false }));

      await expect(
        service.triggerRun({ agentProfileId: 'agent-1' }),
      ).rejects.toThrow(AgentRunServiceError);

      await expect(
        service.triggerRun({ agentProfileId: 'agent-1' }),
      ).rejects.toMatchObject({ code: 'PROFILE_DISABLED' });
    });

    it('should publish event on successful trigger', async () => {
      mockRunRepo.createRun.mockResolvedValue(makeEntity());

      await service.triggerRun({ agentProfileId: 'agent-1' });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'agent.run.triggered',
        expect.objectContaining({
          runId: 'run-1',
          agentProfileId: 'agent-1',
        }),
      );
    });

    it('should use default totalSteps of 1 if not provided', async () => {
      mockRunRepo.createRun.mockResolvedValue(makeEntity());

      await service.triggerRun({ agentProfileId: 'agent-1' });

      expect(mockRunRepo.createRun).toHaveBeenCalledWith(
        'agent-1',
        {},
        1,
        expect.any(Date),
        undefined,
      );
    });
  });

  describe('getById', () => {
    it('should return agent run with decisions', async () => {
      const decisionRows = [
        makeDecisionRow({ step_number: 1, action: 'read_file' }),
        makeDecisionRow({ step_number: 2, action: 'write_code', id: 'dec-2' }),
      ];

      mockRunRepo.findRunById.mockResolvedValue(makeEntity());
      mockRunRepo.getDecisionsByRunId.mockResolvedValue(decisionRows);

      const result = await service.getById('run-1');

      expect(result.id).toBe('run-1');
      expect(result.decisions.length).toBe(2);
      expect(result.decisions[0].action).toBe('read_file');
      expect(result.decisions[1].action).toBe('write_code');
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(
        AgentRunServiceError,
      );

      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        code: 'RUN_NOT_FOUND',
      });
    });
  });

  describe('list', () => {
    it('should return list of agent runs', async () => {
      const entities = [makeEntity(), makeEntity({ id: 'run-2', status: 'completed' })];
      mockRunRepo.listRuns.mockResolvedValue(entities);

      const result = await service.list();

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('run-1');
      expect(result[1].id).toBe('run-2');
    });

    it('should support filtering by agentProfileId', async () => {
      mockRunRepo.listRuns.mockResolvedValue([]);

      await service.list({ agentProfileId: 'agent-1' });

      expect(mockRunRepo.listRuns).toHaveBeenCalledWith(
        expect.objectContaining({ agentProfileId: 'agent-1' }),
      );
    });

    it('should support filtering by status', async () => {
      mockRunRepo.listRuns.mockResolvedValue([]);

      await service.list({ statusFilter: 'running' });

      expect(mockRunRepo.listRuns).toHaveBeenCalledWith(
        expect.objectContaining({ statusFilter: 'running' }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a running agent run', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.cancelRun.mockResolvedValue(makeEntity({ status: 'cancelled' }));

      const result = await service.cancel('run-1');

      expect(result.status).toBe('cancelled');
      expect(mockRunRepo.cancelRun).toHaveBeenCalledWith('run-1');
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(service.cancel('nonexistent')).rejects.toThrow(
        AgentRunServiceError,
      );
    });

    it('should throw error if run is not in running status', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'completed' }));

      await expect(service.cancel('run-1')).rejects.toThrow(
        AgentRunServiceError,
      );

      await expect(service.cancel('run-1')).rejects.toMatchObject({
        code: 'INVALID_RUN_STATUS',
      });
    });

    it('should publish event on successful cancel', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.cancelRun.mockResolvedValue(makeEntity({ status: 'cancelled' }));

      await service.cancel('run-1');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'agent.run.cancelled',
        expect.any(Object),
      );
    });
  });

  describe('retry', () => {
    it('should retry a failed agent run', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'failed' }));
      mockRunRepo.createRun.mockResolvedValue(makeEntity({ id: 'run-2' }));

      const result = await service.retry('run-1');

      expect(result.id).toBe('run-2');
      expect(result.status).toBe('running');
      expect(mockRunRepo.createRun).toHaveBeenCalled();
    });

    it('should retry a cancelled agent run', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'cancelled' }));
      mockRunRepo.createRun.mockResolvedValue(makeEntity({ id: 'run-2' }));

      const result = await service.retry('run-1');

      expect(result.id).toBe('run-2');
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(service.retry('nonexistent')).rejects.toThrow(
        AgentRunServiceError,
      );
    });

    it('should throw error if run is still running', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));

      await expect(service.retry('run-1')).rejects.toThrow(
        AgentRunServiceError,
      );

      await expect(service.retry('run-1')).rejects.toMatchObject({
        code: 'INVALID_RUN_STATUS',
      });
    });

    it('should throw error if agent profile is disabled', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'failed' }));
      mockProfileService.getById.mockResolvedValue(makeProfile({ enabled: false }));

      await expect(service.retry('run-1')).rejects.toThrow(
        AgentRunServiceError,
      );

      await expect(service.retry('run-1')).rejects.toMatchObject({
        code: 'PROFILE_DISABLED',
      });
    });
  });

  describe('executeStep', () => {
    it('should execute a step on a running agent run', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.createDecision.mockResolvedValue({ id: 'dec-1' });

      const result = await service.executeStep(
        'run-1',
        'read_file' as AgentAction,
        { filePath: '/test.ts' },
      );

      expect(result.action).toBe('read_file');
      expect(result.stepNumber).toBe(1);
      expect(mockRunRepo.updateStep).toHaveBeenCalledWith('run-1', 1);
    });

    it('should increment step number', async () => {
      mockRunRepo.findRunById.mockResolvedValue(
        makeEntity({ status: 'running', current_step: 2 }),
      );
      mockRunRepo.createDecision.mockResolvedValue({ id: 'dec-1' });

      const result = await service.executeStep(
        'run-1',
        'write_code' as AgentAction,
        { content: 'fix' },
      );

      expect(result.stepNumber).toBe(3);
      expect(mockRunRepo.updateStep).toHaveBeenCalledWith('run-1', 3);
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(
        service.executeStep('nonexistent', 'read_file' as AgentAction, {}),
      ).rejects.toThrow(AgentRunServiceError);
    });

    it('should throw error if run is not in running status', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'completed' }));

      await expect(
        service.executeStep('run-1', 'read_file' as AgentAction, {}),
      ).rejects.toThrow(AgentRunServiceError);
    });

    it('should publish event on successful step execution', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.createDecision.mockResolvedValue({ id: 'dec-1' });

      await service.executeStep(
        'run-1',
        'read_file' as AgentAction,
        { filePath: '/test.ts' },
      );

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'agent.step.executed',
        expect.any(Object),
      );
    });
  });

  describe('completeRunWithResult', () => {
    it('should mark run as completed', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.completeRun.mockResolvedValue(makeEntity({ status: 'completed' }));

      const result = await service.completeRunWithResult('run-1', { success: true });

      expect(result.status).toBe('completed');
      expect(mockRunRepo.completeRun).toHaveBeenCalledWith('run-1', { success: true });
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(
        service.completeRunWithResult('nonexistent', {}),
      ).rejects.toThrow(AgentRunServiceError);
    });
  });

  describe('failRunWithError', () => {
    it('should mark run as failed', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity({ status: 'running' }));
      mockRunRepo.failRun.mockResolvedValue(makeEntity({ status: 'failed', error: 'step error' }));

      const result = await service.failRunWithError('run-1', 'step error');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('step error');
    });
  });

  describe('getDecisions', () => {
    it('should return decision logs for a run', async () => {
      mockRunRepo.findRunById.mockResolvedValue(makeEntity());
      mockRunRepo.getDecisionsByRunId.mockResolvedValue([
        makeDecisionRow({ action: 'read_file' }),
        makeDecisionRow({ action: 'write_code', id: 'dec-2' }),
      ]);

      const result = await service.getDecisions('run-1');

      expect(result.length).toBe(2);
      expect(result[0].action).toBe('read_file');
    });

    it('should throw error if run not found', async () => {
      mockRunRepo.findRunById.mockResolvedValue(null);

      await expect(service.getDecisions('nonexistent')).rejects.toThrow(
        AgentRunServiceError,
      );
    });
  });

  describe('getStats', () => {
    it('should return statistics about runs', async () => {
      mockRunRepo.listRuns.mockResolvedValue([
        makeEntity({ status: 'running' }),
        makeEntity({ status: 'completed', id: 'run-2' }),
        makeEntity({ status: 'failed', id: 'run-3' }),
        makeEntity({ status: 'running', id: 'run-4' }),
      ]);

      const stats = await service.getStats();

      expect(stats.total).toBe(4);
      expect(stats.running).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(0);
    });

    it('should return zero stats when no runs exist', async () => {
      mockRunRepo.listRuns.mockResolvedValue([]);

      const stats = await service.getStats();

      expect(stats.total).toBe(0);
      expect(stats.running).toBe(0);
    });
  });

  describe('getActiveRuns', () => {
    it('should return only running runs', async () => {
      mockRunRepo.listRuns.mockResolvedValue([
        makeEntity({ status: 'running' }),
        makeEntity({ status: 'running', id: 'run-2' }),
      ]);

      const result = await service.getActiveRuns();

      expect(result.length).toBe(2);
      expect(mockRunRepo.listRuns).toHaveBeenCalledWith(
        expect.objectContaining({ statusFilter: 'running' }),
      );
    });
  });

  describe('getByTenant', () => {
    it('should return runs for a specific tenant', async () => {
      mockRunRepo.listRuns.mockResolvedValue([
        makeEntity({ tenant_id: 'tenant-1' }),
        makeEntity({ tenant_id: 'tenant-2', id: 'run-2' }),
        makeEntity({ tenant_id: 'tenant-1', id: 'run-3' }),
      ]);

      const result = await service.getByTenant('tenant-1');

      expect(result.length).toBe(2);
      expect(result[0].tenantId).toBe('tenant-1');
      expect(result[1].tenantId).toBe('tenant-1');
    });
  });

  describe('completeStep / failStep', () => {
    it('should complete a step with result', async () => {
      await service.completeStep('dec-1', { output: 'done' }, { result: 'ok' });

      expect(mockRunRepo.updateDecision).toHaveBeenCalledWith('dec-1', {
        toolResult: { output: 'done' },
        actionOutput: { result: 'ok' },
      });
    });

    it('should fail a step with error', async () => {
      await service.failStep('dec-1', 'Step failed');

      expect(mockRunRepo.updateDecision).toHaveBeenCalledWith('dec-1', {
        error: 'Step failed',
      });
    });
  });

  describe('checkTimeouts', () => {
    it('should mark timed out runs as failed', async () => {
      const pastTimeout = new Date(Date.now() - 3600000);
      mockRunRepo.listRuns.mockResolvedValue([
        makeEntity({ status: 'running', timeout_at: pastTimeout }),
      ]);
      mockRunRepo.findRunById
        .mockResolvedValueOnce(makeEntity({ status: 'running', timeout_at: pastTimeout }))
        .mockResolvedValueOnce(makeEntity({ status: 'running', timeout_at: pastTimeout }));
      mockRunRepo.failRun.mockResolvedValue(makeEntity({ status: 'failed', error: 'Run timed out' }));

      const timedOut = await service.checkTimeouts();

      expect(timedOut.length).toBe(1);
      expect(mockRunRepo.failRun).toHaveBeenCalled();
    });

    it('should not mark runs that have not timed out', async () => {
      const futureTimeout = new Date(Date.now() + 3600000);
      mockRunRepo.listRuns.mockResolvedValue([
        makeEntity({ status: 'running', timeout_at: futureTimeout }),
      ]);

      const timedOut = await service.checkTimeouts();

      expect(timedOut.length).toBe(0);
      expect(mockRunRepo.failRun).not.toHaveBeenCalled();
    });
  });

  describe('listPaginated', () => {
    it('should return paginated results', async () => {
      const entities = [
        makeEntity(),
        makeEntity({ id: 'run-2' }),
        makeEntity({ id: 'run-3' }),
      ];
      mockRunRepo.listRuns.mockResolvedValue(entities);

      const result = await service.listPaginated({ page: 1, limit: 2 });

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('event bus error handling', () => {
    it('should not throw if event bus publish fails', async () => {
      mockRunRepo.createRun.mockResolvedValue(makeEntity());
      mockEventBus.publish.mockRejectedValue(new Error('Event bus error'));

      // Should not throw
      await expect(
        service.triggerRun({ agentProfileId: 'agent-1' }),
      ).resolves.not.toThrow();
    });
  });

  describe('without event bus', () => {
    it('should work without event bus', async () => {
      const serviceWithoutBus = new AgentRunService({
        agentProfileService: mockProfileService as unknown as AgentProfileService,
        runRepository: mockRunRepo as unknown as AgentRunRepository,
      });

      mockRunRepo.createRun.mockResolvedValue(makeEntity());

      const result = await serviceWithoutBus.triggerRun({ agentProfileId: 'agent-1' });

      expect(result.id).toBe('run-1');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
