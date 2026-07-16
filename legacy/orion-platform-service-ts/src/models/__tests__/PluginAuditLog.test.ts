/**
 * PluginAuditLog 模型测试
 *
 * 此模块为纯类型定义文件，无工厂函数。
 * 测试验证类型可正确导入使用。
 */
import type { PluginAuditLog, CreatePluginAuditLog } from '../PluginAuditLog';

describe('PluginAuditLog', () => {
  describe('type compatibility', () => {
    it('should accept valid PluginAuditLog object', () => {
      const log: PluginAuditLog = {
        id: '1',
        taskId: 'task-1',
        pluginId: 'plugin-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'execute',
        outcome: 'success',
        durationMs: 1500,
        isolationTier: 'tier-1',
        createdAt: new Date(),
      };

      expect(log.action).toBe('execute');
      expect(log.outcome).toBe('success');
      expect(log.durationMs).toBe(1500);
    });

    it('should accept all action types', () => {
      const actions: PluginAuditLog['action'][] = [
        'execute', 'install', 'approve', 'uninstall',
      ];

      actions.forEach(action => {
        const log: PluginAuditLog = {
          id: '1', taskId: 't', pluginId: 'p', userId: 'u',
          tenantId: 't', action, outcome: 'success', createdAt: new Date(),
        };
        expect(log.action).toBe(action);
      });
    });

    it('should accept all outcome types', () => {
      const outcomes: PluginAuditLog['outcome'][] = [
        'success', 'failed', 'timeout', 'cancelled',
      ];

      outcomes.forEach(outcome => {
        const log: PluginAuditLog = {
          id: '1', taskId: 't', pluginId: 'p', userId: 'u',
          tenantId: 't', action: 'execute', outcome, createdAt: new Date(),
        };
        expect(log.outcome).toBe(outcome);
      });
    });

    it('should accept CreatePluginAuditLog', () => {
      const input: CreatePluginAuditLog = {
        taskId: 'task-1',
        pluginId: 'plugin-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'install',
        outcome: 'success',
        codeHash: 'abc123',
        permissions: { read: true },
      };

      expect(input.action).toBe('install');
    });
  });
});
