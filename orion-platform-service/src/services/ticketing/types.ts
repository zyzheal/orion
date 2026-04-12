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
