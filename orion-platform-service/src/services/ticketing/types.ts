/**
 * TASK-801: Smart Ticketing - Type Definitions
 *
 * Data models for ticket lifecycle, workflow transitions,
 * assignment rules, ticket relations, and SLA tracking.
 */

// ==================== Ticket Core Types ====================

/**
 * Ticket category for smart classification
 */
export type TicketCategory =
  | 'infrastructure'
  | 'application'
  | 'database'
  | 'network'
  | 'security'
  | 'deployment'
  | 'pipeline'
  | 'performance'
  | 'cost'
  | 'other';

/**
 * Ticket priority level
 */
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Ticket status in workflow
 */
export type TicketStatus = 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';

/**
 * Ticket source - where the ticket originated
 */
export type TicketSource = 'manual' | 'alert' | 'incident' | 'api';

/**
 * Main ticket entity
 */
export interface Ticket {
  /** Unique ticket ID */
  id: string;
  /** Ticket title */
  title: string;
  /** Detailed description */
  description: string;
  /** Categorized type of the ticket */
  category: TicketCategory;
  /** Priority level */
  priority: TicketPriority;
  /** Current workflow status */
  status: TicketStatus;
  /** User ID assigned to work on the ticket */
  assignee?: string;
  /** User ID who created/reported the ticket */
  reporter: string;
  /** When the ticket was created */
  createdAt: Date;
  /** When the ticket was last updated */
  updatedAt: Date;
  /** Expected resolution deadline */
  dueDate?: Date;
  /** Source of the ticket */
  source: TicketSource;
  /** ID of the source alert (if generated from alert) */
  sourceAlertId?: string;
  /** ID of the source incident (if generated from incident) */
  sourceIncidentId?: string;
  /** Tags for filtering and grouping */
  tags?: Record<string, string>;
  /** Optional metadata from source system */
  metadata?: Record<string, any>;
  /** Resolution notes when closing */
  resolutionNote?: string;
  /** Escalation level (0 = not escalated) */
  escalationLevel: number;
}

// ==================== Workflow Types ====================

/**
 * Valid workflow transitions
 */
export interface WorkflowTransition {
  /** From status */
  from: TicketStatus;
  /** To status */
  to: TicketStatus;
  /** Whether this transition is allowed */
  allowed: boolean;
}

/**
 * Workflow history entry
 */
export interface WorkflowHistory {
  /** History entry ID */
  id: string;
  /** Ticket ID */
  ticketId: string;
  /** Previous status */
  fromStatus: TicketStatus;
  /** New status */
  toStatus: TicketStatus;
  /** User who performed the transition */
  performedBy: string;
  /** When the transition occurred */
  performedAt: Date;
  /** Optional reason for the transition */
  reason?: string;
}

// ==================== Assignment Types ====================

/**
 * Ticket assignment record
 */
export interface TicketAssignment {
  /** Assignment ID */
  id: string;
  /** Ticket being assigned */
  ticketId: string;
  /** User ID of the assignee */
  assignee: string;
  /** User ID who made the assignment */
  assignedBy: string;
  /** When the assignment was made */
  assignedAt: Date;
  /** Reason for this assignment (e.g., expertise match, round-robin) */
  reason: string;
  /** Category expertise match score (0-1) */
  matchScore?: number;
}

/**
 * Assignment rule for auto-assignment
 */
export interface AssignmentRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Categories this rule applies to */
  categories: TicketCategory[];
  /** Assignee user ID */
  assignee: string;
  /** Priority levels this rule applies to */
  priorities?: TicketPriority[];
  /** Whether the rule is active */
  enabled: boolean;
  /** Assignment order (lower = higher priority) */
  order: number;
}

// ==================== Relation Types ====================

/**
 * Type of relation between tickets
 */
export type TicketRelationType = 'duplicate' | 'caused-by' | 'related' | 'blocks' | 'blocked-by';

/**
 * Relation between two tickets
 */
export interface TicketRelation {
  /** Relation ID */
  id: string;
  /** Primary ticket ID */
  ticketId: string;
  /** Related ticket ID */
  relatedTicketId: string;
  /** Type of relationship */
  relationType: TicketRelationType;
  /** Confidence score for automated relations (0-1) */
  confidence?: number;
  /** When the relation was created */
  createdAt: Date;
  /** User who created the relation (null if auto-detected) */
  createdBy?: string;
  /** Description of the relationship */
  description?: string;
}

