/**
 * Workbench API Service
 * Unified personal workbench data aggregation from multiple services:
 * - My Pipelines
 * - My Alerts
 * - My Tickets
 * - My Deployments
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface PipelineRunSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  duration: number;
}

export interface MyPipelinesData {
  recentRuns: PipelineRunSummary[];
  successRate: number;
  totalRuns24h: number;
  failedRuns: number;
}

export interface AlertSummary {
  id: string;
  severity: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface MyAlertsData {
  unread: number;
  critical: number;
  recent: AlertSummary[];
}

export interface TicketSummary {
  id: string;
  title: string;
  priority: string;
  status: string;
  slaRemaining: number;
}

export interface MyTicketsData {
  active: number;
  overdue: number;
  recent: TicketSummary[];
}

export interface DeploymentSummary {
  id: string;
  environment: string;
  status: string;
  version: string;
  deployedAt: string;
}

export interface MyDeploymentsData {
  recent: DeploymentSummary[];
  successRate: number;
}

/** Unified workbench response */
export interface WorkbenchData {
  myPipelines: MyPipelinesData;
  myAlerts: MyAlertsData;
  myTickets: MyTicketsData;
  myDeployments: MyDeploymentsData;
}

// ============================================================================
// Unified endpoint (if available on backend)
// ============================================================================

/**
 * Fetch unified workbench data from aggregated endpoint.
 * Falls back to individual API calls if endpoint not available.
 */
export async function getWorkbenchData(): Promise<WorkbenchData> {
  try {
    const response = await api.get('/v1/workbench');
    const body = response.data as { success: boolean; data: WorkbenchData };
    if (body?.success && body?.data) {
      return body.data;
    }
    throw new Error('Workbench API returned unexpected format');
  } catch {
    // Unified endpoint not available, use fallback
    return getWorkbenchFallback();
  }
}

// ============================================================================
// Fallback: parallel individual API calls
// ============================================================================

/**
 * Fallback implementation that calls individual APIs in parallel
 * and assembles the workbench data from their responses.
 */
export async function getWorkbenchFallback(): Promise<WorkbenchData> {
  const [pipelines, alerts, tickets, deployments] = await Promise.allSettled([
    api.get('/v1/pipeline-runs?limit=5&status=all'),
    api.get('/v1/alerts?limit=5&status=active'),
    api.get('/v1/tickets?limit=5&status=active'),
    api.get('/v1/deployments?limit=5'),
  ]);

  // Parse pipeline runs
  const pipelineItems =
    pipelines.status === 'fulfilled'
      ? (pipelines.value.data?.items || pipelines.value.data?.data || [])
      : [];

  // Parse alerts
  const alertItems =
    alerts.status === 'fulfilled'
      ? (alerts.value.data?.items || alerts.value.data?.data || [])
      : [];

  // Parse tickets
  const ticketItems =
    tickets.status === 'fulfilled'
      ? (tickets.value.data?.items || tickets.value.data?.data || [])
      : [];

  // Parse deployments
  const deploymentItems =
    deployments.status === 'fulfilled'
      ? (deployments.value.data?.items || deployments.value.data?.data || [])
      : [];

  return {
    myPipelines: {
      recentRuns: pipelineItems.map((run: any) => ({
        id: run.id || '',
        name: run.pipelineName || run.name || 'Unknown Pipeline',
        status: run.status || 'unknown',
        createdAt: run.createdAt || run.startedAt || '',
        duration: run.duration || run.durationMs || 0,
      })),
      successRate: 0,
      totalRuns24h: 0,
      failedRuns: pipelineItems.filter((r: any) => r.status === 'failed').length,
    },
    myAlerts: {
      unread: alertItems.length,
      critical: alertItems.filter((a: any) => a.severity === 'critical').length,
      recent: alertItems.map((alert: any) => ({
        id: alert.id || '',
        severity: alert.severity || 'info',
        message: alert.message || alert.description || '',
        createdAt: alert.createdAt || '',
        acknowledged: alert.status === 'acknowledged' || alert.acknowledged || false,
      })),
    },
    myTickets: {
      active: ticketItems.length,
      overdue: ticketItems.filter((t: any) => t.isOverdue || t.slaRemainingHours < 0).length,
      recent: ticketItems.map((ticket: any) => ({
        id: ticket.id || ticket.ticketId || '',
        title: ticket.title || '',
        priority: ticket.priority || 'medium',
        status: ticket.status || 'pending',
        slaRemaining: ticket.slaRemainingHours ?? ticket.slaRemaining ?? 0,
      })),
    },
    myDeployments: {
      recent: deploymentItems.map((dep: any) => ({
        id: dep.id || '',
        environment: dep.environment || 'unknown',
        status: dep.status || 'unknown',
        version: dep.version || dep.appVersion || '',
        deployedAt: dep.deployedAt || dep.createdAt || '',
      })),
      successRate: 0,
    },
  };
}

// ============================================================================
// Individual API helpers (for granular calls)
// ============================================================================

/** Fetch my recent pipeline runs */
export function getMyPipelineRuns(limit = 5) {
  return api.get('/v1/pipeline-runs', { params: { limit, status: 'all' } });
}

/** Fetch my active alerts */
export function getMyAlerts(limit = 5) {
  return api.get('/v1/alerts', { params: { limit, status: 'active' } });
}

/** Fetch my active tickets */
export function getMyTickets(limit = 5) {
  return api.get('/v1/tickets', { params: { limit, status: 'active' } });
}

/** Fetch my recent deployments */
export function getMyDeployments(limit = 5) {
  return api.get('/v1/deployments', { params: { limit } });
}

/** Acknowledge an alert */
export function acknowledgeAlert(alertId: string) {
  return api.post(`/v1/alerts/${alertId}/acknowledge`);
}
