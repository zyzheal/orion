/**
 * ChatOps 模型测试
 */
import {
  createChatOpsCommand,
  createChatOpsExecution,
  createChatOpsSession,
  createChatOpsAuditLog,
} from '../ChatOps';

describe('ChatOps', () => {
  describe('createChatOpsCommand', () => {
    it('should create command with defaults', () => {
      const cmd = createChatOpsCommand({ name: 'deploy' });

      expect(cmd.id).toBeDefined();
      expect(cmd.name).toBe('deploy');
      expect(cmd.subcommand).toBe('');
      expect(cmd.schema).toEqual({});
      expect(cmd.aliases).toEqual([]);
      expect(cmd.permissionLevel).toBe('user');
      expect(cmd.examples).toEqual([]);
    });

    it('should accept custom values', () => {
      const cmd = createChatOpsCommand({
        name: 'build',
        subcommand: 'start',
        schema: { branch: 'string' },
        aliases: ['b'],
        permissionLevel: 'admin',
        examples: ['/build start main'],
      });

      expect(cmd.subcommand).toBe('start');
      expect(cmd.schema).toEqual({ branch: 'string' });
      expect(cmd.aliases).toEqual(['b']);
      expect(cmd.permissionLevel).toBe('admin');
      expect(cmd.examples).toEqual(['/build start main']);
    });
  });

  describe('createChatOpsExecution', () => {
    it('should create execution with defaults', () => {
      const exec = createChatOpsExecution({
        commandId: 'cmd-1',
        userId: 'user-1',
        platform: 'slack',
        channel: '#general',
      });

      expect(exec.id).toBeDefined();
      expect(exec.commandId).toBe('cmd-1');
      expect(exec.userId).toBe('user-1');
      expect(exec.platform).toBe('slack');
      expect(exec.channel).toBe('#general');
      expect(exec.params).toEqual({});
      expect(exec.status).toBe('pending');
      expect(exec.startTime).toBeInstanceOf(Date);
      expect(exec.endTime).toBeNull();
      expect(exec.result).toEqual({});
      expect(exec.milestones).toEqual({});
    });

    it('should accept params', () => {
      const exec = createChatOpsExecution({
        commandId: 'c1',
        userId: 'u1',
        platform: 'discord',
        channel: '#ci',
        params: { branch: 'main' },
      });

      expect(exec.params).toEqual({ branch: 'main' });
    });
  });

  describe('createChatOpsSession', () => {
    it('should create session', () => {
      const session = createChatOpsSession({
        key: 'session-1',
        userId: 'user-1',
        channelId: 'ch-1',
      });

      expect(session.key).toBe('session-1');
      expect(session.userId).toBe('user-1');
      expect(session.channelId).toBe('ch-1');
      expect(session.history).toEqual([]);
      expect(session.state).toEqual({});
    });
  });

  describe('createChatOpsAuditLog', () => {
    it('should create audit log with defaults', () => {
      const log = createChatOpsAuditLog({
        traceId: 'trace-1',
        actor: { userId: 'u1' },
        action: { type: 'deploy' },
      });

      expect(log.id).toBeDefined();
      expect(log.traceId).toBe('trace-1');
      expect(log.actor).toEqual({ userId: 'u1' });
      expect(log.action).toEqual({ type: 'deploy' });
      expect(log.result).toBe('unknown');
      expect(log.context).toEqual({});
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('should accept custom result and context', () => {
      const log = createChatOpsAuditLog({
        traceId: 't1',
        actor: { id: 'u1' },
        action: { cmd: 'build' },
        result: 'success',
        context: { branch: 'main' },
      });

      expect(log.result).toBe('success');
      expect(log.context).toEqual({ branch: 'main' });
    });
  });
});
