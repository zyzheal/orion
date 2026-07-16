/**
 * MonitoringRepository - 数据仓库层单元测试
 *
 * 测试覆盖: 监控配置、告警、告警规则、通知渠道、升级策略、通知历史、统计数据
 */

import { MonitoringRepository } from '../MonitoringRepository';

describe('MonitoringRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: MonitoringRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new MonitoringRepository(mockDb as any);
  });

  // ==================== Monitoring Configs ====================

  describe('findConfigById', () => {
    it('should return config by id', async () => {
      const mockConfig = { id: 'config-1', name: 'CPU Monitor' };
      mockDb.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await repository.findConfigById('config-1');

      expect(result).toEqual(mockConfig);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findConfigById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAllConfigs', () => {
    it('should return all configs without filter', async () => {
      const mockConfigs = [{ id: 'c1' }, { id: 'c2' }];
      mockDb.query.mockResolvedValue({ rows: mockConfigs });

      const result = await repository.findAllConfigs();

      expect(result).toEqual(mockConfigs);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllConfigs('t1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });
  });

  describe('createConfig', () => {
    it('should create a config with all fields', async () => {
      const mockConfig = { id: 'config-1', name: 'CPU Monitor' };
      mockDb.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await repository.createConfig({
        tenant_id: 't1',
        name: 'CPU Monitor',
        type: 'metric',
        target: 'server-1',
        metric: 'cpu_usage',
        threshold: { warning: 80, critical: 95 },
        interval_sec: 30,
        enabled: true,
        notification_channels: ['email', 'slack'],
      });

      expect(result).toEqual(mockConfig);
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'config-1' }] });

      await repository.createConfig({
        tenant_id: 't1',
        name: 'CPU Monitor',
        type: 'metric',
        target: 'server-1',
        metric: 'cpu_usage',
        threshold: { warning: 80 },
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[6]).toBe(60); // default interval_sec
      expect(params[7]).toBe(true); // default enabled
      expect(params[8]).toEqual([]); // default notification_channels
    });
  });

  describe('updateConfig', () => {
    it('should update config name', async () => {
      const mockUpdated = { id: 'config-1', name: 'Updated' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateConfig('config-1', { name: 'Updated' });

      expect(result).toEqual(mockUpdated);
    });

    it('should return current config when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'config-1' }] });

      const result = await repository.updateConfig('config-1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateConfig('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('deleteConfig', () => {
    it('should delete an existing config', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteConfig('config-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteConfig('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Alerts ====================

  describe('findAlertById', () => {
    it('should return alert by id', async () => {
      const mockAlert = { id: 'alert-1', title: 'High CPU' };
      mockDb.query.mockResolvedValue({ rows: [mockAlert] });

      const result = await repository.findAlertById('alert-1');

      expect(result).toEqual(mockAlert);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAlertById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAllAlerts', () => {
    it('should return all alerts without filter', async () => {
      const mockAlerts = [{ id: 'a1' }, { id: 'a2' }];
      mockDb.query.mockResolvedValue({ rows: mockAlerts });

      const result = await repository.findAllAlerts();

      expect(result).toEqual(mockAlerts);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllAlerts({ tenantId: 't1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllAlerts({ status: 'firing' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['firing']
      );
    });

    it('should filter by severity', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllAlerts({ severity: 'critical' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $1'),
        ['critical']
      );
    });

    it('should apply limit and offset', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllAlerts({ limit: 10, offset: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20]
      );
    });
  });

  describe('countAlerts', () => {
    it('should return total count', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repository.countAlerts();

      expect(result).toBe(42);
    });

    it('should return filtered count', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repository.countAlerts({ tenantId: 't1', status: 'firing' });

      expect(result).toBe(5);
    });
  });

  describe('createAlert', () => {
    it('should create an alert', async () => {
      const mockAlert = { id: 'alert-1', title: 'High CPU' };
      mockDb.query.mockResolvedValue({ rows: [mockAlert] });

      const result = await repository.createAlert({
        tenant_id: 't1',
        config_id: 'config-1',
        severity: 'critical',
        title: 'High CPU',
        message: 'CPU usage above 95%',
        value: { cpu: 98 },
      });

      expect(result).toEqual(mockAlert);
    });

    it('should create alert with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'alert-1' }] });

      await repository.createAlert({
        tenant_id: 't1',
        severity: 'warning',
        title: 'Test Alert',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[1]).toBeNull(); // config_id
      expect(params[4]).toBeNull(); // message
      expect(params[5]).toBeNull(); // value
    });
  });

  describe('updateAlert', () => {
    it('should update alert status', async () => {
      const mockUpdated = { id: 'alert-1', status: 'resolved' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateAlert('alert-1', { status: 'resolved' });

      expect(result).toEqual(mockUpdated);
    });

    it('should update alert with acknowledged_by', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'alert-1' }] });

      await repository.updateAlert('alert-1', { acknowledged_by: 'user-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('acknowledged_by'),
        expect.arrayContaining(['user-1', expect.any(Date), 'alert-1'])
      );
    });

    it('should return current alert when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'alert-1' }] });

      const result = await repository.updateAlert('alert-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'alert-1', status: 'acknowledged' }] });

      const result = await repository.acknowledgeAlert('alert-1', 'user-1');

      expect(result).toBeDefined();
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'alert-1', status: 'resolved' }] });

      const result = await repository.resolveAlert('alert-1');

      expect(result).toBeDefined();
    });
  });

  // ==================== Alert Rules ====================

  describe('findAllRules', () => {
    it('should return all rules', async () => {
      const mockRules = [{ id: 'r1' }];
      mockDb.query.mockResolvedValue({ rows: mockRules });

      const result = await repository.findAllRules();

      expect(result).toEqual(mockRules);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllRules('t1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });
  });

  describe('findRuleById', () => {
    it('should return rule by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1' }] });

      const result = await repository.findRuleById('rule-1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findRuleById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createRule', () => {
    it('should create a rule', async () => {
      const mockRule = { id: 'rule-1', name: 'CPU Rule' };
      mockDb.query.mockResolvedValue({ rows: [mockRule] });

      const result = await repository.createRule({
        tenant_id: 't1',
        name: 'CPU Rule',
        metric: 'cpu_usage',
        condition: '>',
        threshold: 90,
        severity: 'critical',
      });

      expect(result).toEqual(mockRule);
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1' }] });

      await repository.createRule({
        tenant_id: 't1',
        name: 'CPU Rule',
        metric: 'cpu_usage',
        condition: '>',
        threshold: 90,
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[5]).toBe('warning'); // default severity
      expect(params[6]).toBe(true); // default enabled
      expect(params[7]).toBe(300000); // default cooldown_ms
    });
  });

  describe('updateRule', () => {
    it('should update rule', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1' }] });

      const result = await repository.updateRule('rule-1', { name: 'Updated' });

      expect(result).toBeDefined();
    });

    it('should return current rule when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1' }] });

      const result = await repository.updateRule('rule-1', {});

      expect(result).toBeDefined();
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteRule('rule-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteRule('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule enabled state', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1', enabled: false }] });

      const result = await repository.toggleRule('rule-1', false);

      expect(result).toBeDefined();
    });
  });

  describe('suppressRule', () => {
    it('should suppress a rule', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1', suppressed: true }] });

      const result = await repository.suppressRule('rule-1');

      expect(result).toBeDefined();
    });
  });

  describe('unsuppressRule', () => {
    it('should unsuppress a rule', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rule-1', suppressed: false }] });

      const result = await repository.unsuppressRule('rule-1');

      expect(result).toBeDefined();
    });
  });

  // ==================== Notification Channels ====================

  describe('findAllChannels', () => {
    it('should return all channels', async () => {
      const mockChannels = [{ id: 'ch1' }];
      mockDb.query.mockResolvedValue({ rows: mockChannels });

      const result = await repository.findAllChannels();

      expect(result).toEqual(mockChannels);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllChannels('t1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });
  });

  describe('findChannelById', () => {
    it('should return channel by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ch1' }] });

      const result = await repository.findChannelById('ch1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findChannelById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createChannel', () => {
    it('should create a channel', async () => {
      const mockChannel = { id: 'ch1', name: 'Slack' };
      mockDb.query.mockResolvedValue({ rows: [mockChannel] });

      const result = await repository.createChannel({
        tenant_id: 't1',
        name: 'Slack',
        type: 'webhook',
        config: { url: 'https://hooks.slack.com' },
      });

      expect(result).toEqual(mockChannel);
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ch1' }] });

      await repository.createChannel({
        tenant_id: 't1',
        name: 'Slack',
        type: 'webhook',
        config: {},
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[4]).toBe(true); // default enabled
      expect(params[5]).toBeNull(); // default severity_filter
    });
  });

  describe('toggleChannel', () => {
    it('should toggle channel enabled state', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ch1', enabled: false }] });

      const result = await repository.toggleChannel('ch1', false);

      expect(result).toBeDefined();
    });
  });

  // ==================== Escalation Policies ====================

  describe('findAllPolicies', () => {
    it('should return all policies', async () => {
      const mockPolicies = [{ id: 'p1' }];
      mockDb.query.mockResolvedValue({ rows: mockPolicies });

      const result = await repository.findAllPolicies();

      expect(result).toEqual(mockPolicies);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllPolicies('t1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });
  });

  describe('findPolicyById', () => {
    it('should return policy by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      const result = await repository.findPolicyById('p1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findPolicyById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createPolicy', () => {
    it('should create a policy', async () => {
      const mockPolicy = { id: 'p1', name: 'On-call Policy' };
      mockDb.query.mockResolvedValue({ rows: [mockPolicy] });

      const result = await repository.createPolicy({
        tenant_id: 't1',
        name: 'On-call Policy',
        steps: [{ delay: 5, channel: 'email' }],
      });

      expect(result).toEqual(mockPolicy);
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'p1' }] });

      await repository.createPolicy({
        tenant_id: 't1',
        name: 'On-call Policy',
        steps: [],
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[3]).toBe(0); // default repeat_count
      expect(params[4]).toBe(true); // default enabled
      expect(params[5]).toBeNull(); // default description
    });
  });

  // ==================== Notification History ====================

  describe('findNotificationHistory', () => {
    it('should return all history', async () => {
      const mockHistory = [{ id: 'h1' }];
      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const result = await repository.findNotificationHistory();

      expect(result).toEqual(mockHistory);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findNotificationHistory({ tenantId: 't1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });

    it('should filter by alertId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findNotificationHistory({ alertId: 'alert-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('alert_id = $1'),
        ['alert-1']
      );
    });

    it('should apply limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findNotificationHistory({ limit: 10 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [10]
      );
    });
  });

  describe('createNotificationHistory', () => {
    it('should create notification history', async () => {
      const mockHistory = { id: 'h1', status: 'sent' };
      mockDb.query.mockResolvedValue({ rows: [mockHistory] });

      const result = await repository.createNotificationHistory({
        tenant_id: 't1',
        alert_id: 'alert-1',
        channel_id: 'ch1',
        channel_type: 'email',
        status: 'sent',
      });

      expect(result).toEqual(mockHistory);
    });

    it('should create with optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'h1' }] });

      await repository.createNotificationHistory({
        tenant_id: 't1',
        alert_id: 'alert-1',
        channel_id: 'ch1',
        channel_type: 'email',
        status: 'failed',
        error_message: 'SMTP error',
        response_payload: '{"error": "timeout"}',
        escalation_step: 2,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO monitoring_notification_history'),
        ['t1', 'alert-1', 'ch1', 'email', 'failed', 'SMTP error', '{"error": "timeout"}', 2]
      );
    });
  });

  // ==================== Stats ====================

  describe('getAlertStats', () => {
    it('should return alert stats', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{
          total: '10',
          firing: '3',
          acknowledged: '2',
          resolved: '5',
          critical: '4',
          warning: '6',
        }],
      });

      const result = await repository.getAlertStats();

      expect(result).toEqual({
        total: 10,
        firing: 3,
        acknowledged: 2,
        resolved: 5,
        critical: 4,
        warning: 6,
      });
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [{}] });

      await repository.getAlertStats('t1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['t1']
      );
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findConfigById('config-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.createAlert({
        tenant_id: 't1',
        severity: 'critical',
        title: 'Test',
      })).rejects.toThrow('Query timeout');
    });

    it('should propagate constraint violation errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.createConfig({
        tenant_id: 't1',
        name: 'Test',
        type: 'metric',
        target: 'server-1',
        metric: 'cpu',
        threshold: {},
      })).rejects.toThrow('Unique constraint violation');
    });
  });
});
