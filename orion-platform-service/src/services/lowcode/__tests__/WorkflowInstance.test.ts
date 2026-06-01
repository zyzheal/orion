/**
 * WorkflowInstanceManager - 工作流实例管理器测试
 *
 * 覆盖：constructor, create, start, suspend, resume, terminate, complete, fail,
 *        moveToNode, updateVariables, addHistory, getState, getInstance, getInstancesByWorkflow,
 *        cleanupExpiredInstances
 */

import { WorkflowInstanceManager } from '../WorkflowInstance';
import { WorkflowInstanceRepository } from '../WorkflowRepository';
import { OrionError, ErrorCode } from '../../../errors';
import type { WorkflowDefinition, WorkflowInstance } from '../types';

// ---- helpers ----

function makeDefinition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: 'def-1',
    tenantId: 'tenant-1',
    name: 'Test Workflow',
    version: 1,
    enabled: true,
    nodes: [
      { id: 'start-1', type: 'start', name: 'Start', position: { x: 0, y: 0 }, config: { type: 'start' } },
      { id: 'end-1', type: 'end', name: 'End', position: { x: 100, y: 0 }, config: { type: 'end' } },
    ],
    edges: [{ id: 'e1', source: 'start-1', target: 'end-1' }],
    createdBy: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInstance(overrides?: Partial<WorkflowInstance>): WorkflowInstance {
  return {
    id: 'inst-1',
    workflowId: 'def-1',
    workflowDefinitionId: 'def-1',
    tenantId: 'tenant-1',
    status: 'pending',
    currentNodeId: 'start-1',
    variables: {},
    history: [],
    input: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepo(): jest.Mocked<WorkflowInstanceRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByWorkflowId: jest.fn(),
    update: jest.fn(),
    addHistory: jest.fn(),
    updateStatus: jest.fn(),
    cleanupExpiredInstances: jest.fn(),
  } as any;
}

// ---- tests ----

