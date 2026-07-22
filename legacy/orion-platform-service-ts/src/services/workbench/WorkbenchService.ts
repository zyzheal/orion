/**
 * WorkbenchService - Aggregated personal workbench for engineers
 *
 * Combines pipeline, alert, ticket, and deployment data into a single
 * personalized view for the "个人工作台" frontend page.
 */

import { DatabasePool } from '../database';

export interface WorkbenchPipelineData {
  recentRuns: Array<{ id: string; name: string; status: string; createdAt: string; durationMs: number }>;
  successRate: number;
  totalRuns24h: number;
  failedRuns: number;
}

export interface WorkbenchAlertData {
  unread: number;
  critical: number;
  recent: Array<{ id: string; severity: string; message: string; createdAt: string; acknowledged: boolean }>;
}

export interface WorkbenchTicketData {
  active: number;
  overdue: number;
  recent: Array<{ id: string; title: string; priority: string; status: string; slaRemaining: number }>;
}

export interface WorkbenchDeploymentData {
  recent: Array<{ id: string; environment: string; status: string; version: string; deployedAt: string }>;
  successRate: number;
}

export interface WorkbenchData {
  myPipelines: WorkbenchPipelineData;
  myAlerts: WorkbenchAlertData;
  myTickets: WorkbenchTicketData;
  myDeployments: WorkbenchDeploymentData;
}

export class WorkbenchService {
  constructor(private pool: DatabasePool) {}

  async getWorkbench(userId: string, tenantId: string = 'default'): Promise<WorkbenchData> {
    const [pipelines, alerts, tickets, deployments] = await Promise.allSettled([
      this.getPipelineData(userId, tenantId),
      this.getAlertData(userId, tenantId),
      this.getTicketData(userId, tenantId),
      this.getDeploymentData(userId, tenantId),
    ]);

    return {
      myPipelines: pipelines.status === 'fulfilled' ? pipelines.value : {
        recentRuns: [], successRate: 0, totalRuns24h: 0, failedRuns: 0,
      },
      myAlerts: alerts.status === 'fulfilled' ? alerts.value : {
        unread: 0, critical: 0, recent: [],
      },
      myTickets: tickets.status === 'fulfilled' ? tickets.value : {
        active: 0, overdue: 0, recent: [],
      },
      myDeployments: deployments.status === 'fulfilled' ? deployments.value : {
        recent: [], successRate: 0,
      },
    };
  }

  private async getPipelineData(_userId: string, _tenantId: string): Promise<WorkbenchPipelineData> {
    const runsResult = await this.pool.query(
      `SELECT id, name, status, created_at, duration_ms
       FROM pipeline_runs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [_tenantId]
    );

    const statsResult = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS total_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'completed') AS success_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'failed') AS failed_24h
       FROM pipeline_runs
       WHERE tenant_id = $1`,
      [_tenantId]
    );

    const total24h = parseInt(statsResult.rows[0].total_24h || '0', 10);
    const success24h = parseInt(statsResult.rows[0].success_24h || '0', 10);
    const failed24h = parseInt(statsResult.rows[0].failed_24h || '0', 10);

    return {
      recentRuns: runsResult.rows.map((r: any) => ({
        id: r.id, name: r.name, status: r.status,
        createdAt: r.created_at?.toISOString() || '', durationMs: parseInt(r.duration_ms || '0', 10),
      })),
      successRate: total24h > 0 ? Math.round((success24h / total24h) * 100) : 0,
      totalRuns24h: total24h,
      failedRuns: failed24h,
    };
  }

  private async getAlertData(_userId: string, _tenantId: string): Promise<WorkbenchAlertData> {
    const unreadResult = await this.pool.query(
      `SELECT COUNT(*) FROM alerts WHERE tenant_id = $1 AND status = 'active'`,
      [_tenantId]
    );

    const criticalResult = await this.pool.query(
      `SELECT COUNT(*) FROM alerts WHERE tenant_id = $1 AND status = 'active' AND severity = 'critical'`,
      [_tenantId]
    );

    const recentResult = await this.pool.query(
      `SELECT id, severity, message, created_at, acknowledged
       FROM alerts
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 5`,
      [_tenantId]
    );

    return {
      unread: parseInt(unreadResult.rows[0].count || '0', 10),
      critical: parseInt(criticalResult.rows[0].count || '0', 10),
      recent: recentResult.rows.map((r: any) => ({
        id: r.id, severity: r.severity, message: r.message,
        createdAt: r.created_at?.toISOString() || '', acknowledged: !!r.acknowledged,
      })),
    };
  }

  private async getTicketData(_userId: string, _tenantId: string): Promise<WorkbenchTicketData> {
    const activeResult = await this.pool.query(
      `SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'in_progress', 'assigned')`,
      [_tenantId]
    );

    const overdueResult = await this.pool.query(
      `SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status IN ('open', 'in_progress', 'assigned') AND sla_deadline < NOW()`,
      [_tenantId]
    );

    const recentResult = await this.pool.query(
      `SELECT id, title, priority, status, sla_deadline
       FROM tickets
       WHERE tenant_id = $1 AND status IN ('open', 'in_progress', 'assigned')
       ORDER BY created_at DESC
       LIMIT 5`,
      [_tenantId]
    );

    return {
      active: parseInt(activeResult.rows[0].count || '0', 10),
      overdue: parseInt(overdueResult.rows[0].count || '0', 10),
      recent: recentResult.rows.map((r: any) => ({
        id: r.id, title: r.title, priority: r.priority, status: r.status,
        slaRemaining: r.sla_deadline
          ? Math.round((new Date(r.sla_deadline).getTime() - Date.now()) / 3600000)
          : 0,
      })),
    };
  }

  private async getDeploymentData(_userId: string, _tenantId: string): Promise<WorkbenchDeploymentData> {
    const recentResult = await this.pool.query(
      `SELECT id, environment, status, version, deployed_at
       FROM deployment_history
       WHERE tenant_id = $1
       ORDER BY deployed_at DESC
       LIMIT 5`,
      [_tenantId]
    );

    const statsResult = await this.pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('success', 'completed')) AS success_count
       FROM deployment_history
       WHERE tenant_id = $1 AND deployed_at > NOW() - INTERVAL '7 days'`,
      [_tenantId]
    );

    const total = parseInt(statsResult.rows[0].total || '0', 10);
    const success = parseInt(statsResult.rows[0].success_count || '0', 10);

    return {
      recent: recentResult.rows.map((r: any) => ({
        id: r.id, environment: r.environment, status: r.status,
        version: r.version || '', deployedAt: r.deployed_at?.toISOString() || '',
      })),
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
    };
  }
}
