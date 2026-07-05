/**
 * DeploySaga Tests
 *
 * Tests for deploy saga definition: step structure, compensation, and finalize.
 */
import { createDeploySagaDefinition, DeploySaga, DeploySagaStatus } from '../DeploySaga';
import { SagaContext } from '../types';

// Mock event publisher
const mockEventPublisher = {
  publishDeploymentStarted: jest.fn(async () => {}),
  publishDeploymentCancelled: jest.fn(async () => {}),
  publishDeploymentCompleted: jest.fn(async () => {}),
  publishDeploymentFailed: jest.fn(async () => {}),
  publishDeploymentRolledback: jest.fn(async () => {}),
};

function makeContext(overrides: Partial<SagaContext> = {}): SagaContext {
  return {
    sagaId: 'saga-1',
    metadata: {},
    stepExecutions: [],
    ...overrides,
  };
}

describe('DeploySaga', () => {
  let saga: DeploySaga;

  beforeEach(() => {
    jest.clearAllMocks();
    saga = new DeploySaga(mockEventPublisher as any);
  });

  describe('getDefinition', () => {
    it('should return saga definition with 5 steps', () => {
      const def = saga.getDefinition();
      expect(def.name).toBe('DeploySaga');
      expect(def.steps).toHaveLength(5);
    });

    it('should have steps in correct order', () => {
      const def = saga.getDefinition();
      const names = def.steps.map(s => s.name);
      expect(names).toEqual([
        'createDeployment',
        'runCanaryAnalysis',
        'promoteToProduction',
        'updateStatus',
        'publishEvents',
      ]);
    });

    it('should have compensation for each step', () => {
      const def = saga.getDefinition();
      for (const step of def.steps) {
        expect(step.compensate).toBeDefined();
      }
    });
  });

  describe('step 1: createDeployment', () => {
    it('should create deployment and store in context', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'staging', tenantId: 't-1' };

      const result = await def.steps[0].execute(input, context);

      expect(result).toHaveProperty('deploymentId');
      expect(result).toHaveProperty('service', 'my-app');
      expect(result).toHaveProperty('environment', 'staging');
      expect(result).toHaveProperty('status', DeploySagaStatus.CREATED);
      expect(context.metadata.deploymentId).toBe(result.deploymentId);
      expect(mockEventPublisher.publishDeploymentStarted).toHaveBeenCalled();
    });

    it('should compensate by deleting deployment', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'staging' };

      const result = await def.steps[0].execute(input, context);
      context.metadata.deploymentId = result.deploymentId;

      await def.steps[0].compensate(input, result, context);

      expect(mockEventPublisher.publishDeploymentCancelled).toHaveBeenCalled();
      expect(saga.getDeployment(result.deploymentId)).toBeNull();
    });
  });

  describe('step 2: runCanaryAnalysis', () => {
    it('should skip canary for rolling strategy', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'prod', strategy: 'rolling' };

      // Create deployment first
      const createResult = await def.steps[0].execute(input, context);
      context.metadata.deploymentId = createResult.deploymentId;

      const result = await def.steps[1].execute(input, context);
      expect(result).toHaveProperty('skipped', true);
      expect(result).toHaveProperty('passed', true);
    });

    it('should throw when canary service not injected for canary strategy', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'prod', strategy: 'canary' };

      const createResult = await def.steps[0].execute(input, context);
      context.metadata.deploymentId = createResult.deploymentId;

      await expect(def.steps[1].execute(input, context)).rejects.toThrow('CanaryAnalysisService not injected');
    });
  });

  describe('finalize', () => {
    it('should return deployment output', async () => {
      const def = saga.getDefinition();
      const context = makeContext();
      const input = { service: 'my-app', environment: 'staging' };

      const createResult = await def.steps[0].execute(input, context);
      context.metadata.deploymentId = createResult.deploymentId;

      const output = await def.finalize(input, context);
      expect(output).toHaveProperty('deploymentId', createResult.deploymentId);
      expect(output).toHaveProperty('service', 'my-app');
      expect(output).toHaveProperty('environment', 'staging');
    });
  });
});
