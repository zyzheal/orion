/**
 * NotificationRepository - Dedicated comprehensive tests
 *
 * Covers: count(), findAll combinations, create with custom channel,
 * markAsSent/markAsRead edge cases
 */

import { NotificationRepository, Notification, CreateNotificationInput } from '../NotificationRepository';

describe('NotificationRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: NotificationRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new NotificationRepository(mockDb as any);
  });

  describe('constructor', () => {
    it('should accept a database pool', () => {
      expect(repository).toBeInstanceOf(NotificationRepository);
    });
  });

  describe('findById', () => {
    it('should return notification when found', async () => {
      const mockRow: Notification = {
        id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert',
        title: 'Alert', message: 'msg', channel: 'in-app',
        status: 'sent', sent_at: new Date(), read_at: null, created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('n1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM notifications WHERE id = $1'),
        ['n1', '__system__']
      );
    });

    it('should return null when notification not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle multiple rows by returning first', async () => {
      const mockRows = [{ id: 'n1' }, { id: 'n2' }];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findById('n1');

      expect(result).toEqual({ id: 'n1' });
    });
  });

  describe('findAll', () => {
    it('should return all notifications with ORDER BY created_at DESC when no options', async () => {
      const mockRows = [{ id: 'n1' }, { id: 'n2' }];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll();

      expect(result).toEqual(mockRows);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('SELECT * FROM notifications');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__']);
    });

    it('should filter by userId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ userId: 'u1' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('user_id = $2');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 'u1']);
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ status: 'read' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('status = $2');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 'read']);
    });

    it('should combine userId and status filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ userId: 'u1', status: 'sent' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('user_id = $2');
      expect(sql).toContain('status = $3');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('AND');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 'u1', 'sent']);
    });

    it('should apply limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ limit: 10 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT $2');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 10]);
    });

    it('should apply offset', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ offset: 20 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('OFFSET $2');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 20]);
    });

    it('should combine userId, status, limit, and offset', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ userId: 'u1', status: 'sent', limit: 5, offset: 10 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('WHERE');
      expect(sql).toContain('LIMIT');
      expect(sql).toContain('OFFSET');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 'u1', 'sent', 5, 10]);
    });

    it('should return empty array when no results', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAll({ userId: 'unknown' });

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should insert with pending status and default in-app channel', async () => {
      const mockRow = { id: 'n1', status: 'pending', channel: 'in-app' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const input: CreateNotificationInput = {
        tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'T', message: 'M',
      };
      const result = await repository.create(input);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO notifications');
      expect(sql).toContain("'pending'");
      expect(sql).toContain('RETURNING *');
      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual(['__system__', 'u1', 'alert', 'T', 'M', 'in-app']);
    });

    it('should use custom channel when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'n1', channel: 'email' }] });

      const input: CreateNotificationInput = {
        tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'T', message: 'M',
        channel: 'email',
      };
      await repository.create(input);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toBe('email');
    });

    it('should use slack channel when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'n1', channel: 'slack' }] });

      const input: CreateNotificationInput = {
        tenant_id: 't1', user_id: 'u1', type: 'info', title: 'T', message: 'M',
        channel: 'slack',
      };
      await repository.create(input);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toBe('slack');
    });
  });

  describe('markAsSent', () => {
    it('should update status to sent and set sent_at', async () => {
      const mockRow = { id: 'n1', status: 'sent', sent_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.markAsSent('n1');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'sent'");
      expect(sql).toContain('sent_at = NOW()');
      expect(sql).toContain('RETURNING *');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['n1', '__system__']);
    });

    it('should return null when notification not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.markAsSent('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should update status to read and set read_at', async () => {
      const mockRow = { id: 'n1', status: 'read', read_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.markAsRead('n1');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'read'");
      expect(sql).toContain('read_at = NOW()');
      expect(sql).toContain('RETURNING *');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['n1', '__system__']);
    });

    it('should return null when notification not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.markAsRead('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of sent (unread) notifications', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '7' }] });

      const result = await repository.getUnreadCount('u1');

      expect(result).toBe(7);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['u1', '__system__']
      );
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'sent'");
      expect(sql).toContain('user_id = $1');
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await repository.getUnreadCount('u1');

      expect(result).toBe(0);
    });

    it('should parse count as integer', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '123' }] });

      const result = await repository.getUnreadCount('u1');

      expect(result).toBe(123);
      expect(typeof result).toBe('number');
    });
  });

  describe('count', () => {
    it('should return total count when no options provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repository.count();

      expect(result).toBe(42);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('SELECT COUNT(*) as count FROM notifications');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__']);
    });

    it('should filter by userId when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repository.count({ userId: 'u1' });

      expect(result).toBe(5);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('user_id = $2');
      expect(mockDb.query.mock.calls[0][1]).toEqual(['__system__', 'u1']);
    });

    it('should return 0 when no notifications exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await repository.count();

      expect(result).toBe(0);
    });

    it('should parse count as integer', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '999' }] });

      const result = await repository.count();

      expect(typeof result).toBe('number');
      expect(result).toBe(999);
    });
  });
});
