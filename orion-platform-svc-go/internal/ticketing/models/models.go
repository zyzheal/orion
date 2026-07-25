package models

import "time"

// --- Ticket ---

type Ticket struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	Title        string            `json:"title" db:"title"`
	Description  string            `json:"description" db:"description"`
	Status       string            `json:"status" db:"status"`
	Priority     string            `json:"priority" db:"priority"`
	Category     string            `json:"category" db:"category"`
	AssigneeID   *string           `json:"assignee_id,omitempty" db:"assignee_id"`
	ReporterID   string            `json:"reporter_id" db:"reporter_id"`
	Source       string            `json:"source" db:"source"`
	SourceID     *string           `json:"source_id,omitempty" db:"source_id"`
	Metadata     map[string]any    `json:"metadata,omitempty"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
	ResolvedAt   *time.Time        `json:"resolved_at,omitempty" db:"resolved_at"`
	ClosedAt     *time.Time        `json:"closed_at,omitempty" db:"closed_at"`
}

type CreateTicketRequest struct {
	Title       string                 `json:"title" binding:"required"`
	Description string                 `json:"description"`
	Priority    string                 `json:"priority"`
	Category    string                 `json:"category"`
	Source      string                 `json:"source"`
	SourceID    *string                `json:"source_id"`
	Metadata    map[string]interface{} `json:"metadata"`
}

type UpdateTicketRequest struct {
	Title       *string                `json:"title"`
	Description *string                `json:"description"`
	Priority    *string                `json:"priority"`
	Category    *string                `json:"category"`
	Metadata    map[string]interface{} `json:"metadata"`
}

type TicketListQuery struct {
	Status   *string `json:"status"`
	Priority *string `json:"priority"`
	Assignee *string `json:"assignee"`
	Category *string `json:"category"`
	Search   *string `json:"search"`
	Limit    int     `json:"limit"`
	Offset   int     `json:"offset"`
}

// --- Workflow ---

type TransitionRequest struct {
	Status  string `json:"status" binding:"required"`
	Comment string `json:"comment"`
}

type AssignRequest struct {
	AssigneeID string `json:"assignee_id" binding:"required"`
	Comment    string `json:"comment"`
}

type EscalateRequest struct {
	Reason      string `json:"reason" binding:"required"`
	TargetLevel int    `json:"target_level"`
}

type ResolveRequest struct {
	Resolution string `json:"resolution" binding:"required"`
	Comment    string `json:"comment"`
}

type WorkflowHistoryEntry struct {
	ID        int       `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	Action    string    `json:"action" db:"action"`
	FromState string    `json:"from_state" db:"from_state"`
	ToState   string    `json:"to_state" db:"to_state"`
	UserID    string    `json:"user_id" db:"user_id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Assignment Rules ---

type AssignmentRule struct {
	ID         int        `json:"id" db:"id"`
	TenantID   string     `json:"tenant_id" db:"tenant_id"`
	Name       string     `json:"name" db:"name"`
	Categories []string   `json:"categories" db:"categories"`
	Priorities []string   `json:"priorities" db:"priorities"`
	Assignee   string     `json:"assignee" db:"assignee"`
	Order      int        `json:"order" db:"order"`
	Conditions string     `json:"conditions" db:"conditions"`
	Action     string     `json:"action" db:"action"`
	TargetID   string     `json:"target_id" db:"target_id"`
	Enabled    bool       `json:"enabled" db:"enabled"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

type CreateAssignmentRuleRequest struct {
	Name       string `json:"name" binding:"required"`
	Conditions string `json:"conditions"`
	Action     string `json:"action" binding:"required"`
	TargetID   string `json:"target_id" binding:"required"`
}

// --- Relations ---

