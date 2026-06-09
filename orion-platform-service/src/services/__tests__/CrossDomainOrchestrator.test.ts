/**
 * CrossDomainOrchestrator Tests
 *
 * Tests for orchestration creation, execution with dependencies,
 * orchestration management (pause/resume), and execution tracking.
 */

import {
  CrossDomainOrchestrator,
  CreateOrchestrationInput,
} from '../cross-domain-orchestration/CrossDomainOrchestrator';

describe('CrossDomainOrchestrator', () => {
  let orchestrator: CrossDomainOrchestrator;

  const validSteps: CreateOrchestrationInput['steps'] = [
    {
      stepName: 'build',
      domainName: 'pipeline',
      action: 'build',
      payload: { repo: 'my-app' },
      maxRetries: 3,
    },
    {
      stepName: 'deploy',
      domainName: 'deploy',
      action: 'deploy',
      payload: { version: '1.0.0' },
      maxRetries: 2,
    },
    {
      stepName: 'verify',
      domainName: 'monitor',
      action: 'verify',
      payload: { threshold: 0.95 },
      maxRetries: 1,
    },
  ];

  const validInput: CreateOrchestrationInput = {
    name: 'deploy-flow',
    description: 'Cross-domain deployment flow',
    domains: ['pipeline', 'deploy', 'monitor'],
    steps: validSteps,
  };

  beforeEach(() => {
    // No database = in-memory mode
    orchestrator = new CrossDomainOrchestrator();
  });

  // ==================== createOrchestration ====================

  describe('createOrchestration', () => {
    it('should create a new orchestration with pending status', async () => {
      const result = await orchestrator.createOrchestration('tenant-1', validInput);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('deploy-flow');
      expect(result.description).toBe('Cross-domain deployment flow');
      expect(result.status).toBe('pending');
      expect(result.steps).toHaveLength(3);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should preserve step properties', async () => {
      const result = await orchestrator.createOrchestration('tenant-1', validInput);

      expect(result.steps[0].domainName).toBe('pipeline');
      expect(result.steps[0].stepName).toBe('build');
      expect(result.steps[0].input).toEqual({ repo: 'my-app' });
      expect(result.steps[0].maxRetries).toBe(3);
    });

    it('should work with minimal input', async () => {
      const minimalInput: CreateOrchestrationInput = {
        name: 'minimal',
        description: 'A minimal orchestration',
        domains: ['pipeline'],
        steps: [
          {
            stepName: 'run',
            domainName: 'pipeline',
            action: 'run',
            payload: {},
          },
        ],
      };

      const result = await orchestrator.createOrchestration('tenant-1', minimalInput);
      expect(result.status).toBe('pending');
      expect(result.steps).toHaveLength(1);
    });

    it('should set default maxRetries to 3', async () => {
      const input: CreateOrchestrationInput = {
        name: 'test',
        description: 'test',
        domains: ['pipeline'],
        steps: [
          {
            stepName: 's1',
            domainName: 'pipeline',
            action: 'run',
            payload: {},
            // no maxRetries specified
          },
        ],
      };

      const result = await orchestrator.createOrchestration('tenant-1', input);
      expect(result.steps[0].maxRetries).toBe(3);
    });
  });

  // ==================== getOrchestrationById ====================

  describe('getOrchestrationById', () => {
    it('should retrieve an orchestration by ID', async () => {
      const created = await orchestrator.createOrchestration('tenant-1', validInput);
      const found = await orchestrator.getOrchestrationById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('deploy-flow');
    });

    it('should return null for non-existent orchestration', async () => {
      const found = await orchestrator.getOrchestrationById('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== listOrchestrations ====================

  describe('listOrchestrations', () => {
    it('should list all orchestrations for a tenant', async () => {
      await orchestrator.createOrchestration('tenant-1', { ...validInput, name: 'flow-1' });
      await orchestrator.createOrchestration('tenant-1', { ...validInput, name: 'flow-2' });

      const orchestrations = await orchestrator.listOrchestrations('tenant-1');
      expect(orchestrations.length).toBe(2);
    });

    it('should filter by status', async () => {
      const created = await orchestrator.createOrchestration('tenant-1', { ...validInput, name: 'pending-flow' });

      const pendingOrchestrations = await orchestrator.listOrchestrations('tenant-1', { status: 'pending' });
      expect(pendingOrchestrations.some((o) => o.name === 'pending-flow')).toBe(true);
    });

    it('should filter by domain', async () => {
      await orchestrator.createOrchestration('tenant-1', {
        ...validInput,
        name: 'pipeline-only',
        domains: ['pipeline'],
        steps: [{ stepName: 'run', domainName: 'pipeline', action: 'run', payload: {} }],
      });

      const pipelineOrchestrations = await orchestrator.listOrchestrations('tenant-1', { domain: 'pipeline' });
      expect(pipelineOrchestrations.length).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await orchestrator.createOrchestration('tenant-1', { ...validInput, name: `flow-${i}` });
      }

      const page1 = await orchestrator.listOrchestrations('tenant-1', { limit: 2, offset: 0 });
      const page2 = await orchestrator.listOrchestrations('tenant-1', { limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0].name).not.toBe(page2[0].name);
    });
  });

  // ==================== executeOrchestration ====================

  describe('executeOrchestration', () => {
    it('should execute an orchestration and update status', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);
      const executed = await orchestrator.executeOrchestration(orchestration.id);

      expect(executed.id).toBe(orchestration.id);
      expect(executed.status).toBe('completed');
      expect(executed.startedAt).toBeInstanceOf(Date);
      expect(executed.completedAt).toBeInstanceOf(Date);
    });

    it('should fail when orchestration not found', async () => {
      await expect(
        orchestrator.executeOrchestration('non-existent')
      ).rejects.toThrow('not found');
    });

    it('should fail when orchestration is not pending', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);
      await orchestrator.executeOrchestration(orchestration.id);

      await expect(
        orchestrator.executeOrchestration(orchestration.id)
      ).rejects.toThrow('cannot be executed');
    });

    it('should update orchestration completedAt timestamp', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);
      expect(orchestration.completedAt).toBeUndefined();

      const executed = await orchestrator.executeOrchestration(orchestration.id);
      expect(executed.completedAt).toBeInstanceOf(Date);
    });
  });

  // ==================== getOrchestrationStatus ====================

  describe('getOrchestrationStatus', () => {
    it('should retrieve orchestration status with steps', async () => {
      const created = await orchestrator.createOrchestration('tenant-1', validInput);

      const status = await orchestrator.getOrchestrationStatus(created.id);
      expect(status).not.toBeNull();
      expect(status.id).toBe(created.id);
      expect(status.steps).toHaveLength(3);
    });

    it('should throw for non-existent orchestration', async () => {
      await expect(
        orchestrator.getOrchestrationStatus('non-existent')
      ).rejects.toThrow('not found');
    });
  });

  // ==================== pauseOrchestration ====================

  describe('pauseOrchestration', () => {
    it('should throw when trying to pause a pending orchestration', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);

      await expect(orchestrator.pauseOrchestration(orchestration.id)).rejects.toThrow(
        'Only running orchestrations can be paused'
      );
    });

    it('should throw for non-existent orchestration', async () => {
      await expect(orchestrator.pauseOrchestration('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== resumeOrchestration ====================

  describe('resumeOrchestration', () => {
    it('should throw when trying to resume a non-paused orchestration', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);

      await expect(orchestrator.resumeOrchestration(orchestration.id)).rejects.toThrow(
        'Only paused orchestrations can be resumed'
      );
    });

    it('should throw for non-existent orchestration', async () => {
      await expect(orchestrator.resumeOrchestration('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== abortOrchestration ====================

  describe('abortOrchestration', () => {
    it('should abort a pending orchestration', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);

      const aborted = await orchestrator.abortOrchestration(orchestration.id);
      expect(aborted.status).toBe('aborted');
    });

    it('should throw when trying to abort a completed orchestration', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);
      await orchestrator.executeOrchestration(orchestration.id);

      await expect(orchestrator.abortOrchestration(orchestration.id)).rejects.toThrow(
        'Cannot abort'
      );
    });

    it('should throw when trying to abort an already aborted orchestration', async () => {
      const orchestration = await orchestrator.createOrchestration('tenant-1', validInput);
      await orchestrator.abortOrchestration(orchestration.id);

      await expect(orchestrator.abortOrchestration(orchestration.id)).rejects.toThrow(
        'Cannot abort'
      );
    });

    it('should throw for non-existent orchestration', async () => {
      await expect(orchestrator.abortOrchestration('non-existent')).rejects.toThrow('not found');
    });
  });
});
