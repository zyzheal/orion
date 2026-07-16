/**
 * SubAppService - Comprehensive Tests
 *
 * Tests for sub-app CRUD, validation, toggle status,
 * history tracking, and error handling.
 */

import { SubAppService } from '../SubAppService';
import { SubAppRepository, SubAppConfig, SubAppConfigHistory } from '../SubAppRepository';
import { OrionError } from '../../../errors';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockDb() {
  return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

function createSubApp(overrides: Partial<SubAppConfig> = {}): SubAppConfig {
  return {
    id: 'subapp-001',
    name: 'Pipeline Management',
    key: 'pipeline-mgmt',
    version: '1.0.0',
    entry_dev: 'http://localhost:3001',
    entry_prod: '/pipeline',
    routes: ['/pipeline', '/pipeline/*'],
    permissions: ['pipeline:read'],
    keep_alive: true,
    preload: false,
    description: 'Pipeline management module',
    icon: 'PipelineOutlined',
    status: 'enabled',
    sort_order: 1,
    created_by: 'admin',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SubAppService', () => {
  let service: SubAppService;
  let mockRepo: jest.Mocked<SubAppRepository>;

  beforeEach(() => {
    const mockDb = createMockDb();
    service = new SubAppService(mockDb as any);

    // Replace the repository with mocks
    mockRepo = {
      findAll: jest.fn().mockResolvedValue([]),
      findEnabled: jest.fn().mockResolvedValue([]),
      findByKey: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((input: any) => Promise.resolve(createSubApp(input))),
      update: jest.fn().mockImplementation((key: any, input: any) => Promise.resolve(createSubApp({ key, ...input }))),
      delete: jest.fn().mockResolvedValue(true),
      toggleStatus: jest.fn().mockImplementation((key: any) =>
        Promise.resolve(createSubApp({ key, status: 'disabled' }))
      ),
      addHistory: jest.fn().mockResolvedValue(undefined),
      getHistory: jest.fn().mockResolvedValue([]),
    } as any;

    (service as any).repository = mockRepo;
  });

  // ─── getAll ───────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('should return all sub-apps', async () => {
      mockRepo.findAll.mockResolvedValue([createSubApp(), createSubApp({ key: 'console', name: 'Console' })]);

      const result = await service.getAll();
      expect(result.length).toBe(2);
    });
  });

  // ─── getEnabled ──────────────────────────────────────────────────────────

  describe('getEnabled', () => {
    it('should return only enabled sub-apps', async () => {
      mockRepo.findEnabled.mockResolvedValue([createSubApp({ status: 'enabled' })]);

      const result = await service.getEnabled();
      expect(result.length).toBe(1);
    });
  });

  // ─── getByKey ────────────────────────────────────────────────────────────

  describe('getByKey', () => {
    it('should return sub-app by key', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());

      const result = await service.getByKey('pipeline-mgmt');
      expect(result?.key).toBe('pipeline-mgmt');
    });

    it('should return null for non-existent key', async () => {
      mockRepo.findByKey.mockResolvedValue(null);
      const result = await service.getByKey('non-existent');
      expect(result).toBeNull();
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a sub-app with valid input', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      const result = await service.create({
        name: 'Test App',
        key: 'test-app',
        entry_dev: 'http://localhost:3001',
        entry_prod: '/test',
        routes: ['/test'],
      });

      expect(result).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.addHistory).toHaveBeenCalled();
    });

    it('should reject duplicate key', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());

      await expect(
        service.create({ name: 'Test', key: 'pipeline-mgmt', entry_dev: 'http://localhost:3001', entry_prod: '/test', routes: ['/test'] })
      ).rejects.toThrow('already exists');
    });

    it('should reject invalid key format', async () => {
      await expect(
        service.create({ name: 'Test', key: 'Invalid_Key!', entry_dev: 'http://localhost:3001', entry_prod: '/test', routes: ['/test'] })
      ).rejects.toThrow();
    });

    it('should reject invalid dev URL', async () => {
      await expect(
        service.create({ name: 'Test', key: 'test-app', entry_dev: 'not-a-url', entry_prod: '/test', routes: ['/test'] })
      ).rejects.toThrow();
    });

    it('should reject routes not starting with /', async () => {
      await expect(
        service.create({
          name: 'Test',
          key: 'test-app',
          entry_dev: 'http://localhost:3001',
          entry_prod: '/test',
          routes: ['invalid-route'],
        })
      ).rejects.toThrow();
    });

    it('should accept valid production URL', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      const result = await service.create({
        name: 'Test',
        key: 'test-app',
        entry_dev: 'http://localhost:3001',
        entry_prod: 'https://example.com/test',
        routes: ['/test'],
      });

      expect(result).toBeDefined();
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update sub-app configuration', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());

      const result = await service.update('pipeline-mgmt', { name: 'Updated Name' });
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith('pipeline-mgmt', { name: 'Updated Name' });
      expect(mockRepo.addHistory).toHaveBeenCalled();
    });

    it('should throw when sub-app not found', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'New' })).rejects.toThrow('not found');
    });

    it('should reject key change', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());

      await expect(
        service.update('pipeline-mgmt', { key: 'new-key' })
      ).rejects.toThrow('Cannot change sub-app key');
    });

    it('should record status_changed action when status changes', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp({ status: 'enabled' }));
      mockRepo.update.mockResolvedValue(createSubApp({ status: 'disabled' }));

      await service.update('pipeline-mgmt', { status: 'disabled' });

      expect(mockRepo.addHistory).toHaveBeenCalledWith(
        'pipeline-mgmt',
        'status_changed',
        expect.any(Object),
        expect.any(Object),
        null,
        expect.any(String),
      );
    });
  });

  // ─── toggleStatus ────────────────────────────────────────────────────────

  describe('toggleStatus', () => {
    it('should toggle status from enabled to disabled', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp({ status: 'enabled' }));
      mockRepo.toggleStatus.mockResolvedValue(createSubApp({ status: 'disabled' }));

      const result = await service.toggleStatus('pipeline-mgmt');
      expect(result.status).toBe('disabled');
      expect(mockRepo.addHistory).toHaveBeenCalled();
    });

    it('should throw when sub-app not found', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await expect(service.toggleStatus('non-existent')).rejects.toThrow('not found');
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete sub-app', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());

      await service.delete('pipeline-mgmt');
      expect(mockRepo.delete).toHaveBeenCalledWith('pipeline-mgmt');
      expect(mockRepo.addHistory).toHaveBeenCalled();
    });

    it('should throw when sub-app not found', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow('not found');
    });

    it('should throw when delete fails', async () => {
      mockRepo.findByKey.mockResolvedValue(createSubApp());
      mockRepo.delete.mockResolvedValue(false);

      await expect(service.delete('pipeline-mgmt')).rejects.toThrow('Failed to delete');
    });
  });

  // ─── getHistory ──────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return configuration history', async () => {
      const history: SubAppConfigHistory[] = [
        {
          id: 'h1',
          subapp_key: 'pipeline-mgmt',
          action: 'created',
          old_value: null,
          new_value: {},
          changed_by: 'admin',
          changed_at: new Date(),
          description: 'Created',
        },
      ];
      mockRepo.getHistory.mockResolvedValue(history);

      const result = await service.getHistory('pipeline-mgmt');
      expect(result.length).toBe(1);
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('should accept valid key format', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await service.create({
        name: 'Test',
        key: 'my-app-123',
        entry_dev: 'http://localhost:3001',
        entry_prod: '/test',
        routes: ['/test'],
      });

      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should reject key starting with number', async () => {
      await expect(
        service.create({ name: 'Test', key: '123app', entry_dev: 'http://localhost:3001', entry_prod: '/test', routes: ['/test'] })
      ).rejects.toThrow();
    });

    it('should accept path-based production entry', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await service.create({
        name: 'Test',
        key: 'test-app',
        entry_dev: 'http://localhost:3001',
        entry_prod: '/my/app',
        routes: ['/my/app'],
      });

      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should accept routes array', async () => {
      mockRepo.findByKey.mockResolvedValue(null);

      await service.create({
        name: 'Test',
        key: 'test-app',
        entry_dev: 'http://localhost:3001',
        entry_prod: '/test',
        routes: ['/test', '/test/:id', '/test/settings'],
      });

      expect(mockRepo.create).toHaveBeenCalled();
    });
  });
});
