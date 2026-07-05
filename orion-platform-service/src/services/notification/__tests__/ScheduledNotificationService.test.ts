/**
 * ScheduledNotificationService - Comprehensive tests
 *
 * Covers:
 * - Cron expression parsing with cron-parser
 * - DND (Do Not Disturb) multi-timezone support
 * - Schedule validation
 * - Legacy one-shot scheduled notification CRUD
 */

import { ScheduledNotificationService, ScheduledNotificationServiceError } from '../ScheduledNotificationService';
import { ScheduledNotificationRepository, ScheduledNotification, CreateScheduledNotificationInput, UpdateScheduledNotificationInput } from '../../repositories/ScheduledNotificationRepository';

describe('ScheduledNotificationService', () => {
  let mockRepository: jest.Mocked<ScheduledNotificationRepository>;
  let service: ScheduledNotificationService;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findPendingByTimeRange: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      markAsSent: jest.fn(),
      cancel: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findByUser: jest.fn(),
      upsert: jest.fn(),
      deleteByUser: jest.fn(),
      findActiveUsers: jest.fn(),
    } as unknown as jest.Mocked<ScheduledNotificationRepository>;

    service = new ScheduledNotificationService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ================================================================
  // Legacy One-shot Scheduled Notification CRUD
  // ================================================================

  describe('createScheduledNotification', () => {
    it('should create a scheduled notification with required fields', async () => {
      const input: CreateScheduledNotificationInput = {
        user_id: 'user-1',
        type: 'alert',
        title: 'Test',
        message: 'Message',
        scheduled_at: new Date('2026-07-03T10:00:00Z'),
      };

      const mockNotification: ScheduledNotification = {
        id: 'sn-1',
        tenant_id: 't1',
        user_id: 'user-1',
        template_id: null,
        type: 'alert',
        title: 'Test',
        message: 'Message',
        channel: 'in-app',
        scheduled_at: new Date('2026-07-03T10:00:00Z'),
        status: 'pending',
        sent_at: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockNotification);

      const result = await service.createScheduledNotification(input);

      expect(result).toEqual(mockNotification);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw when user_id is missing', async () => {
      await expect(service.createScheduledNotification({
        user_id: '',
        type: 'alert',
        title: 'Test',
        message: 'Message',
        scheduled_at: new Date(),
      })).rejects.toThrow('user_id, type, title, message, and scheduled_at are required');
    });

    it('should throw when type is missing', async () => {
      await expect(service.createScheduledNotification({
        user_id: 'user-1',
        type: '',
        title: 'Test',
        message: 'Message',
        scheduled_at: new Date(),
      })).rejects.toThrow('user_id, type, title, message, and scheduled_at are required');
    });

    it('should throw when title is missing', async () => {
      await expect(service.createScheduledNotification({
        user_id: 'user-1',
        type: 'alert',
        title: '',
        message: 'Message',
        scheduled_at: new Date(),
      })).rejects.toThrow('user_id, type, title, message, and scheduled_at are required');
    });

    it('should throw when message is missing', async () => {
      await expect(service.createScheduledNotification({
        user_id: 'user-1',
        type: 'alert',
        title: 'Test',
        message: '',
        scheduled_at: new Date(),
      })).rejects.toThrow('user_id, type, title, message, and scheduled_at are required');
    });

    it('should throw when scheduled_at is missing', async () => {
      await expect(service.createScheduledNotification({
        user_id: 'user-1',
        type: 'alert',
        title: 'Test',
        message: 'Message',
        scheduled_at: undefined as any,
      })).rejects.toThrow('user_id, type, title, message, and scheduled_at are required');
    });
  });

  describe('getScheduledNotification', () => {
    it('should return notification when found', async () => {
      const mockNotification: ScheduledNotification = {
        id: 'sn-1',
        tenant_id: 't1',
        user_id: 'user-1',
        template_id: null,
        type: 'alert',
        title: 'Test',
        message: 'Message',
        channel: 'in-app',
        scheduled_at: new Date(),
        status: 'pending',
        sent_at: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockNotification);

      const result = await service.getScheduledNotification('sn-1');

      expect(result).toEqual(mockNotification);
      expect(mockRepository.findById).toHaveBeenCalledWith('sn-1');
    });

    it('should throw NOT_FOUND when notification does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getScheduledNotification('missing')).rejects.toThrow(ScheduledNotificationServiceError);
      await expect(service.getScheduledNotification('missing')).rejects.toThrow('Scheduled notification not found: missing');
    });
  });

  describe('listScheduledNotifications', () => {
    it('should return all notifications when no options', async () => {
      const notifications: ScheduledNotification[] = [{
        id: 'sn-1',
        tenant_id: 't1',
        user_id: 'user-1',
        template_id: null,
        type: 'alert',
        title: 'Test',
        message: 'Message',
        channel: 'in-app',
        scheduled_at: new Date(),
        status: 'pending',
        sent_at: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      }];

      mockRepository.findAll.mockResolvedValue(notifications);

      const result = await service.listScheduledNotifications();

      expect(result).toEqual(notifications);
      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should pass userId filter to repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.listScheduledNotifications({ userId: 'user-1' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('should pass status filter to repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.listScheduledNotifications({ status: 'pending' });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('should pass limit and offset to repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.listScheduledNotifications({ limit: 10, offset: 20 });

      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 10, offset: 20 });
    });
  });

  describe('updateScheduledNotification', () => {
    it('should update and return notification', async () => {
      const mockNotification: ScheduledNotification = {
        id: 'sn-1',
        tenant_id: 't1',
        user_id: 'user-1',
        template_id: null,
        type: 'alert',
        title: 'Updated',
        message: 'Updated message',
        channel: 'in-app',
        scheduled_at: new Date(),
        status: 'pending',
        sent_at: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.update.mockResolvedValue(mockNotification);

      const result = await service.updateScheduledNotification('sn-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
      expect(mockRepository.update).toHaveBeenCalledWith('sn-1', { title: 'Updated' });
    });

    it('should throw NOT_FOUND when updating non-existent notification', async () => {
      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateScheduledNotification('missing', { title: 'X' }))
        .rejects.toThrow('Scheduled notification not found: missing');
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel notification', async () => {
      mockRepository.cancel.mockResolvedValue(true);

      await service.cancelScheduledNotification('sn-1');

      expect(mockRepository.cancel).toHaveBeenCalledWith('sn-1');
    });

    it('should throw NOT_FOUND when cancelling non-existent or already processed notification', async () => {
      mockRepository.cancel.mockResolvedValue(false);

      await expect(service.cancelScheduledNotification('missing')).rejects.toThrow(
        'Scheduled notification not found or already processed: missing'
      );
    });
  });

  describe('deleteScheduledNotification', () => {
    it('should delete notification', async () => {
      mockRepository.delete.mockResolvedValue(true);

      await service.deleteScheduledNotification('sn-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('sn-1');
    });

    it('should throw NOT_FOUND when deleting non-existent notification', async () => {
      mockRepository.delete.mockResolvedValue(false);

      await expect(service.deleteScheduledNotification('missing')).rejects.toThrow(
        'Scheduled notification not found: missing'
      );
    });
});
