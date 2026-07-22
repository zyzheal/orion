/**
 * DNDService 单元测试
 *
 * 测试免打扰设置管理：CRUD、toggleDND、isInDndPeriod 时间判断逻辑。
 */

import { DNDService, DNDSettings } from '../DNDService';

describe('DNDService', () => {
  let service: DNDService;
  let mockPool: any;

  const sampleDbRow = {
    id: 'dnd-1',
    user_id: 'user-1',
    enabled: true,
    start_time: '22:00',
    end_time: '08:00',
    repeat_days: [1, 2, 3, 4, 5],
    allow_critical: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new DNDService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== getSettings ====================

  describe('getSettings', () => {
    it('should return DND settings for user', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleDbRow], rowCount: 1 });

      const result = await service.getSettings('user-1');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.enabled).toBe(true);
      expect(result!.startTime).toBe('22:00');
      expect(result!.endTime).toBe('08:00');
      expect(result!.repeatDays).toEqual([1, 2, 3, 4, 5]);
      expect(result!.allowCritical).toBe(true);
    });

    it('should return null when no settings exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getSettings('user-1');

      expect(result).toBeNull();
    });

    it('should map row fields correctly', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleDbRow], rowCount: 1 });

      const result = await service.getSettings('user-1');

      expect(result!.id).toBe('dnd-1');
      expect(result!.createdAt).toEqual(new Date('2026-01-01'));
      expect(result!.updatedAt).toEqual(new Date('2026-01-01'));
    });

    it('should default repeatDays when null in DB', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleDbRow, repeat_days: null }],
        rowCount: 1,
      });

      const result = await service.getSettings('user-1');

      expect(result!.repeatDays).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ==================== updateSettings ====================

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      // First call: getSettings (existing)
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      // Second call: UPDATE
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, enabled: false }],
        rowCount: 1,
      });

      const result = await service.updateSettings('user-1', { enabled: false });

      expect(result.enabled).toBe(false);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query.mock.calls[1][0]).toContain('UPDATE chatops_dnd_settings');
    });

    it('should create new settings when none exist', async () => {
      // getSettings returns null
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // INSERT returns new row
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'new-dnd',
          user_id: 'user-1',
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          repeat_days: [1, 2, 3, 4, 5],
          allow_critical: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await service.updateSettings('user-1', {});

      expect(result.id).toBe('new-dnd');
      expect(mockPool.query.mock.calls[1][0]).toContain('INSERT INTO chatops_dnd_settings');
    });

    it('should update startTime and endTime', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, start_time: '20:00', end_time: '07:00' }],
        rowCount: 1,
      });

      const result = await service.updateSettings('user-1', { startTime: '20:00', endTime: '07:00' });

      expect(result.startTime).toBe('20:00');
      expect(result.endTime).toBe('07:00');
    });

    it('should update repeatDays', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, repeat_days: [1, 3, 5] }],
        rowCount: 1,
      });

      const result = await service.updateSettings('user-1', { repeatDays: [1, 3, 5] });

      expect(result.repeatDays).toEqual([1, 3, 5]);
    });

    it('should update allowCritical', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, allow_critical: false }],
        rowCount: 1,
      });

      const result = await service.updateSettings('user-1', { allowCritical: false });

      expect(result.allowCritical).toBe(false);
    });
  });

  // ==================== toggleDND ====================

  describe('toggleDND', () => {
    it('should enable DND', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, enabled: true }],
        rowCount: 1,
      });

      const result = await service.toggleDND('user-1', true);

      expect(result.enabled).toBe(true);
    });

    it('should disable DND', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [sampleDbRow], rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...sampleDbRow, enabled: false }],
        rowCount: 1,
      });

      const result = await service.toggleDND('user-1', false);

      expect(result.enabled).toBe(false);
    });
  });

  // ==================== isInDndPeriod ====================

  describe('isInDndPeriod', () => {
    it('should return enabled=false when no settings exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.isInDndPeriod('user-1');

      expect(result.enabled).toBe(false);
      expect(result.allowCritical).toBe(true);
    });

    it('should return enabled=false when DND is disabled', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleDbRow, enabled: false }],
        rowCount: 1,
      });

      const result = await service.isInDndPeriod('user-1');

      expect(result.enabled).toBe(false);
      expect(result.allowCritical).toBe(true);
    });

    it('should return DND state based on current time', async () => {
      // Use a known time: 23:30 (within 22:00-08:00 range)
      const mockNow = new Date('2026-06-01T23:30:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);
      // Also mock Date.now
      Date.now = jest.fn(() => mockNow.getTime());

      // getSettings
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleDbRow, enabled: true }],
        rowCount: 1,
      });

      const result = await service.isInDndPeriod('user-1');

      // 23:30 is between 22:00 and 08:00 (cross-midnight), and it's Monday (day 1)
      expect(result.enabled).toBe(true);
      expect(result.allowCritical).toBe(true);
      expect(result.endTime).toBe('08:00');

      jest.restoreAllMocks();
    });

    it('should return enabled=false outside DND hours', async () => {
      // Use 15:00 (outside 22:00-08:00 range)
      const mockNow = new Date('2026-06-01T15:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);
      Date.now = jest.fn(() => mockNow.getTime());

      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleDbRow, enabled: true }],
        rowCount: 1,
      });

      const result = await service.isInDndPeriod('user-1');

      expect(result.enabled).toBe(false);

      jest.restoreAllMocks();
    });

    it('should handle same-day range (e.g., 09:00-17:00)', async () => {
      // Settings: 09:00-17:00
      const sameDayRow = { ...sampleDbRow, start_time: '09:00', end_time: '17:00', repeat_days: [0, 1, 2, 3, 4, 5, 6] };

      // Current time: 12:00
      const mockNow = new Date('2026-06-01T12:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);
      Date.now = jest.fn(() => mockNow.getTime());

      mockPool.query.mockResolvedValue({ rows: [sameDayRow], rowCount: 1 });

      const result = await service.isInDndPeriod('user-1');

      expect(result.enabled).toBe(true);

      jest.restoreAllMocks();
    });

    it('should return enabled=false when day does not match', async () => {
      // Settings: weekdays only [1,2,3,4,5]
      // Current: Sunday (day 0)
      const mockNow = new Date('2026-06-07T23:30:00'); // Sunday
      jest.spyOn(global, 'Date').mockImplementation(() => mockNow as any);
      Date.now = jest.fn(() => mockNow.getTime());

      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleDbRow, enabled: true }],
        rowCount: 1,
      });

      const result = await service.isInDndPeriod('user-1');

      expect(result.enabled).toBe(false);

      jest.restoreAllMocks();
    });
  });
});
