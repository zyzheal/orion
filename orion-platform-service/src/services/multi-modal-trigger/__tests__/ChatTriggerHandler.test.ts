/**
 * ChatTriggerHandler - Comprehensive Tests
 *
 * Tests for command parsing, chat trigger execution,
 * built-in commands (run, status, triggers, help),
 * custom trigger handling, and notification methods.
 */

import { ChatTriggerHandler, ChatCommand, ChatMessage } from '../ChatTriggerHandler';
import { UnifiedTriggerService } from '../UnifiedTriggerService';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

class MockTriggerRepository {
  private triggers: Map<string, any> = new Map();

  async findByTenant(tenantId: string) {
    return Array.from(this.triggers.values()).filter(t => t.tenant_id === tenantId);
  }

  async findByType(tenantId: string, type: string) {
    return Array.from(this.triggers.values()).filter(
      t => t.tenant_id === tenantId && t.type === type
    );
  }

  async incrementTriggerCount(id: string) {
    const trigger = this.triggers.get(id);
    if (trigger) trigger.trigger_count += 1;
  }

  addTrigger(trigger: any) {
    this.triggers.set(trigger.id, trigger);
  }
}

class MockTriggerEventRepository {
  private events: Map<string, any> = new Map();

  async create(entity: any) {
    const event = { ...entity, created_at: new Date() };
    this.events.set(event.id, event);
    return event;
  }

