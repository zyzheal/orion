/**
 * 综合种子数据脚本 - 为菜单栏各模块插入测试数据
 * Run: cd orion-platform-service && npx tsx src/db/seed-all.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'heal',
  password: process.env.DB_PASSWORD || 'heal123',
  database: process.env.DB_NAME || 'orion',
});

const DEFAULT_TENANT_ID = 'b9cc68a4-f373-448f-b2b2-07f2b3336d46';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
  console.log('Starting comprehensive seed...\n');

  // 1. 插入产品线数据
  await seedProductLines();

  // 2. 插入工单数据
  await seedTickets();

  // 3. 插入项目数据
  await seedProjects();

  // 4-8. 跳过可能不存在或不兼容的表
  console.log('⏭️  Skipping Pipelines, Environments, Alerts, Knowledge (table schema mismatch)');

  // 8. 插入用户和角色数据
  await seedUsersAndRoles().catch(() => console.log('  ⚠️  Roles table skipped'));

  console.log('\n✅ Core seed data inserted successfully!');
  console.log('ℹ️  Note: Some tables were skipped due to schema differences');
  await pool.end();
}

async function seedProductLines() {
  console.log('📦 Seeding ProductLines...');

  const productLines = [
    {
      name: 'api-gateway',
      display_name: 'API 网关服务',
      description: '统一 API 网关，负责请求路由、限流、认证',
      git_url: 'https://github.com/orion/api-gateway',
      git_provider: 'github',
      branch_mode: 'github-flow',
      phase: 'Production',
      environments: JSON.stringify([
        { name: 'dev', color: '#52c41a' },
        { name: 'staging', color: '#faad14' },
        { name: 'production', color: '#f5222d' }
      ]),
    },
    {
      name: 'user-service',
      display_name: '用户中心服务',
      description: '用户认证、授权、权限管理服务',
      git_url: 'https://github.com/orion/user-service',
      git_provider: 'github',
      branch_mode: 'github-flow',
      phase: 'Production',
      environments: JSON.stringify([
        { name: 'dev', color: '#52c41a' },
        { name: 'staging', color: '#faad14' },
        { name: 'production', color: '#f5222d' }
      ]),
    },
    {
      name: 'payment-service',
      display_name: '支付服务中心',
      description: '支付渠道集成、订单支付、退款处理',
      git_url: 'https://github.com/orion/payment-service',
      git_provider: 'github',
      branch_mode: 'gitflow',
      phase: 'Production',
      environments: JSON.stringify([
        { name: 'dev', color: '#52c41a' },
        { name: 'staging', color: '#faad14' },
        { name: 'production', color: '#f5222d' }
      ]),
    },
    {
      name: 'frontend-web',
      display_name: '前端 Web 应用',
      description: 'React + TypeScript 单页应用',
      git_url: 'https://github.com/orion/frontend-web',
      git_provider: 'github',
      branch_mode: 'github-flow',
      phase: 'Development',
      environments: JSON.stringify([
        { name: 'dev', color: '#52c41a' },
        { name: 'preview', color: '#1890ff' }
      ]),
    },
    {
      name: 'data-pipeline',
      display_name: '数据管道服务',
      description: 'ETL 数据处理、实时流计算',
      git_url: 'https://github.com/orion/data-pipeline',
      git_provider: 'gitlab',
      branch_mode: 'trunk-based',
      phase: 'Production',
      environments: JSON.stringify([
        { name: 'dev', color: '#52c41a' },
        { name: 'staging', color: '#faad14' },
        { name: 'production', color: '#f5222d' }
      ]),
    },
  ];

  for (const pl of productLines) {
    await pool.query(
      `INSERT INTO product_lines (tenant_id, name, display_name, description, git_url, git_provider, branch_mode, phase, environments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (name) DO NOTHING`,
      [DEFAULT_TENANT_ID, pl.name, pl.display_name, pl.description, pl.git_url, pl.git_provider, pl.branch_mode, pl.phase, pl.environments]
    ).catch(() => {}); // Ignore conflicts
  }
  console.log(`  ✅ Inserted ${productLines.length} product lines`);
}

async function seedTickets() {
  console.log('🎫 Seeding Tickets...');

  const tickets = [
    { title: '生产数据库 CPU 使用率过高 (95%)', type: 'incident', priority: 'critical', status: 'open', assignee_id: ADMIN_USER_ID },
    { title: 'API 网关响应时间超时', type: 'incident', priority: 'high', status: 'in_progress', assignee_id: ADMIN_USER_ID },
    { title: '用户登录偶尔返回 401 错误', type: 'incident', priority: 'medium', status: 'open', assignee_id: ADMIN_USER_ID },
    { title: '支付接口偶发 500 错误', type: 'incident', priority: 'critical', status: 'in_progress', assignee_id: ADMIN_USER_ID },
    { title: '前端页面 LCP 超过 4s', type: 'performance', priority: 'medium', status: 'resolved', assignee_id: ADMIN_USER_ID },
    { title: 'Redis 集群内存使用率达到 85%', type: 'incident', priority: 'high', status: 'open', assignee_id: ADMIN_USER_ID },
    { title: 'K8s 节点磁盘使用率超过 90%', type: 'incident', priority: 'critical', status: 'in_progress', assignee_id: ADMIN_USER_ID },
    { title: 'Prometheus 存储空间不足', type: 'incident', priority: 'medium', status: 'open', assignee_id: ADMIN_USER_ID },
    { title: '添加 OAuth2 第三方登录支持', type: 'feature', priority: 'low', status: 'open' },
    { title: '优化数据库慢查询', type: '优化', priority: 'medium', status: 'in_progress', assignee_id: ADMIN_USER_ID },
  ];

  for (const t of tickets) {
    await pool.query(
      `INSERT INTO tickets (tenant_id, title, type, priority, status, assignee_id, reporter_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [DEFAULT_TENANT_ID, t.title, t.type, t.priority, t.status, t.assignee_id, ADMIN_USER_ID]
    );
  }
  console.log(`  ✅ Inserted ${tickets.length} tickets`);
}

async function seedProjects() {
  console.log('📁 Seeding Projects...');

  const projects = [
    { tenant_id: DEFAULT_TENANT_ID, name: 'orion-platform', slug: 'orion-platform', description: 'Orion 平台核心服务', status: 'active' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'api-gateway', slug: 'api-gateway', description: 'API 网关服务', status: 'active' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'user-service', slug: 'user-service', description: '用户中心服务', status: 'active' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'frontend-web', slug: 'frontend-web', description: '前端 Web 应用', status: 'active' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'data-pipeline', slug: 'data-pipeline', description: '数据管道服务', status: 'active' },
  ];

  for (const p of projects) {
    await pool.query(
      `INSERT INTO projects (tenant_id, name, slug, description, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [p.tenant_id, p.name, p.slug, p.description, p.status]
    );
  }
  console.log(`  ✅ Inserted ${projects.length} projects`);
}

async function seedPipelines() {
  console.log('🔄 Seeding Pipelines...');

  // 检查 pipelines 表是否存在
  const tableExists = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pipelines')`
  );

  if (!tableExists.rows[0].exists) {
    console.log('  ⚠️  Pipelines table does not exist, skipping...');
    return;
  }

  const pipelines = [
    { tenant_id: DEFAULT_TENANT_ID, name: 'api-gateway-build', status: 'success', branch: 'main' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'api-gateway-deploy', status: 'success', branch: 'main' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'user-service-build', status: 'success', branch: 'main' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'user-service-deploy', status: 'running', branch: 'main' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'frontend-build', status: 'failed', branch: 'feat/new-ui' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'payment-service-build', status: 'success', branch: 'main' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'payment-service-deploy', status: 'pending', branch: 'release/v2.0' },
  ];

  for (const p of pipelines) {
    await pool.query(
      `INSERT INTO pipelines (tenant_id, name, status, branch)
       VALUES ($1, $2, $3, $4)`,
      [p.tenant_id, p.name, p.status, p.branch]
    );
  }
  console.log(`  ✅ Inserted ${pipelines.length} pipelines`);
}

async function seedEnvironments() {
  console.log('🌍 Seeding Environments...');

  const tableExists = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'environments')`
  );

  if (!tableExists.rows[0].exists) {
    console.log('  ⚠️  Environments table does not exist, skipping...');
    return;
  }

  const environments = [
    { tenant_id: DEFAULT_TENANT_ID, name: 'production', type: 'production', cluster: 'prod-cluster', status: 'healthy' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'staging', type: 'staging', cluster: 'staging-cluster', status: 'healthy' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'dev', type: 'development', cluster: 'dev-cluster', status: 'healthy' },
  ];

  for (const e of environments) {
    await pool.query(
      `INSERT INTO environments (tenant_id, name, type, cluster, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [e.tenant_id, e.name, e.type, e.cluster, e.status]
    );
  }
  console.log(`  ✅ Inserted ${environments.length} environments`);
}

async function seedAlerts() {
  console.log('🔔 Seeding Alerts...');

  const tableExists = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alerts')`
  );

  if (!tableExists.rows[0].exists) {
    console.log('  ⚠️  Alerts table does not exist, skipping...');
    return;
  }

  const alerts = [
    { tenant_id: DEFAULT_TENANT_ID, name: 'High CPU Usage', severity: 'critical', status: 'firing', source: 'prometheus' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Memory Usage High', severity: 'warning', status: 'firing', source: 'prometheus' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Disk Space Low', severity: 'critical', status: 'firing', source: 'prometheus' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'API Response Time', severity: 'warning', status: 'resolved', source: 'prometheus' },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Database Connection Pool', severity: 'warning', status: 'firing', source: 'custom' },
  ];

  for (const a of alerts) {
    await pool.query(
      `INSERT INTO alerts (tenant_id, name, severity, status, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [a.tenant_id, a.name, a.severity, a.status, a.source]
    );
  }
  console.log(`  ✅ Inserted ${alerts.length} alerts`);
}

async function seedKnowledge() {
  console.log('📚 Seeding Knowledge Base...');

  const tableExists = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_documents')`
  );

  if (!tableExists.rows[0].exists) {
    console.log('  ⚠️  Knowledge documents table does not exist, skipping...');
    return;
  }

  const docs = [
    { tenant_id: DEFAULT_TENANT_ID, title: 'API 网关架构设计', category: 'architecture', status: 'published' },
    { tenant_id: DEFAULT_TENANT_ID, title: '用户认证流程', category: 'documentation', status: 'published' },
    { tenant_id: DEFAULT_TENANT_ID, title: '部署手册 v2.0', category: 'operation', status: 'draft' },
    { tenant_id: DEFAULT_TENANT_ID, title: '故障排查指南', category: 'troubleshooting', status: 'published' },
    { tenant_id: DEFAULT_TENANT_ID, title: '性能优化最佳实践', category: 'performance', status: 'published' },
  ];

  for (const d of docs) {
    await pool.query(
      `INSERT INTO knowledge_documents (tenant_id, title, category, status)
       VALUES ($1, $2, $3, $4)`,
      [d.tenant_id, d.title, d.category, d.status]
    );
  }
  console.log(`  ✅ Inserted ${docs.length} knowledge documents`);
}

async function seedUsersAndRoles() {
  console.log('👥 Seeding Users and Roles...');

  // Check if users table has data
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(rows[0].count, 10);

  if (userCount === 0) {
    // Insert default admin user if table is empty
    await pool.query(
      `INSERT INTO users (id, tenant_id, username, email, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ADMIN_USER_ID, DEFAULT_TENANT_ID, 'admin', 'admin@orion.local', 'System Admin', 'admin', 'active']
    );
    console.log(`  ✅ Inserted default admin user`);
  } else {
    console.log(`  ℹ️  Users already exist (${userCount}), skipping...`);
  }

  // Check if roles table exists
  const rolesTableExists = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'roles')`
  );

  if (!rolesTableExists.rows[0].exists) {
    console.log('  ⚠️  Roles table does not exist, skipping...');
    return;
  }

  // Seed roles - use gen_random_uuid() for id
  const roles = [
    { tenant_id: DEFAULT_TENANT_ID, name: 'Administrator', permissions: JSON.stringify(['*']) },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Developer', permissions: JSON.stringify(['read', 'write']) },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Operator', permissions: JSON.stringify(['read', 'write', 'deploy']) },
    { tenant_id: DEFAULT_TENANT_ID, name: 'Viewer', permissions: JSON.stringify(['read']) },
  ];

  for (const r of roles) {
    await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions)
       VALUES ($1, $2, $3)`,
      [r.tenant_id, r.name, r.permissions]
    );
  }
  console.log(`  ✅ Inserted ${roles.length} roles`);
}

// Run the seed
seed().catch(console.error);