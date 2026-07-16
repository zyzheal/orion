/**
 * SDKGeneratorService Tests
 *
 * Covers: task CRUD, language support, SDK generation for all 5 languages,
 * regeneration, stats, pagination, filtering, error handling.
 */

import {
  SDKGeneratorService,
  SDKGeneratorServiceError,
  SDKGenerationTask,
  SDKLanguage,
} from '../SDKGeneratorService';
import { DevPortalSDKTaskRepository, DevPortalSDKTaskEntity } from '../../../repositories/DevPortalSDKTaskRepository';

// The service uses a 500ms setTimeout to simulate SDK generation
const GENERATION_WAIT_MS = 700;

// ==================== Test Helpers ====================

/**
 * Create an in-memory mock repository that simulates the DevPortalSDKTaskRepository.
 * The entity shape mirrors what DevPortalSDKTaskRepository.mapRowToEntity produces:
 * - camelCase business fields (id, tenantId, packageName, ...)
 * - snake_case persistence fields (created_at, updated_at)
 * - completedAt (camelCase alias of DB completed_at)
 */
function createMockRepository(): DevPortalSDKTaskRepository {
  const store = new Map<string, DevPortalSDKTaskEntity>();
  let idCounter = 0;

  return {
    async create(data: Partial<DevPortalSDKTaskEntity> & Pick<DevPortalSDKTaskEntity, 'id'>): Promise<DevPortalSDKTaskEntity> {
      const entity: DevPortalSDKTaskEntity = {
        id: data.id || `mock-sdk-task-${idCounter++}`,
        tenantId: data.tenantId!,
        name: data.name!,
        apiSpec: data.apiSpec ?? '',
        language: data.language ?? 'typescript',
        packageName: data.packageName ?? 'unknown',
        version: data.version ?? '1.0.0',
        status: data.status ?? 'pending',
        output: data.output ?? '',
        error: data.error ?? null,
        completedAt: data.completedAt ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      } as DevPortalSDKTaskEntity;
      store.set(entity.id, entity);
      return entity;
    },

    async findById(id: string): Promise<DevPortalSDKTaskEntity | undefined> {
      return store.get(id);
    },

    async findByTenant(tenantId: string, options?: { language?: string; status?: string }): Promise<DevPortalSDKTaskEntity[]> {
      let entities = Array.from(store.values()).filter(e => e.tenantId === tenantId);
      if (options?.language) {
        entities = entities.filter(e => e.language === options.language);
      }
      if (options?.status) {
        entities = entities.filter(e => e.status === options.status);
      }
      entities.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return entities;
    },

    async updateStatus(id: string, status: string, output?: string, error?: string): Promise<DevPortalSDKTaskEntity> {
      const existing = store.get(id);
      if (!existing) {
        throw new Error(`Not found: ${id}`);
      }
      const completedAt = (status === 'completed' || status === 'failed') ? new Date() : existing.completedAt;
      const updated: DevPortalSDKTaskEntity = {
        ...existing,
        status,
        output: output ?? existing.output,
        error: error ?? existing.error,
        completedAt,
        updated_at: new Date(),
      } as DevPortalSDKTaskEntity;
      store.set(id, updated);
      return updated;
    },

    async update(id: string, data: Partial<DevPortalSDKTaskEntity>): Promise<DevPortalSDKTaskEntity> {
      const existing = store.get(id);
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, ...data, updated_at: new Date() };
      store.set(id, updated);
      return updated as DevPortalSDKTaskEntity;
    },

    async delete(id: string): Promise<boolean> {
      return store.delete(id);
    },

    // Inherited from BaseRepository
    getDb: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }),
    findAll: async () => ({ entities: Array.from(store.values()), total: store.size }),
  } as unknown as DevPortalSDKTaskRepository;
}

