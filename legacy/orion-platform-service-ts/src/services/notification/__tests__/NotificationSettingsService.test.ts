/**
 * NotificationSettingsService Tests
 */

import { NotificationSettingsService, NotificationSettingsServiceError } from '../NotificationSettingsService';
import { NotificationSettingsRepository, NotificationSettings, CreateNotificationSettingsInput } from '../NotificationSettingsRepository';

describe('NotificationSettingsService', () => {
  let mockRepository: jest.Mocked<NotificationSettingsRepository>;
  let service: NotificationSettingsService;

  beforeEach(() => {
    mockRepository = {
      findByUser: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<NotificationSettingsRepository>;

    service = new NotificationSettingsService(mockRepository);
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      const existingSettings: NotificationSettings = {
        id: 'ns-1',
        user_id: 'u1',
        tenant_id: 't1',
        email_enabled: true,
        sms_enabled: false,
        webhook_enabled: false,
        webhook_url: null,
        pipeline_completed: true,
        pipeline_failed: true,
        ticket_assigned: true,
        ticket_escalated: true,
        sla_warning: true,
        sla_breached: true,
        alert_triggered: true,
        deployment_succeed: true,
        deployment_failed: true,
        system_alert: true,
        comment_mention: true,
        transfer_request: true,
        digest_enabled: false,
        digest_frequency: 'daily',
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.findByUser.mockResolvedValue(existingSettings);

      const result = await service.getSettings('u1', 't1');

      expect(result).toEqual(existingSettings);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('u1', 't1');
    });

    it('should create default settings when none exist', async () => {
      mockRepository.findByUser.mockResolvedValue(null);
      const defaultSettings: NotificationSettings = {
        id: 'ns-new',
        user_id: 'u1',
        tenant_id: 't1',
        email_enabled: true,
        sms_enabled: false,
        webhook_enabled: false,
        webhook_url: null,
        pipeline_completed: true,
        pipeline_failed: true,
        ticket_assigned: true,
        ticket_escalated: true,
        sla_warning: true,
        sla_breached: true,
        alert_triggered: true,
        deployment_succeed: true,
        deployment_failed: true,
        system_alert: true,
        comment_mention: true,
        transfer_request: true,
        digest_enabled: false,
        digest_frequency: 'daily',
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.upsert.mockResolvedValue(defaultSettings);

      const result = await service.getSettings('u1', 't1');

      expect(result).toEqual(defaultSettings);
      expect(mockRepository.upsert).toHaveBeenCalledWith({ user_id: 'u1', tenant_id: 't1' });
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const existing: NotificationSettings = {
        id: 'ns-1', user_id: 'u1', tenant_id: 't1',
        email_enabled: true, sms_enabled: false, webhook_enabled: false, webhook_url: null,
        pipeline_completed: true, pipeline_failed: true, ticket_assigned: true, ticket_escalated: true,
        sla_warning: true, sla_breached: true, alert_triggered: true, deployment_succeed: true,
        deployment_failed: true, system_alert: true, comment_mention: true, transfer_request: true,
        digest_enabled: false, digest_frequency: 'daily', quiet_hours_start: null, quiet_hours_end: null,
        created_at: new Date(), updated_at: new Date(),
      };
      const updated: NotificationSettings = { ...existing, email_enabled: false };
      mockRepository.findByUser.mockResolvedValue(existing);
      mockRepository.upsert.mockResolvedValue(updated);

      const result = await service.updateSettings('u1', 't1', { email_enabled: false });

      expect(result.email_enabled).toBe(false);
      expect(mockRepository.upsert).toHaveBeenCalledWith({
        user_id: 'u1', tenant_id: 't1', email_enabled: false,
      });
    });

    it('should create settings if none exist', async () => {
      mockRepository.findByUser.mockResolvedValue(null);
      const newSettings: NotificationSettings = {
        id: 'ns-new', user_id: 'u1', tenant_id: 't1',
        email_enabled: false, sms_enabled: true, webhook_enabled: false, webhook_url: null,
        pipeline_completed: true, pipeline_failed: true, ticket_assigned: true, ticket_escalated: true,
        sla_warning: true, sla_breached: true, alert_triggered: true, deployment_succeed: true,
        deployment_failed: true, system_alert: true, comment_mention: true, transfer_request: true,
        digest_enabled: false, digest_frequency: 'daily', quiet_hours_start: null, quiet_hours_end: null,
        created_at: new Date(), updated_at: new Date(),
      };
      mockRepository.upsert.mockResolvedValue(newSettings);

      const result = await service.updateSettings('u1', 't1', { email_enabled: false, sms_enabled: true });

      expect(result.email_enabled).toBe(false);
      expect(result.sms_enabled).toBe(true);
    });
  });
});

describe('NotificationSettingsRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: NotificationSettingsRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new NotificationSettingsRepository(mockDb as any);
  });

  describe('findByUser', () => {
    it('should return settings when found', async () => {
      const mockRow = { id: 'ns-1', user_id: 'u1', tenant_id: 't1', email_enabled: true };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findByUser('u1', 't1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM notification_settings WHERE user_id = $1 AND tenant_id = $2',
        ['u1', 't1']
      );
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByUser('u1', 't1');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should insert or update settings', async () => {
      const mockRow = { id: 'ns-1', user_id: 'u1', tenant_id: 't1', email_enabled: false };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const input: CreateNotificationSettingsInput = { user_id: 'u1', tenant_id: 't1', email_enabled: false };
      const result = await repository.upsert(input);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
    });

    it('should use default values for omitted fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      const input: CreateNotificationSettingsInput = { user_id: 'u1', tenant_id: 't1' };
      await repository.upsert(input);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBe(true);  // email_enabled default
      expect(params[3]).toBe(false); // sms_enabled default
      expect(params[19]).toBe('daily'); // digest_frequency default
    });
  });
});
