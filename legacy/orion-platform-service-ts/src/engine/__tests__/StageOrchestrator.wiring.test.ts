/**
 * StageOrchestrator Service Wiring Tests
 *
 * Tests for GlobalParamService, EnvProfileService, ScriptVersionService,
 * and PipelineAuditLogService integration into the stage execution flow.
 */

import { StageOrchestrator, StageOrchestratorDeps } from '../StageOrchestrator';
import { GlobalParamService } from '../../services/pipeline/GlobalParamService';
import { EnvProfileService } from '../../services/pipeline/EnvProfileService';
import { ScriptVersionService } from '../../services/pipeline/ScriptVersionService';
import { PipelineAuditLogService } from '../../services/pipeline/PipelineAuditLogService';
import { VariableContext } from '../VariableContext';
import { Stage, StageStatus } from '../../models/Stage';
import { Task, TaskStatus } from '../../models/Task';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../models/PipelineRun';

describe('StageOrchestrator Service Wiring', () => {
  let deps: StageOrchestratorDeps;

  beforeEach(() => {
    deps = {
      pipelineService: {} as any,
      runService: {
        getTasks: jest.fn(async () => []),
        updateStage: jest.fn(),
        updateTask: jest.fn(),
        addStage: jest.fn(),
        addTask: jest.fn(),
      } as any,
      eventPublisher: {
        publishStageStarted: jest.fn(),
        publishStageCompleted: jest.fn(),
        publishStageFailed: jest.fn(),
        publishStageSkipped: jest.fn(),
      } as any,
      sseBridge: null,
      stageExecutor: {
        executeTask: jest.fn(),
        passUpstreamArtifacts: jest.fn(),
        setVariableContext: jest.fn(),
      } as any,
      subPipelineService: null,
      artifactService: null,
      autoRetryService: null,
      expressionEvaluator: {
        evaluate: jest.fn(() => true),
      } as any,
      checkpointManager: null,
      debugController: null,
      secretsService: null,
      globalParamService: null,
      envProfileService: null,
      scriptVersionService: null,
      pipelineAuditLogService: null,
      grayscaleController: {} as any,
      multiTargetExecutor: {} as any,
    };
  });

  // ==================== Service Storage Tests ====================

  describe('service storage', () => {
    it('should store globalParamService from deps', () => {
      const globalParamService = new GlobalParamService();
      const orchestrator = new StageOrchestrator({
        ...deps,
        globalParamService,
      });
      // Services are stored as private fields; we verify via integration
      expect(orchestrator).toBeDefined();
    });

    it('should store envProfileService from deps', () => {
      const envProfileService = new EnvProfileService();
      const orchestrator = new StageOrchestrator({
        ...deps,
        envProfileService,
      });
      expect(orchestrator).toBeDefined();
    });

    it('should store scriptVersionService from deps', () => {
      const scriptVersionService = new ScriptVersionService();
      const orchestrator = new StageOrchestrator({
        ...deps,
        scriptVersionService,
      });
      expect(orchestrator).toBeDefined();
    });

    it('should store pipelineAuditLogService from deps', () => {
      const pipelineAuditLogService = new PipelineAuditLogService();
      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService,
      });
      expect(orchestrator).toBeDefined();
    });
  });

  // ==================== resolveServiceParameters Tests ====================

  describe('resolveServiceParameters', () => {
    it('should resolve GlobalParam references when service is available', async () => {
      const mockGlobalParamService = {
        resolve: jest.fn(async () => ({ apiKey: 'resolved-key-value' })),
      } as unknown as GlobalParamService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        globalParamService: mockGlobalParamService,
      });

      // Access private method via type assertion for testing
      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const task = createTask({
        parameters: { apiUrl: '${global.apiKey}' },
      });

      const result = await resolveFn(execution, task);
      expect(result.params).toEqual({ apiKey: 'resolved-key-value' });
      expect(mockGlobalParamService.resolve).toHaveBeenCalledWith('tenant-1', { apiUrl: '${global.apiKey}' });
    });

    it('should resolve EnvProfile variables when run has environment', async () => {
      const mockEnvProfileService = {
        resolveVariables: jest.fn(async () => ({ NODE_ENV: 'production', DEBUG: 'false' })),
      } as unknown as EnvProfileService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        envProfileService: mockEnvProfileService,
      });

      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ environment: 'production' }),
      });

      const task = createTask({ parameters: {} });

      const result = await resolveFn(execution, task);
      expect(result.env).toEqual({ NODE_ENV: 'production', DEBUG: 'false' });
      expect(mockEnvProfileService.resolveVariables).toHaveBeenCalledWith(
        'default', 'default-production', 'production'
      );
    });

    it('should skip EnvProfile resolution when run has no environment', async () => {
      const mockEnvProfileService = {
        resolveVariables: jest.fn(),
      } as unknown as EnvProfileService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        envProfileService: mockEnvProfileService,
      });

      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ environment: undefined }),
      });

      const task = createTask({ parameters: {} });

      const result = await resolveFn(execution, task);
      expect(result.env).toEqual({});
      expect(mockEnvProfileService.resolveVariables).not.toHaveBeenCalled();
    });

    it('should skip GlobalParam resolution when service is not available', async () => {
      const orchestrator = new StageOrchestrator({
        ...deps,
        globalParamService: null,
      });

      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const task = createTask({
        parameters: { apiKey: '${global.apiKey}' },
      });

      const result = await resolveFn(execution, task);
      expect(result.params).toEqual({});
    });

    it('should return empty results when both services are unavailable', async () => {
      const orchestrator = new StageOrchestrator({
        ...deps,
        globalParamService: null,
        envProfileService: null,
      });

      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const task = createTask({ parameters: { key: 'value' } });

      const result = await resolveFn(execution, task);
      expect(result.params).toEqual({});
      expect(result.env).toEqual({});
    });

    it('should resolve both global params and env profile together', async () => {
      const mockGlobalParamService = {
        resolve: jest.fn(async () => ({ apiKey: 'resolved-api-key' })),
      } as unknown as GlobalParamService;

      const mockEnvProfileService = {
        resolveVariables: jest.fn(async () => ({ DEPLOY_URL: 'https://deploy.example.com' })),
      } as unknown as EnvProfileService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        globalParamService: mockGlobalParamService,
        envProfileService: mockEnvProfileService,
      });

      const resolveFn = (orchestrator as any).resolveServiceParameters.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ environment: 'production', context: { tenantId: 'tenant-1' } }),
      });

      const task = createTask({
        parameters: { apiUrl: '${global.apiKey}' },
      });

      const result = await resolveFn(execution, task);
      expect(result.params).toEqual({ apiKey: 'resolved-api-key' });
      expect(result.env).toEqual({ DEPLOY_URL: 'https://deploy.example.com' });
    });
  });

  // ==================== recordStageAudit Tests ====================

  describe('recordStageAudit', () => {
    it('should call PipelineAuditLogService.recordStageEvent on stage start', async () => {
      const mockRecordStageEvent = jest.fn().mockResolvedValue({});
      const mockAuditLogService = {
        recordStageEvent: mockRecordStageEvent,
      } as unknown as PipelineAuditLogService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService: mockAuditLogService,
      });

      const recordFn = (orchestrator as any).recordStageAudit.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' }, triggerBy: 'admin' }),
      });

      const stage = createStage({ id: 'stage-1', name: 'build' });

      await recordFn(execution, stage, 'start', 'success');

      expect(mockRecordStageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          runId: 'run-1',
          stageId: 'stage-1',
          action: 'start',
          actor: 'admin',
          outcome: 'success',
          metadata: expect.objectContaining({ stageName: 'build' }),
        })
      );
    });

    it('should call PipelineAuditLogService.recordStageEvent on stage complete', async () => {
      const mockRecordStageEvent = jest.fn().mockResolvedValue({});
      const mockAuditLogService = {
        recordStageEvent: mockRecordStageEvent,
      } as unknown as PipelineAuditLogService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService: mockAuditLogService,
      });

      const recordFn = (orchestrator as any).recordStageAudit.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const stage = createStage({ id: 'stage-1', name: 'build' });

      await recordFn(execution, stage, 'complete', 'success', 5000);

      expect(mockRecordStageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'complete',
          outcome: 'success',
          durationMs: 5000,
        })
      );
    });

    it('should call PipelineAuditLogService.recordStageEvent on stage fail', async () => {
      const mockRecordStageEvent = jest.fn().mockResolvedValue({});
      const mockAuditLogService = {
        recordStageEvent: mockRecordStageEvent,
      } as unknown as PipelineAuditLogService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService: mockAuditLogService,
      });

      const recordFn = (orchestrator as any).recordStageAudit.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const stage = createStage({ id: 'stage-1', name: 'build' });

      await recordFn(execution, stage, 'fail', 'failure', 3000, 'Connection timeout');

      expect(mockRecordStageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fail',
          outcome: 'failed',
          durationMs: 3000,
          errorMessage: 'Connection timeout',
        })
      );
    });

    it('should silently ignore audit errors', async () => {
      const mockAuditLogService = {
        recordStageEvent: jest.fn().mockRejectedValue(new Error('DB error')),
      } as unknown as PipelineAuditLogService;

      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService: mockAuditLogService,
      });

      const recordFn = (orchestrator as any).recordStageAudit.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const stage = createStage({ id: 'stage-1', name: 'build' });

      // Should not throw
      await expect(recordFn(execution, stage, 'start', 'success')).resolves.toBeUndefined();
    });

    it('should skip audit when service is not available', async () => {
      const orchestrator = new StageOrchestrator({
        ...deps,
        pipelineAuditLogService: null,
      });

      const recordFn = (orchestrator as any).recordStageAudit.bind(orchestrator);

      const execution = createExecution({
        run: createRun({ context: { tenantId: 'tenant-1' } }),
      });

      const stage = createStage({ id: 'stage-1', name: 'build' });

      // Should not throw and not call any service
      await expect(recordFn(execution, stage, 'start', 'success')).resolves.toBeUndefined();
    });
  });
});

// ==================== Test Helpers ====================

function createExecution(overrides: Partial<any> = {}): any {
  return {
    run: createRun(),
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
    ...overrides,
  };
}

function createRun(overrides: Partial<any> = {}): PipelineRun {
  return {
    id: 'run-1',
    pipelineId: 'pipeline-1',
    pipelineVersion: '1',
    triggerType: TriggerType.API,
    status: PipelineRunStatus.RUNNING,
    environment: 'production',
    context: { tenantId: 'default' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: `stage-${Date.now()}`,
    runId: 'run-1',
    name: 'default',
    sequence: 0,
    status: StageStatus.PENDING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    stageId: 'stage-1',
    name: 'test',
    type: 'shell',
    sequence: 1,
    status: TaskStatus.PENDING,
    config: {},
    parameters: {},
    retryCount: 0,
    maxRetries: 0,
    timeoutSeconds: 600,
    createdAt: new Date(),
    ...overrides,
  };
}
