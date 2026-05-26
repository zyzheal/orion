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
    api.get<{ data?: { items?: any[]; data?: any[] } } | { items?: any[]; data?: any[] }>('/v1/pipeline-runs?limit=5&status=all'),
    api.get<{ data?: { items?: any[]; data?: any[] } } | { items?: any[]; data?: any[] }>('/v1/alerts?limit=5&status=active'),
    api.get<{ data?: { items?: any[]; data?: any[] } } | { items?: any[]; data?: any[] }>('/v1/tickets?limit=5&status=active'),
    api.get<{ data?: { items?: any[]; data?: any[] } } | { items?: any[]; data?: any[] }>('/v1/deployments?limit=5'),
  ]);

  // Parse pipeline runs
  const pipelineItems =
    pipelines.status === 'fulfilled'
      ? ((pipelines.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.items ||
          (pipelines.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.data ||
          ((pipelines.value.data as { data?: { data?: Array<Record<string, unknown>> } })?.data?.data || [])
        ) as Array<Record<string, unknown>>
      : [];

  // Parse alerts
  const alertItems =
    alerts.status === 'fulfilled'
      ? ((alerts.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.items ||
          (alerts.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.data ||
          ((alerts.value.data as { data?: { data?: Array<Record<string, unknown>> } })?.data?.data || [])
        ) as Array<Record<string, unknown>>
      : [];

  // Parse tickets
  const ticketItems =
    tickets.status === 'fulfilled'
      ? ((tickets.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.items ||
          (tickets.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.data ||
          ((tickets.value.data as { data?: { data?: Array<Record<string, unknown>> } })?.data?.data || [])
        ) as Array<Record<string, unknown>>
      : [];

  // Parse deployments
  const deploymentItems =
    deployments.status === 'fulfilled'
      ? ((deployments.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.items ||
          (deployments.value.data as { items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> })?.data ||
          ((deployments.value.data as { data?: { data?: Array<Record<string, unknown>> } })?.data?.data || [])
        ) as Array<Record<string, unknown>>
      : [];

  return {
    myPipelines: {
      recentRuns: pipelineItems.map((run: Record<string, unknown>) => ({
        id: run.id as string || '',
        name: (run.pipelineName as string) || (run.name as string) || 'Unknown Pipeline',
        status: run.status as string || 'unknown',
        createdAt: (run.createdAt as string) || (run.startedAt as string) || '',
        duration: (run.duration as number) || (run.durationMs as number) || 0,
      })),
      successRate: 0,
      totalRuns24h: 0,
      failedRuns: pipelineItems.filter((r: Record<string, unknown>) => r.status === 'failed').length,
    },
    myAlerts: {
      unread: alertItems.length,
      critical: alertItems.filter((a: Record<string, unknown>) => a.severity === 'critical').length,
      recent: alertItems.map((alert: Record<string, unknown>) => ({
        id: alert.id as string || '',
        severity: alert.severity as string || 'info',
        message: (alert.message as string) || (alert.description as string) || '',
        createdAt: alert.createdAt as string || '',
        acknowledged: alert.status === 'acknowledged' || alert.acknowledged || false,
      })),
    },
    myTickets: {
      active: ticketItems.length,
      overdue: ticketItems.filter((t: Record<string, unknown>) => t.isOverdue || (t.slaRemainingHours as number) < 0).length,
      recent: ticketItems.map((ticket: Record<string, unknown>) => ({
        id: (ticket.id as string) || (ticket.ticketId as string) || '',
        title: ticket.title as string || '',
        priority: ticket.priority as string || 'medium',
        status: ticket.status as string || 'pending',
        slaRemaining: (ticket.slaRemainingHours as number) ?? (ticket.slaRemaining as number) ?? 0,
      })),
    },
    myDeployments: {
      recent: deploymentItems.map((dep: Record<string, unknown>) => ({
        id: dep.id as string || '',
        environment: dep.environment as string || 'unknown',
        status: dep.status as string || 'unknown',
        version: (dep.version as string) || (dep.appVersion as string) || '',
        deployedAt: (dep.deployedAt as string) || (dep.createdAt as string) || '',
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