describe('WorkflowInstanceManager', () => {
  let repo: jest.Mocked<WorkflowInstanceRepository>;
  let manager: WorkflowInstanceManager;

  beforeEach(() => {
    repo = createMockRepo();
    manager = new WorkflowInstanceManager(repo as any);
  });

  // ========== constructor ==========

  describe('constructor', () => {
    it('should store repository reference', () => {
      expect(manager.repository).toBe(repo);
    });
  });

  // ========== create ==========

  describe('create', () => {
    it('should create an instance from a definition with start node', async () => {
      const definition = makeDefinition();
      const created = makeInstance({ currentNodeId: 'end-1' });
      repo.create.mockResolvedValue(created);
      repo.addHistory.mockResolvedValue(undefined as any);

      const result = await manager.create(definition, { key: 'value' }, 'user-1');

      expect(repo.create).toHaveBeenCalledTimes(1);
      const callArg = repo.create.mock.calls[0][0];
      expect(callArg.workflowId).toBe('def-1');
      expect(callArg.status).toBe('pending');
      expect(callArg.tenantId).toBe('tenant-1');
      expect(callArg.input).toEqual({ key: 'value' });
      expect(result).toBe(created);
    });

    it('should throw OrionError if no start node found', async () => {
      const definition = makeDefinition({ nodes: [{ id: 'end-1', type: 'end', name: 'End', position: { x: 0, y: 0 }, config: { type: 'end' } }] });

      await expect(manager.create(definition, {}, 'user-1')).rejects.toThrow(OrionError);
      await expect(manager.create(definition, {}, 'user-1')).rejects.toThrow('must have a start node');
    });

    it('should record history entry for start node enter', async () => {
      const definition = makeDefinition();
      const created = makeInstance({ id: 'inst-2' });
      repo.create.mockResolvedValue(created);
      repo.addHistory.mockResolvedValue(undefined as any);

      await manager.create(definition, {}, 'user-1');

      expect(repo.addHistory).toHaveBeenCalledWith('inst-2', expect.objectContaining({
        nodeId: 'start-1',
        nodeName: 'Start',
        nodeType: 'start',
        action: 'enter',
      }));
    });

    it('should set currentNodeId to the target of start node edge', async () => {
      const definition = makeDefinition();
      repo.create.mockResolvedValue(makeInstance());
      repo.addHistory.mockResolvedValue(undefined as any);

      await manager.create(definition, {}, 'user-1');

      const callArg = repo.create.mock.calls[0][0];
      expect(callArg.currentNodeId).toBe('end-1');
    });

    it('should use start node as currentNodeId when no outgoing edge', async () => {
      const definition = makeDefinition({ edges: [] });
      repo.create.mockResolvedValue(makeInstance());
      repo.addHistory.mockResolvedValue(undefined as any);

      await manager.create(definition, {}, 'user-1');

      const callArg = repo.create.mock.calls[0][0];
      expect(callArg.currentNodeId).toBe('start-1');
    });
  });

  // ========== start ==========

  describe('start', () => {
    it('should transition from pending to running', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'pending' }));
      repo.update.mockResolvedValue(makeInstance({ status: 'running' }));

      const result = await manager.start('inst-1');

      expect(repo.update).toHaveBeenCalledWith('inst-1', { status: 'running' });
      expect(result.status).toBe('running');
    });

    it('should transition from suspended to running', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'suspended' }));
      repo.update.mockResolvedValue(makeInstance({ status: 'running' }));

      await manager.start('inst-1');
      expect(repo.update).toHaveBeenCalled();
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.start('missing')).rejects.toThrow('not found');
    });

    it('should throw if status is completed', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'completed' }));

      await expect(manager.start('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if status is running', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));

      await expect(manager.start('inst-1')).rejects.toThrow(OrionError);
    });
  });

  // ========== suspend ==========

  describe('suspend', () => {
    it('should transition from running to suspended', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));
      repo.updateStatus.mockResolvedValue(makeInstance({ status: 'suspended' }));

      const result = await manager.suspend('inst-1');

      expect(repo.updateStatus).toHaveBeenCalledWith('inst-1', 'suspended');
      expect(result.status).toBe('suspended');
    });

    it('should throw if not running', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'pending' }));

      await expect(manager.suspend('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.suspend('missing')).rejects.toThrow('not found');
    });
  });

  // ========== resume ==========

  describe('resume', () => {
    it('should transition from suspended to running', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'suspended' }));
      repo.update.mockResolvedValue(makeInstance({ status: 'running' }));

      const result = await manager.resume('inst-1');

      expect(repo.update).toHaveBeenCalledWith('inst-1', { status: 'running' });
      expect(result.status).toBe('running');
    });

    it('should throw if not suspended', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));

      await expect(manager.resume('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.resume('missing')).rejects.toThrow('not found');
    });
  });

  // ========== terminate ==========

  describe('terminate', () => {
    it('should terminate a running instance', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));
      repo.updateStatus.mockResolvedValue(makeInstance({ status: 'terminated' }));

      const result = await manager.terminate('inst-1', 'test reason');

      expect(repo.updateStatus).toHaveBeenCalledWith('inst-1', 'terminated', 'test reason');
      expect(result.status).toBe('terminated');
    });

    it('should use default reason if none provided', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'pending' }));
      repo.updateStatus.mockResolvedValue(makeInstance({ status: 'terminated' }));

      await manager.terminate('inst-1');

      expect(repo.updateStatus).toHaveBeenCalledWith('inst-1', 'terminated', 'Workflow terminated by user');
    });

    it('should throw if already completed', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'completed' }));

      await expect(manager.terminate('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if already failed', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'failed' }));

      await expect(manager.terminate('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if already terminated', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'terminated' }));

      await expect(manager.terminate('inst-1')).rejects.toThrow(OrionError);
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.terminate('missing')).rejects.toThrow('not found');
    });
  });

  // ========== complete ==========

  describe('complete', () => {
    it('should complete an instance with output', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));
      repo.update.mockResolvedValue(makeInstance({ status: 'completed', output: { result: 'ok' } }));

      const result = await manager.complete('inst-1', { result: 'ok' });

      expect(repo.update).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        status: 'completed',
        output: { result: 'ok' },
      }));
      expect(result.status).toBe('completed');
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.complete('missing')).rejects.toThrow('not found');
    });
  });

  // ========== fail ==========

  describe('fail', () => {
    it('should fail an instance with error message', async () => {
      repo.findById.mockResolvedValue(makeInstance({ status: 'running' }));
      repo.updateStatus.mockResolvedValue(makeInstance({ status: 'failed', error: 'boom' }));

      const result = await manager.fail('inst-1', 'boom');

      expect(repo.updateStatus).toHaveBeenCalledWith('inst-1', 'failed', 'boom');
      expect(result.status).toBe('failed');
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.fail('missing', 'err')).rejects.toThrow('not found');
    });
  });

  // ========== moveToNode ==========

  describe('moveToNode', () => {
    it('should update currentNodeId', async () => {
      repo.findById.mockResolvedValue(makeInstance());
      repo.update.mockResolvedValue(makeInstance({ currentNodeId: 'new-node' }));

      const result = await manager.moveToNode('inst-1', 'new-node');

      expect(repo.update).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        currentNodeId: 'new-node',
      }));
    });

    it('should merge variables when provided', async () => {
      repo.findById.mockResolvedValue(makeInstance({ variables: { a: 1 } }));
      repo.update.mockResolvedValue(makeInstance({ variables: { a: 1, b: 2 } }));

      await manager.moveToNode('inst-1', 'node-2', { b: 2 });

      expect(repo.update).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        variables: { a: 1, b: 2 },
      }));
    });

    it('should not merge variables when not provided', async () => {
      repo.findById.mockResolvedValue(makeInstance({ variables: { a: 1 } }));
      repo.update.mockResolvedValue(makeInstance());

      await manager.moveToNode('inst-1', 'node-2');

      expect(repo.update).toHaveBeenCalledWith('inst-1', { currentNodeId: 'node-2' });
    });
  });

  // ========== updateVariables ==========

  describe('updateVariables', () => {
    it('should merge new variables with existing ones', async () => {
      repo.findById.mockResolvedValue(makeInstance({ variables: { a: 1 } }));
      repo.update.mockResolvedValue(makeInstance({ variables: { a: 1, b: 2, c: 3 } }));

      const result = await manager.updateVariables('inst-1', { b: 2, c: 3 });

      expect(repo.update).toHaveBeenCalledWith('inst-1', { variables: { a: 1, b: 2, c: 3 } });
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.updateVariables('missing', {})).rejects.toThrow('not found');
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('should return the workflow state', async () => {
      repo.findById.mockResolvedValue(makeInstance({
        status: 'running',
        currentNodeId: 'node-1',
        variables: { x: 1 },
        history: [{ nodeId: 'start', nodeName: 'Start', nodeType: 'start', action: 'enter', timestamp: new Date() }],
      }));

      const state = await manager.getState('inst-1');

      expect(state.instanceId).toBe('inst-1');
      expect(state.status).toBe('running');
      expect(state.currentNodeId).toBe('node-1');
      expect(state.variables).toEqual({ x: 1 });
    });

    it('should throw if instance not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(manager.getState('missing')).rejects.toThrow('not found');
    });
  });

  // ========== getInstance ==========

  describe('getInstance', () => {
    it('should return instance when found', async () => {
      const inst = makeInstance();
      repo.findById.mockResolvedValue(inst);

      const result = await manager.getInstance('inst-1');
      expect(result).toBe(inst);
    });

    it('should return null when not found', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await manager.getInstance('missing');
      expect(result).toBeNull();
    });
  });

  // ========== getInstancesByWorkflow ==========

  describe('getInstancesByWorkflow', () => {
    it('should delegate to repository.findByWorkflowId', async () => {
      const instances = [makeInstance(), makeInstance({ id: 'inst-2' })];
      repo.findByWorkflowId.mockResolvedValue(instances);

      const result = await manager.getInstancesByWorkflow('def-1', { status: 'running', limit: 10, offset: 0 });

      expect(repo.findByWorkflowId).toHaveBeenCalledWith('def-1', { status: 'running', limit: 10, offset: 0 });
      expect(result).toHaveLength(2);
    });
  });

  // ========== cleanupExpiredInstances ==========

  describe('cleanupExpiredInstances', () => {
    it('should call repository cleanup', () => {
      repo.cleanupExpiredInstances.mockResolvedValue(5);

      const result = manager.cleanupExpiredInstances(new Date('2024-01-01'));

      expect(repo.cleanupExpiredInstances).toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });
  });
});
