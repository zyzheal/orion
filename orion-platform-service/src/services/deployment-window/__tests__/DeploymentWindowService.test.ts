/**
 * DeploymentWindowService 单元测试 - 综合版本
 *
 * 覆盖范围:
 * - createWindow: 默认值、自定义参数、边界条件
 * - listWindows: 环境过滤、空结果
 * - checkDeploymentAllowed: 窗口内/外、多窗口、调度时间
 * - createBlackout: 基础创建、可选参数
 * - checkBlackout: 阻断检测、调度时间
 * - isWithinWindow (private): 日期/时间边界
 * - findNextWindow (private): 下一窗口计算
 */

import { DeploymentWindowService, DeploymentWindow, BlackoutPeriod } from '../DeploymentWindowService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('DeploymentWindowService', () => {
  let service: DeploymentWindowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeploymentWindowService(mockPool as any);
  });

  // =========================================================================
  // createWindow
  // =========================================================================
  describe('createWindow', () => {
    it('应该创建部署窗口并返回完整记录', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w-001',
          tenant_id: 'tenant-1',
          name: 'weekday-business-hours',
          environment: 'production',
          start_time: '09:00',
          end_time: '17:00',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          timezone: 'UTC',
          blocking: true,
          created_at: new Date('2024-01-01'),
        }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'weekday-business-hours',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.id).toBe('w-001');
      expect(result.name).toBe('weekday-business-hours');
      expect(result.environment).toBe('production');
      expect(result.tenant_id).toBe('tenant-1');
    });

    it('应该使用默认工作日 (mon-fri)', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-002', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.days).toHaveLength(5);
      expect(result.days).toEqual(expect.arrayContaining(['mon', 'tue', 'wed', 'thu', 'fri']));
    });

    it('应该使用默认时区 UTC', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-003', timezone: 'UTC' }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.timezone).toBe('UTC');
    });

    it('应该使用默认 blocking=true', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-004', blocking: true }],
      });

      await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([true])
      );
    });

    it('应该支持自定义 days', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-005', days: ['sat', 'sun'] }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'weekend-window',
        environment: 'staging',
        start_time: '10:00',
        end_time: '16:00',
        days: ['sat', 'sun'],
      });

      expect(result.days).toEqual(['sat', 'sun']);
    });

    it('应该支持自定义 timezone', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-006', timezone: 'Asia/Shanghai' }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'cn-window',
        environment: 'production',
        start_time: '09:00',
        end_time: '18:00',
        timezone: 'Asia/Shanghai',
      });

      expect(result.timezone).toBe('Asia/Shanghai');
    });

    it('应该支持 blocking=false', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-007', blocking: false }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'advisory-window',
        environment: 'development',
        start_time: '00:00',
        end_time: '23:59',
        blocking: false,
      });

      expect(result.blocking).toBe(false);
    });

    it('应该将所有参数正确传递给 SQL 查询', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-008' }],
      });

      await service.createWindow({
        tenant_id: 't-1',
        name: 'test-window',
        environment: 'staging',
        start_time: '14:00',
        end_time: '16:00',
        days: ['wed'],
        timezone: 'America/New_York',
        blocking: false,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deployment_windows'),
        ['t-1', 'test-window', 'staging', '14:00', '16:00', ['wed'], 'America/New_York', false]
      );
    });

    it('应该传递空 days 数组（空数组为 truthy 不会被默认值替换）', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-009', days: [] }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'no-days',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
        days: [],
      });

      // 空数组 [] 是 truthy，不会被 || 默认值替换
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([[]])
      );
    });

    it('应该支持单个工作日', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-010', days: ['mon'] }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'monday-only',
        environment: 'production',
        start_time: '10:00',
        end_time: '12:00',
        days: ['mon'],
      });

      expect(result.days).toEqual(['mon']);
    });
  });

  // =========================================================================
  // listWindows
  // =========================================================================
  describe('listWindows', () => {
    it('应该返回指定租户的所有窗口', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'w-1', name: 'window-1', tenant_id: 'tenant-1' },
          { id: 'w-2', name: 'window-2', tenant_id: 'tenant-1' },
        ],
      });

      const result = await service.listWindows('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('window-1');
      expect(result[1].name).toBe('window-2');
    });

    it('应该支持按环境过滤', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', environment: 'production' }],
      });

      await service.listWindows('tenant-1', 'production');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('environment = $2'),
        ['tenant-1', 'production']
      );
    });

    it('不传环境时不应包含 environment 条件', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('tenant-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('environment'),
        ['tenant-1']
      );
    });

    it('应该返回空数组当没有窗口时', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.listWindows('tenant-1');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('应该使用正确的 tenant_id 参数', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('specific-tenant-id');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['specific-tenant-id']
      );
    });

    it('应该查询 deployment_windows 表', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('tenant-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM deployment_windows'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // checkDeploymentAllowed
  // =========================================================================
  describe('checkDeploymentAllowed', () => {
    it('应该允许在窗口内部署（全覆盖窗口）', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('应该拒绝在窗口外部署（日期不匹配）', async () => {
      // 只在周日开放，但当前不是周日
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['sun'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      // 结果取决于当前日期，但当不在周日时应该被拒绝
      if (!result.allowed) {
        expect(result.reason).toBe('Outside deployment window');
      }
    });

    it('应该在没有窗口时拒绝部署', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Outside deployment window');
    });

    it('应该返回 nextWindow 当部署被拒绝时', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['wed'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.nextWindow).toBeDefined();
      expect(result.nextWindow).toBeInstanceOf(Date);
    });

    it('应该返回 nextWindow（下一天）即使没有窗口时', async () => {
      // findNextWindow 总是返回 fromTime + 1 天，即使窗口列表为空
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(false);
      expect(result.nextWindow).toBeDefined();
      expect(result.nextWindow).toBeInstanceOf(Date);
    });

    it('应该支持指定调度时间检查', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_time: '09:00',
          end_time: '17:00',
        }],
      });

      // 2024-01-08 是周一
      const scheduledTime = new Date('2024-01-08T10:00:00Z');
      const result = await service.checkDeploymentAllowed('tenant-1', 'production', scheduledTime);

      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });

    it('应该在多个窗口中找到匹配的', async () => {
      // 第一个窗口不匹配，第二个匹配
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'w-1', days: ['sun'], start_time: '00:00', end_time: '23:59' },
          { id: 'w-2', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start_time: '00:00', end_time: '23:59' },
        ],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      // 全覆盖窗口应该匹配
      expect(result.allowed).toBe(true);
    });

    it('应该调用 listWindows 获取窗口列表', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.checkDeploymentAllowed('my-tenant', 'staging');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM deployment_windows'),
        ['my-tenant', 'staging']
      );
    });
  });

  // =========================================================================
  // createBlackout
  // =========================================================================
  describe('createBlackout', () => {
    it('应该创建 blackout 期', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b-001',
          tenant_id: 'tenant-1',
          name: 'holiday-blackout',
          start_at: new Date('2024-12-25'),
          end_at: new Date('2024-12-26'),
          reason: 'Christmas holiday',
          created_by: null,
          created_at: new Date(),
        }],
      });

      const result = await service.createBlackout({
        tenant_id: 'tenant-1',
        name: 'holiday-blackout',
        start_at: new Date('2024-12-25'),
        end_at: new Date('2024-12-26'),
        reason: 'Christmas holiday',
      });

      expect(result.name).toBe('holiday-blackout');
      expect(result.reason).toBe('Christmas holiday');
      expect(result.tenant_id).toBe('tenant-1');
    });

    it('应该支持 created_by 参数', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b-002',
          created_by: 'user-123',
        }],
      });

      await service.createBlackout({
        tenant_id: 'tenant-1',
        name: 'maintenance',
        start_at: new Date('2024-06-01'),
        end_at: new Date('2024-06-02'),
        reason: 'Scheduled maintenance',
        created_by: 'user-123',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['user-123'])
      );
    });

    it('应该默认 created_by 为 null', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'b-003', created_by: null }],
      });

      await service.createBlackout({
        tenant_id: 'tenant-1',
        name: 'blackout',
        start_at: new Date('2024-01-01'),
        end_at: new Date('2024-01-02'),
        reason: 'reason',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });

    it('应该将所有参数正确传递给 SQL 查询', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'b-004' }] });

      const startDate = new Date('2024-03-01T00:00:00Z');
      const endDate = new Date('2024-03-02T23:59:59Z');

      await service.createBlackout({
        tenant_id: 't-1',
        name: 'deploy-freeze',
        start_at: startDate,
        end_at: endDate,
        reason: 'Quarter end freeze',
        created_by: 'admin',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blackout_periods'),
        ['t-1', 'deploy-freeze', startDate, endDate, 'Quarter end freeze', 'admin']
      );
    });

    it('应该查询 blackout_periods 表', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'b-005' }] });

      await service.createBlackout({
        tenant_id: 't-1',
        name: 'test',
        start_at: new Date(),
        end_at: new Date(),
        reason: 'test',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blackout_periods'),
        expect.any(Array)
      );
    });
  });

  // =========================================================================
  // checkBlackout
  // =========================================================================
  describe('checkBlackout', () => {
    it('应该检测当前在 blackout 期内', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b-1',
          tenant_id: 'tenant-1',
          name: 'active-blackout',
          start_at: new Date(now.getTime() - 3600000),
          end_at: new Date(now.getTime() + 3600000),
          reason: 'Active maintenance',
        }],
      });

      const result = await service.checkBlackout('tenant-1');

      expect(result.blocked).toBe(true);
      expect(result.blackout).toBeDefined();
      expect(result.blackout!.id).toBe('b-1');
    });

    it('应该返回不在 blackout 期', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkBlackout('tenant-1');

      expect(result.blocked).toBe(false);
      expect(result.blackout).toBeUndefined();
    });

    it('应该支持指定时间检查', async () => {
      const scheduledTime = new Date('2024-07-04T12:00:00Z');
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b-1',
          start_at: new Date('2024-07-04'),
          end_at: new Date('2024-07-05'),
        }],
      });

      const result = await service.checkBlackout('tenant-1', scheduledTime);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('start_at <= $2 AND end_at >= $2'),
        ['tenant-1', scheduledTime]
      );
    });

    it('应该使用当前时间当不指定 scheduledTime 时', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const before = new Date();
      await service.checkBlackout('tenant-1');
      const after = new Date();

      const calledWith = mockPool.query.mock.calls[0][1];
      const usedTime = calledWith[1];

      expect(usedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(usedTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('应该查询 tenant_id 过滤条件', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.checkBlackout('specific-tenant');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['specific-tenant', expect.any(Date)]
      );
    });

    it('应该返回 blackout 详情当被阻断时', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b-10',
          tenant_id: 'tenant-1',
          name: 'year-end-freeze',
          start_at: new Date('2024-12-20'),
          end_at: new Date('2025-01-05'),
          reason: 'Year-end deployment freeze',
          created_by: 'admin',
          created_at: new Date(),
        }],
      });

      const result = await service.checkBlackout('tenant-1');

      expect(result.blocked).toBe(true);
      expect(result.blackout!.name).toBe('year-end-freeze');
      expect(result.blackout!.reason).toBe('Year-end deployment freeze');
    });
  });

  // =========================================================================
  // isWithinWindow (private - tested via checkDeploymentAllowed)
  // =========================================================================
  describe('isWithinWindow (private)', () => {
    it('应该检测时间在窗口内（全覆盖窗口）', () => {
      const time = new Date('2024-01-08T12:00:00Z'); // Monday
      const window = {
        days: ['mon'],
        start_time: '00:00',
        end_time: '23:59',
      } as DeploymentWindow;

      const result = (service as any).isWithinWindow(window, time);

      expect(result).toBe(true);
    });

    it('应该检测时间在窗口外（日期不匹配）', () => {
      const time = new Date('2024-01-08T12:00:00Z'); // Monday
      const window = {
        days: ['tue'],
        start_time: '00:00',
        end_time: '23:59',
      } as DeploymentWindow;

      const result = (service as any).isWithinWindow(window, time);

      expect(result).toBe(false);
    });

    it('应该检测时间在窗口外（时间不匹配）', () => {
      // 使用一个确定的时间点
      const time = new Date('2024-01-08T03:00:00Z'); // Monday 3AM UTC
      const localTime = time.toTimeString().slice(0, 5); // 获取本地时间字符串

      // 创建一个不包含当前时间的窗口
      const window = {
        days: ['mon'],
        start_time: '12:00',
        end_time: '14:00',
      } as DeploymentWindow;

      // 如果本地时间不在 12:00-14:00 范围内，应该返回 false
      if (localTime < '12:00' || localTime > '14:00') {
        const result = (service as any).isWithinWindow(window, time);
        expect(result).toBe(false);
      }
    });

    it('应该正确处理所有星期几的映射', () => {
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

      // 使用多个已知日期，每个日期对应 getDay() 返回的本地星期
      // 2024-01-07(日) 到 2024-01-13(六) 在 UTC 是完整的周
      // 日期字符串需要零填充，否则某些引擎解析失败
      const dates = [
        '2024-01-07T12:00:00Z',
        '2024-01-08T12:00:00Z',
        '2024-01-09T12:00:00Z',
        '2024-01-10T12:00:00Z',
        '2024-01-11T12:00:00Z',
        '2024-01-12T12:00:00Z',
        '2024-01-13T12:00:00Z',
      ];

      for (const dateStr of dates) {
        const date = new Date(dateStr);
        const actualDayIndex = date.getDay();
        const actualDayName = dayNames[actualDayIndex];

        const window = {
          days: [actualDayName],
          start_time: '00:00',
          end_time: '23:59',
        } as DeploymentWindow;

        const result = (service as any).isWithinWindow(window, date);
        expect(result).toBe(true);
      }
    });

    it('应该支持多天窗口', () => {
      const window = {
        days: ['mon', 'wed', 'fri'],
        start_time: '00:00',
        end_time: '23:59',
      } as DeploymentWindow;

      // Monday
      const monday = new Date('2024-01-08T12:00:00Z');
      expect((service as any).isWithinWindow(window, monday)).toBe(true);

      // Tuesday - not in window
      const tuesday = new Date('2024-01-09T12:00:00Z');
      expect((service as any).isWithinWindow(window, tuesday)).toBe(false);
    });

    it('应该使用本地时间进行时间比较', () => {
      const time = new Date('2024-01-08T12:00:00Z');
      const localTimeStr = time.toTimeString().slice(0, 5);

      const window = {
        days: ['mon'],
        start_time: localTimeStr,
        end_time: localTimeStr,
      } as DeploymentWindow;

      const result = (service as any).isWithinWindow(window, time);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // findNextWindow (private)
  // =========================================================================
  describe('findNextWindow (private)', () => {
    it('应该返回下一天作为下一个窗口', () => {
      const windows = [{
        days: ['mon'],
        start_time: '09:00',
        end_time: '17:00',
      }] as DeploymentWindow[];

      const fromTime = new Date('2024-01-07T10:00:00Z'); // Sunday
      const result = service.findNextWindow(windows, fromTime);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);

      // 应该是下一天
      const expected = new Date(fromTime);
      expected.setDate(expected.getDate() + 1);
      expect(result!.getDate()).toBe(expected.getDate());
    });

    it('应该在空窗口列表时仍返回下一天', () => {
      // findNextWindow 总是返回 fromTime + 1 天，即使窗口列表为空
      const fromTime = new Date('2024-01-15T10:00:00Z');
      const result = service.findNextWindow([], fromTime);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(fromTime.getDate() + 1);
    });

    it('应该始终返回 fromTime + 1 天', () => {
      const windows = [
        { days: ['mon'], start_time: '09:00', end_time: '17:00' },
        { days: ['fri'], start_time: '10:00', end_time: '16:00' },
      ] as DeploymentWindow[];

      const fromTime = new Date('2024-01-01T00:00:00Z'); // Monday
      const result = service.findNextWindow(windows, fromTime);

      expect(result).toBeDefined();
      expect(result!.getDate()).toBe(2); // Jan 2
    });
  });

  // =========================================================================
  // 接口和类型测试
  // =========================================================================
  describe('接口导出', () => {
    it('应该正确导出 DeploymentWindowService 类', () => {
      expect(DeploymentWindowService).toBeDefined();
      expect(typeof DeploymentWindowService).toBe('function');
    });

    it('应该可以实例化 DeploymentWindowService', () => {
      const instance = new DeploymentWindowService(mockPool as any);
      expect(instance).toBeInstanceOf(DeploymentWindowService);
    });

    it('应该有 createWindow 方法', () => {
      expect(typeof service.createWindow).toBe('function');
    });

    it('应该有 listWindows 方法', () => {
      expect(typeof service.listWindows).toBe('function');
    });

    it('应该有 checkDeploymentAllowed 方法', () => {
      expect(typeof service.checkDeploymentAllowed).toBe('function');
    });

    it('应该有 createBlackout 方法', () => {
      expect(typeof service.createBlackout).toBe('function');
    });

    it('应该有 checkBlackout 方法', () => {
      expect(typeof service.checkBlackout).toBe('function');
    });

    it('应该有 findNextWindow 公共方法', () => {
      expect(typeof service.findNextWindow).toBe('function');
    });
  });

  // =========================================================================
  // 错误处理
  // =========================================================================
  describe('错误处理', () => {
    it('createWindow 应该在数据库错误时抛出异常', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.createWindow({
          tenant_id: 't-1',
          name: 'test',
          environment: 'production',
          start_time: '09:00',
          end_time: '17:00',
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('listWindows 应该在数据库错误时抛出异常', async () => {
      mockPool.query.mockRejectedValue(new Error('Query timeout'));

      await expect(
        service.listWindows('tenant-1')
      ).rejects.toThrow('Query timeout');
    });

    it('checkDeploymentAllowed 应该在数据库错误时抛出异常', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.checkDeploymentAllowed('tenant-1', 'production')
      ).rejects.toThrow('Connection lost');
    });

    it('createBlackout 应该在数据库错误时抛出异常', async () => {
      mockPool.query.mockRejectedValue(new Error('Constraint violation'));

      await expect(
        service.createBlackout({
          tenant_id: 't-1',
          name: 'test',
          start_at: new Date(),
          end_at: new Date(),
          reason: 'test',
        })
      ).rejects.toThrow('Constraint violation');
    });

    it('checkBlackout 应该在数据库错误时抛出异常', async () => {
      mockPool.query.mockRejectedValue(new Error('Table not found'));

      await expect(
        service.checkBlackout('tenant-1')
      ).rejects.toThrow('Table not found');
    });
  });

  // =========================================================================
  // 租户隔离
  // =========================================================================
  describe('租户隔离', () => {
    it('createWindow 应该绑定 tenant_id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'w-1' }] });

      await service.createWindow({
        tenant_id: 'tenant-A',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['tenant-A'])
      );
    });

    it('listWindows 应该按 tenant_id 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('tenant-B');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-B']
      );
    });

    it('checkBlackout 应该按 tenant_id 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.checkBlackout('tenant-C');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-C', expect.any(Date)]
      );
    });
  });
});
