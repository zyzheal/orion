/**
 * Redis 缓存层测试脚本
 * 验证 Redis 连接、缓存操作和哨兵高可用
 */

const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'redis_password',
  maxRetriesPerRequest: 3,
};

const sentinelConfig = {
  sentinels: [
    { host: process.env.REDIS_SENTINEL_HOST || 'localhost', port: 26379 },
    { host: process.env.REDIS_SENTINEL_HOST || 'localhost', port: 26380 },
    { host: process.env.REDIS_SENTINEL_HOST || 'localhost', port: 26381 },
  ],
  name: process.env.REDIS_SENTINEL_MASTER || 'mymaster',
  password: process.env.REDIS_PASSWORD || 'redis_password',
  maxRetriesPerRequest: 3,
};

// 缓存键命名规范
const CacheKeys = {
  user: (userId) => `orion:user:${userId}`,
  session: (sessionId) => `orion:session:${sessionId}`,
  team: (teamId) => `orion:team:${teamId}`,
  config: (key) => `orion:config:${key}`,
  lock: (resource) => `orion:lock:${resource}`,
};

// 缓存过期策略（秒）
const CacheTTL = {
  SHORT: 5 * 60,      // 5 分钟
  MEDIUM: 30 * 60,    // 30 分钟
  LONG: 2 * 60 * 60,  // 2 小时
  PERMANENT: 7 * 24 * 60 * 60, // 7 天
};

