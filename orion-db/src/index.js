/**
 * Orion Database Client
 * PostgreSQL + Redis 连接工具
 */

const { Pool } = require('pg');
const Redis = require('ioredis');

// PostgreSQL 连接池配置
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'orion_app',
  password: process.env.POSTGRES_PASSWORD || 'orion_app_password',
  database: process.env.POSTGRES_DB || 'orion_tenant_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Redis 配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'redis_password',
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  },
};

// Redis Sentinel 配置
const redisSentinelConfig = {
  sentinels: [
    { host: 'localhost', port: 26379 },
    { host: 'localhost', port: 26380 },
    { host: 'localhost', port: 26381 },
  ],
  name: 'mymaster',
  password: process.env.REDIS_PASSWORD || 'redis_password',
  maxRetriesPerRequest: 3,
};

// 创建 PostgreSQL 连接池
let pgPool = null;

function getPostgresPool() {
  if (!pgPool) {
    pgPool = new Pool(pgConfig);

    pgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL error:', err);
    });
  }
  return pgPool;
}

// 创建 Redis 客户端
let redisClient = null;

function getRedisClient(useSentinel = false) {
  if (!redisClient) {
    if (useSentinel) {
      redisClient = new Redis(redisSentinelConfig);
    } else {
      redisClient = new Redis(redisConfig);
    }

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }
  return redisClient;
}

// 设置租户上下文
async function setTenantContext(client, tenantId) {
  await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
}

// 设置用户上下文
async function setUserContext(client, userId) {
  await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
}

// 缓存键命名规范
const CacheKeys = {
  // 用户相关
  user: (userId) => `orion:user:${userId}`,
  userSession: (sessionId) => `orion:session:${sessionId}`,

  // 团队相关
  team: (teamId) => `orion:team:${teamId}`,
  teamMembers: (teamId) => `orion:team:${teamId}:members`,

  // 产品线相关
  productLine: (plId) => `orion:pl:${plId}`,
  pipeline: (pipelineId) => `orion:pipeline:${pipelineId}`,

  // K8s 相关
  k8sCluster: (clusterId) => `orion:k8s:cluster:${clusterId}`,
  k8sDeployment: (deploymentId) => `orion:k8s:deploy:${deploymentId}`,

  // 流水线运行
  pipelineRun: (runId) => `orion:run:${runId}`,
  pipelineRunLogs: (runId) => `orion:run:${runId}:logs`,

  // 租户相关
  tenantQuota: (tenantId) => `orion:tenant:${tenantId}:quota`,
  tenantConfig: (tenantId) => `orion:tenant:${tenantId}:config`,

  // 分布式锁
  lock: (resource) => `orion:lock:${resource}`,
};

// 缓存过期策略
const CacheTTL = {
  // 短期缓存（5 分钟）
  SHORT: 5 * 60,

  // 中期缓存（30 分钟）
  MEDIUM: 30 * 60,

  // 长期缓存（2 小时）
  LONG: 2 * 60 * 60,

  // 永久缓存（7 天）
  PERMANENT: 7 * 24 * 60 * 60,
};

// 缓存操作工具类
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  // 获取缓存
  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  // 设置缓存
  async set(key, value, ttl = CacheTTL.MEDIUM) {
    if (ttl > 0) {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } else {
      await this.redis.set(key, JSON.stringify(value));
    }
  }

  // 删除缓存
  async delete(key) {
    await this.redis.del(key);
  }

  // 检查键是否存在
  async exists(key) {
    return await this.redis.exists(key) === 1;
  }

  // 获取多个键
  async mget(keys) {
    const values = await this.redis.mget(keys);
    return values.map(v => v ? JSON.parse(v) : null);
  }

  // 分布式锁
  async acquireLock(key, ttl = 30, retryTimes = 3, retryDelay = 100) {
    const lockValue = `${Date.now()}:${Math.random()}`;

    for (let i = 0; i < retryTimes; i++) {
      const acquired = await this.redis.set(key, lockValue, 'NX', 'EX', ttl);
      if (acquired) {
        return { acquired: true, value: lockValue };
      }
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return { acquired: false, value: null };
  }

  // 释放锁
  async releaseLock(key, lockValue) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    return await this.redis.eval(script, 1, key, lockValue);
  }

  // 热点数据预加载
  async preloadHotData(key, fetchFn, ttl = CacheTTL.MEDIUM) {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const fresh = await fetchFn();
    if (fresh) {
      await this.set(key, fresh, ttl);
    }
    return fresh;
  }

  // 缓存穿透保护（空值缓存）
  async getWithEmptyProtection(key, fetchFn, ttl = CacheTTL.SHORT, emptyTtl = 60) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetchFn();
    if (fresh === null || fresh === undefined) {
      // 缓存空值，防止穿透
      await this.redis.setex(key, emptyTtl, JSON.stringify(null));
      return null;
    }

    await this.set(key, fresh, ttl);
    return fresh;
  }

  // 关闭连接
  async close() {
    await this.redis.quit();
  }
}

module.exports = {
  getPostgresPool,
  getRedisClient,
  setTenantContext,
  setUserContext,
  CacheKeys,
  CacheTTL,
  CacheService,
  pgConfig,
  redisConfig,
  redisSentinelConfig,
};
