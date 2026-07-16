/**
 * WorkbenchService 单元测试
 *
 * 测试个人工作台聚合数据：Pipeline、Alert、Ticket、Deployment 数据查询和降级。
 */

import { WorkbenchService } from '../WorkbenchService';

describe('WorkbenchService', () => {
  let service: WorkbenchService;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = { query: jest.fn() };
    service = new WorkbenchService(mockPool as any);
  });

  // Helper: mock query based on SQL content
  function mockQueryByTable(tableResults: Record<string, any[]>) {
    mockPool.query.mockImplementation((sql: string) => {
      for (const [table, rows] of Object.entries(tableResults)) {
        if (sql.includes(table)) {
          return Promise.resolve({ rows });
        }
      }
      return Promise.resolve({ rows: [] });
    });
  }

  function setupSuccessfulQueries() {
    mockQueryByTable({
      pipeline_runs: [
        { id: 'run-1', name: 'Build', status: 'completed', created_at: new Date(), duration_ms: '1200' },
        { id: 'run-2', name: 'Deploy', status: 'failed', created_at: new Date(), duration_ms: '3000' },
      ],
      alerts: [
        { id: 'alert-1', severity: 'critical', message: 'CPU high', created_at: new Date(), acknowledged: false },
      ],
      tickets: [
        { id: 'ticket-1', title: 'Fix bug', priority: 'high', status: 'open', sla_deadline: new Date(Date.now() + 3600000) },
      ],
      deployment_history: [
        { id: 'dep-1', environment: 'prod', status: 'success', version: 'v1.0', deployed_at: new Date() },
      ],
    });
  }

  describe('getWorkbench', () => {
    it('should return aggregated data from all queries', async () => {
      // Need specific mock for stats queries
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('pipeline_runs') && sql.includes('FILTER')) {
          return Promise.resolve({ rows: [{ total_24h: '10', success_24h: '8', failed_24h: '2' }] });
        }
        if (sql.includes('pipeline_runs')) {
          return Promise.resolve({
            rows: [
              { id: 'run-1', name: 'Build', status: 'completed', created_at: new Date(), duration_ms: '1200' },
              { id: 'run-2', name: 'Deploy', status: 'failed', created_at: new Date(), duration_ms: '3000' },
            ],
          });
        }
        if (sql.includes('alerts') && sql.includes("severity = 'critical'")) {
          return Promise.resolve({ rows: [{ count: '2' }] });
        }
        if (sql.includes('alerts') && sql.includes("status = 'active'") && !sql.includes('severity')) {
          return Promise.resolve({ rows: [{ count: '5' }] });
        }
        if (sql.includes('alerts')) {
          return Promise.resolve({
            rows: [{ id: 'alert-1', severity: 'critical', message: 'CPU high', created_at: new Date(), acknowledged: false }],
          });
        }
        if (sql.includes('tickets') && sql.includes('sla_deadline < NOW()')) {
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('tickets') && sql.includes('COUNT')) {
          return Promise.resolve({ rows: [{ count: '3' }] });
        }
        if (sql.includes('tickets')) {
          return Promise.resolve({
            rows: [{ id: 'ticket-1', title: 'Fix bug', priority: 'high', status: 'open', sla_deadline: new Date(Date.now() + 3600000) }],
          });
        }
        if (sql.includes('deployment_history') && sql.includes('FILTER')) {
          return Promise.resolve({ rows: [{ total: '5', success_count: '4' }] });
        }
        if (sql.includes('deployment_history')) {
          return Promise.resolve({
            rows: [{ id: 'dep-1', environment: 'prod', status: 'success', version: 'v1.0', deployed_at: new Date() }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myPipelines.recentRuns).toHaveLength(2);
      expect(result.myPipelines.successRate).toBe(80);
      expect(result.myPipelines.totalRuns24h).toBe(10);
      expect(result.myPipelines.failedRuns).toBe(2);

      expect(result.myAlerts.unread).toBe(5);
      expect(result.myAlerts.critical).toBe(2);
      expect(result.myAlerts.recent).toHaveLength(1);

      expect(result.myTickets.active).toBe(3);
      expect(result.myTickets.overdue).toBe(1);
      expect(result.myTickets.recent).toHaveLength(1);

      expect(result.myDeployments.recent).toHaveLength(1);
      expect(result.myDeployments.successRate).toBe(80);
    });

    it('should use default tenantId when not provided', async () => {
      setupSuccessfulQueries();

      await service.getWorkbench('user-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['default']
      );
    });

    it('should degrade gracefully when pipeline query fails', async () => {
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('pipeline_runs')) {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve({ rows: [{ count: '0' }] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myPipelines.recentRuns).toEqual([]);
      expect(result.myPipelines.successRate).toBe(0);
      expect(result.myPipelines.totalRuns24h).toBe(0);
      expect(result.myPipelines.failedRuns).toBe(0);
    });

    it('should degrade gracefully when alert query fails', async () => {
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('alerts')) {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve({ rows: [{ count: '0' }] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myAlerts.unread).toBe(0);
      expect(result.myAlerts.critical).toBe(0);
      expect(result.myAlerts.recent).toEqual([]);
    });

    it('should degrade gracefully when ticket query fails', async () => {
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('tickets')) {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve({ rows: [{ count: '0' }] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myTickets.active).toBe(0);
      expect(result.myTickets.overdue).toBe(0);
      expect(result.myTickets.recent).toEqual([]);
    });

    it('should degrade gracefully when deployment query fails', async () => {
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('deployment_history')) {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve({ rows: [{ count: '0' }] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myDeployments.recent).toEqual([]);
      expect(result.myDeployments.successRate).toBe(0);
    });

    it('should handle zero results', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myPipelines.successRate).toBe(0);
      expect(result.myPipelines.totalRuns24h).toBe(0);
      expect(result.myAlerts.unread).toBe(0);
      expect(result.myTickets.active).toBe(0);
      expect(result.myDeployments.successRate).toBe(0);
    });

    it('should handle null values from database', async () => {
      mockPool.query.mockImplementation((sql: string) => {
        if (sql.includes('pipeline_runs') && sql.includes('FILTER')) {
          return Promise.resolve({ rows: [{ total_24h: null, success_24h: null, failed_24h: null }] });
        }
        if (sql.includes('pipeline_runs')) {
          return Promise.resolve({
            rows: [{ id: 'run-1', name: 'Build', status: 'completed', created_at: null, duration_ms: null }],
          });
        }
        if (sql.includes('alerts') && sql.includes('COUNT')) {
          return Promise.resolve({ rows: [{ count: null }] });
        }
        if (sql.includes('alerts')) {
          return Promise.resolve({
            rows: [{ id: 'a1', severity: 'info', message: 'msg', created_at: null, acknowledged: null }],
          });
        }
        if (sql.includes('tickets') && sql.includes('COUNT')) {
          return Promise.resolve({ rows: [{ count: null }] });
        }
        if (sql.includes('tickets')) {
          return Promise.resolve({
            rows: [{ id: 't1', title: 'Bug', priority: 'low', status: 'open', sla_deadline: null }],
          });
        }
        if (sql.includes('deployment_history') && sql.includes('FILTER')) {
          return Promise.resolve({ rows: [{ total: null, success_count: null }] });
        }
        if (sql.includes('deployment_history')) {
          return Promise.resolve({
            rows: [{ id: 'd1', environment: 'dev', status: 'success', version: null, deployed_at: null }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.getWorkbench('user-1', 'tenant-1');

      expect(result.myPipelines.recentRuns[0].durationMs).toBe(0);
      expect(result.myPipelines.recentRuns[0].createdAt).toBe('');
      expect(result.myPipelines.totalRuns24h).toBe(0);
      expect(result.myAlerts.unread).toBe(0);
      expect(result.myAlerts.recent[0].createdAt).toBe('');
      expect(result.myTickets.recent[0].slaRemaining).toBe(0);
      expect(result.myDeployments.recent[0].version).toBe('');
      expect(result.myDeployments.recent[0].deployedAt).toBe('');
      expect(result.myDeployments.successRate).toBe(0);
    });

    it('should run all queries in parallel', async () => {
      setupSuccessfulQueries();

      await service.getWorkbench('user-1', 'tenant-1');

      // All 10 queries should be issued
      expect(mockPool.query).toHaveBeenCalledTimes(10);
    });
  });
});
