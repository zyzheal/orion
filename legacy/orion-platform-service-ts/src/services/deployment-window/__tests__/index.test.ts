/**
 * Deployment Window Index - Re-export + Behavior Tests
 *
 * 覆盖范围:
 * - Re-export 验证 (DeploymentWindowService, 类型)
 * - createWindow: 默认值(days/timezone/blocking)、自定义参数、SQL 参数传递
 * - listWindows: 租户过滤、环境过滤、空结果
 * - checkDeploymentAllowed: 窗口内/外、无窗口、多窗口、调度时间
 * - createBlackout: 基础创建、可选参数(created_by)、SQL 参数传递
 * - checkBlackout: 阻断检测、非阻断、指定时间、默认当前时间
 * - findNextWindow: 下一天计算、空窗口列表
 * - 租户隔离验证
 * - 错误处理
 */

import { DeploymentWindowService, DeploymentWindow, BlackoutPeriod } from '../index';

// ==================== Mock ====================

function createMockPool() {
  return { query: jest.fn() };
}

// ==================== Re-export Tests ====================

describe('Deployment Window Index (Re-exports)', () => {
  describe('DeploymentWindowService', () => {
    it('should export DeploymentWindowService class', () => {
      expect(DeploymentWindowService).toBeDefined();
      expect(typeof DeploymentWindowService).toBe('function');
    });

    it('should be instantiable with a pool', () => {
      const mockPool = createMockPool();
      const instance = new DeploymentWindowService(mockPool as any);
      expect(instance).toBeInstanceOf(DeploymentWindowService);
    });

    it('should have expected methods', () => {
      const mockPool = createMockPool();
      const instance = new DeploymentWindowService(mockPool as any);
      expect(typeof instance.createWindow).toBe('function');
      expect(typeof instance.listWindows).toBe('function');
      expect(typeof instance.checkDeploymentAllowed).toBe('function');
      expect(typeof instance.createBlackout).toBe('function');
      expect(typeof instance.checkBlackout).toBe('function');
    });

    it('should have findNextWindow method', () => {
      const mockPool = createMockPool();
      const instance = new DeploymentWindowService(mockPool as any);
      expect(typeof instance.findNextWindow).toBe('function');
    });
  });
});

// ==================== Behavior Tests ====================

