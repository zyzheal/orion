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

  // Stateful mock DB that persists orchestrations and steps
  const orchestrationStore = new Map<string, any>();
  const stepStore = new Map<string, any[]>();

  function createMockDb() {
    return {
      query: jest.fn(async (sql: string, params?: any[]) => {
        // INSERT orchestration (save)
        if (sql.includes('INSERT INTO cross_domain_orchestrations')) {
          const row = buildOrchestrationRow(params);
          orchestrationStore.set(row.id, row);
          return { rows: [row], rowCount: 1 };
        }
        // INSERT step (saveStep)
        if (sql.includes('INSERT INTO cross_domain_orchestration_steps')) {
          const stepId = params[0];
          const orchId = params[1];
          const stepRow = buildStepRow(stepId, orchId, params);
          const existing = stepStore.get(orchId) || [];
          existing.push(stepRow);
          stepStore.set(orchId, existing);
          return { rows: [stepRow], rowCount: 1 };
        }
        // SELECT by id (findById)
        if (sql.includes('WHERE id = $1') && !sql.includes('orchestration_id')) {
          const id = params?.[0];
          const row = orchestrationStore.get(id);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        // SELECT steps by orchestration_id
        if (sql.includes('orchestration_id = $1') && sql.includes('ORDER BY sequence')) {
          const orchId = params?.[0];
          const steps = stepStore.get(orchId) || [];
          return { rows: steps, rowCount: steps.length };
        }
        // SELECT by tenant (findByTenant) — mirrors the real repository's SQL construction
        if (sql.includes('WHERE tenant_id = $1') && sql.includes('cross_domain_orchestrations')) {
          const tenantId = params?.[0];
          let results = Array.from(orchestrationStore.values()).filter(
            (o: any) => o.tenant_id === tenantId
          );
          // Dynamically reconstruct the expected SQL to track param positions
          // (mirrors OrchestrationRepository.findByTenant)
          const expectedQueryParts: string[] = ['SELECT * FROM cross_domain_orchestrations WHERE tenant_id = $1'];
          const mockParams: any[] = [tenantId];
          let mockParamIdx = 2;
          // Check if SQL has a status clause to find its param index
          const statusMatch = sql.match(/AND\s+status\s*=\s*ANY\(\$(\d+)\)/i);
          if (statusMatch) {
            const statusIdx = parseInt(statusMatch[1]);
            const statusParam = params?.[statusIdx - 1];
            if (statusParam) {
              const statuses = Array.isArray(statusParam) ? statusParam : [statusParam];
              results = results.filter((o: any) => statuses.includes(o.status));
            }
          }
          // Check if SQL has a domain clause
          const domainMatch = sql.match(/AND\s+domains\s+@>\s+\$(\d+)::jsonb/i);
          if (domainMatch) {
            const domainIdx = parseInt(domainMatch[1]);
            const domainJsonParam = params?.[domainIdx - 1];
            if (domainJsonParam) {
              const domains = JSON.parse(domainJsonParam as string) as string[];
              results = results.filter((o: any) => {
                const oDomains = Array.isArray(o.domains) ? o.domains : (typeof o.domains === 'string' ? JSON.parse(o.domains) : []);
                return oDomains.some((d: string) => domains.includes(d));
              });
            }
          }
          // Sort by created_at DESC
          results.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          // Apply LIMIT and OFFSET (non-global regex to avoid lastIndex state)
          const limitRe = /LIMIT\s+\$(\d+)/i;
          const offsetRe = /OFFSET\s+\$(\d+)/i;
          const limitMatch = sql.match(limitRe);
          const offsetMatch = sql.match(offsetRe);
          if (offsetMatch) {
            const offset = params?.[parseInt(offsetMatch[1]) - 1];
            results = results.slice((offset as number) || 0);
          }
          if (limitMatch) {
            const limit = params?.[parseInt(limitMatch[1]) - 1];
            results = results.slice(0, (limit as number) || results.length);
          }
          return { rows: results, rowCount: results.length };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
  }

  function buildOrchestrationRow(params: any[]): any {
    return {
      id: params[0],
      tenant_id: params[1],
      name: params[2],
      description: params[3],
      status: params[4],
      input: params[5],
      output: params[6],
      error: params[7],
      domains: params[8],
      current_step: params[9],
      step_count: params[10],
      completed_steps: params[11],
      created_by: params[12],
      metadata: params[13],
      created_at: params[14],
      updated_at: params[15],
      completed_at: params[16],
      started_at: params[17],
    };
  }

  function buildStepRow(stepId: string, orchId: string, params: any[]): any {
    return {
      id: stepId,
      orchestration_id: orchId,
      step_name: params[2],
      domain_name: params[3],
      sequence: params[4],
      status: params[5],
      input: params[6],
      output: params[7],
      error: params[8],
      retry_count: params[9],
      max_retries: params[10],
      started_at: params[11],
      completed_at: params[12],
      compensation_started_at: params[13],
      compensation_completed_at: params[14],
      created_at: new Date(),
    };
  }

  beforeEach(() => {
    orchestrationStore.clear();
    stepStore.clear();
    const mockDb = createMockDb();
    orchestrator = new CrossDomainOrchestrator(mockDb as any);
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
