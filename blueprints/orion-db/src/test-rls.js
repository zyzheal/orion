/**
 * RLS (Row Level Security) 测试脚本
 * 验证租户隔离策略是否生效
 */

const { Pool } = require('pg');

const testConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'orion_app',
  password: process.env.POSTGRES_PASSWORD || 'orion_app_password',
  database: process.env.POSTGRES_DB || 'orion_tenant_db',
};

async function testRLS() {
  const pool = new Pool(testConfig);
  const results = [];

  console.log('=== RLS (行级安全) 测试 ===\n');

  try {
    // 测试 1: 设置租户上下文后查询
    console.log('测试 1: 租户 1 用户查询');
    const client1 = await pool.connect();
    await client1.query("SET LOCAL app.current_tenant_id = '1'");

    const tenant1Users = await client1.query(
      'SELECT id, user_id, email, name FROM core.users ORDER BY user_id'
    );
    console.log(`租户 1 用户数：${tenant1Users.rows.length}`);
    tenant1Users.rows.forEach(row => {
      console.log(`  - ${row.user_id}: ${row.email} (${row.name})`);
    });
    results.push({ test: 'tenant1_users', count: tenant1Users.rows.length, passed: tenant1Users.rows.length > 0 });

    await client1.release();

    // 测试 2: 租户 2 用户查询
    console.log('\n测试 2: 租户 2 用户查询');
    const client2 = await pool.connect();
    await client2.query("SET LOCAL app.current_tenant_id = '2'");

    const tenant2Users = await client2.query(
      'SELECT id, user_id, email, name FROM core.users ORDER BY user_id'
    );
    console.log(`租户 2 用户数：${tenant2Users.rows.length}`);
    tenant2Users.rows.forEach(row => {
      console.log(`  - ${row.user_id}: ${row.email} (${row.name})`);
    });
    results.push({ test: 'tenant2_users', count: tenant2Users.rows.length, passed: tenant2Users.rows.length > 0 });

    await client2.release();

    // 测试 3: 验证租户隔离
    console.log('\n测试 3: 验证租户隔离');
    const client3 = await pool.connect();
    await client3.query("SET LOCAL app.current_tenant_id = '1'");

    // 租户 1 不应该看到租户 2 的数据
    const crossTenantCheck = await client3.query(
      "SELECT count(*) FROM core.users WHERE user_id = 'admin-002'"
    );
    const tenant1CannotSeeTenant2 = crossTenantCheck.rows[0].count === '0';
    console.log(`租户 1 能否看到租户 2 的管理员：${!tenant1CannotSeeTenant2}`);
    console.log(`租户隔离测试：${tenant1CannotSeeTenant2 ? '通过' : '失败'}`);
    results.push({ test: 'tenant_isolation', passed: tenant1CannotSeeTenant2 });

    await client3.release();

    // 测试 4: 团队查询
    console.log('\n测试 4: 团队查询');
    const client4 = await pool.connect();
    await client4.query("SET LOCAL app.current_tenant_id = '1'");

    const teams = await client4.query(
      'SELECT id, team_id, name, description FROM core.teams ORDER BY team_id'
    );
    console.log(`租户 1 团队数：${teams.rows.length}`);
    teams.rows.forEach(row => {
      console.log(`  - ${row.team_id}: ${row.name}`);
    });
    results.push({ test: 'teams', count: teams.rows.length, passed: teams.rows.length > 0 });

    await client4.release();

    // 测试 5: 主机资产查询
    console.log('\n测试 5: 主机资产查询');
    const client5 = await pool.connect();
    await client5.query("SET LOCAL app.current_tenant_id = '1'");

    const hosts = await client5.query(
      'SELECT id, name, hostname, ip, os_type FROM cmdb.hosts WHERE deleted = false ORDER BY name'
    );
    console.log(`租户 1 主机数：${hosts.rows.length}`);
    hosts.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.hostname} (${row.ip})`);
    });
    results.push({ test: 'hosts', count: hosts.rows.length, passed: hosts.rows.length > 0 });

    await client5.release();

    // 测试 6: 审计日志插入
    console.log('\n测试 6: 审计日志插入测试');
    const client6 = await pool.connect();
    await client6.query("SET LOCAL app.current_tenant_id = '1'");

    const insertResult = await client6.query(
      `INSERT INTO audit.logs (tenant_id, user_id, action, resource_type, status, ip_address)
       VALUES (1, 1, 'RLS_TEST', 'test', 'success', '127.0.0.1')
       RETURNING id, action, status`
    );
    console.log(`审计日志插入成功：ID=${insertResult.rows[0].id}`);
    results.push({ test: 'audit_log_insert', passed: true });

    await client6.release();

    // 总结
    console.log('\n=== 测试结果汇总 ===');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach(r => {
      const status = r.passed ? '✓ 通过' : '✗ 失败';
      console.log(`${status}: ${r.test}${r.count !== undefined ? ` (${r.count})` : ''}`);
    });

    console.log(`\n总计：${passedCount}/${totalCount} 通过`);

    return { passed: passedCount === totalCount, results };

  } catch (error) {
    console.error('RLS 测试失败:', error);
    return { passed: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// 运行测试
if (require.main === module) {
  testRLS()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { testRLS };
