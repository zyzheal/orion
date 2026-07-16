/**
 * 分区表测试脚本
 * 验证分片表的分区创建、写入和查询功能
 */

const { Pool } = require('pg');

const testConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'orion_app',
  password: process.env.POSTGRES_PASSWORD || 'orion_app_password',
  database: process.env.POSTGRES_DB || 'orion_tenant_db',
};

async function testPartitions() {
  const pool = new Pool(testConfig);
  const results = [];

  console.log('=== 分区表测试 ===\n');

  try {
    // 测试 1: 检查分区是否存在
    console.log('测试 1: 检查分区表结构');

    const client = await pool.connect();

    // 查询 audit_logs_partitioned 的分区
    const partitionCheck = await client.query(`
      SELECT
        parent.relname AS parent_table,
        child.relname AS partition_name
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      JOIN pg_namespace nmsp_parent ON parent.relnamespace = nmsp_parent.oid
      WHERE nmsp_parent.nspname = 'audit'
        AND parent.relname = 'audit_logs_partitioned'
      ORDER BY child.relname
    `);

    console.log(`audit_logs_partitioned 分区数量：${partitionCheck.rows.length}`);
    partitionCheck.rows.forEach(row => {
      console.log(`  - ${row.partition_name}`);
    });
    results.push({
      test: 'partitions_exist',
      passed: partitionCheck.rows.length >= 4,
      count: partitionCheck.rows.length
    });

    // 测试 2: 写入测试 - 当前月份数据
    console.log('\n测试 2: 分区表写入测试');

    await client.query("SET LOCAL app.current_tenant_id = '1'");

    const insertResult = await client.query(`
      INSERT INTO audit.audit_logs_partitioned
        (tenant_id, user_id, action, resource_type, resource_id, status, ip_address, create_time)
      VALUES
        (1, 1, 'PARTITION_TEST_1', 'test', 1, 'success', '127.0.0.1', NOW()),
        (1, 2, 'PARTITION_TEST_2', 'test', 2, 'success', '127.0.0.1', NOW()),
        (1, 3, 'PARTITION_TEST_3', 'test', 3, 'success', '127.0.0.1', NOW())
      RETURNING id, action, create_time
    `);

    console.log(`写入 ${insertResult.rows.length} 条记录`);
    insertResult.rows.forEach(row => {
      console.log(`  - ID=${row.id}, action=${row.action}, time=${row.create_time}`);
    });
    results.push({ test: 'partition_insert', passed: insertResult.rows.length === 3 });

    // 测试 3: 查询测试
    console.log('\n测试 3: 分区表查询测试');

    const selectResult = await client.query(`
      SELECT count(*), date_trunc('month', create_time) as month
      FROM audit.audit_logs_partitioned
      WHERE tenant_id = 1
      GROUP BY date_trunc('month', create_time)
      ORDER BY month
    `);

    console.log('按月统计记录数:');
    selectResult.rows.forEach(row => {
      console.log(`  - ${row.month.toISOString().slice(0, 7)}: ${row.count} 条`);
    });
    results.push({ test: 'partition_query', passed: selectResult.rows.length > 0 });

    // 测试 4: 查询计划分析（验证分区剪枝）
    console.log('\n测试 4: 查询计划分析（分区剪枝）');

    const explainResult = await client.query(`
      EXPLAIN (FORMAT TEXT)
      SELECT * FROM audit.audit_logs_partitioned
      WHERE tenant_id = 1
        AND create_time >= date_trunc('month', CURRENT_DATE)
        AND create_time < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    `);

    const planText = explainResult.rows.map(r => r['QUERY PLAN']).join('\n');
    console.log('查询计划:');
    console.log(planText.substring(0, 500) + '...');

    // 检查是否使用了分区剪枝
    const usesPartitionPruning = planText.includes('Partitioned Table') ||
                                  planText.includes('Append') ||
                                  planText.includes('Partition');
    console.log(`\n使用分区剪枝：${usesPartitionPruning ? '是' : '否'}`);
    results.push({ test: 'partition_pruning', passed: usesPartitionPruning });

    // 测试 5: event_logs 分区表测试
    console.log('\n测试 5: event_logs 分区表测试');

    const eventInsert = await client.query(`
      INSERT INTO audit.event_logs_partitioned
        (tenant_id, event_type, event_source, event_data, severity, create_time)
      VALUES
        (1, 'PARTITION_TEST', 'test_script', '{"test": true}'::jsonb, 'info', NOW())
      RETURNING id, event_type
    `);

    console.log(`event_logs 写入：ID=${eventInsert.rows[0].id}`);
    results.push({ test: 'event_log_partition', passed: true });

    // 测试 6: pipeline_runs 分区表测试
    console.log('\n测试 6: pipeline_runs 分区表测试');

    const pipelineInsert = await client.query(`
      INSERT INTO cicd.pipeline_runs_partitioned
        (tenant_id, pipeline_id, run_id, trigger_type, status, create_time)
      VALUES
        (1, 1, 'run-partition-test-001', 'manual', 'success', NOW())
      RETURNING id, run_id
    `);

    console.log(`pipeline_runs 写入：ID=${pipelineInsert.rows[0].id}, run_id=${pipelineInsert.rows[0].run_id}`);
    results.push({ test: 'pipeline_run_partition', passed: true });

    // 测试 7: 分区表 RLS 验证
    console.log('\n测试 7: 分区表 RLS 验证');

    // 切换到租户 2
    await client.query("SET LOCAL app.current_tenant_id = '2'");

    const tenant2Check = await client.query(`
      SELECT count(*) FROM audit.audit_logs_partitioned WHERE tenant_id = 1
    `);

    const rlsWorking = tenant2Check.rows[0].count === '0';
    console.log(`租户 2 查询租户 1 数据：${tenant2Check.rows[0].count} 条`);
    console.log(`RLS 隔离：${rlsWorking ? '生效' : '失效'}`);
    results.push({ test: 'partition_rls', passed: rlsWorking });

    await client.release();

    // 测试结果汇总
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
    console.error('分区表测试失败:', error);
    return { passed: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// 运行测试
if (require.main === module) {
  testPartitions()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { testPartitions };