  async findByTriggerId(triggerId: string, limit: number = 50) {
    return Array.from(this.events.values())
      .filter(e => e.trigger_id === triggerId)
      .slice(0, limit);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ChatTriggerHandler', () => {
  let handler: ChatTriggerHandler;
  let mockTriggerRepo: MockTriggerRepository;
  let mockEventRepo: MockTriggerEventRepository;

  function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      userId: 'user-001',
      channel: '#deployments',
      content: '',
      timestamp: new Date().toISOString(),
      platform: 'slack',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockTriggerRepo = new MockTriggerRepository();
    mockEventRepo = new MockTriggerEventRepository();
    handler = new ChatTriggerHandler();
    (handler as any).triggerRepo = mockTriggerRepo;
    (handler as any).eventRepo = mockEventRepo;
  });

  // ─── parseChatCommand ────────────────────────────────────────────────────

  describe('parseChatCommand', () => {
    it('should parse a simple command', () => {
      const cmd = handler.parseChatCommand('/run build-and-deploy');
      expect(cmd.command).toBe('run');
      expect(cmd.args).toEqual(['build-and-deploy']);
    });

    it('should parse command with multiple args', () => {
      const cmd = handler.parseChatCommand('/deploy app1 app2');
      expect(cmd.command).toBe('deploy');
      expect(cmd.args).toEqual(['app1', 'app2']);
    });

    it('should parse command with options', () => {
      const cmd = handler.parseChatCommand('/run deploy --env=production');
      expect(cmd.command).toBe('run');
      expect(cmd.args).toEqual(['deploy']);
      expect(cmd.options.env).toBe('production');
    });

    it('should parse command with short options', () => {
      const cmd = handler.parseChatCommand('/status -v');
      expect(cmd.command).toBe('status');
      expect(cmd.options.v).toBe('true');
    });

    it('should parse command with long options', () => {
      const cmd = handler.parseChatCommand('/run deploy --verbose');
      expect(cmd.command).toBe('run');
      expect(cmd.options.verbose).toBe('true');
    });

    it('should return empty command for non-command messages', () => {
      const cmd = handler.parseChatCommand('hello world');
      expect(cmd.command).toBe('');
      expect(cmd.args).toEqual([]);
      expect(cmd.options).toEqual({});
    });

    it('should handle leading/trailing whitespace', () => {
      const cmd = handler.parseChatCommand('  /run deploy  ');
      expect(cmd.command).toBe('run');
      expect(cmd.args).toEqual(['deploy']);
    });

    it('should preserve raw message', () => {
      const raw = '/run deploy --env=production';
      const cmd = handler.parseChatCommand(raw);
      expect(cmd.raw).toBe(raw);
    });
  });

  // ─── executeFromChat ─────────────────────────────────────────────────────

  describe('executeFromChat', () => {
    it('should return usage hint for non-command messages', async () => {
      const result = await handler.executeFromChat(createMessage({ content: 'hello' }));
      expect(result.success).toBe(false);
      expect(result.response).toContain('no command detected');
    });

    it('should handle /run command with pipeline', async () => {
      const msg = createMessage({ content: '/run my-pipeline' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.pipelineRunId).toBeDefined();
      expect(result.response).toContain('Pipeline run initiated');
    });

    it('should return usage for /run without args', async () => {
      const msg = createMessage({ content: '/run' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(false);
      expect(result.response).toContain('Usage');
    });

    it('should handle /status command with pipeline', async () => {
      const msg = createMessage({ content: '/status pipeline-123' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.response).toContain('pipeline-123');
    });

    it('should return usage for /status without pipeline', async () => {
      const msg = createMessage({ content: '/status' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(false);
      expect(result.response).toContain('Usage');
    });

    it('should handle /triggers command with no triggers', async () => {
      const msg = createMessage({ content: '/triggers' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.response).toContain('No triggers');
    });

    it('should handle /triggers command with triggers', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-1',
        tenant_id: 'default',
        name: 'deploy-trigger',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        config: {},
      });

      const msg = createMessage({ content: '/triggers' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.response).toContain('deploy-trigger');
    });

    it('should handle /help command', async () => {
      const msg = createMessage({ content: '/help' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.response).toContain('/run');
      expect(result.response).toContain('/status');
      expect(result.response).toContain('/triggers');
      expect(result.response).toContain('/help');
    });

    it('should handle /execute as alias for /run', async () => {
      const msg = createMessage({ content: '/execute my-pipeline' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.pipelineRunId).toBeDefined();
    });

    it('should handle unknown commands', async () => {
      const msg = createMessage({ content: '/unknown-cmd' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(false);
      expect(result.response).toContain('Unknown command');
    });
  });

  // ─── Custom Trigger ──────────────────────────────────────────────────────

  describe('custom trigger handling', () => {
    it('should activate matching custom chat trigger', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-custom',
        tenant_id: 'default',
        name: 'deploy-prod',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-001',
        config: { chatCommands: ['deploy-prod'] },
      });

      const msg = createMessage({ content: '/deploy-prod' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.triggerId).toBe('trigger-custom');
      expect(result.response).toContain('deploy-prod');
    });

    it('should return error when no DB configured for custom trigger', async () => {
      const noDbHandler = new ChatTriggerHandler();
      (noDbHandler as any).triggerRepo = null;

      const msg = createMessage({ content: '/custom-cmd' });
      const result = await noDbHandler.executeFromChat(msg);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not configured');
    });
  });

  // ─── notifyChannel ───────────────────────────────────────────────────────

  describe('notifyChannel', () => {
    it('should send notification successfully', async () => {
      const result = await handler.notifyChannel('#general', 'Hello world');
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should include platform info', async () => {
      const result = await handler.notifyChannel('#general', 'Hello', { platform: 'slack' });
      expect(result.success).toBe(true);
    });

    it('should handle attachments', async () => {
      const result = await handler.notifyChannel('#general', 'Hello', {
        attachments: [{ title: 'File', url: 'http://example.com' }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── notifyChannelRich ───────────────────────────────────────────────────

  describe('notifyChannelRich', () => {
    it('should send rich notification', async () => {
      const result = await handler.notifyChannelRich('#deployments', {
        title: 'Deploy Complete',
        text: 'App v1.2.3 deployed to production',
        fields: [
          { name: 'Version', value: '1.2.3', inline: true },
          { name: 'Environment', value: 'production', inline: true },
        ],
        color: '#52c41a',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle minimal options', async () => {
      const result = await handler.notifyChannelRich('#general', {});
      expect(result.success).toBe(true);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle /run with options', async () => {
      const msg = createMessage({ content: '/run deploy --env=staging --region=us-east-1' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.command?.options.env).toBe('staging');
      expect(result.command?.options.region).toBe('us-east-1');
    });

    it('should handle /status with --pipeline option', async () => {
      const msg = createMessage({ content: '/status --pipeline=pipeline-456' });
      const result = await handler.executeFromChat(msg);

      expect(result.success).toBe(true);
      expect(result.response).toContain('pipeline-456');
    });

    it('should handle multiple chat triggers with different commands', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-1',
        tenant_id: 'default',
        name: 'deploy',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-1',
        config: { chatCommands: ['deploy'] },
      });
      mockTriggerRepo.addTrigger({
        id: 'trigger-2',
        tenant_id: 'default',
        name: 'rollback',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-2',
        config: { chatCommands: ['rollback'] },
      });

      const deployResult = await handler.executeFromChat(createMessage({ content: '/deploy' }));
      expect(deployResult.triggerId).toBe('trigger-1');

      const rollbackResult = await handler.executeFromChat(createMessage({ content: '/rollback' }));
      expect(rollbackResult.triggerId).toBe('trigger-2');
    });
  });

  // ─── parseChatCommand edge cases ────────────────────────────────────────

  describe('parseChatCommand - edge cases', () => {
    it('should parse command with hyphenated option names', () => {
      const cmd = handler.parseChatCommand('/run deploy --my-option=value');
      expect(cmd.command).toBe('run');
      expect(cmd.options['my-option']).toBe('value');
    });

    it('should parse command with multiple options and args', () => {
      const cmd = handler.parseChatCommand('/deploy app1 app2 --env=prod --region=us-east-1 --force');
      expect(cmd.command).toBe('deploy');
      expect(cmd.args).toEqual(['app1', 'app2']);
      expect(cmd.options.env).toBe('prod');
      expect(cmd.options.region).toBe('us-east-1');
      expect(cmd.options.force).toBe('true');
    });

    it('should handle just a slash command with no args', () => {
      const cmd = handler.parseChatCommand('/help');
      expect(cmd.command).toBe('help');
      expect(cmd.args).toEqual([]);
      expect(cmd.options).toEqual({});
    });

    it('should handle empty string', () => {
      const cmd = handler.parseChatCommand('');
      expect(cmd.command).toBe('');
      expect(cmd.args).toEqual([]);
    });

    it('should handle message with only whitespace', () => {
      const cmd = handler.parseChatCommand('   ');
      expect(cmd.command).toBe('');
    });

    it('should parse option with value containing equals sign', () => {
      const cmd = handler.parseChatCommand('/run pipeline --filter=key=value');
      // The regex captures everything after the first = as the value
      expect(cmd.options.filter).toBe('key=value');
    });
  });

  // ─── executeFromChat with channel parameter ────────────────────────────

  describe('executeFromChat - channel parameter', () => {
    it('should pass channel to custom trigger handler', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-channel',
        tenant_id: 'default',
        name: 'custom',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-1',
        config: { chatCommands: ['custom'] },
      });

      const result = await handler.executeFromChat(
        createMessage({ content: '/custom' }),
        '#ops'
      );
      expect(result.success).toBe(true);
      expect(result.triggerId).toBe('trigger-channel');
    });
  });

  // ─── Custom trigger with event creation ────────────────────────────────

  describe('custom trigger - event recording', () => {
    it('should create event record when custom trigger matches', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-event',
        tenant_id: 'default',
        name: 'deploy-event',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-1',
        config: { chatCommands: ['deploy-event'] },
      });

      await handler.executeFromChat(createMessage({ content: '/deploy-event' }));

      const events = await mockEventRepo.findByTriggerId('trigger-event');
      expect(events.length).toBe(1);
      expect(events[0].event_type).toBe('chat_command');
      expect(events[0].evaluation_result).toBe('matched');
    });

    it('should increment trigger count on custom trigger match', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-count',
        tenant_id: 'default',
        name: 'count-test',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-1',
        config: { chatCommands: ['count-test'] },
      });

      await handler.executeFromChat(createMessage({ content: '/count-test' }));

      const trigger = (mockTriggerRepo as any).triggers.get('trigger-count');
      expect(trigger.trigger_count).toBe(1);
    });
  });

  // ─── /triggers command filtering ───────────────────────────────────────

  describe('/triggers command - filtering', () => {
    it('should only show chat and manual type triggers', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-chat',
        tenant_id: 'default',
        name: 'chat-trigger',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        config: {},
      });
      mockTriggerRepo.addTrigger({
        id: 'trigger-manual',
        tenant_id: 'default',
        name: 'manual-trigger',
        type: 'manual',
        enabled: false,
        trigger_count: 0,
        config: {},
      });
      mockTriggerRepo.addTrigger({
        id: 'trigger-webhook',
        tenant_id: 'default',
        name: 'webhook-trigger',
        type: 'webhook',
        enabled: true,
        trigger_count: 0,
        config: {},
      });

      const result = await handler.executeFromChat(createMessage({ content: '/triggers' }));
      expect(result.success).toBe(true);
      expect(result.response).toContain('chat-trigger');
      expect(result.response).toContain('manual-trigger');
      expect(result.response).not.toContain('webhook-trigger');
    });

    it('should show enabled/disabled status', async () => {
      mockTriggerRepo.addTrigger({
        id: 'trigger-enabled',
        tenant_id: 'default',
        name: 'active-trigger',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        config: {},
      });

      const result = await handler.executeFromChat(createMessage({ content: '/triggers' }));
      expect(result.response).toContain('enabled');
    });
  });

  // ─── notifyChannel edge cases ──────────────────────────────────────────

  describe('notifyChannel - edge cases', () => {
    it('should handle threadId option', async () => {
      const result = await handler.notifyChannel('#general', 'Hello', {
        platform: 'slack',
        threadId: 'thread-123',
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should generate unique message IDs', async () => {
      const result1 = await handler.notifyChannel('#general', 'msg1');
      const result2 = await handler.notifyChannel('#general', 'msg2');
      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });

  // ─── notifyChannelRich edge cases ──────────────────────────────────────

  describe('notifyChannelRich - edge cases', () => {
    it('should handle all options', async () => {
      const result = await handler.notifyChannelRich('#deployments', {
        platform: 'slack',
        title: 'Deploy Complete',
        text: 'v2.0.0 deployed',
        fields: [
          { name: 'Version', value: '2.0.0', inline: true },
          { name: 'Status', value: 'Success', inline: false },
        ],
        color: '#52c41a',
        threadId: 'thread-456',
      });
      expect(result.success).toBe(true);
    });

    it('should handle empty fields array', async () => {
      const result = await handler.notifyChannelRich('#general', {
        title: 'Test',
        fields: [],
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── No DB configured for /triggers command ────────────────────────────

  describe('no DB for triggers command', () => {
    it('should return error when no DB for /triggers', async () => {
      const noDbHandler = new ChatTriggerHandler();
      (noDbHandler as any).triggerRepo = null;

      const result = await noDbHandler.executeFromChat(createMessage({ content: '/triggers' }));
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not configured');
    });
  });

  // ─── Custom trigger without eventRepo ──────────────────────────────────

  describe('custom trigger - no eventRepo', () => {
    it('should still return success when eventRepo is null', async () => {
      const noEventHandler = new ChatTriggerHandler();
      (noEventHandler as any).triggerRepo = mockTriggerRepo;
      (noEventHandler as any).eventRepo = null;

      mockTriggerRepo.addTrigger({
        id: 'trigger-no-event',
        tenant_id: 'default',
        name: 'no-event',
        type: 'chat',
        enabled: true,
        trigger_count: 0,
        pipeline_id: 'pipeline-1',
        config: { chatCommands: ['no-event'] },
      });

      const result = await noEventHandler.executeFromChat(createMessage({ content: '/no-event' }));
      expect(result.success).toBe(true);
      expect(result.triggerId).toBe('trigger-no-event');
    });
  });

  // ─── ChatMessage platform variations ───────────────────────────────────

  describe('chat message platform variations', () => {
    it('should handle message without platform', async () => {
      const msg = createMessage({ content: '/run pipeline-1', platform: undefined });
      const result = await handler.executeFromChat(msg);
      expect(result.success).toBe(true);
    });

    it('should handle message with threadId', async () => {
      const msg = createMessage({
        content: '/run pipeline-1',
        platform: 'teams',
        threadId: 'thread-abc',
      });
      const result = await handler.executeFromChat(msg);
      expect(result.success).toBe(true);
    });
  });
});
