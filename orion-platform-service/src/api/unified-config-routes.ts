/**
 * Unified Configuration API Routes
 * Prefix: /api/v1/config
 * 
 * 统一配置管理 API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { UnifiedConfigService, SystemConfig, unifiedConfig } from '../config/UnifiedConfigService';

interface ConfigRoutesOptions {
  database?: DatabasePool;
}

interface UpdateConfigBody {
  key: keyof SystemConfig;
  value: any;
}

// H1: 敏感配置列表 — 非管理员访问时返回脱敏值
const SENSITIVE_KEYS: string[] = [
  'security',
  'database',
  'redis',
  'nats',
];

/**
 * H1: 脱敏敏感配置值
 */
function redactSensitive(value: any, key: string): any {
  if (value === null || value === undefined) return value;
  const redacted = JSON.parse(JSON.stringify(value));

  if (key === 'security') {
    redacted.jwtSecret = '***REDACTED***';
  }
  if (key === 'database') {
    redacted.password = '***REDACTED***';
  }
  if (key === 'redis' && redacted.password) {
    redacted.password = '***REDACTED***';
  }
  if (key === 'nats') {
    if (redacted.pass) redacted.pass = '***REDACTED***';
    if (redacted.user) redacted.user = '***REDACTED***';
  }
  return redacted;
}

export default async function configRoutes(
  app: FastifyInstance,
  options: ConfigRoutesOptions = {}
): Promise<void> {
  const configService = new UnifiedConfigService(options.database);
  await configService.initialize();

  // ==================== 读取配置 ====================

  // GET /config - 获取所有配置 (脱敏)
  app.get('/', async (_request, reply) => {
    const config = configService.exportConfig();
    return reply.send({ config });
  });

  // GET /config/:key - 获取单个配置
  // H1: 敏感 key 需要 admin 角色，否则返回脱敏值
  app.get<{ Params: { key: string } }>('/:key', async (request, reply) => {
    const { key } = request.params as { key: keyof SystemConfig };
    const userRole = (request as any).user?.role;
    const isAdmin = userRole === 'admin';

    if (SENSITIVE_KEYS.includes(key as string) && !isAdmin) {
      // 非管理员访问敏感配置 — 返回脱敏值
      const value = configService.get(key);
      const redacted = redactSensitive(value, key as string);
      return reply.send({ key, value: redacted, redacted: true });
    }

    try {
      const value = configService.get(key);
      return reply.send({ key, value });
    } catch (error: any) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: error.message });
    }
  });

  // GET /config/:key/full - 获取完整配置 (含敏感信息, 仅 admin)
  app.get<{ Params: { key: string } }>('/:key/full', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request, reply) => {
    const { key } = request.params as { key: keyof SystemConfig };
    const value = configService.get(key);
    return reply.send({ key, value });
  });

  // ==================== 更新配置 ====================

  // PUT /config/:key - 更新配置
  app.put<{ Params: { key: string }; Body: { value: any } }>('/:key', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request, reply) => {
    const { key } = request.params as { key: keyof SystemConfig };
    const { value } = request.body;

    try {
      const oldValue = configService.get(key);
      await configService.set(key, value);
      
      return reply.send({
        key,
        oldValue,
        newValue: value,
        message: '配置已更新',
      });
    } catch (error: any) {
      return reply.status(400).send({ code: 'UPDATE_FAILED', message: error.message });
    }
  });

  // POST /config/batch - 批量更新
  app.post<{ Body: { configs: { key: keyof SystemConfig; value: any }[] } }>('/batch', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request, reply) => {
    const { configs } = request.body;
    const results: any[] = [];

    for (const { key, value } of configs) {
      try {
        const oldValue = configService.get(key);
        await configService.set(key, value);
        results.push({ key, success: true, oldValue, newValue: value });
      } catch (error: any) {
        results.push({ key, success: false, error: error.message });
      }
    }

    return reply.send({ results });
  });

  // ==================== 重置 ====================

  // POST /config/:key/reset - 重置单个配置
  app.post<{ Params: { key: string } }>('/:key/reset', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request, reply) => {
    const { key } = request.params as { key: keyof SystemConfig };
    await configService.reset(key);
    const value = configService.get(key);
    return reply.send({ key, value, message: '配置已重置为默认值' });
  });

  // POST /config/reset - 重置所有配置
  app.post('/reset', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (_request, reply) => {
    await configService.reset();
    return reply.send({ message: '所有配置已重置为默认值' });
  });

  // ==================== 变更历史 ====================

  // GET /config/history - 获取配置变更历史
  app.get('/history', async (_request, reply) => {
    const history = configService.getHistory();
    return reply.send({ history });
  });

  // ==================== 导入导出 ====================

  // GET /config/export - 导出配置
  app.get('/export', async (_request, reply) => {
    const config = configService.exportConfig();
    return reply.send({
      config,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    });
  });

  // POST /config/import - 导入配置
  app.post<{ Body: { config: Partial<SystemConfig>; merge?: boolean } }>('/import', {
    onRequest: [authenticateUser, requirePermission({ resource: 'config', action: 'manage' })],
  }, async (request, reply) => {
    const { config, merge = false } = request.body;
    
    if (!merge) {
      await configService.reset();
    }

    const results: any[] = [];
    for (const [key, value] of Object.entries(config)) {
      try {
        await configService.set(key as keyof SystemConfig, value);
        results.push({ key, success: true });
      } catch (error: any) {
        results.push({ key, success: false, error: error.message });
      }
    }

    return reply.send({
      message: '配置导入完成',
      results,
    });
  });

  // ==================== 订阅配置变更 ====================

  // WebSocket 订阅 (可选) - 通过事件发布实现
  // 实际使用时通过 EventBus 订阅 'config.changed' 事件
}