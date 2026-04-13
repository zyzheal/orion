/**
 * Page Data Models for TASK-905 Core Pages
 * - Dashboard metrics and KPIs
 * - Pipeline list and detail models
 * - Deployment list and detail models
 * - Alert list and detail models
 */

import type { StatusType } from '@/components/StatusBadge';

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardMetric {
  /** Unique metric identifier */
  id: string;
  /** Display title */
  title: string;
  /** Current value */
  value: number | string;
  /** Unit label */
  unit?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Trend percentage */
  trendPercent?: number;
  /** Previous period value */
  previousValue?: number | string;
  /** Color theme override */
  color?: string;
}

export interface ActivityEvent {
  /** Unique event ID */
  id: string;
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Event timestamp */
  time: string | Date;
  /** Event type */
  type: 'pipeline' | 'deployment' | 'alert' | 'config' | 'other';
  /** Associated status */
  status?: StatusType;
  /** User who triggered the event */
  user?: string;
}

export interface QuickAction {
  /** Action name */
  name: string;
  /** Action icon (Ant Design icon name) */
  icon: string;
  /** Navigation path */
  path: string;
  /** Color theme */
  color: string;
  /** Description */
  description: string;
}

export interface DashboardData {
  /** KPI metrics */
  metrics: DashboardMetric[];
  /** Recent activity events */
  recentActivity: ActivityEvent[];
  /** Quick action shortcuts */
  quickActions: QuickAction[];
  /** System health summary */
  systemHealth: { name: string; status: StatusType; latency: string }[];
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineStage {
  /** Stage name */
  name: string;
  /** Stage status */
  status: StatusType;
  /** Stage duration in seconds */
  duration?: number;
  /** Stage start time */
  startTime?: string;
  /** Stage end time */
  endTime?: string;
  /** Stage logs */
  logs?: string[];
  /** Step details within the stage */
  steps?: StageStep[];
}

export interface StageStep {
  /** Step name */
  name: string;
  /** Step status */
  status: StatusType;
  /** Step duration in seconds */
  duration?: number;
  /** Step output */
  output?: string;
}

export interface PipelineRun {
  /** Unique run ID */
  id: string;
  /** Pipeline name */
  name: string;
  /** Run number */
  runNumber: number;
  /** Run status */
  status: StatusType;
  /** Git branch */
  branch: string;
  /** Commit hash */
  commit?: string;
  /** Author/trigger user */
  author: string;
  /** Trigger type */
  trigger: 'manual' | 'push' | 'schedule' | 'api';
  /** Start time */
  startTime: string;
  /** End time */
  endTime?: string;
  /** Duration in seconds */
  duration?: number;
  /** Pipeline stages */
  stages?: PipelineStage[];
  /** Pipeline definition ID */
  pipelineId?: string;
}

export interface PipelineListFilters {
  /** Search query */
  search?: string;
  /** Filter by status */
  status?: StatusType | 'all';
  /** Filter by branch */
  branch?: string;
  /** Filter by trigger type */
  trigger?: string;
}

// ============================================================================
// Deployment Types
// ============================================================================

export interface DeploymentStage {
  /** Stage name */
  name: string;
  /** Stage status */
  status: StatusType;
  /** Stage duration */
  duration?: number;
  /** Stage details */
  details?: string;
}

export interface HealthCheckResult {
  /** Check name */
  name: string;
  /** Check status */
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  /** Check detail message */
  message?: string;
  /** Response time in ms */
  latency?: number;
}

export interface Deployment {
  /** Unique deployment ID */
  id: string;
  /** Application name */
  appName: string;
  /** Deployed version */
  version: string;
  /** Target environment */
  environment: 'production' | 'staging' | 'development' | 'test';
  /** Deployment strategy */
  strategy: 'rolling' | 'blue-green' | 'canary' | 'recreate';
  /** Deployment status */
  status: StatusType;
  /** Deployment trigger user */
  triggeredBy: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime?: string;
  /** Duration in seconds */
  duration?: number;
  /** Deployment stages */
  stages?: DeploymentStage[];
  /** Health check results */
  healthChecks?: HealthCheckResult[];
  /** Source pipeline run ID */
  pipelineRunId?: string;
  /** Git commit reference */
  commit?: string;
  /** Rollback source deployment ID */
  rollbackFrom?: string;
}

export interface DeploymentListFilters {
  /** Search query */
  search?: string;
  /** Filter by status */
  status?: StatusType | 'all';
  /** Filter by environment */
  environment?: string;
  /** Filter by application */
  appName?: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

export interface Alert {
  /** Unique alert ID */
  id: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alerting metric name */
  metric: string;
  /** Current metric value */
  value: string;
  /** Alert threshold */
  threshold: string;
  /** Current alert status */
  status: AlertStatus;
  /** Alert message/description */
  message: string;
  /** Source service/component */
  source: string;
  /** First triggered time */
  firstTriggered: string;
  /** Last updated time */
  lastUpdated: string;
  /** Alert acknowledgement user */
  acknowledgedBy?: string;
  /** Alert acknowledgement time */
  acknowledgedAt?: string;
  /** Alert resolution user */
  resolvedBy?: string;
  /** Alert resolution time */
  resolvedAt?: string;
}

export interface AlertListFilters {
  /** Search query */
  search?: string;
  /** Filter by severity */
  severity?: AlertSeverity | 'all';
  /** Filter by status */
  status?: AlertStatus | 'all';
  /** Filter by source */
  source?: string;
}

// ============================================================================
// BI Dashboard Types
// ============================================================================

export interface KPIMetric {
  title: string;
  value: string | number;
  suffix?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  status?: 'success' | 'warning' | 'error' | 'normal';
}

export interface ExecutiveDashboardData {
  overview: {
    totalTickets: number;
    resolvedTickets: number;
    openTickets: number;
    overallResolutionRate: number;
    avgResolutionTimeHours: number;
    slaComplianceRate: number;
    totalEngineers: number;
    activeEngineers: number;
  };
  trends: {
    ticketVolumeTrend: { period: string; created: number; resolved: number; open: number }[];
    resolutionTimeTrend: { period: string; avgHours: number; medianHours: number }[];
    slaComplianceTrend: { period: string; rate: number }[];
  };
  teamRanking: {
    topPerformers: { engineerId: string; name: string; score: number; resolved: number }[];
    bottomPerformers: { engineerId: string; name: string; score: number; needsAttention: string }[];
  };
  alerts: {
    slaBreachedCount: number;
    overdueTicketsCount: number;
    overloadedEngineers: number;
    unassignedOlderThan24h: number;
  };
  distribution: {
    byCategory: Record<string, { count: number; avgResolutionHours: number }>;
    byPriority: Record<string, { count: number; resolved: number }>;
  };
}

export interface ManagerDashboardData {
  teamOverview: {
    totalTickets: number;
    resolvedCount: number;
    avgResolutionTimeHours: number;
    slaComplianceRate: number;
    teamLoadPercentage: number;
  };
  memberMetrics: {
    engineerId: string;
    engineerName: string;
    period: string;
    workload: { totalAssigned: number; totalResolved: number };
    efficiency: { avgResolutionTimeMs: number; ticketsPerDay: number };
    quality: { slaComplianceRate: number; firstTimeResolveRate: number; reopenRate: number };
    compositeScore: number;
    performanceGrade: string;
    trend: 'improving' | 'stable' | 'declining';
  }[];
  weekOverWeek: {
    ticketsCreatedChange: number;
    resolvedChange: number;
    avgResolutionTimeChange: number;
    slaComplianceChange: number;
  };
  transferAnalysis: {
    totalTransfers: number;
    avgTransfersPerTicket: number;
    topTransferReasons: { reason: string; count: number }[];
  };
}

export interface EngineerDashboardData {
  personalOverview: {
    engineerId: string;
    engineerName: string;
    currentLoad: number;
    totalResolved: number;
    avgResolutionTimeHours: number;
    slaComplianceRate: number;
    performanceGrade: string;
    rank: number;
    totalInTeam: number;
  };
  personalTrend: {
    period: string;
    resolved: number;
    avgResolutionHours: number;
    slaCompliant: number;
  }[];
  strengths: {
    category: string;
    resolvedCount: number;
    slaComplianceRate: number;
    proficiencyScore: number;
  }[];
  weaknesses: {
    category: string;
    resolvedCount: number;
    slaComplianceRate: number;
    suggestion: string;
  }[];
  activeTickets: {
    ticketId: string;
    title: string;
    priority: string;
    status: string;
    elapsedHours: number;
    slaRemainingHours: number;
    isOverdue: boolean;
  }[];
}
