/**
 * SelfHealingSaga Tests
 *
 * Tests for self-healing saga definition: step structure, detection,
 * diagnosis, remediation, verification, event publishing, and compensation.
 */
import {
  SelfHealingSaga,
  SelfHealingSagaStatus,
  createSelfHealingSagaDefinition,
} from '../SelfHealingSaga';
import { SagaContext } from '../types';

// Mock event bus
const mockEventBus = {
  publish: jest.fn(async () => {}),
};

// Mock diagnostic service
const mockDiagnosticService = {
  detect: jest.fn(async () => ({
    issueType: 'pod_crash',
    severity: 'critical',
    details: { podName: 'app-pod-abc' },
  })),
  diagnose: jest.fn(async () => ({
    rootCause: 'OOMKilled',
    confidence: 95,
    recommendedActions: ['restart', 'increase_memory_limit'],
  })),
  cancelSession: jest.fn(async () => {}),
};

// Mock self-healing service
const mockSelfHealingService = {
  getCurrentState: jest.fn(async () => ({
    podName: 'app-pod-12345',
    status: 'Running',
  })),
  executeRemediation: jest.fn(async () => ({
    success: true,
    details: { restartedPods: 1 },
  })),
  undoRemediation: jest.fn(async () => {}),
  verifyRemediation: jest.fn(async () => ({
    verified: true,
    metrics: { latencyMs: 45 },
  })),
};

function makeContext(overrides: Partial<SagaContext> = {}): SagaContext {
  return {
    transactionId: 'tx-1',
    requestId: 'req-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    stepExecutions: [],
    currentStepIndex: -1,
    ...overrides,
  };
}

