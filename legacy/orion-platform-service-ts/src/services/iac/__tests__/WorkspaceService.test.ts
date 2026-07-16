/**
 * WorkspaceService Unit Tests (No DB)
 *
 * Tests the in-memory fallback behavior when no PostgreSQL database is provided.
 * Also tests EventBus event publishing via mock.
 */

import { WorkspaceService } from '../WorkspaceService';
import { EventBusService } from '../../event-bus-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventBusMock(): jest.Mocked<EventBusService> {
  return {
    publish: jest.fn().mockResolvedValue('evt-fake-id'),
    subscribe: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
    checkHealth: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(true),
    isConnected: jest.fn().mockReturnValue(false),
    isFallback: jest.fn().mockReturnValue(false),
    isJetStreamAvailable: jest.fn().mockReturnValue(false),
    getJetStreamClient: jest.fn(),
    getJetStreamManager: jest.fn(),
    ensureStream: jest.fn(),
    ensureConsumer: jest.fn(),
    getJetStreamMetrics: jest.fn(),
    listConsumers: jest.fn(),
    replay: jest.fn(),
    getConnectionStatus: jest.fn(),
    getMetrics: jest.fn(),
    resetMetrics: jest.fn(),
    setRepositories: jest.fn(),
    getRepositories: jest.fn(),
    createStream: jest.fn(),
    getEventHistory: jest.fn(),
    getSubscriptions: jest.fn(),
    getEventStats: jest.fn(),
    retryPendingEvents: jest.fn(),
    getConfig: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  } as unknown as jest.Mocked<EventBusService>;
}

function makeService(eventBus?: EventBusService): WorkspaceService {
  // No db passed => all repository fields remain undefined
  return new WorkspaceService({ eventBus });
}

// ---------------------------------------------------------------------------
// Workspace CRUD - create (in-memory fallback)
// ---------------------------------------------------------------------------

describe('WorkspaceService - create (in-memory fallback)', () => {
  test('should create a workspace with required fields', async () => {
    const svc = makeService();
    const ws = await svc.create({
      name: 'test-ws',
      projectId: 'proj-1',
      environment: 'dev',
    });

    expect(ws.id).toBeDefined();
    expect(ws.name).toBe('test-ws');
    expect(ws.projectId).toBe('proj-1');
    expect(ws.environment).toBe('dev');
    expect(ws.statePath).toBe('');
    expect(ws.variables).toEqual({});
    expect(ws.lockedBy).toBeNull();
    expect(ws.status).toBe('active');
    expect(ws.provider).toBe('terraform');
    expect(ws.createdAt).toBeInstanceOf(Date);
  });

  test('should create a workspace with optional fields', async () => {
    const svc = makeService();
    const ws = await svc.create({
      name: 'full-ws',
      projectId: 'proj-2',
      environment: 'prod',
      statePath: '/infra/vpc',
      variables: { region: 'us-east-1' },
      provider: 'pulumi',
    });

    expect(ws.name).toBe('full-ws');
    expect(ws.statePath).toBe('/infra/vpc');
    expect(ws.variables).toEqual({ region: 'us-east-1' });
    expect(ws.provider).toBe('pulumi');
  });

  test('should publish iac.workspace.created event', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.create({
      name: 'event-ws',
      projectId: 'proj-3',
      environment: 'staging',
    });

    expect(mockBus.publish).toHaveBeenCalledWith(
      'iac.workspace.created',
      expect.objectContaining({
        workspaceId: expect.any(String),
        name: 'event-ws',
        environment: 'staging',
      }),
    );
  });

  test('should create without eventBus and not throw', async () => {
    const svc = makeService();
    const ws = await svc.create({
      name: 'no-bus-ws',
      projectId: 'proj-4',
      environment: 'dev',
    });
    expect(ws.id).toBeDefined();
  });

  test('should create with helm provider', async () => {
    const svc = makeService();
    const ws = await svc.create({
      name: 'helm-ws',
      projectId: 'proj-7',
      environment: 'dr',
      provider: 'helm',
    });
    expect(ws.provider).toBe('helm');
    expect(ws.environment).toBe('dr');
  });

  test('should create multiple workspaces with unique IDs', async () => {
    const svc = makeService();
    const ws1 = await svc.create({ name: 'ws-a', projectId: 'p', environment: 'dev' });
    const ws2 = await svc.create({ name: 'ws-b', projectId: 'p', environment: 'dev' });
    expect(ws1.id).not.toBe(ws2.id);
  });
});