type TicketRelation struct {
	ID              int     `json:"id" db:"id"`
	TenantID        string  `json:"tenant_id" db:"tenant_id"`
	TicketID        string  `json:"ticket_id" db:"ticket_id"`
	RelatedID       string  `json:"related_id" db:"related_id"`
	RelatedTicketID string  `json:"related_ticket_id" db:"related_ticket_id"`
	Type            string  `json:"type" db:"type"`
	RelationType    string  `json:"relation_type" db:"relation_type"`
	CreatedBy       string  `json:"created_by" db:"created_by"`
	Description     string  `json:"description" db:"description"`
	Confidence      float64 `json:"confidence" db:"confidence"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type CreateRelationRequest struct {
	RelatedID string `json:"related_id" binding:"required"`
	Type      string `json:"type" binding:"required"` // blocks, blocked_by, relates, duplicate
}

type CorrelateRequest struct {
	TicketIDs []string `json:"ticket_ids" binding:"required"`
}

// --- SLA ---

type SLATarget struct {
	ID                   int     `json:"id" db:"id"`
	TenantID             string  `json:"tenant_id" db:"tenant_id"`
	Name                 string  `json:"name" db:"name"`
	Priority             string  `json:"priority" db:"priority"`
	ResponseH            int     `json:"response_hours" db:"response_hours"`
	ResolveH             int     `json:"resolve_hours" db:"resolve_hours"`
	Enabled              bool    `json:"enabled" db:"enabled"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	TargetResponseTimeMs int64   `json:"target_response_time_ms" db:"target_response_time_ms"`
	TargetResolutionTimeMs int64 `json:"target_resolution_time_ms" db:"target_resolution_time_ms"`
}

type CreateSLATargetRequest struct {
	Priority    string `json:"priority" binding:"required"`
	ResponseHrs int    `json:"response_hours" binding:"required"`
	ResolveHrs  int    `json:"resolve_hours" binding:"required"`
}

type TicketSLAStatus struct {
	TicketID     string  `json:"ticket_id"`
	ResponseDue  string  `json:"response_due"`
	ResolutionDue string `json:"resolution_due"`
	ResponseOK   bool    `json:"response_ok"`
	ResolutionOK bool    `json:"resolution_ok"`
	Breached     bool    `json:"breached"`
}

// --- Reports ---

type SLAComplianceReport struct {
	Total           int                     `json:"total"`
	Compliant       int                     `json:"compliant"`
	Breached        int                     `json:"breached"`
	ComplianceRate  float64                 `json:"compliance_rate"`
	TotalTickets    int                     `json:"total_tickets"`
	BreachedCount   int                     `json:"breached_count"`
	AvgResponseMs   float64                 `json:"avg_response_ms"`
	AvgResolutionMs float64                 `json:"avg_resolution_ms"`
	ByPriority      map[string]SLAPriorityStats `json:"by_priority"`
}

// SLAPriorityStats holds SLA compliance stats for a single priority level.
type SLAPriorityStats struct {
	Total          int     `json:"total"`
	Breached       int     `json:"breached"`
	ComplianceRate float64 `json:"compliance_rate"`
}

type ResolutionStats struct {
	Total          int     `json:"total"`
	AvgResolutionH float64 `json:"avg_resolution_hours"`
	MedianH        float64 `json:"median_hours"`
	ByPriority    map[string]float64 `json:"by_priority"`
}

type BacklogAnalysis struct {
	ByStatus   map[string]int `json:"by_status"`
	ByPriority map[string]int `json:"by_priority"`
	Oldest     *Ticket        `json:"oldest"`
	Total      int            `json:"total"`
}

type TrendReport struct {
	Periods     []string              `json:"periods"`
	Created     []int                 `json:"created"`
	Resolved    []int                 `json:"resolved"`
	Escalated   []int                 `json:"escalated"`
}

type StatisticsReport struct {
	Total          int            `json:"total"`
	Open           int            `json:"open"`
	InProgress     int            `json:"in_progress"`
	Resolved       int            `json:"resolved"`
	Closed         int            `json:"closed"`
	ByPriority     map[string]int `json:"by_priority"`
	ByCategory     map[string]int `json:"by_category"`
	AvgResponseH   float64        `json:"avg_response_hours"`
	AvgResolveH    float64        `json:"avg_resolve_hours"`
}

// --- Dispatch ---