describe('SDKGeneratorService', () => {
  let service: SDKGeneratorService;

  const defaultInput = {
    tenantId: 'tenant-1',
    name: 'My SDK',
    apiSpec: '{"openapi":"3.0.0","info":{"title":"Test","version":"1.0.0"}}',
    language: 'typescript' as SDKLanguage,
    packageName: 'my-sdk',
  };

  beforeEach(() => {
    const mockRepo = createMockRepository();
    service = new SDKGeneratorService(mockRepo);
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should throw when repository is null', () => {
      expect(() => new SDKGeneratorService(null as any)).toThrow('DevPortalSDKTaskRepository is required');
    });

    it('should throw when repository is undefined', () => {
      expect(() => new SDKGeneratorService(undefined as any)).toThrow('DevPortalSDKTaskRepository is required');
    });
  });

  // ==================== getSupportedLanguages ====================

  describe('getSupportedLanguages', () => {
    it('should return all 5 supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages.length).toBe(5);
      const langNames = languages.map(l => l.language);
      expect(langNames).toContain('typescript');
      expect(langNames).toContain('python');
      expect(langNames).toContain('go');
      expect(langNames).toContain('java');
      expect(langNames).toContain('csharp');
    });

    it('should include config details for each language', () => {
      const languages = service.getSupportedLanguages();

      for (const lang of languages) {
        expect(lang.fileExtension).toBeDefined();
        expect(lang.packageManager).toBeDefined();
        expect(lang.httpClient).toBeDefined();
        expect(lang.typeSystem).toBeDefined();
      }
    });

    it('should have correct TypeScript config', () => {
      const ts = service.getSupportedLanguages().find(l => l.language === 'typescript')!;
      expect(ts.fileExtension).toBe('.ts');
      expect(ts.packageManager).toBe('npm');
      expect(ts.httpClient).toBe('axios');
    });

    it('should have correct Python config', () => {
      const py = service.getSupportedLanguages().find(l => l.language === 'python')!;
      expect(py.fileExtension).toBe('.py');
      expect(py.packageManager).toBe('pip');
      expect(py.httpClient).toBe('httpx');
    });
  });

  // ==================== createTask ====================

  describe('createTask', () => {
    it('should create a task with all fields', async () => {
      const task = await service.createTask(defaultInput);

      expect(task.id).toBeDefined();
      expect(task.tenantId).toBe('tenant-1');
      expect(task.name).toBe('My SDK');
      expect(task.language).toBe('typescript');
      expect(task.packageName).toBe('my-sdk');
      expect(task.version).toBe('1.0.0');
      // processTask fires asynchronously; status may be 'pending' or 'generating'
      expect(['pending', 'generating']).toContain(task.status);
      expect(task.output).toBe('');
      expect(task.error).toBeNull();
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.completedAt).toBeNull();
    });

    it('should use custom version', async () => {
      const task = await service.createTask({ ...defaultInput, version: '2.0.0' });
      expect(task.version).toBe('2.0.0');
    });

    it('should trim whitespace from name and packageName', async () => {
      const task = await service.createTask({
        ...defaultInput,
        name: '  My SDK  ',
        packageName: '  my-sdk  ',
      });

      expect(task.name).toBe('My SDK');
      expect(task.packageName).toBe('my-sdk');
    });

    it('should throw for empty name', async () => {
      await expect(
        service.createTask({ ...defaultInput, name: '' })
      ).rejects.toThrow(SDKGeneratorServiceError);

      await expect(
        service.createTask({ ...defaultInput, name: '   ' })
      ).rejects.toThrow(SDKGeneratorServiceError);
    });

    it('should throw for empty apiSpec', async () => {
      await expect(
        service.createTask({ ...defaultInput, apiSpec: '' })
      ).rejects.toThrow(SDKGeneratorServiceError);
    });

    it('should throw for empty packageName', async () => {
      await expect(
        service.createTask({ ...defaultInput, packageName: '' })
      ).rejects.toThrow(SDKGeneratorServiceError);
    });

    it('should throw for unsupported language', async () => {
      await expect(
        service.createTask({ ...defaultInput, language: 'rust' as any })
      ).rejects.toThrow(SDKGeneratorServiceError);

      try {
        await service.createTask({ ...defaultInput, language: 'rust' as any });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_INPUT');
      }
    });

    it('should support all 5 languages', async () => {
      const languages: SDKLanguage[] = ['typescript', 'python', 'go', 'java', 'csharp'];

      for (const lang of languages) {
        const task = await service.createTask({
          ...defaultInput,
          language: lang,
          name: `${lang} SDK`,
          packageName: `sdk-${lang}`,
        });
        expect(task.language).toBe(lang);
      }
    });

    it('should trigger async generation', async () => {
      const task = await service.createTask(defaultInput);

      // Wait for simulated generation
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.status).toBe('completed');
      expect(completed.output.length).toBeGreaterThan(0);
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  // ==================== getTaskById ====================

  describe('getTaskById', () => {
    it('should return a task by ID', async () => {
      const created = await service.createTask(defaultInput);
      const task = await service.getTaskById(created.id);

      expect(task.id).toBe(created.id);
      expect(task.name).toBe('My SDK');
    });

    it('should reflect completed status after generation', async () => {
      const created = await service.createTask(defaultInput);
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const task = await service.getTaskById(created.id);
      expect(task.status).toBe('completed');
      expect(task.output).toContain('Generated by Orion SDK Generator');
    });

    it('should throw TASK_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.getTaskById('non-existent')
      ).rejects.toThrow(SDKGeneratorServiceError);

      try {
        await service.getTaskById('non-existent');
      } catch (err: any) {
        expect(err.code).toBe('TASK_NOT_FOUND');
      }
    });
  });

  // ==================== listTasks ====================

  describe('listTasks', () => {
    it('should return paginated tasks', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createTask({
          ...defaultInput,
          name: `SDK ${i}`,
          packageName: `sdk-${i}`,
        });
      }

      const result = await service.listTasks('tenant-1', { page: 1, pageSize: 3 });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should use default pagination', async () => {
      const result = await service.listTasks('tenant-1');
      expect(result.page).toBe(1);
    });

    it('should filter by language', async () => {
      await service.createTask(defaultInput);
      await service.createTask({ ...defaultInput, language: 'python', name: 'Py SDK', packageName: 'py-sdk' });

      const result = await service.listTasks('tenant-1', { language: 'python' });
      expect(result.data.every(t => t.language === 'python')).toBe(true);
    });

    it('should filter by status', async () => {
      await service.createTask(defaultInput);
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.listTasks('tenant-1', { status: 'completed' });
      expect(completed.data.every(t => t.status === 'completed')).toBe(true);
    });

    it('should isolate by tenant', async () => {
      await service.createTask(defaultInput);
      await service.createTask({ ...defaultInput, tenantId: 'tenant-2' });

      const result = await service.listTasks('tenant-1');
      expect(result.total).toBe(1);
    });

    it('should sort by createdAt descending', async () => {
      await service.createTask({ ...defaultInput, name: 'First', packageName: 'first' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.createTask({ ...defaultInput, name: 'Second', packageName: 'second' });

      const result = await service.listTasks('tenant-1');
      expect(result.data.length).toBe(2);
      // Verify descending order: each item's createdAt >= next item's createdAt
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          result.data[i + 1].createdAt.getTime()
        );
      }
    });
  });

  // ==================== deleteTask ====================

  describe('deleteTask', () => {
    it('should delete an existing task', async () => {
      const created = await service.createTask(defaultInput);
      const result = await service.deleteTask(created.id);

      expect(result).toBe(true);

      await expect(service.getTaskById(created.id)).rejects.toThrow(SDKGeneratorServiceError);
    });

    it('should throw TASK_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.deleteTask('non-existent')
      ).rejects.toThrow(SDKGeneratorServiceError);
    });
  });

  // ==================== regenerateTask ====================

  describe('regenerateTask', () => {
    it('should reset task to pending', async () => {
      const created = await service.createTask(defaultInput);
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(created.id);
      expect(completed.status).toBe('completed');

      const regenerated = await service.regenerateTask(created.id);
      // processTask fires asynchronously; status may be 'pending' or 'generating'
      expect(['pending', 'generating']).toContain(regenerated.status);
      expect(regenerated.output).toBe('');
      expect(regenerated.error).toBeNull();
      expect(regenerated.completedAt).toBeNull();
    });

    it('should trigger new generation after regeneration', async () => {
      const created = await service.createTask(defaultInput);
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      await service.regenerateTask(created.id);

      // Wait for new generation
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const task = await service.getTaskById(created.id);
      expect(task.status).toBe('completed');
      expect(task.output.length).toBeGreaterThan(0);
    });

    it('should throw TASK_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.regenerateTask('non-existent')
      ).rejects.toThrow(SDKGeneratorServiceError);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats with zero for empty tenant', async () => {
      const stats = await service.getStats('tenant-empty');

      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
    });

    it('should count pending tasks', async () => {
      await service.createTask(defaultInput);
      await service.createTask({ ...defaultInput, name: 'SDK 2', packageName: 'sdk-2' });

      const stats = await service.getStats('tenant-1');
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
    });

    it('should count completed tasks', async () => {
      await service.createTask(defaultInput);
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const stats = await service.getStats('tenant-1');
      expect(stats.total).toBe(1);
      expect(stats.completed).toBe(1);
    });

    it('should isolate stats by tenant', async () => {
      await service.createTask(defaultInput);
      await service.createTask({ ...defaultInput, tenantId: 'tenant-2', name: 'SDK 2', packageName: 'sdk-2' });

      const stats1 = await service.getStats('tenant-1');
      const stats2 = await service.getStats('tenant-2');

      expect(stats1.total).toBe(1);
      expect(stats2.total).toBe(1);
    });
  });

  // ==================== generated code quality ====================

  describe('generated code output', () => {
    it('should generate TypeScript SDK with class and axios', async () => {
      const task = await service.createTask({ ...defaultInput, language: 'typescript' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('import axios');
      expect(completed.output).toContain('export class');
      expect(completed.output).toContain('ClientOptions');
      expect(completed.output).toContain('my-sdk');
    });

    it('should generate Python SDK with httpx', async () => {
      const task = await service.createTask({ ...defaultInput, language: 'python', packageName: 'my-pkg' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('import httpx');
      expect(completed.output).toContain('class');
      expect(completed.output).toContain('Client');
    });

    it('should generate Go SDK with net/http', async () => {
      const task = await service.createTask({ ...defaultInput, language: 'go' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('net/http');
      expect(completed.output).toContain('package');
      expect(completed.output).toContain('func');
    });

    it('should generate Java SDK with OkHttp', async () => {
      const task = await service.createTask({ ...defaultInput, language: 'java' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('OkHttpClient');
      expect(completed.output).toContain('public class');
    });

    it('should generate C# SDK with HttpClient', async () => {
      const task = await service.createTask({ ...defaultInput, language: 'csharp' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('HttpClient');
      expect(completed.output).toContain('namespace');
      expect(completed.output).toContain('public class');
    });

    it('should include package name and version in output', async () => {
      const task = await service.createTask({ ...defaultInput, version: '2.1.0' });
      await new Promise(resolve => setTimeout(resolve, GENERATION_WAIT_MS));

      const completed = await service.getTaskById(task.id);
      expect(completed.output).toContain('my-sdk');
      expect(completed.output).toContain('2.1.0');
    });
  });
});