async function testRedis() {
  console.log('=== Redis 缓存层测试 ===\n');

  const results = [];
  let client;

  try {
    // 测试 1: 基本连接
    console.log('测试 1: Redis 连接测试');
    client = new Redis(redisConfig);

    await client.ping();
    console.log('✓ Redis 连接成功');
    results.push({ test: 'connection', passed: true });

    // 测试 2: 基本 CRUD 操作
    console.log('\n测试 2: 基本 CRUD 操作');

    // Set
    const testKey = CacheKeys.user('test-001');
    const testValue = { id: 'test-001', name: '测试用户', email: 'test@orion.com' };
    await client.setex(testKey, CacheTTL.MEDIUM, JSON.stringify(testValue));
    console.log(`✓ Set 成功：${testKey}`);

    // Get
    const retrieved = await client.get(testKey);
    const parsed = JSON.parse(retrieved);
    console.log(`✓ Get 成功：${parsed.name}`);
    results.push({ test: 'crud', passed: parsed.id === testValue.id });

    // Delete
    await client.del(testKey);
    const deleted = await client.get(testKey);
    console.log(`✓ Delete 成功：${deleted === null}`);

    // 测试 3: 过期策略
    console.log('\n测试 3: 缓存过期策略测试');
    const shortTtlKey = 'orion:test:short-ttl';
    await client.setex(shortTtlKey, 2, 'temporary-value');
    const beforeExpiry = await client.get(shortTtlKey);
    console.log(`设置 2 秒过期，立即读取：${beforeExpiry}`);

    console.log('等待 3 秒验证过期...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const afterExpiry = await client.get(shortTtlKey);
    console.log(`3 秒后读取：${afterExpiry}`);
    results.push({ test: 'expiry', passed: afterExpiry === null });

    // 测试 4: 分布式锁
    console.log('\n测试 4: 分布式锁测试');
    const lockKey = CacheKeys.lock('test-resource');
    const lockValue = `${Date.now()}:${Math.random()}`;

    // 尝试获取锁
    const acquired = await client.set(lockKey, lockValue, 'NX', 'EX', 30);
    console.log(`获取锁：${acquired ? '成功' : '失败'}`);

    if (acquired) {
      // 验证锁存在
      const lockExists = await client.exists(lockKey);
      console.log(`锁存在：${lockExists === 1}`);

      // 释放锁（使用 Lua 脚本确保原子性）
      const releaseScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const released = await client.eval(releaseScript, 1, lockKey, lockValue);
      console.log(`释放锁：${released === 1 ? '成功' : '失败'}`);

      results.push({ test: 'distributed_lock', passed: acquired && released === 1 });
    } else {
      results.push({ test: 'distributed_lock', passed: false });
    }

    // 测试 5: Hash 操作
    console.log('\n测试 5: Hash 操作测试');
    const hashKey = CacheKeys.config('app-settings');
    await client.hset(hashKey, {
      theme: 'dark',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      maxConnections: '100',
    });

    const theme = await client.hget(hashKey, 'theme');
    const allFields = await client.hgetall(hashKey);
    console.log(`获取单个字段：theme = ${theme}`);
    console.log(`获取所有字段：`, allFields);
    results.push({ test: 'hash_operations', passed: theme === 'dark' });

    await client.del(hashKey);

    // 测试 6: List 操作（消息队列）
    console.log('\n测试 6: List 操作测试（简单消息队列）');
    const queueKey = 'orion:queue:test';
    await client.del(queueKey);

    // 入队
    await client.rpush(queueKey, ['message-1', 'message-2', 'message-3']);
    console.log('入队 3 条消息');

    // 出队
    const msg1 = await client.lpop(queueKey);
    const msg2 = await client.lpop(queueKey);
    console.log(`出队：${msg1}, ${msg2}`);

    const remaining = await client.llen(queueKey);
    console.log(`剩余消息数：${remaining}`);
    results.push({ test: 'list_operations', passed: msg1 === 'message-1' && remaining === 1 });

    await client.del(queueKey);

    // 测试 7: Set 操作（唯一访客统计）
    console.log('\n测试 7: Set 操作测试（唯一访客统计）');
    const visitorsKey = 'orion:visitors:2026-04-11';
    await client.del(visitorsKey);

    await client.sadd(visitorsKey, ['user-1', 'user-2', 'user-3', 'user-1', 'user-2']);
    const uniqueVisitors = await client.scard(visitorsKey);
    console.log(`添加 5 次访问（有重复），唯一访客数：${uniqueVisitors}`);
    results.push({ test: 'set_operations', passed: uniqueVisitors === 3 });

    await client.del(visitorsKey);

    // 测试 8: Sorted Set 操作（排行榜）
    console.log('\n测试 8: Sorted Set 操作测试（排行榜）');
    const leaderboardKey = 'orion:leaderboard:weekly';
    await client.del(leaderboardKey);

    await client.zadd(leaderboardKey, [
      { score: 100, value: 'user-1' },
      { score: 250, value: 'user-2' },
      { score: 175, value: 'user-3' },
      { score: 300, value: 'user-4' },
      { score: 225, value: 'user-5' },
    ]);

    // 获取前 3 名（降序）
    const top3 = await client.zrevrange(leaderboardKey, 0, 2, 'WITHSCORES');
    console.log('排行榜前 3 名:');
    for (let i = 0; i < top3.length; i += 2) {
      console.log(`  ${i/2 + 1}. ${top3[i]}: ${top3[i+1]} 分`);
    }
    results.push({ test: 'sorted_set', passed: top3[0] === 'user-4' });

    await client.del(leaderboardKey);

    // 测试 9: 发布订阅
    console.log('\n测试 9: 发布订阅测试');
    const pubClient = new Redis(redisConfig);
    const subClient = new Redis(redisConfig);

    let messageReceived = false;
    await subClient.subscribe('orion:channel:test');

    subClient.on('message', (channel, message) => {
      console.log(`收到消息：${channel} = ${message}`);
      messageReceived = true;
    });

    // 等待订阅完成
    await new Promise(resolve => setTimeout(resolve, 100));

    await pubClient.publish('orion:channel:test', 'Hello, Pub/Sub!');

    // 等待消息传递
    await new Promise(resolve => setTimeout(resolve, 500));

    results.push({ test: 'pubsub', passed: messageReceived });

    await pubClient.quit();
    await subClient.quit();

    // 测试结果汇总
    console.log('\n=== 测试结果汇总 ===');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach(r => {
      const status = r.passed ? '✓ 通过' : '✗ 失败';
      console.log(`${status}: ${r.test}`);
    });

    console.log(`\n总计：${passedCount}/${totalCount} 通过`);

    return { passed: passedCount === totalCount, results };

  } catch (error) {
    console.error('Redis 测试失败:', error);
    results.push({ test: 'error', passed: false, error: error.message });
    return { passed: false, error: error.message };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

// Sentinel 模式测试（可选）
async function testSentinel() {
  console.log('\n=== Redis Sentinel 高可用测试 ===\n');

  try {
    const sentinelClient = new Redis(sentinelConfig);
    await sentinelClient.ping();
    console.log('✓ Sentinel 模式连接成功');

    const role = await sentinelClient.role();
    console.log(`角色：${role[0]}`);

    // 测试读写
    await sentinelClient.setex('orion:sentinel:test', 10, 'sentinel-value');
    const value = await sentinelClient.get('orion:sentinel:test');
    console.log(`Sentinel 读写测试：${value === 'sentinel-value' ? '通过' : '失败'}`);

    await sentinelClient.quit();
    return { passed: true };

  } catch (error) {
    console.error('Sentinel 测试失败:', error.message);
    return { passed: false, error: error.message };
  }
}

// 运行测试
if (require.main === module) {
  testRedis()
    .then(async result => {
      if (result.passed) {
        await testSentinel();
      }
      process.exit(result.passed ? 0 : 1);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { testRedis, testSentinel, CacheKeys, CacheTTL };