type DispatchEngineer struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	UserID       string            `json:"user_id" db:"user_id"`
	Name         string            `json:"name" db:"name"`
	Skills       string            `json:"skills" db:"skills"`
	MaxTickets   int               `json:"max_tickets" db:"max_tickets"`
	IsActive     bool              `json:"is_active" db:"is_active"`
	CurrentLoad  int               `json:"current_load" db:"current_load"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

type RegisterEngineerRequest struct {
	UserID     string `json:"user_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Skills     string `json:"skills"`
	MaxTickets int    `json:"max_tickets"`
}

type DispatchRule struct {
	ID        int       `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Conditions string   `json:"conditions" db:"conditions"`
	Strategy  string    `json:"strategy" db:"strategy"` // round_robin, skill_match, load_balance
	Weight    int       `json:"weight" db:"weight"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type AddDispatchRuleRequest struct {
	Name       string `json:"name" binding:"required"`
	Conditions string `json:"conditions"`
	Strategy   string `json:"strategy" binding:"required"`
	Weight     int    `json:"weight"`
}

type UpdateWeightsRequest struct {
	Weights map[string]int `json:"weights" binding:"required"`
}

type BestMatchResult struct {
	EngineerID string  `json:"engineer_id"`
	Name       string  `json:"name"`
	Score      float64 `json:"score"`
	Reason     string  `json:"reason"`
}

type DispatchScoreRequest struct {
	TicketID  string   `json:"ticket_id" binding:"required"`
	Skills    []string `json:"skills"`
	Priority  string   `json:"priority"`
	Category  string   `json:"category"`
}

type DispatchScoreResult struct {
	EngineerID string  `json:"engineer_id"`
	Name       string  `json:"name"`
	Score      float64 `json:"score"`
}

type QueueStatus struct {
	Pending  int `json:"pending"`
	Assigned int `json:"assigned"`
	Total    int `json:"total"`
}

type QueueEntry struct {
	TicketID  string    `json:"ticket_id"`
	Priority  string    `json:"priority"`
	Age       float64   `json:"age_hours"`
	Assigned  bool      `json:"assigned"`
	Engineer  *string   `json:"engineer,omitempty"`
}

type SLAAlert struct {
	TicketID    string    `json:"ticket_id"`
	Title       string    `json:"title"`
	BreachType  string    `json:"breach_type"` // response, resolution
	TimeUntil   float64   `json:"time_until_hours"`
	EngineerID  *string   `json:"engineer_id,omitempty"`
}

type LoadBalanceReport struct {
	Engineers     []string          `json:"engineers"`
	Loads         map[string]int    `json:"loads"`
	AvgLoad       float64           `json:"avg_load"`
	MaxLoad       int               `json:"max_load"`
	MinLoad       int               `json:"min_load"`
}

type ReassignmentSuggestion struct {
	EngineerID  string  `json:"engineer_id"`
	TicketID    string  `json:"ticket_id"`
	Reason      string  `json:"reason"`
	TargetID    string  `json:"target_engineer_id"`
	LoadBefore  int     `json:"load_before"`
	LoadAfter   int     `json:"load_after"`
}

type DispatchMetrics struct {
	TotalDispatched     int     `json:"total_dispatched"`
	AutoDispatched      int     `json:"auto_dispatched"`
	ManualDispatched    int     `json:"manual_dispatched"`
	AvgDispatchTimeMins float64 `json:"avg_dispatch_time_minutes"`
}

type AssignmentSuccess struct {
	Total       int     `json:"total"`
	Successful  int     `json:"successful"`
	Rate        float64 `json:"success_rate"`
}

type TimeToAssignmentStats struct {
	AvgMinutes  float64 `json:"avg_minutes"`
	MedianMins  float64 `json:"median_minutes"`
	P95Minutes  float64 `json:"p95_minutes"`
	MaxMinutes  float64 `json:"max_minutes"`
}

type EngineerPerformance struct {
	EngineerID       string  `json:"engineer_id"`
	TotalAssigned    int     `json:"total_assigned"`
	Resolved         int     `json:"resolved"`
	AvgResolveH      float64 `json:"avg_resolve_hours"`
	SLACompliance    float64 `json:"sla_compliance"`
	CurrentLoad      int     `json:"current_load"`
}

// --- Transfer ---

type TransferRequest struct {
	ToUserID string `json:"to_user_id" binding:"required"`
	Reason   string `json:"reason"`
}

type TransferHistoryEntry struct {
	ID        int       `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	FromUserID string   `json:"from_user_id" db:"from_user_id"`
	ToUserID  string    `json:"to_user_id" db:"to_user_id"`
	Reason    string    `json:"reason" db:"reason"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type TransferStats struct {
	TotalTransfers  int     `json:"total_transfers"`
	ActiveTransfers int     `json:"active_transfers"`
	AvgTransfers    float64 `json:"avg_transfers_per_ticket"`
}

// --- Suspend ---

type Suspend struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	EngineerID   string    `json:"engineer_id" db:"engineer_id"`
	Reason       string    `json:"reason" db:"reason"`
	Type         string    `json:"type" db:"type"` // scheduled, adhoc
	StartAt      time.Time `json:"start_at" db:"start_at"`
	EndAt        *time.Time `json:"end_at,omitempty" db:"end_at"`
	Status       string    `json:"status" db:"status"` // active, completed, cancelled
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type CreateSuspendRequest struct {
	EngineerID string `json:"engineer_id" binding:"required"`
	Reason     string `json:"reason"`
	Type       string `json:"type"`
	StartAt    string `json:"start_at"`
	EndAt      string `json:"end_at"`
}

type EngineerSuspendImpact struct {
	EngineerID   string `json:"engineer_id"`
	AffectedTix  int    `json:"affected_tickets"`
	Reassigned   int    `json:"reassigned"`
	AvgDelayMins float64 `json:"avg_delay_minutes"`
}

// --- BI Analytics ---

type ExecutiveDashboard struct {
	TotalTickets     int            `json:"total_tickets"`
	OpenTickets      int            `json:"open_tickets"`
	ResolvedToday    int            `json:"resolved_today"`
	ActiveEngineers  int            `json:"active_engineers"`
	SLACompliance    float64        `json:"sla_compliance"`
	Escalations      int            `json:"escalations"`
}

type ManagerDashboard struct {
	TeamLoad        map[string]int  `json:"team_load"`
	OverdueTickets  int             `json:"overdue_tickets"`
	NewThisWeek     int             `json:"new_this_week"`
	ResolutionTrend []int           `json:"resolution_trend"`
}

type EngineerDashboard struct {
	EngineerID      string          `json:"engineer_id"`
	MyTickets       int             `json:"my_tickets"`
	OpenTickets     int             `json:"open_tickets"`
	ResolvedToday   int             `json:"resolved_today"`
	UpcomingDeadlines []string     `json:"upcoming_deadlines"`
}

type EngineerEfficiency struct {
	EngineerID       string  `json:"engineer_id"`
	TicketsResolved  int     `json:"tickets_resolved"`
	AvgResolveH      float64 `json:"avg_resolve_hours"`
	ResponseTime     float64 `json:"avg_response_time_hours"`
}

type EfficiencyScore struct {
	EngineerID  string  `json:"engineer_id"`
	Score       float64 `json:"score"`
	Ranking     int     `json:"ranking"`
}

type ComparePeriodsResult struct {
	CurrentPeriod string              `json:"current_period"`
	PreviousPeriod string             `json:"previous_period"`
	Metrics       map[string]CompareMetric `json:"metrics"`
}

type CompareMetric struct {
	Current     float64 `json:"current"`
	Previous    float64 `json:"previous"`
	ChangePct   float64 `json:"change_pct"`
}

type BIDataExportRequest struct {
	From string `json:"from" binding:"required"`
	To   string `json:"to" binding:"required"`
	Format string `json:"format"`
}

type TimeTrend struct {
	Labels []string `json:"labels"`
	Values []int    `json:"values"`
}

// --- SLA Policies ---

type SLAPolicy struct {
	ID                     int     `json:"id" db:"id"`
	TenantID               string  `json:"tenant_id" db:"tenant_id"`
	Name                   string  `json:"name" db:"name"`
	Description            string  `json:"description" db:"description"`
	Priority               string  `json:"priority" db:"priority"`
	ResponseH              int     `json:"response_hours" db:"response_hours"`
	ResolveH               int     `json:"resolve_hours" db:"resolve_hours"`
	Active                 bool    `json:"active" db:"active"`
	Enabled                bool    `json:"enabled" db:"enabled"`
	CreatedAt              time.Time `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time `json:"updated_at" db:"updated_at"`
	TargetResponseTimeMs   int64   `json:"target_response_time_ms" db:"target_response_time_ms"`
	TargetResolutionTimeMs int64   `json:"target_resolution_time_ms" db:"target_resolution_time_ms"`
}

type CreateSLAPolicyRequest struct {
	Name      string `json:"name" binding:"required"`
	Priority  string `json:"priority" binding:"required"`
	ResponseH int    `json:"response_hours" binding:"required"`
	ResolveH  int    `json:"resolve_hours" binding:"required"`
}

type UpdateSLAPolicyRequest struct {
	Name      *string `json:"name"`
	Priority  *string `json:"priority"`
	ResponseH *int    `json:"response_hours"`
	ResolveH  *int    `json:"resolve_hours"`
	Active    *bool   `json:"active"`
}

type SLABreach struct {
	ID        int       `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	PolicyID  int       `json:"policy_id" db:"policy_id"`
	Type      string    `json:"type" db:"type"` // response, resolution
	BreachedAt time.Time `json:"breached_at" db:"breached_at"`
}

type ComplianceResult struct {
	PolicyID    int     `json:"policy_id"`
	Total       int     `json:"total"`
	Compliant   int     `json:"compliant"`
	Breached    int     `json:"breached"`
	Compliance  float64 `json:"compliance_rate"`
}

// --- Automation Rules ---

type AutomationRule struct {
	ID        int       `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Trigger   string    `json:"trigger" db:"trigger"`
	Condition string    `json:"condition" db:"condition"`
	Action    string    `json:"action" db:"action"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateAutomationRuleRequest struct {
	Name      string `json:"name" binding:"required"`
	Trigger   string `json:"trigger" binding:"required"`
	Condition string `json:"condition"`
	Action    string `json:"action" binding:"required"`
}

type UpdateAutomationRuleRequest struct {
	Name      *string `json:"name"`
	Trigger   *string `json:"trigger"`
	Condition *string `json:"condition"`
	Action    *string `json:"action"`
	Enabled   *bool   `json:"enabled"`
}

type ExecuteRuleResult struct {
	RuleID    int `json:"rule_id"`
	Executed  bool `json:"executed"`
	Message   string `json:"message"`
}

// --- Types required by repository interfaces ---

// TicketComment represents a comment on a ticket.
type TicketComment struct {
	ID        int       `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// TicketStatistics holds aggregate statistics for tickets.
type TicketStatistics struct {
	Total        int            `json:"total"`
	Open         int            `json:"open"`
	InProgress   int            `json:"in_progress"`
	Resolved     int            `json:"resolved"`
	Closed       int            `json:"closed"`
	ByPriority   map[string]int `json:"by_priority"`
	ByCategory   map[string]int `json:"by_category"`
}

// TrendPoint is a single data point in a trend chart.
type TrendPoint struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

// ListQuery is the pagination/query model used by the extended ticket repo.
type ListQuery struct {
	Status   *string `json:"status"`
	Priority *string `json:"priority"`
	Assignee *string `json:"assignee"`
	Search   *string `json:"search"`
	Limit    int     `json:"limit"`
	Offset   int     `json:"offset"`
}

// SLARecord represents an SLA tracking record.
type SLARecord struct {
	ID                   int        `json:"id" db:"id"`
	TicketID             string     `json:"ticket_id" db:"ticket_id"`
	SLATargetID          int        `json:"sla_target_id" db:"sla_target_id"`
	Priority             string     `json:"priority" db:"priority"`
	ResponseDue          time.Time  `json:"response_due" db:"response_due"`
	ResponseDeadlineAt   *time.Time `json:"response_deadline_at" db:"response_deadline_at"`
	ResolveDue           time.Time  `json:"resolve_due" db:"resolve_due"`
	ResolutionDeadlineAt *time.Time `json:"resolution_deadline_at" db:"resolution_deadline_at"`
	ResponseOK           bool       `json:"response_ok" db:"response_ok"`
	ResolutionOK         bool       `json:"resolution_ok" db:"resolution_ok"`
	Breached             bool       `json:"breached" db:"breached"`
	BreachType           string     `json:"breach_type" db:"breach_type"`
	RespondedAt          *time.Time `json:"responded_at" db:"responded_at"`
	ResolvedAt           *time.Time `json:"resolved_at" db:"resolved_at"`
	Paused               bool       `json:"paused" db:"paused"`
	PausedAt             *time.Time `json:"paused_at" db:"paused_at"`
	PausedReason         string     `json:"paused_reason" db:"paused_reason"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}

// DispatchRecord represents a dispatch event.
type DispatchRecord struct {
	ID           int       `json:"id" db:"id"`
	EngineerID   string    `json:"engineer_id" db:"engineer_id"`
	TicketID     string    `json:"ticket_id" db:"ticket_id"`
	DispatchedAt time.Time `json:"dispatched_at" db:"dispatched_at"`
	Method       string    `json:"method" db:"method"` // auto, manual
}

// DispatchRecordStatus represents queue status.
type DispatchQueueStatus struct {
	Pending  int `json:"pending"`
	Assigned int `json:"assigned"`
	Total    int `json:"total"`
}

// DispatchEngineer represents an engineer registered for dispatch.
type DispatchQueueEntry struct {
	TicketID  string  `json:"ticket_id"`
	Priority  string  `json:"priority"`
	Engineer  *string `json:"engineer,omitempty"`
	DispatchedAt *time.Time `json:"dispatched_at"`
}

// WorkflowHistory represents a single workflow transition (legacy name used by repo).
type WorkflowHistory struct {
	ID        int       `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	Action    string    `json:"action" db:"action"`
	FromState string    `json:"from_state" db:"from_state"`
	ToState   string    `json:"to_state" db:"to_state"`
	UserID    string    `json:"user_id" db:"user_id"`
	Comment   string    `json:"comment" db:"comment"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// SuspendRecord represents a suspension record (legacy name used by repo).
type SuspendRecord struct {
	ID        int       `json:"id" db:"id"`
	EngineerID string   `json:"engineer_id" db:"engineer_id"`
	Type      string    `json:"type" db:"type"`
	Status    string    `json:"status" db:"status"`
	StartAt   time.Time `json:"start_at" db:"start_at"`
	EndAt     *time.Time `json:"end_at" db:"end_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// SLAComplianceDetail holds detailed compliance stats for an SLA policy over a period.
type SLAComplianceDetail struct {
	PolicyID       string    `json:"policy_id"`
	PolicyName     string    `json:"policy_name"`
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
	TotalTickets   int       `json:"total_tickets"`
	BreachedCount  int       `json:"breached_count"`
	ComplianceRate float64   `json:"compliance_rate"`
}

// AutomationRuleExecution logs a rule execution.
type AutomationRuleExecution struct {
	ID        int       `json:"id" db:"id"`
	RuleID    int       `json:"rule_id" db:"rule_id"`
	TriggeredAt time.Time `json:"triggered_at" db:"triggered_at"`
	Result    string    `json:"result" db:"result"` // success, failure, skipped
	Detail    string    `json:"detail" db:"detail"`
}

// TransferRecord represents a ticket transfer event (legacy name used by repo).
type TransferRecord struct {
	ID         int       `json:"id" db:"id"`
	TicketID   string    `json:"ticket_id" db:"ticket_id"`
	FromUserID string    `json:"from_user_id" db:"from_user_id"`
	ToUserID   string    `json:"to_user_id" db:"to_user_id"`
	Reason     string    `json:"reason" db:"reason"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}
