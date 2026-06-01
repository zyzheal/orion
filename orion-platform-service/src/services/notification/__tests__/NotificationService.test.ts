/**
 * NotificationService Tests
 */

import { NotificationService, NotificationServiceError } from '../NotificationService';
import { NotificationRepository, Notification, CreateNotificationInput } from '../NotificationRepository';

describe('NotificationService', () => {
  let mockRepository: jest.Mocked<NotificationRepository>;
  let service: NotificationService;

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      markAsSent: jest.fn(),
      markAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    } as unknown as jest.Mocked<NotificationRepository>;

    service = new NotificationService(mockRepository);
  });

  describe('send', () => {
    it('should create a notification', async () => {
      const input: CreateNotificationInput = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        type: 'alert',
        title: 'Test Alert',
        message: 'Test message',
      };
      const mockNotification: Notification = {
        id: 'notif-1',
        ...input,
        channel: 'in-app',
        status: 'pending',
        sent_at: null,
        read_at: null,
        created_at: new Date(),
      };
      await mockRepository.create.mockResolvedValue(mockNotification);

      const result = await service.send(input);

      expect(result).toEqual(mockNotification);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw when tenant_id is missing', async () => {
      const input: CreateNotificationInput = {
        tenant_id: '',
        user_id: 'user-1',
        type: 'alert',
        title: 'Test',
        message: 'Test',
      };

      await expect(service.send(input)).rejects.toThrow(NotificationServiceError);
      await expect(service.send(input)).rejects.toThrow('Tenant/User ID required');
    });

    it('should throw when user_id is missing', async () => {
      const input: CreateNotificationInput = {
        tenant_id: 'tenant-1',
        user_id: '',
        type: 'alert',
        title: 'Test',
        message: 'Test',
      };

      await expect(service.send(input)).rejects.toThrow(NotificationServiceError);
    });
  });

  describe('getNotifications', () => {
    it('should return notifications for a user', async () => {
      const mockNotifications: Notification[] = [
        { id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M', channel: 'in-app', status: 'sent', sent_at: new Date(), read_at: null, created_at: new Date() },
        { id: 'n2', tenant_id: 't1', user_id: 'u1', type: 'info', title: 'B', message: 'M', channel: 'email', status: 'sent', sent_at: new Date(), read_at: null, created_at: new Date() },
      ];
      await mockRepository.findAll.mockResolvedValue(mockNotifications);

      const result = await service.getNotifications('u1', 10);

      expect(result).toEqual(mockNotifications);
      expect(mockRepository.findAll).toHaveBeenCalledWith({ userId: 'u1', limit: 10 });
    });

    it('should return empty array when no notifications', async () => {
      await mockRepository.findAll.mockResolvedValue([]);

      const result = await service.getNotifications('u1');

      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const existing: Notification = {
        id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M',
        channel: 'in-app', status: 'sent', sent_at: new Date(), read_at: null, created_at: new Date(),
      };
      const readNotification: Notification = {
        ...existing,
        status: 'read',
        read_at: new Date(),
      };
      await mockRepository.findById.mockResolvedValue(existing);
      await mockRepository.markAsRead.mockResolvedValue(readNotification);

      const result = await service.markAsRead('n1');

      expect(result.status).toBe('read');
      expect(mockRepository.markAsRead).toHaveBeenCalledWith('n1');
    });

    it('should throw when notification not found', async () => {
      await mockRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent')).rejects.toThrow(NotificationServiceError);
      await expect(service.markAsRead('non-existent')).rejects.toThrow('Notification not found');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      await mockRepository.getUnreadCount.mockResolvedValue(5);

      const result = await service.getUnreadCount('u1');

      expect(result).toBe(5);
      expect(mockRepository.getUnreadCount).toHaveBeenCalledWith('u1');
    });

    it('should return 0 when no unread notifications', async () => {
      await mockRepository.getUnreadCount.mockResolvedValue(0);

      const result = await service.getUnreadCount('u1');

      expect(result).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should send notifications to multiple users', async () => {
      await mockRepository.create.mockResolvedValue({
        id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'Broadcast', message: 'Hello',
        channel: 'in-app', status: 'pending', sent_at: null, read_at: null, created_at: new Date(),
      });

      const result = await service.broadcast('t1', ['u1', 'u2', 'u3'], 'alert', 'Broadcast', 'Hello');

      expect(result).toBe(3);
      expect(mockRepository.create).toHaveBeenCalledTimes(3);
    });

    it('should return 0 for empty user list', async () => {
      const result = await service.broadcast('t1', [], 'alert', 'Broadcast', 'Hello');

      expect(result).toBe(0);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe('NotificationRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: NotificationRepository;

  beforeEach(async () => {
    mockDb = { query: jest.fn() };
    repository = new NotificationRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return notification when found', async () => {
      const mockRow = { id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('n1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM notifications WHERE id = $1', ['n1']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all notifications ordered by created_at', async () => {
      const mockRows = [{ id: 'n1' }, { id: 'n2' }];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll();

      expect(result).toEqual(mockRows);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should filter by userId when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ userId: 'u1' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('user_id = $1');
    });

    it('should filter by status when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ status: 'sent' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('status = $1');
    });

    it('should apply limit when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ limit: 10 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT $');
    });
  });

  describe('create', () => {
    it('should insert notification with pending status', async () => {
      const mockRow = { id: 'n1', tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M', status: 'pending' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const input: CreateNotificationInput = { tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M' };
      const result = await repository.create(input);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO notifications');
      expect(sql).toContain('RETURNING *');
    });

    it('should default channel to in-app', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'n1' }] });

      const input: CreateNotificationInput = { tenant_id: 't1', user_id: 'u1', type: 'alert', title: 'A', message: 'M' };
      await repository.create(input);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[5]).toBe('in-app');
    });
  });

  describe('markAsSent', () => {
    it('should update status to sent', async () => {
      const mockRow = { id: 'n1', status: 'sent', sent_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.markAsSent('n1');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'sent'");
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.markAsSent('missing');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should update status to read', async () => {
      const mockRow = { id: 'n1', status: 'read', read_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.markAsRead('n1');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'read'");
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '7' }] });

      const result = await repository.getUnreadCount('u1');

      expect(result).toBe(7);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('COUNT(*)');
      expect(sql).toContain("status = 'sent'");
    });
  });
});
