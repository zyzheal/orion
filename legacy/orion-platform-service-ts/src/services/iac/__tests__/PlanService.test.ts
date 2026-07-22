/**
 * PlanService 单元测试
 *
 * 测试覆盖：
 * - Terraform 执行
 * - 状态管理
 * - 变更检测
 * - Plan CRUD
 * - Apply 操作
 */

import { PlanService } from '../PlanService';
import { WorkspaceService } from '../WorkspaceService';
import { EventBusService } from '../../event-bus-service';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

// Mock EventBus
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

// Mock WorkspaceService
function makeWorkspaceService(): jest.Mocked<WorkspaceService> {
  return {
    create: jest.fn(),
    getById: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
    addStateVersion: jest.fn(),
    getCurrentState: jest.fn(),
    getStateHistory: jest.fn(),
    listResources: jest.fn(),
    importResource: jest.fn(),
    createModule: jest.fn(),
    getModuleById: jest.fn(),
    listModules: jest.fn(),
    deleteModule: jest.fn(),
    listStateVersions: jest.fn(),
    getStateDiff: jest.fn(),
  } as unknown as jest.Mocked<WorkspaceService>;
}

describe('PlanService', () => {
  let service: PlanService;
  let mockWorkspaceService: jest.Mocked<WorkspaceService>;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaceService = makeWorkspaceService();
    mockEventBus = makeEventBusMock();
    service = new PlanService({
      workspaceService: mockWorkspaceService,
      eventBus: mockEventBus,
      db: mockPool as any,
    });
  });

  describe('create (Terraform Execution)', () => {
    it('应该创建新的 IaC Plan', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe('ws-1');
      expect(result.status).toBe('completed');
    });

    it('应该模拟 Terraform plan 执行', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      // Plan should simulate execution and complete
      expect(result.status).toBe('completed');
      expect(result.resourceChanges).toBeDefined();
    });

    it('应该检测资源变更', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {
            add: 3,
            change: 1,
            destroy: 0,
            details: [
              { action: 'add', type: 'aws_instance', name: 'web_server' },
              { action: 'add', type: 'aws_security_group', name: 'web_sg' },
              { action: 'add', type: 'aws_s3_bucket', name: 'assets' },
              { action: 'change', type: 'aws_instance', name: 'api_server' },
            ],
          },
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.resourceChanges?.add).toBe(3);
      expect(result.resourceChanges?.change).toBe(1);
      expect(result.resourceChanges?.destroy).toBe(0);
      expect(result.resourceChanges?.details).toBeDefined();
      expect(result.resourceChanges?.details?.length).toBe(4);
    });

    it('应该提供成本估算', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate?.monthlyCost).toBe(127.5);
      expect(result.costEstimate?.delta).toBe(42.5);
      expect(result.costEstimate?.currency).toBe('USD');
    });

    it('应该发布 iac.plan.created 事件', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'iac.plan.created',
        expect.objectContaining({
          planId: expect.any(String),
          workspaceId: 'ws-1',
          status: 'completed',
        }),
      );
    });

    it('应该在没有数据库时创建 Plan（内存模式）', async () => {
      const serviceNoDb = new PlanService({
        workspaceService: mockWorkspaceService,
        eventBus: mockEventBus,
      });

      const result = await serviceNoDb.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('getById', () => {
    it('应该返回指定 Plan', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.getById('plan-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('plan-1');
    });

    it('应该返回 undefined 如果 Plan 不存在', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getById('nonexistent');

      expect(result).toBeUndefined();
    });

    it('应该返回 undefined 如果没有数据库', async () => {
      const serviceNoDb = new PlanService({
        workspaceService: mockWorkspaceService,
      });

      const result = await serviceNoDb.getById('plan-1');

      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('应该返回所有 Plans', async () => {
      // findAll executes two queries: main query + count query
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'plan-1',
              name: 'ws-1',
              workspace_id: 'ws-1',
              terraform_version: '1.5.0',
              plan_content: {},
              resources_to_add: 3,
              resources_to_change: 1,
              resources_to_destroy: 0,
              applied: false,
              applied_at: null,
              applied_by: null,
              created_at: new Date(),
            },
            {
              id: 'plan-2',
              name: 'ws-2',
              workspace_id: 'ws-2',
              terraform_version: '1.5.0',
              plan_content: {},
              resources_to_add: 2,
              resources_to_change: 0,
              resources_to_destroy: 1,
              applied: true,
              applied_at: new Date(),
              applied_by: 'user-1',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await service.list();

      expect(result.plans.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('应该按状态过滤 Plans', async () => {
      // findAll executes two queries: main query + count query
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'plan-1',
              name: 'ws-1',
              workspace_id: 'ws-1',
              terraform_version: '1.5.0',
              plan_content: {},
              resources_to_add: 3,
              resources_to_change: 1,
              resources_to_destroy: 0,
              applied: true,
              applied_at: new Date(),
              applied_by: 'user-1',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await service.list({ status: 'applied' });

      expect(result.plans.every(p => p.applied)).toBe(true);
    });

    it('应该支持分页', async () => {
      const plans = Array.from({ length: 25 }, (_, i) => ({
        id: `plan-${i}`,
        name: 'ws-1',
        workspace_id: 'ws-1',
        terraform_version: '1.5.0',
        plan_content: {},
        resources_to_add: 3,
        resources_to_change: 1,
        resources_to_destroy: 0,
        applied: false,
        applied_at: null,
        applied_by: null,
        created_at: new Date(),
      }));

      // findAll executes two queries: main query + count query
      mockPool.query
        .mockResolvedValueOnce({ rows: plans })
        .mockResolvedValueOnce({ rows: [{ count: '25' }] });

      const result = await service.list({ page: 2, perPage: 10 });

      expect(result.plans.length).toBe(10);
      expect(result.total).toBe(25);
    });

    it('应该返回空列表如果没有数据库', async () => {
      const serviceNoDb = new PlanService({
        workspaceService: mockWorkspaceService,
      });

      const result = await serviceNoDb.list();

      expect(result.plans).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('listByWorkspace', () => {
    it('应该返回指定 workspace 的所有 Plans', async () => {
      // findAll executes two queries: main query + count query
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'plan-1',
              name: 'ws-1',
              workspace_id: 'ws-1',
              terraform_version: '1.5.0',
              plan_content: {},
              resources_to_add: 3,
              resources_to_change: 1,
              resources_to_destroy: 0,
              applied: false,
              applied_at: null,
              applied_by: null,
              created_at: new Date(),
            },
            {
              id: 'plan-2',
              name: 'ws-1',
              workspace_id: 'ws-1',
              terraform_version: '1.5.0',
              plan_content: {},
              resources_to_add: 2,
              resources_to_change: 0,
              resources_to_destroy: 1,
              applied: true,
              applied_at: new Date(),
              applied_by: 'user-1',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await service.listByWorkspace('ws-1');

      expect(result.length).toBe(2);
      expect(result.every(p => p.workspaceId === 'ws-1')).toBe(true);
    });

    it('应该返回空数组如果没有匹配的 workspace', async () => {
      // findAll executes two queries: main query + count query
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await service.listByWorkspace('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('apply', () => {
    it('应该应用 Plan', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: true,
            applied_at: new Date(),
            applied_by: 'system',
            created_at: new Date(),
          }],
        });

      const result = await service.apply('plan-1');

      expect(result).toBeDefined();
      expect(result?.applied).toBe(true);
      expect(result?.appliedBy).toBe('system');
    });

    it('应该发布 iac.plan.applied 事件', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            applied: true,
          }],
        });

      await service.apply('plan-1');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'iac.plan.applied',
        expect.objectContaining({
          planId: 'plan-1',
        }),
      );
    });

    it('应该拒绝重复应用', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: true,
          applied_at: new Date(),
          applied_by: 'user-1',
          created_at: new Date(),
        }],
      });

      await expect(service.apply('plan-1')).rejects.toThrow('Plan already applied');
    });

    it('应该返回 undefined 如果 Plan 不存在', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.apply('nonexistent');

      expect(result).toBeUndefined();
    });

    it('应该返回 undefined 如果没有数据库', async () => {
      const serviceNoDb = new PlanService({
        workspaceService: mockWorkspaceService,
      });

      const result = await serviceNoDb.apply('plan-1');

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('应该删除 Plan', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.delete('plan-1');

      expect(result).toBe(true);
    });

    it('应该返回 false 如果 Plan 不存在', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('应该返回 false 如果没有数据库', async () => {
      const serviceNoDb = new PlanService({
        workspaceService: mockWorkspaceService,
      });

      const result = await serviceNoDb.delete('plan-1');

      expect(result).toBe(false);
    });
  });

  describe('状态管理', () => {
    it('应该标记 Plan 状态为 completed', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.status).toBe('completed');
    });

    it('应该追踪 applied 状态', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        }) // create INSERT
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        }) // findById (first call in apply)
        .mockResolvedValueOnce({ rowCount: 1 }) // markApplied
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: true,
            applied_at: new Date(),
            applied_by: 'system',
            created_at: new Date(),
          }],
        }); // findById (second call in apply)

      const plan = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      const applied = await service.apply(plan.id);

      expect(applied?.applied).toBe(true);
      expect(applied?.appliedAt).toBeDefined();
      expect(applied?.appliedBy).toBe('system');
    });
  });

  describe('变更检测详情', () => {
    it('应该提供详细的资源变更信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.resourceChanges?.details).toBeDefined();
      expect(result.resourceChanges?.details?.length).toBe(4);

      // Verify each change detail
      const details = result.resourceChanges?.details ?? [];
      expect(details[0].action).toBe('add');
      expect(details[0].type).toBe('aws_instance');
      expect(details[0].name).toBe('web_server');

      expect(details[1].action).toBe('add');
      expect(details[1].type).toBe('aws_security_group');
      expect(details[1].name).toBe('web_sg');

      expect(details[3].action).toBe('change');
      expect(details[3].type).toBe('aws_instance');
      expect(details[3].name).toBe('api_server');
    });

    it('应该正确计算变更数量', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.resourceChanges?.add).toBe(3);
      expect(result.resourceChanges?.change).toBe(1);
      expect(result.resourceChanges?.destroy).toBe(0);
    });
  });

  describe('EventBus 事件', () => {
    it('应该发布所有必要的事件', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        }) // create INSERT
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        }) // findById (first call in apply)
        .mockResolvedValueOnce({ rowCount: 1 }) // markApplied
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: true,
            applied_at: new Date(),
            applied_by: 'system',
            created_at: new Date(),
          }],
        }); // findById (second call in apply)

      // Create event
      await service.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      // Apply event
      await service.apply('plan-1');

      const events = mockEventBus.publish.mock.calls.map(c => c[0]);

      expect(events).toContain('iac.plan.created');
      expect(events).toContain('iac.plan.applied');
    });

    it('应该在没有 EventBus 时不抛出错误', async () => {
      const serviceNoEventBus = new PlanService({
        workspaceService: mockWorkspaceService,
        db: mockPool as any,
      });

      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await serviceNoEventBus.create({
        workspaceId: 'ws-1',
        triggeredBy: 'user-1',
      });

      expect(result.id).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('应该处理空 plan content', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: null,
          resources_to_add: 0,
          resources_to_change: 0,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.getById('plan-1');

      expect(result).toBeDefined();
      expect(result?.planContent).toEqual({});
    });

    it('应该处理 null terraform version', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: null,
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: false,
          applied_at: null,
          applied_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.getById('plan-1');

      expect(result).toBeDefined();
      expect(result?.terraformVersion).toBeNull();
    });

    it('应该处理并发应用请求', async () => {
      // First request sees unapplied plan
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            name: 'ws-1',
            workspace_id: 'ws-1',
            terraform_version: '1.5.0',
            plan_content: {},
            resources_to_add: 3,
            resources_to_change: 1,
            resources_to_destroy: 0,
            applied: false,
            applied_at: null,
            applied_by: null,
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan-1',
            applied: true,
          }],
        });

      // Second request sees applied plan
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'plan-1',
          name: 'ws-1',
          workspace_id: 'ws-1',
          terraform_version: '1.5.0',
          plan_content: {},
          resources_to_add: 3,
          resources_to_change: 1,
          resources_to_destroy: 0,
          applied: true,
          applied_at: new Date(),
          applied_by: 'user-1',
          created_at: new Date(),
        }],
      });

      const firstApply = await service.apply('plan-1');

      // Second call should fail because plan is already applied
      await expect(service.apply('plan-1')).rejects.toThrow('Plan already applied');

      expect(firstApply?.applied).toBe(true);
    });
  });
});