describe('DeploymentWindowService behavior via index', () => {
  let pool: ReturnType<typeof createMockPool>;
  let service: DeploymentWindowService;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    service = new DeploymentWindowService(pool as any);
  });

  // ==================== createWindow ====================

  describe('createWindow', () => {
    it('should create a deployment window and return the record', async () => {
      pool.query.mockResolvedValue({
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

    it('should use default days (mon-fri)', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-002', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }] });

      await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([['mon', 'tue', 'wed', 'thu', 'fri']]));
    });

    it('should use default timezone UTC', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-003', timezone: 'UTC' }] });

      await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['UTC']));
    });

    it('should use default blocking=true', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-004', blocking: true }] });

      await service.createWindow({
        tenant_id: 'tenant-1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([true]));
    });

    it('should support custom days', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-005', days: ['sat', 'sun'] }] });

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

    it('should support custom timezone', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-006', timezone: 'Asia/Shanghai' }] });

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

    it('should support blocking=false', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-007', blocking: false }] });

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

    it('should pass all parameters correctly to SQL query', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-008' }] });

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

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deployment_windows'),
        ['t-1', 'test-window', 'staging', '14:00', '16:00', ['wed'], 'America/New_York', false]
      );
    });
  });

  // ==================== listWindows ====================

  describe('listWindows', () => {
    it('should return all windows for a tenant', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { id: 'w-1', name: 'window-1', tenant_id: 'tenant-1' },
          { id: 'w-2', name: 'window-2', tenant_id: 'tenant-1' },
        ],
      });

      const result = await service.listWindows('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('window-1');
    });

    it('should support environment filter', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-1', environment: 'production' }] });

      await service.listWindows('tenant-1', 'production');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('environment = $2'),
        ['tenant-1', 'production']
      );
    });

    it('should not include environment condition when not specified', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('tenant-1');

      expect(pool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('environment'),
        ['tenant-1']
      );
    });

    it('should return empty array when no windows exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.listWindows('tenant-1');

      expect(result).toEqual([]);
    });

    it('should use correct tenant_id parameter', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('specific-tenant-id');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['specific-tenant-id']
      );
    });
  });

  // ==================== checkDeploymentAllowed ====================

  describe('checkDeploymentAllowed', () => {
    it('should allow deployment inside a full-coverage window', async () => {
      pool.query.mockResolvedValue({
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

    it('should reject deployment when no windows exist', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Outside deployment window');
    });

    it('should return nextWindow when deployment is rejected', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['sat'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.nextWindow).toBeDefined();
      expect(result.nextWindow).toBeInstanceOf(Date);
    });

    it('should support scheduled time check', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'w-1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_time: '09:00',
          end_time: '17:00',
        }],
      });

      const scheduledTime = new Date('2024-01-08T10:00:00Z'); // Monday
      const result = await service.checkDeploymentAllowed('tenant-1', 'production', scheduledTime);

      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should find matching window from multiple windows', async () => {
      pool.query.mockResolvedValue({
        rows: [
          { id: 'w-1', days: ['sun'], start_time: '00:00', end_time: '23:59' },
          { id: 'w-2', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start_time: '00:00', end_time: '23:59' },
        ],
      });

      const result = await service.checkDeploymentAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(true);
    });

    it('should call listWindows with correct parameters', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.checkDeploymentAllowed('my-tenant', 'staging');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM deployment_windows'),
        ['my-tenant', 'staging']
      );
    });
  });

  // ==================== createBlackout ====================

  describe('createBlackout', () => {
    it('should create a blackout period', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'b-001',
          tenant_id: 'tenant-1',
          name: 'holiday-blackout',
          start_at: new Date('2024-12-25'),
          end_at: new Date('2024-12-26'),
          reason: 'Christmas holiday',
          created_by: null,
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

    it('should support created_by parameter', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'b-002', created_by: 'user-123' }] });

      await service.createBlackout({
        tenant_id: 'tenant-1',
        name: 'maintenance',
        start_at: new Date('2024-06-01'),
        end_at: new Date('2024-06-02'),
        reason: 'Scheduled maintenance',
        created_by: 'user-123',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['user-123']));
    });

    it('should default created_by to null', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'b-003', created_by: null }] });

      await service.createBlackout({
        tenant_id: 'tenant-1',
        name: 'blackout',
        start_at: new Date('2024-01-01'),
        end_at: new Date('2024-01-02'),
        reason: 'reason',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([null]));
    });

    it('should pass all parameters correctly to SQL query', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'b-004' }] });

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

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blackout_periods'),
        ['t-1', 'deploy-freeze', startDate, endDate, 'Quarter end freeze', 'admin']
      );
    });
  });

  // ==================== checkBlackout ====================

  describe('checkBlackout', () => {
    it('should detect current blackout period', async () => {
      const now = new Date();
      pool.query.mockResolvedValue({
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

    it('should return not blocked when no blackout exists', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkBlackout('tenant-1');

      expect(result.blocked).toBe(false);
      expect(result.blackout).toBeUndefined();
    });

    it('should support scheduled time check', async () => {
      const scheduledTime = new Date('2024-07-04T12:00:00Z');
      pool.query.mockResolvedValue({
        rows: [{ id: 'b-1', start_at: new Date('2024-07-04'), end_at: new Date('2024-07-05') }],
      });

      await service.checkBlackout('tenant-1', scheduledTime);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('start_at <= $2 AND end_at >= $2'),
        ['tenant-1', scheduledTime]
      );
    });

    it('should use current time when scheduledTime is not specified', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const before = new Date();
      await service.checkBlackout('tenant-1');
      const after = new Date();

      const calledWith = pool.query.mock.calls[0][1];
      const usedTime = calledWith[1] as Date;

      expect(usedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(usedTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should filter by tenant_id', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.checkBlackout('specific-tenant');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['specific-tenant', expect.any(Date)]
      );
    });

    it('should return blackout details when blocked', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          id: 'b-10',
          tenant_id: 'tenant-1',
          name: 'year-end-freeze',
          start_at: new Date('2024-12-20'),
          end_at: new Date('2025-01-05'),
          reason: 'Year-end deployment freeze',
          created_by: 'admin',
        }],
      });

      const result = await service.checkBlackout('tenant-1');

      expect(result.blocked).toBe(true);
      expect(result.blackout!.name).toBe('year-end-freeze');
      expect(result.blackout!.reason).toBe('Year-end deployment freeze');
    });
  });

  // ==================== findNextWindow ====================

  describe('findNextWindow', () => {
    it('should return next day as the next window', () => {
      const windows = [{ days: ['mon'], start_time: '09:00', end_time: '17:00' }] as DeploymentWindow[];
      const fromTime = new Date('2024-01-07T10:00:00Z'); // Sunday

      const result = service.findNextWindow(windows, fromTime);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);

      const expected = new Date(fromTime);
      expected.setDate(expected.getDate() + 1);
      expect(result!.getDate()).toBe(expected.getDate());
    });

    it('should return next day even with empty window list', () => {
      const fromTime = new Date('2024-01-15T10:00:00Z');
      const result = service.findNextWindow([], fromTime);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(fromTime.getDate() + 1);
    });

    it('should always return fromTime + 1 day', () => {
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

  // ==================== isWithinWindow (private) ====================

  describe('isWithinWindow (private)', () => {
    it('should detect time inside window (full coverage)', () => {
      const time = new Date('2024-01-08T12:00:00Z'); // Monday
      const window = { days: ['mon'], start_time: '00:00', end_time: '23:59' } as DeploymentWindow;

      const result = (service as any).isWithinWindow(window, time);

      expect(result).toBe(true);
    });

    it('should detect time outside window (day mismatch)', () => {
      const time = new Date('2024-01-08T12:00:00Z'); // Monday
      const window = { days: ['tue'], start_time: '00:00', end_time: '23:59' } as DeploymentWindow;

      const result = (service as any).isWithinWindow(window, time);

      expect(result).toBe(false);
    });

    it('should support multi-day windows', () => {
      const window = { days: ['mon', 'wed', 'fri'], start_time: '00:00', end_time: '23:59' } as DeploymentWindow;

      const monday = new Date('2024-01-08T12:00:00Z');
      expect((service as any).isWithinWindow(window, monday)).toBe(true);

      const tuesday = new Date('2024-01-09T12:00:00Z');
      expect((service as any).isWithinWindow(window, tuesday)).toBe(false);
    });

    it('should correctly map all day names', () => {
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dates = [
        '2024-01-07T12:00:00Z', '2024-01-08T12:00:00Z', '2024-01-09T12:00:00Z',
        '2024-01-10T12:00:00Z', '2024-01-11T12:00:00Z', '2024-01-12T12:00:00Z', '2024-01-13T12:00:00Z',
      ];

      for (const dateStr of dates) {
        const date = new Date(dateStr);
        const actualDayName = dayNames[date.getDay()];
        const window = { days: [actualDayName], start_time: '00:00', end_time: '23:59' } as DeploymentWindow;

        expect((service as any).isWithinWindow(window, date)).toBe(true);
      }
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('createWindow should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database connection failed'));

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

    it('listWindows should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Query timeout'));

      await expect(service.listWindows('tenant-1')).rejects.toThrow('Query timeout');
    });

    it('checkDeploymentAllowed should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Connection lost'));

      await expect(service.checkDeploymentAllowed('tenant-1', 'production')).rejects.toThrow('Connection lost');
    });

    it('createBlackout should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Constraint violation'));

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

    it('checkBlackout should propagate database errors', async () => {
      pool.query.mockRejectedValue(new Error('Table not found'));

      await expect(service.checkBlackout('tenant-1')).rejects.toThrow('Table not found');
    });
  });

  // ==================== Tenant Isolation ====================

  describe('tenant isolation', () => {
    it('createWindow should bind tenant_id', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 'w-1' }] });

      await service.createWindow({
        tenant_id: 'tenant-A',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['tenant-A']));
    });

    it('listWindows should filter by tenant_id', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.listWindows('tenant-B');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-B']
      );
    });

    it('checkBlackout should filter by tenant_id', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await service.checkBlackout('tenant-C');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-C', expect.any(Date)]
      );
    });
  });
});
