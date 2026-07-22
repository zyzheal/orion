/**
 * VisorExecRepository Unit Tests
 */

import { VisorExecRepository } from '../VisorExecRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

const createMockPool = (rows: any[] = [], rowCount: number = 0) => ({
  query: jest.fn().mockResolvedValue({ rows, rowCount }),
});

describe('VisorExecRepository', () => {
  let repo: VisorExecRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    repo = new VisorExecRepository(mockPool as any);
  });

  // ==================== Command Logs ====================

  describe('createCommandLog', () => {
    it('should insert a command log and return entity', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'cmd-1',
          tenant_id: 'test-tenant-001',
          command: 'ls -la',
          host_ids: ['host-1', 'host-2'],
          host_count: 2,
          timeout: 30,
          status: 'success',
          created_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createCommandLog({
        command: 'ls -la',
        hostIds: ['host-1', 'host-2'],
      });

      expect(result.id).toBe('cmd-1');
      expect(result.command).toBe('ls -la');
      expect(result.host_ids).toEqual(['host-1', 'host-2']);
      expect(result.host_count).toBe(2);
    });
  });

  describe('findCommandLogById', () => {
    it('should return command log when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'cmd-1',
          tenant_id: 'test-tenant-001',
          command: 'ls',
          host_ids: [],
          host_count: 0,
          timeout: 30,
          status: 'success',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findCommandLogById('cmd-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('cmd-1');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findCommandLogById('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('findAllCommandLogs', () => {
    it('should return paginated results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            { id: 'cmd-2', tenant_id: 't', command: 'b', host_ids: [], host_count: 0, timeout: 30, status: 'success', created_at: new Date('2026-07-01T00:00:02Z') },
            { id: 'cmd-1', tenant_id: 't', command: 'a', host_ids: [], host_count: 0, timeout: 30, status: 'success', created_at: new Date('2026-07-01T00:00:01Z') },
          ],
          rowCount: 2,
        });

      const result = await repo.findAllCommandLogs(undefined, { page: 1, pageSize: 20 });
      expect(result.entities).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('createCommandLogDetails', () => {
    it('should batch insert details', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'd1', tenant_id: 't', command_id: 'c1', hostname: 'h1', output: '', error_output: '', exit_code: 0, status: 'success', created_at: new Date() },
          { id: 'd2', tenant_id: 't', command_id: 'c1', hostname: 'h2', output: '', error_output: '', exit_code: 0, status: 'success', created_at: new Date() },
        ],
        rowCount: 2,
      });

      const result = await repo.createCommandLogDetails([
        { commandId: 'c1', hostname: 'h1' },
        { commandId: 'c1', hostname: 'h2' },
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe('findCommandLogDetailsByCommandId', () => {
    it('should return details for a command', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'd1', tenant_id: 't', command_id: 'c1', hostname: 'h1', output: 'ok', error_output: '', exit_code: 0, status: 'success', created_at: new Date() },
        ],
        rowCount: 1,
      });

      const result = await repo.findCommandLogDetailsByCommandId('c1');
      expect(result).toHaveLength(1);
      expect(result[0].command_id).toBe('c1');
    });
  });

  // ==================== Templates ====================

  describe('createTemplate', () => {
    it('should insert a template', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'tpl-1',
          tenant_id: 'test-tenant-001',
          name: 'My Template',
          description: 'desc',
          content: 'echo hello',
          category: 'general',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createTemplate({
        name: 'My Template',
        content: 'echo hello',
      });

      expect(result.name).toBe('My Template');
      expect(result.category).toBe('general');
    });
  });

  describe('findTemplateById', () => {
    it('should return template when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'tpl-1',
          tenant_id: 'test-tenant-001',
          name: 'T',
          description: '',
          content: 'x',
          category: 'general',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findTemplateById('tpl-1');
      expect(result).toBeDefined();
      expect(result!.name).toBe('T');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findTemplateById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllTemplates', () => {
    it('should return paginated templates', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'tpl-1',
            tenant_id: 'test-tenant-001',
            name: 'T',
            description: '',
            content: 'x',
            category: 'general',
            created_at: new Date(),
            updated_at: new Date(),
          }],
          rowCount: 1,
        });

      const result = await repo.findAllTemplates();
      expect(result.total).toBe(1);
      expect(result.entities).toHaveLength(1);
    });
  });

  describe('updateTemplate', () => {
    it('should update template fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'tpl-1',
          tenant_id: 'test-tenant-001',
          name: 'Updated',
          description: '',
          content: 'x',
          category: 'general',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateTemplate('tpl-1', { name: 'Updated' });
      expect(result).toBeDefined();
      expect(result!.name).toBe('Updated');
    });

    it('should return undefined when template not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.updateTemplate('nonexistent', { name: 'X' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteTemplate', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const result = await repo.deleteTemplate('tpl-1');
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.deleteTemplate('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ==================== Cron Jobs ====================

  describe('createCronJob', () => {
    it('should insert a cron job', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'job-1',
          tenant_id: 'test-tenant-001',
          name: 'Nightly',
          command: 'backup.sh',
          host_ids: ['h1'],
          hostnames: ['h1'],
          cron_expression: '0 2 * * *',
          enabled: true,
          last_run_at: null,
          next_run_at: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createCronJob({
        name: 'Nightly',
        command: 'backup.sh',
        hostIds: ['h1'],
        hostnames: ['h1'],
        cronExpression: '0 2 * * *',
      });

      expect(result.name).toBe('Nightly');
      expect(result.enabled).toBe(true);
    });
  });

  describe('findCronJobById', () => {
    it('should return job when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'job-1',
          tenant_id: 'test-tenant-001',
          name: 'J',
          command: 'cmd',
          host_ids: [],
          hostnames: [],
          cron_expression: '* * * * *',
          enabled: true,
          last_run_at: null,
          next_run_at: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findCronJobById('job-1');
      expect(result).toBeDefined();
    });
  });

  describe('findAllCronJobs', () => {
    it('should return paginated jobs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'job-1',
            tenant_id: 'test-tenant-001',
            name: 'J',
            command: 'cmd',
            host_ids: [],
            hostnames: [],
            cron_expression: '* * * * *',
            enabled: true,
            last_run_at: null,
            next_run_at: null,
            created_at: new Date(),
          }],
          rowCount: 1,
        });

      const result = await repo.findAllCronJobs();
      expect(result.total).toBe(1);
    });
  });

  describe('updateCronJob', () => {
    it('should update fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'job-1',
          tenant_id: 'test-tenant-001',
          name: 'Updated',
          command: 'cmd',
          host_ids: [],
          hostnames: [],
          cron_expression: '* * * * *',
          enabled: false,
          last_run_at: null,
          next_run_at: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateCronJob('job-1', { enabled: false });
      expect(result).toBeDefined();
      expect(result!.enabled).toBe(false);
    });
  });

  describe('toggleCronJob', () => {
    it('should toggle enabled status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'job-1',
          tenant_id: 'test-tenant-001',
          name: 'J',
          command: 'cmd',
          host_ids: [],
          hostnames: [],
          cron_expression: '* * * * *',
          enabled: false,
          last_run_at: null,
          next_run_at: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.toggleCronJob('job-1', false);
      expect(result).toBeDefined();
      expect(result!.enabled).toBe(false);
    });
  });

  describe('updateCronJobLastRun', () => {
    it('should update last_run_at', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'job-1',
          tenant_id: 'test-tenant-001',
          name: 'J',
          command: 'cmd',
          host_ids: [],
          hostnames: [],
          cron_expression: '* * * * *',
          enabled: true,
          last_run_at: new Date('2026-07-01T02:00:00Z'),
          next_run_at: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateCronJobLastRun('job-1', new Date('2026-07-01T02:00:00Z'));
      expect(result).toBeDefined();
      expect(result!.last_run_at).toBeDefined();
    });
  });

  describe('deleteCronJob', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const result = await repo.deleteCronJob('job-1');
      expect(result).toBe(true);
    });
  });

  // ==================== Cron Job Logs ====================

  describe('createCronJobLog', () => {
    it('should insert a cron job log', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'log-1',
          tenant_id: 'test-tenant-001',
          job_id: 'job-1',
          command_id: 'cmd-1',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createCronJobLog({ jobId: 'job-1', commandId: 'cmd-1' });
      expect(result.job_id).toBe('job-1');
      expect(result.command_id).toBe('cmd-1');
    });
  });

  describe('findCronJobLogsByJobId', () => {
    it('should return paginated logs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'log-1',
            tenant_id: 'test-tenant-001',
            job_id: 'job-1',
            command_id: 'cmd-1',
            created_at: new Date(),
          }],
          rowCount: 1,
        });

      const result = await repo.findCronJobLogsByJobId('job-1');
      expect(result.total).toBe(1);
      expect(result.entities[0].job_id).toBe('job-1');
    });
  });

  // ==================== Upload Tasks ====================

  describe('createUploadTask', () => {
    it('should insert an upload task', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'upl-1',
          tenant_id: 'test-tenant-001',
          file_name: 'deploy.sh',
          file_size: 1024,
          host_ids: ['h1'],
          hostnames: ['h1'],
          target_path: '/tmp/',
          status: 'success',
          progress: 100,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.createUploadTask({
        fileName: 'deploy.sh',
        fileSize: 1024,
        hostIds: ['h1'],
        hostnames: ['h1'],
        targetPath: '/tmp/',
      });

      expect(result.file_name).toBe('deploy.sh');
      expect(result.progress).toBe(100);
    });
  });

  describe('findUploadTaskById', () => {
    it('should return task when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'upl-1',
          tenant_id: 'test-tenant-001',
          file_name: 'f',
          file_size: 0,
          host_ids: [],
          hostnames: [],
          target_path: '/tmp/',
          status: 'pending',
          progress: 0,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findUploadTaskById('upl-1');
      expect(result).toBeDefined();
    });
  });

  describe('findAllUploadTasks', () => {
    it('should return paginated tasks', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'upl-1',
            tenant_id: 'test-tenant-001',
            file_name: 'f',
            file_size: 0,
            host_ids: [],
            hostnames: [],
            target_path: '/tmp/',
            status: 'pending',
            progress: 0,
            created_at: new Date(),
          }],
          rowCount: 1,
        });

      const result = await repo.findAllUploadTasks();
      expect(result.total).toBe(1);
    });
  });

  describe('updateUploadTask', () => {
    it('should update status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'upl-1',
          tenant_id: 'test-tenant-001',
          file_name: 'f',
          file_size: 0,
          host_ids: [],
          hostnames: [],
          target_path: '/tmp/',
          status: 'failed',
          progress: 50,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateUploadTask('upl-1', { status: 'failed' });
      expect(result).toBeDefined();
      expect(result!.status).toBe('failed');
    });
  });
});
