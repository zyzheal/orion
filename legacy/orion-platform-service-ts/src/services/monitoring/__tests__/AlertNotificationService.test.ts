/**
 * TASK-703: AlertNotificationService Unit Tests
 */

import { AlertNotificationService } from '../AlertNotificationService';
import { Alert, AlertChannel, EscalationPolicy, AlertSeverity } from '../types';

describe('AlertNotificationService', () => {
  let service: AlertNotificationService;

  beforeEach(() => {
    service = new AlertNotificationService();
  });

  // ==================== Channel Management ====================

  describe('addChannel', () => {
    it('should add an email channel', () => {
      const channel: AlertChannel = {
        id: 'ch-email',
        name: 'Team Email',
        type: 'email',
        config: { recipients: ['team@example.com'] },
        enabled: true,
      };

      service.addChannel(channel);

      const channels = service.getAllChannels();
      expect(channels.length).toBe(1);
      expect(channels[0].type).toBe('email');
    });

    it('should add a webhook channel', () => {
      const channel: AlertChannel = {
        id: 'ch-webhook',
        name: 'PagerDuty',
        type: 'webhook',
        config: { url: 'https://events.pagerduty.com/v2/enqueue' },
        enabled: true,
      };

      service.addChannel(channel);

      const found = service.getChannel('ch-webhook');
      expect(found).toBeDefined();
      expect(found!.type).toBe('webhook');
    });

    it('should add a Slack channel', () => {
      const channel: AlertChannel = {
        id: 'ch-slack',
        name: '#alerts',
        type: 'slack',
        config: { webhookUrl: 'https://hooks.slack.com/services/xxx' },
        enabled: true,
      };

      service.addChannel(channel);

      const channels = service.getAllChannels();
      expect(channels.length).toBe(1);
    });

    it('should allow updating a channel', async () => {
      const channel: AlertChannel = {
        id: 'ch-1',
        name: 'Test',
        type: 'email',
        config: { recipients: ['test@example.com'] },
        enabled: true,
      };

      await service.addChannel(channel);

      const updated = await service.updateChannel('ch-1', { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should return null when updating non-existent channel', async () => {
      const result = await service.updateChannel('nonexistent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should allow removing a channel', async () => {
      await service.addChannel({
        id: 'ch-1',
        name: 'Test',
        type: 'email',
        config: { recipients: ['test@example.com'] },
        enabled: true,
      });

      const removed = await service.removeChannel('ch-1');
      expect(removed).toBe(true);
      expect(service.getAllChannels().length).toBe(0);
    });

    it('should allow toggling a channel', () => {
      service.addChannel({
        id: 'ch-1',
        name: 'Test',
        type: 'email',
        config: { recipients: ['test@example.com'] },
        enabled: true,
      });

      service.toggleChannel('ch-1', false);
      const channel = service.getChannel('ch-1');
      expect(channel!.enabled).toBe(false);
    });
  });

  // ==================== Notification Sending ====================

  describe('sendNotification', () => {
    const testAlert: Alert = {
      id: 'alert-1',
      ruleId: 'rule-1',
      ruleName: 'High CPU',
      metric: 'system.cpu.usage',
      value: 95,
      threshold: 80,
      severity: 'critical',
      status: 'triggered',
      triggeredAt: new Date(),
    };

    it('should send notification to email channel', async () => {
      service.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'], subjectPrefix: '[ALERT]' },
        enabled: true,
      });

      const records = await service.sendNotification(testAlert, ['ch-email']);

      expect(records.length).toBe(1);
      expect(records[0].status).toBe('sent');
      expect(records[0].channelType).toBe('email');
    });

    it('should send notification to webhook channel', async () => {
      service.addChannel({
        id: 'ch-webhook',
        name: 'Webhook',
        type: 'webhook',
        config: { url: 'https://example.com/webhook' },
        enabled: true,
      });

      const records = await service.sendNotification(testAlert, ['ch-webhook']);

      expect(records.length).toBe(1);
      expect(records[0].status).toBe('sent');
    });

    it('should send notification to Slack channel', async () => {
      service.addChannel({
        id: 'ch-slack',
        name: 'Slack',
        type: 'slack',
        config: { webhookUrl: 'https://hooks.slack.com/services/xxx', channel: '#alerts' },
        enabled: true,
      });

      const records = await service.sendNotification(testAlert, ['ch-slack']);

      expect(records.length).toBe(1);
      expect(records[0].status).toBe('sent');
    });

    it('should skip disabled channels', async () => {
      service.addChannel({
        id: 'ch-disabled',
        name: 'Disabled',
        type: 'email',
        config: { recipients: ['test@example.com'] },
        enabled: false,
      });

      const records = await service.sendNotification(testAlert, ['ch-disabled']);
      expect(records.length).toBe(0);
    });

    it('should skip channels with non-matching severity filter', async () => {
      service.addChannel({
        id: 'ch-critical-only',
        name: 'Critical Only',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
        severityFilter: ['critical'],
      });

      const warningAlert: Alert = {
        ...testAlert,
        severity: 'warning',
        id: 'alert-warning',
      };

      const records = await service.sendNotification(warningAlert, ['ch-critical-only']);
      expect(records.length).toBe(0);
    });

    it('should send to multiple channels', async () => {
      service.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
      });

      service.addChannel({
        id: 'ch-slack',
        name: 'Slack',
        type: 'slack',
        config: { webhookUrl: 'https://hooks.slack.com/services/xxx' },
        enabled: true,
      });

      const records = await service.sendNotification(testAlert, ['ch-email', 'ch-slack']);

      expect(records.length).toBe(2);
    });

    it('should handle non-existent channel IDs', async () => {
      const records = await service.sendNotification(testAlert, ['nonexistent']);
      expect(records.length).toBe(0);
    });
  });

  // ==================== Escalation Policies ====================

  describe('escalationPolicies', () => {
    it('should add an escalation policy', () => {
      const policy: EscalationPolicy = {
        id: 'policy-1',
        name: 'On-Call Escalation',
        steps: [
          { step: 0, waitMs: 0, recipients: ['oncall@example.com'], channelIds: ['ch-1'] },
          { step: 1, waitMs: 300000, recipients: ['manager@example.com'], channelIds: ['ch-1'] },
        ],
        repeatCount: 1,
        enabled: true,
      };

      service.addEscalationPolicy(policy);

      const policies = service.getAllEscalationPolicies();
      expect(policies.length).toBe(1);
    });

    it('should get a specific policy', () => {
      const policy: EscalationPolicy = {
        id: 'policy-1',
        name: 'Test Policy',
        steps: [],
        repeatCount: 0,
        enabled: true,
      };

      service.addEscalationPolicy(policy);

      const found = service.getEscalationPolicy('policy-1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Policy');
    });

    it('should remove an escalation policy', () => {
      service.addEscalationPolicy({
        id: 'policy-1',
        name: 'Test',
        steps: [],
        repeatCount: 0,
        enabled: true,
      });

      const removed = service.removeEscalationPolicy('policy-1');
      expect(removed).toBe(true);
      expect(service.getAllEscalationPolicies().length).toBe(0);
    });
  });

  // ==================== Escalation Execution ====================

  describe('escalation', () => {
    beforeEach(() => {
      // Add channels for escalation
      service.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
      });

      // Add escalation policy
      service.addEscalationPolicy({
        id: 'policy-1',
        name: 'Standard Escalation',
        steps: [
          {
            step: 0,
            waitMs: 0,
            recipients: ['oncall@example.com'],
            channelIds: ['ch-email'],
          },
          {
            step: 1,
            waitMs: 60000,
            recipients: ['manager@example.com'],
            channelIds: ['ch-email'],
          },
        ],
        repeatCount: 0,
        enabled: true,
      });
    });

    it('should start escalation for an alert', () => {
      service.startEscalation('alert-1', 'policy-1');

      const state = service.getEscalationState('alert-1');
      expect(state).toBeDefined();
      expect(state!.alertId).toBe('alert-1');
      expect(state!.currentStep).toBe(0);
    });

    it('should cancel escalation', () => {
      service.startEscalation('alert-1', 'policy-1');
      service.cancelEscalation('alert-1');

      const state = service.getEscalationState('alert-1');
      expect(state).toBeUndefined();
    });

    it('should record escalation notifications', () => {
      service.startEscalation('alert-1', 'policy-1');

      const history = service.getNotificationHistory({ alertId: 'alert-1' });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].status).toBe('escalated');
      expect(history[0].escalationStep).toBe(0);
    });
  });

  // ==================== Alert Acknowledgment ====================

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert and cancel escalation', () => {
      service.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
      });

      service.addEscalationPolicy({
        id: 'policy-1',
        name: 'Test',
        steps: [
          { step: 0, waitMs: 0, recipients: ['oncall@example.com'], channelIds: ['ch-email'] },
          { step: 1, waitMs: 60000, recipients: ['manager@example.com'], channelIds: ['ch-email'] },
        ],
        repeatCount: 0,
        enabled: true,
      });

      service.startEscalation('alert-1', 'policy-1');
      service.acknowledgeAlert('alert-1', 'john.doe');

      const state = service.getEscalationState('alert-1');
      expect(state).toBeUndefined();
    });
  });

  // ==================== Notification History ====================

  describe('notificationHistory', () => {
    const testAlert: Alert = {
      id: 'alert-1',
      ruleId: 'rule-1',
      metric: 'cpu',
      value: 95,
      threshold: 80,
      severity: 'critical',
      status: 'triggered',
      triggeredAt: new Date(),
    };

    beforeEach(async () => {
      service.addChannel({
        id: 'ch-email',
        name: 'Email',
        type: 'email',
        config: { recipients: ['ops@example.com'] },
        enabled: true,
      });

      await service.sendNotification(testAlert, ['ch-email']);
    });

    it('should return notification history', () => {
      const history = service.getNotificationHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should filter by alert ID', () => {
      const history = service.getNotificationHistory({ alertId: 'alert-1' });
      expect(history.length).toBeGreaterThan(0);

      const noHistory = service.getNotificationHistory({ alertId: 'nonexistent' });
      expect(noHistory.length).toBe(0);
    });

    it('should filter by channel ID', () => {
      const history = service.getNotificationHistory({ channelId: 'ch-email' });
      expect(history.length).toBeGreaterThan(0);
    });

    it('should filter by status', () => {
      const history = service.getNotificationHistory({ status: 'sent' });
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit results', () => {
      const history = service.getNotificationHistory({ limit: 1 });
      expect(history.length).toBe(1);
    });

    it('should get notifications for a specific alert', () => {
      const notifications = service.getAlertNotifications('alert-1');
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should sort by sentAt descending', () => {
      const history = service.getNotificationHistory();

      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].sentAt.getTime()).toBeGreaterThanOrEqual(
          history[i + 1].sentAt.getTime()
        );
      }
    });
  });

  // ==================== Clear Operations ====================

  describe('clearAll', () => {
    it('should clear all channels and policies', () => {
      service.addChannel({
        id: 'ch-1',
        name: 'Test',
        type: 'email',
        config: { recipients: ['test@example.com'] },
        enabled: true,
      });

      service.addEscalationPolicy({
        id: 'policy-1',
        name: 'Test',
        steps: [],
        repeatCount: 0,
        enabled: true,
      });

      service.clearAll();

      expect(service.getAllChannels().length).toBe(0);
      expect(service.getAllEscalationPolicies().length).toBe(0);
    });

    it('should clear notification history', () => {
      service.clearNotificationHistory();
      const history = service.getNotificationHistory();
      expect(history.length).toBe(0);
    });
  });
});