// ==================== SLA Types ====================

/**
 * SLA target configuration
 */
export interface SLATarget {
  /** SLA ID */
  id: string;
  /** SLA name */
  name: string;
  /** Applicable priority */
  priority: TicketPriority;
  /** Target response time in milliseconds */
  targetResponseTimeMs: number;
  /** Target resolution time in milliseconds */
  targetResolutionTimeMs: number;
  /** Whether this SLA is active */
  enabled: boolean;
}

/**
 * SLA tracking for a ticket
 */
export interface TicketSLA {
  /** SLA tracking ID */
  id: string;
  /** Associated ticket ID */
  ticketId: string;
  /** SLA target applied */
  slaTargetId: string;
  /** Target resolution time in milliseconds */
  targetResolutionTimeMs: number;
  /** Actual resolution time (null if not resolved) */
  actualResolutionTimeMs?: number;
  /** Whether SLA has been breached */
  breached: boolean;
  /** When the SLA was breached (null if not breached) */
  breachedAt?: Date;
  /** When the ticket was resolved */
  resolvedAt?: Date;
  /** Time of first response */
  firstResponseAt?: Date;
  /** Response SLA breached */
  responseBreached: boolean;
}

// ==================== Report Types ====================

/**
 * SLA compliance summary
 */
export interface SLAComplianceReport {
  /** Overall compliance percentage */
  complianceRate: number;
  /** Total tickets tracked */
  totalTickets: number;
  /** Tickets within SLA */
  compliantTickets: number;
  /** Tickets that breached SLA */
  breachedTickets: number;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, { total: number; compliant: number; rate: number }>;
  /** Breakdown by category */
  byCategory: Record<string, { total: number; compliant: number; rate: number }>;
  /** Report period start */
  periodStart: Date;
  /** Report period end */
  periodEnd: Date;
}

/**
 * Resolution time statistics
 */
export interface ResolutionStats {
  /** Mean resolution time in ms */
  meanResolutionTimeMs: number;
  /** Median resolution time in ms */
  medianResolutionTimeMs: number;
  /** P95 resolution time in ms */
  p95ResolutionTimeMs: number;
  /** Total resolved tickets */
  totalResolved: number;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, { mean: number; count: number }>;
  /** Breakdown by category */
  byCategory: Record<string, { mean: number; count: number }>;
}

/**
 * Backlog analysis
 */
export interface BacklogAnalysis {
  /** Current open tickets count */
  openCount: number;
  /** Assigned but not started */
  assignedCount: number;
  /** In progress count */
  inProgressCount: number;
  /** Overdue tickets count */
  overdueCount: number;
  /** Average age of open tickets in ms */
  averageAgeMs: number;
  /** Oldest ticket age in ms */
  oldestTicketAgeMs: number;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, number>;
  /** Breakdown by category */
  byCategory: Record<string, number>;
}

/**
 * Trend data point for time series
 */
export interface TrendDataPoint {
  /** Time bucket label */
  period: string;
  /** Number of tickets created */
  created: number;
  /** Number of tickets resolved */
  resolved: number;
  /** Number of tickets still open at period end */
  open: number;
  /** Average resolution time for this period */
  avgResolutionTimeMs?: number;
}

/**
 * Trend report over a time range
 */
export interface TrendReport {
  /** Time series data */
  dataPoints: TrendDataPoint[];
  /** Total created in period */
  totalCreated: number;
  /** Total resolved in period */
  totalResolved: number;
  /** Net change in open tickets */
  netChange: number;
  /** Trend direction */
  trend: 'increasing' | 'decreasing' | 'stable';
  /** Period granularity */
  granularity: 'hour' | 'day' | 'week' | 'month';
}

// ==================== Ticket Generator Types ====================

/**
 * Alert data for ticket generation
 */
export interface AlertTicketSource {
  /** Alert ID */
  alertId: string;
  /** Alert metric name */
  metric: string;
  /** Alert severity */
  severity: 'critical' | 'warning' | 'info';
  /** Alert message */
  message: string;
  /** Alert tags */
  tags?: Record<string, string>;
  /** Alert timestamp */
  triggeredAt: Date;
  /** Alert rule name */
  ruleName?: string;
}

/**
 * Incident data for ticket generation
 */