// ---------------------------------------------------------------------------
// Workspace CRUD - getById (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - getById (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.getById('any-id');
    expect(result).toBeUndefined();
  });

  test('should return undefined even for a workspace that was just created', async () => {
    // In-memory fallback does not store; getById always hits db path which is missing
    const svc = makeService();
    const created = await svc.create({
      name: 'temp-ws',
      projectId: 'proj-5',
      environment: 'dev',
    });
    const result = await svc.getById(created.id);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Workspace CRUD - list (no db => returns empty)
// ---------------------------------------------------------------------------

describe('WorkspaceService - list (no db)', () => {
  test('should return empty workspaces and total 0 with no filter', async () => {
    const svc = makeService();
    const result = await svc.list();
    expect(result).toEqual({ workspaces: [], total: 0 });
  });

  test('should return empty with projectId filter', async () => {
    const svc = makeService();
    const result = await svc.list({ projectId: 'proj-1' });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });

  test('should return empty with environment filter', async () => {
    const svc = makeService();
    const result = await svc.list({ environment: 'prod' });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });

  test('should return empty with status filter', async () => {
    const svc = makeService();
    const result = await svc.list({ status: 'active' });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });

  test('should return empty with provider filter', async () => {
    const svc = makeService();
    const result = await svc.list({ provider: 'terraform' });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });

  test('should return empty with pagination', async () => {
    const svc = makeService();
    const result = await svc.list({ page: 1, perPage: 10 });
    expect(result).toEqual({ workspaces: [], total: 0 });
  });
});

// ---------------------------------------------------------------------------
// Workspace CRUD - update (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - update (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.update('any-id', { name: 'new-name' });
    expect(result).toBeUndefined();
  });

  test('should return undefined even with empty update payload', async () => {
    const svc = makeService();
    const result = await svc.update('any-id', {});
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Workspace CRUD - delete (no db => returns false)
// ---------------------------------------------------------------------------

describe('WorkspaceService - delete (no db)', () => {
  test('should return false when no db is available', async () => {
    const svc = makeService();
    const result = await svc.delete('any-id');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Workspace Locking - lock (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - lock (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.lock('ws-1', 'user-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Workspace Locking - unlock (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - unlock (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.unlock('ws-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// State Version Management - addStateVersion (in-memory fallback)
// ---------------------------------------------------------------------------

describe('WorkspaceService - addStateVersion (in-memory fallback)', () => {
  test('should create a state version with required fields', async () => {
    const svc = makeService();
    const sv = await svc.addStateVersion({
      workspaceId: 'ws-1',
      version: 1,
      commitSha: 'abc123',
      author: 'developer',
      size: 1024,
    });

    expect(sv.id).toBeDefined();
    expect(sv.workspaceId).toBe('ws-1');
    expect(sv.version).toBe(1);
    expect(sv.commitSha).toBe('abc123');
    expect(sv.author).toBe('developer');
    expect(sv.size).toBe(1024);
    expect(sv.timestamp).toBeInstanceOf(Date);
  });

  test('should publish iac.state.versioned event', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.addStateVersion({
      workspaceId: 'ws-2',
      version: 2,
      commitSha: 'def456',
      author: 'ops',
      size: 2048,
    });

    expect(mockBus.publish).toHaveBeenCalledWith(
      'iac.state.versioned',
      expect.objectContaining({
        workspaceId: 'ws-2',
        version: 2,
      }),
    );
  });

  test('should create without eventBus and not throw', async () => {
    const svc = makeService();
    const sv = await svc.addStateVersion({
      workspaceId: 'ws-3',
      version: 3,
      commitSha: 'ghi789',
      author: 'admin',
      size: 512,
    });
    expect(sv.id).toBeDefined();
  });

  test('should create multiple state versions with unique IDs', async () => {
    const svc = makeService();
    const sv1 = await svc.addStateVersion({
      workspaceId: 'ws-x',
      version: 1,
      commitSha: 'sha1',
      author: 'dev',
      size: 100,
    });
    const sv2 = await svc.addStateVersion({
      workspaceId: 'ws-x',
      version: 2,
      commitSha: 'sha2',
      author: 'dev',
      size: 200,
    });
    expect(sv1.id).not.toBe(sv2.id);
  });
});

// ---------------------------------------------------------------------------
// State Version Management - getCurrentState (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - getCurrentState (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.getCurrentState('ws-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// State Version Management - getStateHistory (no db => returns [])
// ---------------------------------------------------------------------------

describe('WorkspaceService - getStateHistory (no db)', () => {
  test('should return empty array when no db is available', async () => {
    const svc = makeService();
    const result = await svc.getStateHistory('ws-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Resource Operations - listResources (no db => empty because getById returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - listResources (no db)', () => {
  test('should return empty array when workspace does not exist', async () => {
    const svc = makeService();
    const result = await svc.listResources('nonexistent-ws');
    expect(result).toEqual([]);
  });

  test('should return empty array even though getById returns undefined', async () => {
    // In no-db mode, getById always returns undefined, so listResources short-circuits
    const svc = makeService();
    const created = await svc.create({
      name: 'resource-ws',
      projectId: 'proj-6',
      environment: 'dev',
    });
    const result = await svc.listResources(created.id);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Resource Operations - importResource (no db => throws because getById returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - importResource (no db)', () => {
  test('should throw Error when workspace not found', async () => {
    const svc = makeService();
    await expect(
      svc.importResource('nonexistent-ws', { address: 'aws_s3_bucket.main', type: 'aws_s3_bucket' }),
    ).rejects.toThrow('Workspace not found');
  });
});

// ---------------------------------------------------------------------------
// Module Management - createModule (in-memory fallback)
// ---------------------------------------------------------------------------

describe('WorkspaceService - createModule (in-memory fallback)', () => {
  test('should create a module with required fields', async () => {
    const svc = makeService();
    const mod = await svc.createModule({
      name: 'vpc-module',
      version: '1.0.0',
      source: 'terraform-aws-modules/vpc/aws',
    });

    expect(mod.id).toBeDefined();
    expect(mod.name).toBe('vpc-module');
    expect(mod.version).toBe('1.0.0');
    expect(mod.source).toBe('terraform-aws-modules/vpc/aws');
    expect(mod.dependencies).toEqual({});
    expect(mod.createdAt).toBeInstanceOf(Date);
  });

  test('should create a module with dependencies', async () => {
    const svc = makeService();
    const mod = await svc.createModule({
      name: 'eks-module',
      version: '2.0.0',
      source: 'terraform-aws-modules/eks/aws',
      dependencies: { vpc: '>= 1.0.0' },
    });

    expect(mod.dependencies).toEqual({ vpc: '>= 1.0.0' });
  });

  test('should publish iac.module.created event', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.createModule({
      name: 'event-module',
      version: '3.0.0',
      source: 'git::https://example.com/module.git',
    });

    expect(mockBus.publish).toHaveBeenCalledWith(
      'iac.module.created',
      expect.objectContaining({
        moduleId: expect.any(String),
        name: 'event-module',
        version: '3.0.0',
      }),
    );
  });

  test('should create without eventBus and not throw', async () => {
    const svc = makeService();
    const mod = await svc.createModule({
      name: 'no-bus-module',
      version: '1.0.0',
      source: 'local',
    });
    expect(mod.id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Module Management - getModuleById (no db => returns undefined)
// ---------------------------------------------------------------------------

describe('WorkspaceService - getModuleById (no db)', () => {
  test('should return undefined when no db is available', async () => {
    const svc = makeService();
    const result = await svc.getModuleById('mod-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Module Management - listModules (no db => returns [])
// ---------------------------------------------------------------------------

describe('WorkspaceService - listModules (no db)', () => {
  test('should return empty array when no db is available', async () => {
    const svc = makeService();
    const result = await svc.listModules();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Module Management - deleteModule (no db => returns false)
// ---------------------------------------------------------------------------

describe('WorkspaceService - deleteModule (no db)', () => {
  test('should return false when no db is available', async () => {
    const svc = makeService();
    const result = await svc.deleteModule('mod-1');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// State Version Operations - listStateVersions (no db => throws because getById fails)
// ---------------------------------------------------------------------------

describe('WorkspaceService - listStateVersions (no db)', () => {
  test('should throw Error when workspace not found', async () => {
    const svc = makeService();
    await expect(svc.listStateVersions('nonexistent-ws')).rejects.toThrow(
      'Workspace nonexistent-ws not found',
    );
  });
});

// ---------------------------------------------------------------------------
// State Version Operations - getStateDiff (always returns empty MVP diff)
// ---------------------------------------------------------------------------

describe('WorkspaceService - getStateDiff (MVP empty diff)', () => {
  test('should return empty diff regardless of versions', async () => {
    const svc = makeService();
    const diff = await svc.getStateDiff('ws-1', 'v1', 'v2');

    expect(diff.workspaceId).toBe('ws-1');
    expect(diff.versionA).toBe('v1');
    expect(diff.versionB).toBe('v2');
    expect(diff.added).toEqual([]);
    expect(diff.modified).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  test('should return diff with arbitrary version strings', async () => {
    const svc = makeService();
    const diff = await svc.getStateDiff('ws-2', 'abc', 'xyz');

    expect(diff.versionA).toBe('abc');
    expect(diff.versionB).toBe('xyz');
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  test('should return diff with same version for A and B', async () => {
    const svc = makeService();
    const diff = await svc.getStateDiff('ws-3', 'v1', 'v1');

    expect(diff.workspaceId).toBe('ws-3');
    expect(diff.added).toEqual([]);
    expect(diff.modified).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  test('should return diff with empty string versions', async () => {
    const svc = makeService();
    const diff = await svc.getStateDiff('ws-4', '', '');

    expect(diff.versionA).toBe('');
    expect(diff.versionB).toBe('');
    expect(diff.added).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EventBus Event Publishing Summary
// ---------------------------------------------------------------------------

describe('WorkspaceService - EventBus events', () => {
  test('publishes iac.workspace.created on create', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.create({ name: 'ws', projectId: 'p', environment: 'dev' });

    const call = mockBus.publish.mock.calls.find(
      (c) => c[0] === 'iac.workspace.created',
    );
    expect(call).toBeDefined();
    expect(call![1]).toHaveProperty('workspaceId');
    expect(call![1]).toHaveProperty('name', 'ws');
    expect(call![1]).toHaveProperty('environment', 'dev');
  });

  test('publishes iac.state.versioned on addStateVersion', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.addStateVersion({
      workspaceId: 'ws-1',
      version: 1,
      commitSha: 'sha',
      author: 'dev',
      size: 100,
    });

    const call = mockBus.publish.mock.calls.find(
      (c) => c[0] === 'iac.state.versioned',
    );
    expect(call).toBeDefined();
    expect(call![1]).toHaveProperty('workspaceId', 'ws-1');
    expect(call![1]).toHaveProperty('version', 1);
  });

  test('publishes iac.module.created on createModule', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    await svc.createModule({
      name: 'mod',
      version: '1.0.0',
      source: 'local',
    });

    const call = mockBus.publish.mock.calls.find(
      (c) => c[0] === 'iac.module.created',
    );
    expect(call).toBeDefined();
    expect(call![1]).toHaveProperty('moduleId');
    expect(call![1]).toHaveProperty('name', 'mod');
    expect(call![1]).toHaveProperty('version', '1.0.0');
  });

  test('does not publish update/delete/lock/unlock events without db', async () => {
    const mockBus = makeEventBusMock();
    const svc = makeService(mockBus);

    // These methods short-circuit before reaching publish when db is absent
    await svc.update('ws-1', { name: 'new' });
    await svc.delete('ws-1');
    await svc.lock('ws-1', 'user-1');
    await svc.unlock('ws-1');

    // Only the create event should have been published (none in this test)
    const events = mockBus.publish.mock.calls.map((c) => c[0]);
    expect(events).not.toContain('iac.workspace.updated');
    expect(events).not.toContain('iac.workspace.deleted');
    expect(events).not.toContain('iac.workspace.locked');
    expect(events).not.toContain('iac.workspace.unlocked');
  });
});

// ---------------------------------------------------------------------------
// Constructor / Initialization
// ---------------------------------------------------------------------------

describe('WorkspaceService - constructor', () => {
  test('should instantiate with no arguments', () => {
    const svc = new WorkspaceService({});
    expect(svc).toBeInstanceOf(WorkspaceService);
  });

  test('should instantiate with eventBus only', () => {
    const mockBus = makeEventBusMock();
    const svc = new WorkspaceService({ eventBus: mockBus });
    expect(svc).toBeInstanceOf(WorkspaceService);
  });

  test('should instantiate with empty db mock', () => {
    const mockDb = { query: jest.fn() };
    const svc = new WorkspaceService({ db: mockDb as any });
    expect(svc).toBeInstanceOf(WorkspaceService);
  });
});
