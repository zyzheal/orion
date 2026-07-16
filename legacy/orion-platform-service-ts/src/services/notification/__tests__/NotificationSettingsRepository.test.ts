/**
 * NotificationSettingsRepository - Dedicated comprehensive tests
 *
 * Covers: upsert default values for all 20+ fields, upsert with explicit values,
 * findByUser edge cases
 */

import { NotificationSettingsRepository, NotificationSettings, CreateNotificationSettingsInput } from '../NotificationSettingsRepository';

describe('NotificationSettingsRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: NotificationSettingsRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new NotificationSettingsRepository(mockDb as any);
  });

  describe('constructor', () => {
    it('should accept a database pool', () => {
      expect(repository).toBeInstanceOf(NotificationSettingsRepository);
    });
  });

  describe('findByUser', () => {
    it('should return settings when found', async () => {
      const mockRow: NotificationSettings = {
        id: 'ns-1', user_id: 'u1', tenant_id: 't1',
        email_enabled: true, sms_enabled: false, webhook_enabled: false, webhook_url: null,
        pipeline_completed: true, pipeline_failed: true, ticket_assigned: true, ticket_escalated: true,
        sla_warning: true, sla_breached: true, alert_triggered: true, deployment_succeed: true,
        deployment_failed: true, system_alert: true, comment_mention: true, transfer_request: true,
        digest_enabled: false, digest_frequency: 'daily', quiet_hours_start: null, quiet_hours_end: null,
        created_at: new Date(), updated_at: new Date(),
      };
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

    it('should return null when rows is empty', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByUser('unknown', 't1');

      expect(result).toBeNull();
    });

    it('should query with different tenant ids', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      await repository.findByUser('u1', 'tenant-abc');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['u1', 'tenant-abc']
      );
    });
  });

  describe('upsert', () => {
    it('should insert with all default values when only user_id and tenant_id provided', async () => {
      const mockRow = { id: 'ns-1' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const input: CreateNotificationSettingsInput = { user_id: 'u1', tenant_id: 't1' };
      const result = await repository.upsert(input);

      expect(result).toEqual(mockRow);
      const params = mockDb.query.mock.calls[0][1];
      // Verify all 22 positional parameters
      expect(params[0]).toBe('u1');    // user_id
      expect(params[1]).toBe('t1');    // tenant_id
      expect(params[2]).toBe(true);    // email_enabled default
      expect(params[3]).toBe(false);   // sms_enabled default
      expect(params[4]).toBe(false);   // webhook_enabled default
      expect(params[5]).toBeNull();    // webhook_url default
      expect(params[6]).toBe(true);    // pipeline_completed default
      expect(params[7]).toBe(true);    // pipeline_failed default
      expect(params[8]).toBe(true);    // ticket_assigned default
      expect(params[9]).toBe(true);    // ticket_escalated default
      expect(params[10]).toBe(true);   // sla_warning default
      expect(params[11]).toBe(true);   // sla_breached default
      expect(params[12]).toBe(true);   // alert_triggered default
      expect(params[13]).toBe(true);   // deployment_succeed default
      expect(params[14]).toBe(true);   // deployment_failed default
      expect(params[15]).toBe(true);   // system_alert default
      expect(params[16]).toBe(true);   // comment_mention default
      expect(params[17]).toBe(true);   // transfer_request default
      expect(params[18]).toBe(false);  // digest_enabled default
      expect(params[19]).toBe('daily'); // digest_frequency default
      expect(params[20]).toBeNull();   // quiet_hours_start default
      expect(params[21]).toBeNull();   // quiet_hours_end default
    });

    it('should use explicit values when all fields provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      const input: CreateNotificationSettingsInput = {
        user_id: 'u1', tenant_id: 't1',
        email_enabled: false, sms_enabled: true, webhook_enabled: true,
        webhook_url: 'https://hooks.example.com',
        pipeline_completed: false, pipeline_failed: false,
        ticket_assigned: false, ticket_escalated: false,
        sla_warning: false, sla_breached: false,
        alert_triggered: false, deployment_succeed: false,
        deployment_failed: false, system_alert: false,
        comment_mention: false, transfer_request: false,
        digest_enabled: true, digest_frequency: 'hourly',
        quiet_hours_start: '22:00', quiet_hours_end: '08:00',
      };
      await repository.upsert(input);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('u1');
      expect(params[1]).toBe('t1');
      expect(params[2]).toBe(false);   // email_enabled
      expect(params[3]).toBe(true);    // sms_enabled
      expect(params[4]).toBe(true);    // webhook_enabled
      expect(params[5]).toBe('https://hooks.example.com'); // webhook_url
      expect(params[6]).toBe(false);   // pipeline_completed
      expect(params[7]).toBe(false);   // pipeline_failed
      expect(params[8]).toBe(false);   // ticket_assigned
      expect(params[9]).toBe(false);   // ticket_escalated
      expect(params[10]).toBe(false);  // sla_warning
      expect(params[11]).toBe(false);  // sla_breached
      expect(params[12]).toBe(false);  // alert_triggered
      expect(params[13]).toBe(false);  // deployment_succeed
      expect(params[14]).toBe(false);  // deployment_failed
      expect(params[15]).toBe(false);  // system_alert
      expect(params[16]).toBe(false);  // comment_mention
      expect(params[17]).toBe(false);  // transfer_request
      expect(params[18]).toBe(true);   // digest_enabled
      expect(params[19]).toBe('hourly'); // digest_frequency
      expect(params[20]).toBe('22:00'); // quiet_hours_start
      expect(params[21]).toBe('08:00'); // quiet_hours_end
    });

    it('should generate correct SQL with ON CONFLICT upsert', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      await repository.upsert({ user_id: 'u1', tenant_id: 't1' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO notification_settings');
      expect(sql).toContain('ON CONFLICT (user_id, tenant_id)');
      expect(sql).toContain('DO UPDATE SET');
      expect(sql).toContain('RETURNING *');
      expect(sql).toContain('updated_at = NOW()');
    });

    it('should include all updatable columns in DO UPDATE SET', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      await repository.upsert({ user_id: 'u1', tenant_id: 't1' });

      const sql = mockDb.query.mock.calls[0][0];
      // Verify key columns are in the UPDATE SET clause
      expect(sql).toContain('email_enabled = EXCLUDED.email_enabled');
      expect(sql).toContain('sms_enabled = EXCLUDED.sms_enabled');
      expect(sql).toContain('webhook_enabled = EXCLUDED.webhook_enabled');
      expect(sql).toContain('webhook_url = EXCLUDED.webhook_url');
      expect(sql).toContain('pipeline_completed = EXCLUDED.pipeline_completed');
      expect(sql).toContain('pipeline_failed = EXCLUDED.pipeline_failed');
      expect(sql).toContain('ticket_assigned = EXCLUDED.ticket_assigned');
      expect(sql).toContain('ticket_escalated = EXCLUDED.ticket_escalated');
      expect(sql).toContain('sla_warning = EXCLUDED.sla_warning');
      expect(sql).toContain('sla_breached = EXCLUDED.sla_breached');
      expect(sql).toContain('alert_triggered = EXCLUDED.alert_triggered');
      expect(sql).toContain('deployment_succeed = EXCLUDED.deployment_succeed');
      expect(sql).toContain('deployment_failed = EXCLUDED.deployment_failed');
      expect(sql).toContain('system_alert = EXCLUDED.system_alert');
      expect(sql).toContain('comment_mention = EXCLUDED.comment_mention');
      expect(sql).toContain('transfer_request = EXCLUDED.transfer_request');
      expect(sql).toContain('digest_enabled = EXCLUDED.digest_enabled');
      expect(sql).toContain('digest_frequency = EXCLUDED.digest_frequency');
      expect(sql).toContain('quiet_hours_start = EXCLUDED.quiet_hours_start');
      expect(sql).toContain('quiet_hours_end = EXCLUDED.quiet_hours_end');
    });

    it('should handle partial overrides correctly', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      const input: CreateNotificationSettingsInput = {
        user_id: 'u1', tenant_id: 't1',
        email_enabled: false,
        webhook_url: 'https://custom.hook',
        digest_frequency: 'weekly',
      };
      await repository.upsert(input);

      const params = mockDb.query.mock.calls[0][1];
      // Overridden
      expect(params[2]).toBe(false);   // email_enabled overridden
      expect(params[5]).toBe('https://custom.hook'); // webhook_url overridden
      expect(params[19]).toBe('weekly'); // digest_frequency overridden
      // Defaults
      expect(params[3]).toBe(false);   // sms_enabled default
      expect(params[4]).toBe(false);   // webhook_enabled default
      expect(params[6]).toBe(true);    // pipeline_completed default
      expect(params[18]).toBe(false);  // digest_enabled default
      expect(params[20]).toBeNull();   // quiet_hours_start default
    });

    it('should pass 22 parameters for the query', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ns-1' }] });

      await repository.upsert({ user_id: 'u1', tenant_id: 't1' });

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toHaveLength(22);
    });
  });
});