describe('SelfHealingSaga', () => {
  let saga: SelfHealingSaga;

  beforeEach(() => {
    jest.clearAllMocks();
    saga = new SelfHealingSaga();
  });

  describe('getDefinition', () => {
    it('should return saga definition with 5 steps', () => {
      const def = saga.getDefinition();
      expect(def.name).toBe('SelfHealingSaga');
      expect(def.steps).toHaveLength(5);
    });

    it('should have steps in correct order', () => {
      const def = saga.getDefinition();
      const names = def.steps.map(s => s.name);
      expect(names).toEqual([
        'detectIssue',
        'diagnoseRootCause',
        'executeRemediation',
        'verifyResult',
        'publishEvents',
      ]);
    });

    it('should have compensation for each step', () => {
      const def = saga.getDefinition();
      for (const step of def.steps) {
        expect(step.compensate).toBeDefined();
      }
    });

    it('should have finalize function', () => {
      const def = saga.getDefinition();
      expect(def.finalize).toBeDefined();
    });
  });

  describe('step 1: detectIssue', () => {
    it('should create a healing session and return detection result', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'prod', namespace: 'default' };

      const result = await def.steps[0].execute(input, context);

      expect(result).toHaveProperty('issueType');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('details');
      expect(context.metadata.healingId).toBeDefined();
      expect(context.metadata.service).toBe('my-app');

      // Session should be stored
      const session = saga.getSession(context.metadata.healingId as string);
      expect(session).not.toBeNull();
      expect(session!.status).toBe(SelfHealingSagaStatus.DETECTING);
    });

    it('should use issueType from input when no diagnosticService', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', issueType: 'container_oom' as const };

      const result = await def.steps[0].execute(input, context);
      expect(result.issueType).toBe('container_oom');
    });

    it('should compensate by deleting session and publishing event', async () => {
      const sagaWithBus = new SelfHealingSaga(mockEventBus as any);
      const def = sagaWithBus.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app' };

      const result = await def.steps[0].execute(input, context);
      const healingId = context.metadata.healingId as string;

      await def.steps[0].compensate(input, result, context);

      expect(sagaWithBus.getSession(healingId)).toBeNull();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'selfhealing.detection.cleared',
        expect.objectContaining({ healingId, service: 'my-app' }),
      );
    });
  });

  describe('step 2: diagnoseRootCause', () => {
    it('should diagnose root cause with fallback when no service', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      // Run detect first to set up session
      await def.steps[0].execute(input, context);

      const result = await def.steps[1].execute(input, context);

      expect(result).toHaveProperty('rootCause');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('recommendedActions');
      expect(result.autoApproved).toBe(true); // 85 >= 80
    });

    it('should require user approval when confidence below threshold', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 99 };

      await def.steps[0].execute(input, context);

      // Without userApproval, should throw
      await expect(def.steps[1].execute(input, context)).rejects.toThrow();
    });

    it('should allow execution when userApproval is true', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 99, userApproval: true };

      await def.steps[0].execute(input, context);
      const result = await def.steps[1].execute(input, context);

      expect(result.autoApproved).toBe(true);
    });

    it('should compensate by clearing diagnosis', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      const result = await def.steps[1].execute(input, context);
      const healingId = context.metadata.healingId as string;

      await def.steps[1].compensate(input, result, context);

      const session = saga.getSession(healingId);
      expect(session!.diagnosisResult).toBeUndefined();
      expect(session!.status).toBe(SelfHealingSagaStatus.FAILED);
    });
  });

  describe('step 3: executeRemediation', () => {
    it('should execute remediation with fallback', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);

      const result = await def.steps[2].execute(input, context);

      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('details');
    });

    it('should compensate by undoing remediation', async () => {
      const sagaWithServices = new SelfHealingSaga(
        mockEventBus as any,
        undefined,
        mockSelfHealingService as any,
      );
      const def = sagaWithServices.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      const result = await def.steps[2].execute(input, context);
      const healingId = context.metadata.healingId as string;

      await def.steps[2].compensate(input, result, context);

      const session = sagaWithServices.getSession(healingId);
      expect(session!.status).toBe(SelfHealingSagaStatus.UNDONE);
      expect(mockSelfHealingService.undoRemediation).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'selfhealing.remediation.undo',
        expect.objectContaining({ healingId }),
      );
    });
  });

  describe('step 4: verifyResult', () => {
    it('should verify remediation result with fallback', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);

      const result = await def.steps[3].execute(input, context);

      expect(result).toHaveProperty('verified', true);
      expect(result).toHaveProperty('metrics');

      const healingId = context.metadata.healingId as string;
      const session = saga.getSession(healingId);
      expect(session!.status).toBe(SelfHealingSagaStatus.COMPLETED);
    });

    it('should compensate by setting status to failed', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);
      const result = await def.steps[3].execute(input, context);
      const healingId = context.metadata.healingId as string;

      await def.steps[3].compensate(input, result, context);

      const session = saga.getSession(healingId);
      expect(session!.status).toBe(SelfHealingSagaStatus.FAILED);
    });
  });

  describe('step 5: publishEvents', () => {
    it('should publish completion event when eventBus is available', async () => {
      const sagaWithBus = new SelfHealingSaga(mockEventBus as any);
      const def = sagaWithBus.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);
      await def.steps[3].execute(input, context);

      const result = await def.steps[4].execute(input, context);

      expect(result.published).toBe(true);
      expect(result.events).toContain('selfhealing.completed');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'selfhealing.completed',
        expect.objectContaining({ service: 'my-app' }),
      );
    });

    it('should return no events when no eventBus', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);
      await def.steps[3].execute(input, context);

      const result = await def.steps[4].execute(input, context);

      expect(result.published).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('should compensate by publishing failure event', async () => {
      const sagaWithBus = new SelfHealingSaga(mockEventBus as any);
      const def = sagaWithBus.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);
      await def.steps[3].execute(input, context);
      const result = await def.steps[4].execute(input, context);

      await def.steps[4].compensate(input, result, context);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'selfhealing.failed',
        expect.objectContaining({ service: 'my-app' }),
      );
    });
  });

  describe('with injected services', () => {
    it('should use diagnosticService for detection', async () => {
      const sagaWithDiag = new SelfHealingSaga(undefined, mockDiagnosticService as any);
      const def = sagaWithDiag.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app' };

      const result = await def.steps[0].execute(input, context);

      expect(mockDiagnosticService.detect).toHaveBeenCalled();
      expect(result.issueType).toBe('pod_crash');
      expect(result.severity).toBe('critical');
    });

    it('should use diagnosticService for diagnosis', async () => {
      const sagaWithDiag = new SelfHealingSaga(undefined, mockDiagnosticService as any);
      const def = sagaWithDiag.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 90 };

      await def.steps[0].execute(input, context);
      const result = await def.steps[1].execute(input, context);

      expect(mockDiagnosticService.diagnose).toHaveBeenCalled();
      expect(result.rootCause).toBe('OOMKilled');
      expect(result.confidence).toBe(95);
      expect(result.autoApproved).toBe(true); // 95 >= 90
    });

    it('should use selfHealingService for remediation', async () => {
      const sagaWithHealing = new SelfHealingSaga(
        undefined,
        undefined,
        mockSelfHealingService as any,
      );
      const def = sagaWithHealing.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      const result = await def.steps[2].execute(input, context);

      expect(mockSelfHealingService.getCurrentState).toHaveBeenCalled();
      expect(mockSelfHealingService.executeRemediation).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('finalize', () => {
    it('should return healing output after all steps', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', autoExecuteThreshold: 80 };

      await def.steps[0].execute(input, context);
      await def.steps[1].execute(input, context);
      await def.steps[2].execute(input, context);
      await def.steps[3].execute(input, context);

      const output = await def.finalize!(input, context);

      expect(output).toHaveProperty('healingId');
      expect(output).toHaveProperty('service', 'my-app');
      expect(output).toHaveProperty('status');
      expect(output).toHaveProperty('detectionResult');
      expect(output).toHaveProperty('diagnosisResult');
      expect(output).toHaveProperty('remediationResult');
    });
  });

  describe('cleanup', () => {
    it('should remove session from memory', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app' };

      await def.steps[0].execute(input, context);
      const healingId = context.metadata.healingId as string;

      expect(saga.getSession(healingId)).not.toBeNull();

      saga.cleanup(healingId);

      expect(saga.getSession(healingId)).toBeNull();
    });
  });
});