export interface IncidentTicketSource {
  /** Incident ID */
  incidentId: string;
  /** Incident title */
  title: string;
  /** Incident description */
  description: string;
  /** Incident severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Affected services */
  affectedServices?: string[];
  /** Incident tags */
  tags?: Record<string, string>;
  /** Reporter */
  reporter: string;
}

// ==================== Config Types ====================

/**
 * Ticketing service configuration
 */
export interface TicketingConfig {
  /** NATS subject prefix for ticketing events */
  natsSubjectPrefix: string;
  /** Default SLA targets by priority (in hours) */
  defaultSLAHours: Record<TicketPriority, number>;
  /** Auto-assignment enabled */
  enableAutoAssignment: boolean;
  /** Auto-escalation enabled */
  enableAutoEscalation: boolean;
  /** Escalation check interval in milliseconds */
  escalationCheckIntervalMs: number;
  /** Duplicate detection similarity threshold (0-1) */
  duplicateDetectionThreshold: number;
  /** Max tickets in memory */
  maxTicketsInMemory: number;
}

// ==================== BI & Analytics Types (TASK-TICKET-BI) ====================

/**
 * Time granularity for BI aggregation
 */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Engineer efficiency metrics for a time period
 */
export interface EngineerEfficiencyMetrics {
  /** Engineer user ID */
  engineerId: string;
  /** Engineer display name */
  engineerName: string;
  /** Period label (e.g., "2024-01") */
  period: string;
  /** Workload metrics */
  workload: {
    totalAssigned: number;
    totalResolved: number;
    totalTransferred: number;
    avgActiveTickets: number;
    peakConcurrent: number;
  };
  /** Efficiency metrics (time-based) */
  efficiency: {
    avgResolutionTimeMs: number;
    medianResolutionTimeMs: number;
    p95ResolutionTimeMs: number;
    avgFirstResponseTimeMs: number;
    avgTransferHoldTimeMs: number;
    ticketsPerDay: number;
  };
  /** Quality metrics */
  quality: {
    slaComplianceRate: number;
    firstTimeResolveRate: number;
    escalationRate: number;
    reopenRate: number;
    customerSatisfactionScore: number;
  };
  /** Collaboration metrics */
  collaboration: {
    transfersReceived: number;
    transfersGiven: number;
    backupCoverageCount: number;
    commentsCount: number;
  };
  /** Composite efficiency score (0-100) */
  compositeScore: number;
  /** Performance grade */
  performanceGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  /** Trend direction */
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Executive dashboard (boss view)
 */
export interface ExecutiveDashboard {
  /** Overview KPIs */
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
  /** Trend data */
  trends: {
    ticketVolumeTrend: { period: string; created: number; resolved: number; open: number }[];
    resolutionTimeTrend: { period: string; avgHours: number; medianHours: number }[];
    slaComplianceTrend: { period: string; rate: number }[];
    teamLoadTrend: { period: string; load: number }[];
  };
  /** Team ranking */
  teamRanking: {
    topPerformers: { engineerId: string; name: string; score: number; resolved: number }[];
    bottomPerformers: { engineerId: string; name: string; score: number; needsAttention: string }[];
  };
  /** Alerts requiring attention */
  alerts: {
    slaBreachedCount: number;
    overdueTicketsCount: number;
    overloadedEngineers: number;
    unassignedOlderThan24h: number;
  };
  /** Distribution breakdowns */
  distribution: {
    byCategory: Record<string, { count: number; avgResolutionHours: number }>;
    byPriority: Record<string, { count: number; resolved: number }>;
    bySource: Record<string, number>;
  };
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
}

/**
 * Manager dashboard
 */
export interface ManagerDashboard {
  /** Team overview */
  teamOverview: {
    totalTickets: number;
    resolvedCount: number;
    avgResolutionTimeHours: number;
    slaComplianceRate: number;
    teamLoadPercentage: number;
  };
  /** Individual member metrics */
  memberMetrics: EngineerEfficiencyMetrics[];
  /** Heatmap data: dayOfWeek (0=Sun) x hourOfDay (0-23) */
  heatmap: { dayOfWeek: number; hourOfDay: number; ticketCount: number }[];
  /** Week-over-week changes */
  weekOverWeek: {
    ticketsCreatedChange: number;
    resolvedChange: number;
    avgResolutionTimeChange: number;
    slaComplianceChange: number;
  };
  /** Transfer analysis */
  transferAnalysis: {
    totalTransfers: number;
    avgTransfersPerTicket: number;
    topTransferReasons: { reason: string; count: number }[];
    mostTransferredTickets: { ticketId: string; title: string; transferCount: number }[];
  };
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
}

/**
 * Engineer personal dashboard
 */
export interface EngineerDashboard {
  /** Personal overview */
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
  /** Personal trend data */
  personalTrend: {
    period: string;
    resolved: number;
    avgResolutionHours: number;
    slaCompliant: number;
    received: number;
  }[];
  /** Strengths by category */
  strengths: {
    category: string;
    resolvedCount: number;
    avgResolutionHours: number;
    slaComplianceRate: number;
    proficiencyScore: number;
  }[];
  /** Weaknesses by category */
  weaknesses: {
    category: string;
    resolvedCount: number;
    avgResolutionHours: number;
    slaComplianceRate: number;
    suggestion: string;
  }[];
  /** Active tickets needing attention */
  activeTickets: {
    ticketId: string;
    title: string;
    priority: string;
    category: string;
    status: string;
    assignedAt: Date;
    elapsedHours: number;
    slaRemainingHours: number;
    isOverdue: boolean;
  }[];
}

/**
 * BI export data for external tools
 */
export interface BIExportData {
  /** Dataset name */
  dataset: string;
  /** Time granularity */
  granularity: TimeGranularity;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Data rows */
  rows: Record<string, any>[];
  /** Column definitions */
  columns: { name: string; type: string; label: string }[];
  /** Generation timestamp */
  generatedAt: Date;
}

/**
 * Engineer efficiency score breakdown
 */
export interface EfficiencyScore {
  /** Overall composite score (0-100) */
  score: number;
  /** Dimension breakdown */
  breakdown: {
    /** Workload dimension (25% weight) */
    workloadScore: number;
    /** Efficiency dimension (30% weight) */
    efficiencyScore: number;
    /** Quality dimension (30% weight) */
    qualityScore: number;
    /** Teamwork dimension (15% weight) */
    teamworkScore: number;
  };
}

/**
 * Period comparison result
 */
export interface PeriodComparison {
  /** Current period data */
  current: { period: string; metrics: Record<string, number> };
  /** Previous period data */
  previous: { period: string; metrics: Record<string, number> };
  /** Change analysis */
  changes: { metric: string; changePercent: number; direction: 'up' | 'down' | 'same' }[];
}

// ==================== Dispatch Types (TASK-802) ====================

/**
 * Dispatch rule for automatic ticket assignment
 */
export interface DispatchRule {
  /** Rule ID */
  id: string;
  /** Conditions that trigger this rule */
  conditions: DispatchRuleConditions;
  /** Target assignee (user ID or 'best-match' for scoring) */
  assignee: string;
  /** Rule priority (lower = higher priority) */
  priority: number;
  /** Whether the rule is active */
  enabled: boolean;
  /** Rule name for display */
  name: string;
}

/**
 * Conditions that trigger a dispatch rule
 */
export interface DispatchRuleConditions {
  /** Applicable categories */
  categories?: TicketCategory[];
  /** Applicable priorities */
  priorities?: TicketPriority[];
  /** Applicable sources */
  sources?: TicketSource[];
  /** Tag-based matching */
  tagMatches?: Record<string, string>;
  /** Minimum escalation level */
  minEscalationLevel?: number;
}

/**
 * Result of a dispatch operation
 */
export interface DispatchResult {
  /** Dispatch record ID */
  id: string;
  /** Ticket that was dispatched */
  ticketId: string;
  /** Assigned engineer */
  assignee: string;
  /** Reason for assignment */
  reason: string;
  /** Dispatch score (0-100) */
  score: number;
  /** When the dispatch occurred */
  dispatchedAt: Date;
  /** Whether dispatch was manual or automatic */
  dispatchType: 'auto' | 'manual' | 'rule';
  /** Scoring breakdown (for auto dispatch) */
  scoreBreakdown?: DispatchScoreBreakdown;
  /** Whether the assignment was accepted */
  accepted: boolean;
  /** Time from dispatch to acceptance */
  timeToAcceptanceMs?: number;
}

/**
 * Breakdown of dispatch scoring components
 */
export interface DispatchScoreBreakdown {
  /** Expertise match score (0-100) */
  expertiseScore: number;
  /** Workload balance score (0-100, higher = less loaded) */
  workloadScore: number;
  /** Availability score (0-100) */
  availabilityScore: number;
  /** Historical success rate score (0-100) */
  successRateScore: number;
  /** SLA urgency score (0-100, higher = more urgent) */
  slaUrgencyScore: number;
  /** Weights used for scoring */
  weights: DispatchWeights;
}

/**
 * Configurable weights for dispatch scoring
 */
export interface DispatchWeights {
  /** Weight for expertise matching */
  expertise: number;
  /** Weight for workload balance */
  workload: number;
  /** Weight for availability */
  availability: number;
  /** Weight for historical success rate */
  successRate: number;
  /** Weight for SLA urgency */
  slaUrgency: number;
}

/**
 * Engineer profile for dispatch matching
 */
export interface EngineerProfile {
  /** Engineer user ID */
  id: string;
  /** Display name */
  name: string;
  /** Areas of expertise (categories they handle well) */
  expertise: TicketCategory[];
  /** Current number of assigned tickets */
  currentLoad: number;
  /** Maximum capacity before overload */
  maxCapacity: number;
  /** Current availability status */
  availability: EngineerAvailability;
  /** Historical resolution statistics */
  resolutionStats: EngineerResolutionStats;
  /** Skills proficiency levels (0-100) */
  skills?: Record<string, number>;
  /** Team assignment */
  team?: string;
  /** On-call status */
  onCall?: boolean;
}

/**
 * Engineer availability status
 */
export type EngineerAvailability = 'available' | 'busy' | 'away' | 'offline' | 'on-call';

/**
 * Resolution statistics for an engineer
 */
export interface EngineerResolutionStats {
  /** Total tickets resolved */
  totalResolved: number;
  /** Average resolution time in milliseconds */
  avgResolutionTimeMs: number;
  /** SLA compliance rate (0-1) */
  slaComplianceRate: number;
  /** Resolution rate by category */
  resolutionByCategory: Record<TicketCategory, number>;
  /** Resolution rate by priority */
  resolutionByPriority: Record<TicketPriority, number>;
  /** Number of escalations received */
  escalationCount: number;
  /** Customer satisfaction score (0-100) */
  satisfactionScore?: number;
}

/**
 * Dispatch queue entry
 */
export interface DispatchQueueEntry {
  /** Queue entry ID */
  id: string;
  /** Ticket in queue */
  ticket: Ticket;
  /** Effective dispatch priority (computed) */
  dispatchPriority: number;
  /** When the ticket entered the queue */
  enqueuedAt: Date;
  /** SLA deadline */
  slaDeadline?: Date;
  /** Number of reprioritizations */
  reprioritizeCount: number;
  /** Last dispatch attempt */
  lastDispatchAttempt?: Date;
  /** Dispatch attempt count */
  dispatchAttemptCount: number;
}

/**
 * Dispatch queue status summary
 */
export interface DispatchQueueStatus {
  /** Total tickets in queue */
  totalInQueue: number;
  /** Breakdown by priority */
  byPriority: Record<TicketPriority, number>;
  /** Tickets approaching SLA breach */
  slaAtRisk: number;
  /** Tickets past SLA breach */
  slaBreached: number;
  /** Average wait time in queue (ms) */
  avgWaitTimeMs: number;
  /** Oldest ticket wait time (ms) */
  oldestWaitTimeMs: number;
}

/**
 * SLA alert for dispatch queue
 */
export interface SLAAlert {
  /** Alert ID */
  id: string;
  /** Queue entry */
  queueEntryId: string;
  /** Ticket ID */
  ticketId: string;
  /** Alert type */
  alertType: 'sla-warning' | 'sla-critical' | 'sla-breach';
  /** Time remaining until SLA breach (negative if breached) */
  timeRemainingMs: number;
  /** Generated at */
  generatedAt: Date;
  /** Message */
  message: string;
}

/**
 * Load balancer report
 */
export interface LoadBalancingReport {
  /** Current engineer loads */
  engineerLoads: EngineerLoadInfo[];
  /** Overall balance score (0-1, 1 = perfectly balanced) */
  balanceScore: number;
  /** Overloaded engineers */
  overloadedEngineers: string[];
  /** Underutilized engineers */
  underutilizedEngineers: string[];
  /** Reassignment suggestions */
  reassignmentSuggestions: ReassignmentSuggestion[];
}

/**
 * Engineer load information
 */
export interface EngineerLoadInfo {
  /** Engineer ID */
  engineerId: string;
  /** Engineer name */
  engineerName: string;
  /** Current load */
  currentLoad: number;
  /** Max capacity */
  maxCapacity: number;
  /** Utilization percentage (0-100) */
  utilizationPercent: number;
  /** Is overloaded */
  isOverloaded: boolean;
}

/**
 * Reassignment suggestion
 */
export interface ReassignmentSuggestion {
  /** Ticket ID to reassign */
  ticketId: string;
  /** Current assignee */
  fromEngineer: string;
  /** Suggested new assignee */
  toEngineer: string;
  /** Reason for reassignment */
  reason: string;
  /** Expected improvement in balance */
  expectedImprovement: number;
}

// ==================== Transfer Types (TASK-TICKET-XFER) ====================

/**
 * Transfer type
 */
export type TransferType = 'manual' | 'auto-timeout' | 'escalation' | 'backup';

/**
 * Ticket transfer record
 */
export interface TicketTransfer {
  /** Transfer ID */
  id: string;
  /** Ticket being transferred */
  ticketId: string;
  /** Previous assignee */
  fromEngineer: string;
  /** New assignee */
  toEngineer: string;
  /** Transfer type */
  transferType: TransferType;
  /** Reason for transfer */
  reason: string;
  /** Who initiated the transfer */
  initiatedBy: string;
  /** When the transfer occurred */
  transferredAt: Date;
  /** How long the previous engineer held the ticket */
  holdDurationMs?: number;
  /** Whether the transfer was accepted */
  accepted: boolean;
}

/**
 * Auto transfer rules configuration
 */
export interface AutoTransferConfig {
  /** Not-started timeout by priority (ms) */
  notStartedTimeout: Record<string, number>;
  /** In-progress timeout by priority (ms) */
  inProgressTimeout: Record<string, number>;
  /** Maximum transfers per ticket */
  maxTransferCount: number;
  /** Exclude engineers from auto-transfer (IDs) */
  excludedEngineers?: string[];
  /** Enable auto-transfer */
  enabled: boolean;
  /** Check interval (ms) */
  checkIntervalMs: number;
}

/**
 * Transfer statistics
 */
export interface TransferStats {
  /** Total transfers */
  totalTransfers: number;
  /** Transfers by type */
  byType: Record<TransferType, number>;
  /** Most transferred engineers */
  mostTransferred: { engineerId: string; count: number }[];
  /** Most common reasons */
  topReasons: { reason: string; count: number }[];
  /** Avg hold time before transfer */
  avgHoldTimeMs: number;
  /** Max transfers for any single ticket */
  maxTransfersPerTicket: number;
}

// ==================== Suspend Types (TASK-TICKET-XFER) ====================

/**
 * Suspend status
 */
export type SuspendStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

/**
 * Suspend reason
 */
export type SuspendReason = 'leave' | 'sick' | 'training' | 'offline' | 'other';

/**
 * Engineer suspend/leave record
 */
export interface EngineerSuspend {
  /** Suspend ID */
  id: string;
  /** Engineer being suspended */
  engineerId: string;
  /** Reason for suspension */
  reason: SuspendReason;
  /** Suspend status */
  status: SuspendStatus;
  /** Start time of suspension */
  startTime: Date;
  /** Expected end time */
  endTime: Date;
  /** Actual end time */
  actualEndTime?: Date;
  /** Backup engineer who covers during suspension */
  backupEngineerId?: string;
  /** Auto-reassign tickets that were assigned but not started */
  autoReassignPending: boolean;
  /** Pause SLA for pending tickets during suspension */
  pauseSLAForPending: boolean;
  /** Notes */
  notes?: string;
  /** Who created the suspension */
  createdBy: string;
  /** When created */
  createdAt: Date;
  /** Number of tickets reassigned due to this suspension */
  ticketsReassigned: number;
}

/**
 * Suspension with ticket impact
 */
export interface SuspensionImpact {
  suspend: EngineerSuspend;
  affectedTickets: {
    ticketId: string;
    title: string;
    currentStatus: string;
    reassignedTo?: string;
    wasReassigned: boolean;
  }[];
  totalAffected: number;
}
