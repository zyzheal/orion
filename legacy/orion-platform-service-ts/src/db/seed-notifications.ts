/**
 * Seed notification data for testing
 * Run: cd orion-platform-service && npx tsx src/db/seed-notifications.ts
 */

import { Pool } from 'pg';
import pino from 'pino';

const logger = pino({ name: 'seed-notifications' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'heal',
  password: process.env.DB_PASSWORD || 'heal123',
  database: process.env.DB_NAME || 'orion',
});

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

const NOTIFICATIONS = [
  { id: 'N001', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '您被分配了一个紧急工单 TKT-001: 生产数据库 CPU 使用率过高 (95%)', channel: 'in-app', status: 'sent', created_at: '2026-05-19T08:35:00Z' },
  { id: 'N002', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_escalated', title: '工单升级提醒', message: '工单 TKT-005 已超过 2 小时未处理，已自动升级到 L2', channel: 'in-app', status: 'sent', created_at: '2026-05-19T09:00:00Z' },
  { id: 'N003', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-002 即将超过 SLA 时限（剩余 30 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-19T09:15:00Z' },
  { id: 'N004', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'comment_mention', title: '被 @提及', message: '张伟在 TKT-001 的评论中 @了你：请帮忙确认监控数据', channel: 'in-app', status: 'sent', created_at: '2026-05-19T09:30:00Z' },
  { id: 'N005', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline api-service-build 执行成功，耗时 5m 12s', channel: 'in-app', status: 'read', created_at: '2026-05-19T08:00:00Z' },
  { id: 'N006', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'transfer_request', title: '工单转派请求', message: '李娜将工单 TKT-003 转派给您: API 网关 502 错误率上升', channel: 'in-app', status: 'read', created_at: '2026-05-19T07:45:00Z' },
  { id: 'N007', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_breached', title: 'SLA 已违约', message: '工单 TKT-008 已超过 SLA 时限 2 小时，请立即处理', channel: 'in-app', status: 'sent', created_at: '2026-05-19T06:00:00Z' },
  { id: 'N008', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'Event Bus 服务延迟超过阈值，当前 156ms（阈值 100ms）', channel: 'in-app', status: 'read', created_at: '2026-05-19T05:30:00Z' },
  { id: 'N009', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-009: 前端页面加载缓慢，LCP 超过 4s', channel: 'in-app', status: 'sent', created_at: '2026-05-19T04:20:00Z' },
  { id: 'N010', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline frontend-build 执行成功，耗时 3m 45s', channel: 'in-app', status: 'read', created_at: '2026-05-19T04:00:00Z' },
  { id: 'N011', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-010 即将超过 SLA 时限（剩余 15 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-19T03:45:00Z' },
  { id: 'N012', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'Redis 集群内存使用率达到 85%', channel: 'in-app', status: 'sent', created_at: '2026-05-19T03:30:00Z' },
  { id: 'N013', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_escalated', title: '工单升级提醒', message: '工单 TKT-011 已超过 4 小时未处理，已升级到 L3', channel: 'in-app', status: 'sent', created_at: '2026-05-19T03:00:00Z' },
  { id: 'N014', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'comment_mention', title: '被 @提及', message: '王磊在 PR-234 的评论中 @了你：需要确认 API 兼容性', channel: 'in-app', status: 'read', created_at: '2026-05-19T02:30:00Z' },
  { id: 'N015', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline payment-service-deploy 执行成功，耗时 8m 20s', channel: 'in-app', status: 'read', created_at: '2026-05-19T02:00:00Z' },
  { id: 'N016', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-012: 订单支付接口偶尔返回 500 错误', channel: 'in-app', status: 'sent', created_at: '2026-05-19T01:30:00Z' },
  { id: 'N017', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_breached', title: 'SLA 已违约', message: '工单 TKT-013 已超过 SLA 时限 4 小时', channel: 'in-app', status: 'sent', created_at: '2026-05-19T01:00:00Z' },
  { id: 'N018', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'transfer_request', title: '工单转派请求', message: '赵强将工单 TKT-014 转派给您: 日志收集服务异常', channel: 'in-app', status: 'read', created_at: '2026-05-19T00:30:00Z' },
  { id: 'N019', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'K8s 节点 node-03 磁盘使用率超过 90%', channel: 'in-app', status: 'sent', created_at: '2026-05-19T00:00:00Z' },
  { id: 'N020', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline user-service-build 执行成功，耗时 4m 10s', channel: 'in-app', status: 'read', created_at: '2026-05-18T23:30:00Z' },
  { id: 'N021', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-015: 用户登录偶尔失败，返回 401', channel: 'in-app', status: 'sent', created_at: '2026-05-18T23:00:00Z' },
  { id: 'N022', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-016 即将超过 SLA 时限（剩余 45 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-18T22:30:00Z' },
  { id: 'N023', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'comment_mention', title: '被 @提及', message: '刘洋在 TKT-012 的评论中 @了你：这个问题可能与缓存有关', channel: 'in-app', status: 'sent', created_at: '2026-05-18T22:00:00Z' },
  { id: 'N024', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_escalated', title: '工单升级提醒', message: '工单 TKT-017 已超过 1 小时未处理，已升级到 L2', channel: 'in-app', status: 'read', created_at: '2026-05-18T21:30:00Z' },
  { id: 'N025', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'API 网关响应时间超过 P99 阈值，当前 890ms', channel: 'in-app', status: 'read', created_at: '2026-05-18T21:00:00Z' },
  { id: 'N026', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline notification-service-build 执行成功，耗时 3m 55s', channel: 'in-app', status: 'read', created_at: '2026-05-18T20:30:00Z' },
  { id: 'N027', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-018: 通知推送服务偶发延迟', channel: 'in-app', status: 'read', created_at: '2026-05-18T20:00:00Z' },
  { id: 'N028', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_breached', title: 'SLA 已违约', message: '工单 TKT-019 已超过 SLA 时限 1 小时', channel: 'in-app', status: 'sent', created_at: '2026-05-18T19:30:00Z' },
  { id: 'N029', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'transfer_request', title: '工单转派请求', message: '陈静将工单 TKT-020 转派给您: 数据库慢查询', channel: 'in-app', status: 'read', created_at: '2026-05-18T19:00:00Z' },
  { id: 'N030', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'Prometheus 存储空间不足，剩余 5GB', channel: 'in-app', status: 'read', created_at: '2026-05-18T18:30:00Z' },
  { id: 'N031', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline gateway-service-deploy 执行成功，耗时 6m 30s', channel: 'in-app', status: 'read', created_at: '2026-05-18T18:00:00Z' },
  { id: 'N032', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-021: 灰度发布流量分配异常', channel: 'in-app', status: 'read', created_at: '2026-05-18T17:30:00Z' },
  { id: 'N033', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-022 即将超过 SLA 时限（剩余 20 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-18T17:00:00Z' },
  { id: 'N034', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'comment_mention', title: '被 @提及', message: '马超在文档《系统架构设计 v2》中 @了你：请评审', channel: 'in-app', status: 'read', created_at: '2026-05-18T16:30:00Z' },
  { id: 'N035', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_escalated', title: '工单升级提醒', message: '工单 TKT-023 已超过 3 小时未处理，已升级到 L3', channel: 'in-app', status: 'sent', created_at: '2026-05-18T16:00:00Z' },
  { id: 'N036', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'Grafana 面板加载超时，请检查数据源连接', channel: 'in-app', status: 'read', created_at: '2026-05-18T15:30:00Z' },
  { id: 'N037', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline auth-service-build 执行成功，耗时 4m 45s', channel: 'in-app', status: 'read', created_at: '2026-05-18T15:00:00Z' },
  { id: 'N038', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-024: 租户隔离策略配置错误', channel: 'in-app', status: 'read', created_at: '2026-05-18T14:30:00Z' },
  { id: 'N039', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_breached', title: 'SLA 已违约', message: '工单 TKT-025 已超过 SLA 时限 3 小时', channel: 'in-app', status: 'read', created_at: '2026-05-18T14:00:00Z' },
  { id: 'N040', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'transfer_request', title: '工单转派请求', message: '黄磊将工单 TKT-026 转派给您: CI 缓存清理', channel: 'in-app', status: 'read', created_at: '2026-05-18T13:30:00Z' },
  { id: 'N041', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: '向量数据库查询延迟突增，P95 达到 350ms', channel: 'in-app', status: 'sent', created_at: '2026-05-18T13:00:00Z' },
  { id: 'N042', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline pipeline-engine-build 执行成功，耗时 5m 30s', channel: 'in-app', status: 'read', created_at: '2026-05-18T12:30:00Z' },
  { id: 'N043', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-027: AI 网关 Token 限额即将耗尽', channel: 'in-app', status: 'sent', created_at: '2026-05-18T12:00:00Z' },
  { id: 'N044', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-028 即将超过 SLA 时限（剩余 10 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-18T11:30:00Z' },
  { id: 'N045', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'comment_mention', title: '被 @提及', message: '孙丽在 Sprint 回顾文档中 @了你：请补充反馈', channel: 'in-app', status: 'sent', created_at: '2026-05-18T11:00:00Z' },
  { id: 'N046', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_escalated', title: '工单升级提醒', message: '工单 TKT-029 已超过 30 分钟未响应，已升级到 L2', channel: 'in-app', status: 'read', created_at: '2026-05-18T10:30:00Z' },
  { id: 'N047', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: '混沌工程测试实例超时，请检查资源配额', channel: 'in-app', status: 'read', created_at: '2026-05-18T10:00:00Z' },
  { id: 'N048', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline monitoring-service-build 执行成功，耗时 4m 15s', channel: 'in-app', status: 'read', created_at: '2026-05-18T09:30:00Z' },
  { id: 'N049', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-030: FinOps 成本分析报告数据不准确', channel: 'in-app', status: 'read', created_at: '2026-05-18T09:00:00Z' },
  { id: 'N050', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_breached', title: 'SLA 已违约', message: '工单 TKT-031 已超过 SLA 时限 5 小时', channel: 'in-app', status: 'read', created_at: '2026-05-18T08:30:00Z' },
  { id: 'N051', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'transfer_request', title: '工单转派请求', message: '周杰将工单 TKT-032 转派给您: 知识库搜索优化', channel: 'in-app', status: 'read', created_at: '2026-05-18T08:00:00Z' },
  { id: 'N052', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'system_alert', title: '系统告警', message: 'IaC 模块 Terraform 状态锁未释放', channel: 'in-app', status: 'sent', created_at: '2026-05-18T07:30:00Z' },
  { id: 'N053', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'pipeline_completed', title: 'Pipeline 完成', message: 'Pipeline compliance-check 执行成功，耗时 7m 40s', channel: 'in-app', status: 'read', created_at: '2026-05-18T07:00:00Z' },
  { id: 'N054', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'ticket_assigned', title: '新工单分配', message: '工单 TKT-033: 安全扫描发现 3 个高危漏洞', channel: 'in-app', status: 'sent', created_at: '2026-05-18T06:30:00Z' },
  { id: 'N055', user_id: ADMIN_USER_ID, tenant_id: 'default', type: 'sla_warning', title: 'SLA 警告', message: '工单 TKT-034 即将超过 SLA 时限（剩余 25 分钟）', channel: 'in-app', status: 'sent', created_at: '2026-05-18T06:00:00Z' },
];

async function seed() {
  // Check if data already exists
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1', [ADMIN_USER_ID]);
  const count = parseInt(rows[0].count, 10);
  if (count > 0) {
    logger.info(`Notifications already seeded: ${count} records exist. Skipping.`);
    return;
  }

  for (const n of NOTIFICATIONS) {
    await pool.query(
      `INSERT INTO notifications (id, user_id, tenant_id, type, title, message, channel, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [n.id, n.user_id, n.tenant_id, n.type, n.title, n.message, n.channel, n.status, n.created_at]
    );
  }
  logger.info(`Seeded ${NOTIFICATIONS.length} notifications for user_id=1`);
}

async function main() {
  try {
    await seed();
    logger.info('Seed completed');
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
