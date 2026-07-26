package models

import "time"

// --- Ticket ---

type Ticket struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	Title        string            `json:"title" db:"title"`
	Description  string            `json:"description" db:"description"`
	Type         string            `json:"type" db:"type"`
	Status       string            `json:"status" db:"status"`
	Priority     string            `json:"priority" db:"priority"`
	Category     string            `json:"category" db:"category"`
	AssigneeID   *string           `json:"assignee_id,omitempty" db:"assignee_id"`
	AssignedTo   string            `json:"assigned_to,omitempty" db:"assigned_to"`
	ReporterID   string            `json:"reporter_id" db:"reporter_id"`
	CreatedBy    string            `json:"created_by,omitempty" db:"created_by"`
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
	Type        string                 `json:"type"`
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
	ID                     string `json:"id"`
	Name                   string `json:"name"`
	Priority               string `json:"priority" binding:"required"`
	ResponseHrs            int    `json:"response_hours" binding:"required"`
	ResolveHrs             int    `json:"resolve_hours" binding:"required"`
	TargetResponseTimeMs   int64  `json:"target_response_time_ms"`
	TargetResolutionTimeMs int64  `json:"target_resolution_time_ms"`
	Enabled                *bool  `json:"enabled"`
}

type TicketSLAStatus struct {
	TicketID               string     `json:"ticket_id"`
	ResponseDue            string     `json:"response_due"`
	ResolutionDue          string     `json:"resolution_due"`
	ResponseOK             bool       `json:"response_ok"`
	ResolutionOK           bool       `json:"resolution_ok"`
	Breached               bool       `json:"breached"`
	PolicyID               string     `json:"policy_id"`
	Status                 string     `json:"status"`
	Priority               string     `json:"priority"`
	TargetResponseTimeMs   int64      `json:"target_response_time_ms"`
	TargetResolutionTimeMs int64      `json:"target_resolution_time_ms"`
	ResponseDeadlineAt     time.Time  `json:"response_deadline_at"`
	ResolutionDeadlineAt   time.Time  `json:"resolution_deadline_at"`
	BreachType             string     `json:"breach_type"`
	RespondedAt            *time.Time `json:"responded_at"`
	ResolvedAt             *time.Time `json:"resolved_at"`
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
	Days        int                   `json:"days"`
	Granularity string                `json:"granularity"`
	DataPoints  []TrendPoint          `json:"data_points"`
	Summary     TrendSummary          `json:"summary"`
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
	Expertise    string            `json:"expertise" db:"expertise"`
	MaxTickets   int               `json:"max_tickets" db:"max_tickets"`
	MaxCapacity  int               `json:"max_capacity" db:"max_capacity"`
	IsActive     bool              `json:"is_active" db:"is_active"`
	CurrentLoad  int               `json:"current_load" db:"current_load"`
	Availability string            `json:"availability" db:"availability"`
	Team         string            `json:"team" db:"team"`
	OnCall       bool              `json:"on_call" db:"on_call"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
	// Extra fields for analytics usage
	TotalResolved   int     `json:"total_resolved" db:"total_resolved"`
	AvgResolutionMs int64   `json:"avg_resolution_ms" db:"avg_resolution_ms"`
	SuccessRate     float64 `json:"success_rate" db:"success_rate"`
	SLACompliance   float64 `json:"sla_compliance" db:"sla_compliance"`
}

type RegisterEngineerRequest struct {
	UserID       string `json:"user_id" binding:"required"`
	ID           string `json:"id"`
	Name         string `json:"name" binding:"required"`
	Skills       string `json:"skills"`
	CurrentLoad  int    `json:"current_load"`
	MaxCapacity  int    `json:"max_capacity"`
	Availability string `json:"availability"`
	Team         string `json:"team"`
	OnCall       bool   `json:"on_call"`
	MaxTickets   int    `json:"max_tickets"`
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
	Engineers       []EngineerLoad    `json:"engineers"`
	Loads           map[string]int    `json:"loads"`
	AvgLoad         float64           `json:"avg_load"`
	MaxLoad         int               `json:"max_load"`
	MinLoad         int               `json:"min_load"`
	ImbalanceScore  float64           `json:"imbalance_score"`
}

type ReassignmentSuggestion struct {
	EngineerID  string  `json:"engineer_id"`
	TicketID    string  `json:"ticket_id"`
	Reason      string  `json:"reason"`
	TargetID    string  `json:"target_engineer_id"`
	LoadBefore  int     `json:"load_before"`
	LoadAfter   int     `json:"load_after"`
	Action      string  `json:"action"`
	CurrentLoad int     `json:"current_load"`
}

type DispatchMetrics struct {
	TotalDispatched     int     `json:"total_dispatched"`
	AutoDispatched      int     `json:"auto_dispatched"`
	ManualDispatched    int     `json:"manual_dispatched"`
	TotalDispatches     int     `json:"total_dispatches"`
	AutoDispatches      int     `json:"auto_dispatches"`
	ManualDispatches    int     `json:"manual_dispatches"`
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
	Name             string  `json:"name"`
	TotalAssigned    int     `json:"total_assigned"`
	Resolved         int     `json:"resolved"`
	AvgResolveH      float64 `json:"avg_resolve_hours"`
	SLACompliance    float64 `json:"sla_compliance"`
	CurrentLoad      int     `json:"current_load"`
	TotalResolved    int     `json:"total_resolved"`
	AvgResolutionMs  int64   `json:"avg_resolution_ms"`
	SuccessRate      float64 `json:"success_rate"`
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

type EngineerTransferCount struct {
	EngineerID    string `json:"engineer_id"`
	TransferCount int    `json:"transfer_count"`
}

type EngineerProfile struct {
	EngineerID  string  `json:"engineer_id"`
	CurrentLoad int     `json:"current_load"`
	MaxCapacity int     `json:"max_capacity"`
	Score       float64 `json:"score"`
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
	EngineerID         string `json:"engineer_id" binding:"required"`
	Reason             string `json:"reason"`
	Type               string `json:"type"`
	StartAt            string `json:"start_at"`
	EndAt              string `json:"end_at"`
	StartTime          string `json:"start_time"`
	EndTime            string `json:"end_time"`
	BackupEngineerID   string `json:"backup_engineer_id"`
	AutoReassignPending bool `json:"auto_reassign_pending"`
	PauseSLAForPending  bool `json:"pause_sla_for_pending"`
	Notes              string `json:"notes"`
	CreatedBy          string `json:"created_by"`
}

// ValidSuspendReasons is the allowed suspend reason values.
var ValidSuspendReasons = []string{
	"vacation", "sick_leave", "training", "other",
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
	TeamLoad        map[string]int     `json:"team_load"`
	OverdueTickets  int                `json:"overdue_tickets"`
	NewThisWeek     int                `json:"new_this_week"`
	ResolutionTrend []int              `json:"resolution_trend"`
	PeriodStart     time.Time          `json:"period_start"`
	PeriodEnd       time.Time          `json:"period_end"`
	TeamTickets     int                `json:"team_tickets"`
	TeamOpenTickets int                `json:"team_open_tickets"`
	TrendData       []TrendPoint       `json:"trend_data"`
	Bottlenecks     []string           `json:"bottlenecks"`
	Engineers       []EngineerSummary  `json:"engineers"`
}

// EngineerSummary summarizes an engineer's key metrics.
type EngineerSummary struct {
	EngineerID      string `json:"engineer_id"`
	Name            string `json:"name"`
	TicketsHandled  int    `json:"tickets_handled"`
	AvgResolutionMs int64  `json:"avg_resolution_ms"`
	SLACompliance   float64 `json:"sla_compliance"`
}

type EngineerDashboard struct {
	EngineerID        string             `json:"engineer_id"`
	MyTickets         int                `json:"my_tickets"`
	OpenTickets       int                `json:"open_tickets"`
	ResolvedToday     int                `json:"resolved_today"`
	UpcomingDeadlines []string           `json:"upcoming_deadlines"`
	PeriodStart       time.Time          `json:"period_start"`
	PeriodEnd         time.Time          `json:"period_end"`
	ResolvedTickets     int                `json:"resolved_tickets"`
	AvgResolutionMs     int64              `json:"avg_resolution_ms"`
	SLACompliance       float64            `json:"sla_compliance"`
	AssignedTickets     int                `json:"assigned_tickets"`
	CategoryBreakdown   map[string]int     `json:"category_breakdown"`
}

type EngineerEfficiency struct {
	EngineerID       string  `json:"engineer_id"`
	TicketsResolved  int     `json:"tickets_resolved"`
	AvgResolveH      float64 `json:"avg_resolve_hours"`
	ResponseTime     float64 `json:"avg_response_time_hours"`
}

type EfficiencyScore struct {
	EngineerID  string              `json:"engineer_id"`
	Score       float64             `json:"score"`
	Ranking     int                 `json:"ranking"`
	Grade       string              `json:"grade"`
	Components  map[string]float64  `json:"components"`
	PeriodStart time.Time           `json:"period_start"`
	PeriodEnd   time.Time           `json:"period_end"`
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
	ID                     string  `json:"id" db:"id"`
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
	Name                 string `json:"name" binding:"required"`
	Priority             string `json:"priority" binding:"required"`
	ResponseH            int    `json:"response_hours" binding:"required"`
	ResolveH             int    `json:"resolve_hours" binding:"required"`
	Description          string `json:"description"`
	TargetResponseTimeMs int64  `json:"target_response_time_ms"`
	TargetResolutionTimeMs int64 `json:"target_resolution_time_ms"`
	Enabled              *bool  `json:"enabled"`
}

type UpdateSLAPolicyRequest struct {
	Name                 *string `json:"name"`
	Priority             *string `json:"priority"`
	ResponseH            *int    `json:"response_hours"`
	ResolveH             *int    `json:"resolve_hours"`
	Active               *bool   `json:"active"`
	Description          *string `json:"description"`
	TargetResponseTimeMs *int64  `json:"target_response_time_ms"`
	TargetResolutionTimeMs *int64 `json:"target_resolution_time_ms"`
	Enabled              *bool   `json:"enabled"`
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
	ID          int       `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Trigger     string    `json:"trigger" db:"trigger"`
	Condition   string    `json:"condition" db:"condition"`
	Action      string    `json:"action" db:"action"`
	Actions     string    `json:"actions" db:"actions"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateAutomationRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Trigger     string `json:"trigger" binding:"required"`
	Condition   string `json:"condition"`
	Action      string `json:"action" binding:"required"`
	Actions     string `json:"actions"`
	Description string `json:"description"`
	Enabled     *bool  `json:"enabled"`
}

type UpdateAutomationRuleRequest struct {
	Name        *string `json:"name"`
	Trigger     *string `json:"trigger"`
	Condition   *string `json:"condition"`
	Action      *string `json:"action"`
	Actions     *string `json:"actions"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
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
	Total            int            `json:"total"`
	TotalTickets     int            `json:"total_tickets"`
	Open             int            `json:"open"`
	OpenTickets      int            `json:"open_tickets"`
	InProgress       int            `json:"in_progress"`
	Resolved         int            `json:"resolved"`
	ResolvedTickets  int            `json:"resolved_tickets"`
	Closed           int            `json:"closed"`
	ByPriority       map[string]int `json:"by_priority"`
	ByCategory       map[string]int `json:"by_category"`
	AvgResolutionMs  int64          `json:"avg_resolution_ms"`
}

// TrendPoint is a single data point in a trend chart.
type TrendPoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
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
	ID           string    `json:"id" db:"id"`
	EngineerID   string    `json:"engineer_id" db:"engineer_id"`
	TicketID     string    `json:"ticket_id" db:"ticket_id"`
	DispatchedAt time.Time `json:"dispatched_at" db:"dispatched_at"`
	Method       string    `json:"method" db:"method"` // auto, manual
	AssignedBy   string    `json:"assigned_by" db:"assigned_by"`
	Score        float64   `json:"score" db:"score"`
	Reason       string    `json:"reason" db:"reason"`
}

// DispatchRecordStatus represents queue status.
type DispatchQueueStatus struct {
	Pending  int `json:"pending"`
	Assigned int `json:"assigned"`
	Total    int `json:"total"`
}

// DispatchEngineer represents an engineer registered for dispatch.
type DispatchQueueEntry struct {
	TicketID     string     `json:"ticket_id"`
	Priority     string     `json:"priority"`
	Engineer     *string    `json:"engineer,omitempty"`
	DispatchedAt *time.Time `json:"dispatched_at"`
	EnqueuedAt   time.Time  `json:"enqueued_at"`
}

// WorkflowHistory represents a single workflow transition (legacy name used by repo).
type WorkflowHistory struct {
	ID          int       `json:"id" db:"id"`
	TicketID    string    `json:"ticket_id" db:"ticket_id"`
	Action      string    `json:"action" db:"action"`
	FromState   string    `json:"from_state" db:"from_state"`
	ToState     string    `json:"to_state" db:"to_state"`
	UserID      string    `json:"user_id" db:"user_id"`
	Comment     string    `json:"comment" db:"comment"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	// Aliases used by repository insert query (from_status/to_status/performed_by/reason)
	FromStatus  string `json:"-" db:"from_status"`
	ToStatus    string `json:"-" db:"to_status"`
	PerformedBy string `json:"-" db:"performed_by"`
	Reason      string `json:"-" db:"reason"`
}

// SuspendRecord represents a suspension record (legacy name used by repo).
type SuspendRecord struct {
	ID                   string     `json:"id" db:"id"`
	TenantID             string     `json:"tenant_id" db:"tenant_id"`
	EngineerID           string     `json:"engineer_id" db:"engineer_id"`
	Type                 string     `json:"type" db:"type"`
	Status               string     `json:"status" db:"status"`
	Reason               string     `json:"reason" db:"reason"`
	StartTime            time.Time  `json:"start_time" db:"start_time"`
	EndTime              *time.Time `json:"end_time" db:"end_time"`
	BackupEngineerID     string     `json:"backup_engineer_id" db:"backup_engineer_id"`
	AutoReassignPending  bool       `json:"auto_reassign_pending" db:"auto_reassign_pending"`
	PauseSLAForPending   bool       `json:"pause_sla_for_pending" db:"pause_sla_for_pending"`
	Notes                string     `json:"notes" db:"notes"`
	CreatedBy            string     `json:"created_by" db:"created_by"`
	ActivatedAt          *time.Time `json:"activated_at" db:"activated_at"`
	EndedAt              *time.Time `json:"ended_at" db:"ended_at"`
	CancelledAt          *time.Time `json:"cancelled_at" db:"cancelled_at"`
	UpdatedAt            *time.Time `json:"updated_at" db:"updated_at"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
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
	ID            int       `json:"id" db:"id"`
	RuleID        string    `json:"rule_id" db:"rule_id"`
	TicketID      string    `json:"ticket_id" db:"ticket_id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	TriggeredBy   string    `json:"triggered_by" db:"triggered_by"`
	ConditionsMet bool      `json:"conditions_met" db:"conditions_met"`
	ActionsTaken  string    `json:"actions_taken" db:"actions_taken"`
	Status        string    `json:"status" db:"status"` // success, failure, skipped
	TriggeredAt   time.Time `json:"triggered_at" db:"triggered_at"`
	Result        string    `json:"result" db:"result"`
	Detail        string    `json:"detail" db:"detail"`
}

// TransferRecord represents a ticket transfer event (legacy name used by repo).
type TransferRecord struct {
	ID             string    `json:"id" db:"id"`
	TicketID       string    `json:"ticket_id" db:"ticket_id"`
	FromEngineerID string    `json:"from_engineer_id" db:"from_engineer_id"`
	ToEngineerID   string    `json:"to_engineer_id" db:"to_engineer_id"`
	InitiatedBy    string    `json:"initiated_by" db:"initiated_by"`
	Reason         string    `json:"reason" db:"reason"`
	HoldDurationMs int64     `json:"hold_duration_ms" db:"hold_duration_ms"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// --- Missing types referenced by service layer ---

// DispatchWeights defines the weighting factors for dispatch scoring.
type DispatchWeights struct {
	Expertise    float64 `json:"expertise"`
	Workload     float64 `json:"workload"`
	SLA          float64 `json:"sla"`
	Response     float64 `json:"response"`
	Availability float64 `json:"availability"`
	SuccessRate  float64 `json:"success_rate"`
	SLAUrgency   float64 `json:"sla_urgency"`
}

// DispatchMatch represents a candidate engineer for dispatch scoring.
type DispatchMatch struct {
	EngineerID    string  `json:"engineer_id"`
	EngineerName  string  `json:"engineer_name"`
	Score         float64 `json:"score"`
	CurrentLoad   int     `json:"current_load"`
	ExpertisePct  float64 `json:"expertise_pct"`
	ResponseTimeMs int64  `json:"response_time_ms"`
	Availability  string   `json:"availability"`
	Reasons       []string `json:"reasons"`
}

// AutoTransferConfig controls automatic ticket transfer behavior.
type AutoTransferConfig struct {
	Enabled               bool                       `json:"enabled"`
	MaxTransfers          int                        `json:"max_transfers"`
	MaxHoldTimeMs         int64                      `json:"max_hold_time_ms"`
	MaxPendingTimeMs      int64                      `json:"max_pending_time_ms"`
	MinScoreToTransfer    float64                    `json:"min_score_to_transfer"`
	NotifySourceEngineer  bool                       `json:"notify_source_engineer"`
	NotifyTargetEngineer  bool                       `json:"notify_target_engineer"`
	RequireAcknowledgment bool                       `json:"require_acknowledgment"`
	TargetQueue           string                     `json:"target_queue"`
	NotStarted            map[string]time.Duration   `json:"not_started"`
}

// DefaultAutoTransferConfig returns a sensible default configuration.
func DefaultAutoTransferConfig() AutoTransferConfig {
	return AutoTransferConfig{
		Enabled:               true,
		MaxTransfers:          5,
		MaxHoldTimeMs:         30 * 60 * 1000, // 30 min
		MaxPendingTimeMs:      60 * 60 * 1000, // 1 hour
		MinScoreToTransfer:    0.5,
		NotifySourceEngineer:  true,
		NotifyTargetEngineer:  true,
		RequireAcknowledgment: false,
		TargetQueue:           "",
		NotStarted: map[string]time.Duration{
			"low":    4 * time.Hour,
			"medium": 2 * time.Hour,
			"high":   1 * time.Hour,
			"urgent": 30 * time.Minute,
		},
	}
}

// PeriodComparison holds metrics for two time periods.
type PeriodComparison struct {
	Current  PeriodStats `json:"current"`
	Previous PeriodStats `json:"previous"`
	Delta    PeriodDelta `json:"delta"`
}

// PeriodMetrics holds a single period's ticket statistics.
type PeriodMetrics struct {
	Total           int `json:"total"`
	Resolved        int `json:"resolved"`
	AvgResolutionMs int64 `json:"avg_resolution_ms"`
	Backlog         int `json:"backlog"`
}

// HeatmapData represents engineer activity heatmap.
type HeatmapData struct {
	Rows    []string      `json:"rows"`
	Cols    []string      `json:"cols"`
	Values  [][]float64   `json:"values"`
	Metric  string        `json:"metric"`
	Grain   string        `json:"grain"`
}

// BottleneckAnalysis holds workflow bottleneck info.
type BottleneckAnalysis struct {
	Bottlenecks     []Bottleneck `json:"bottlenecks"`
	OverallHealth   string       `json:"overall_health"`
	Recommendations []string     `json:"recommendations"`
}

// Bottleneck represents a single bottleneck point.
type Bottleneck struct {
	State           string  `json:"state"`
	Type            string  `json:"type"`
	AvgTimeMs       int64   `json:"avg_time_ms"`
	Count           int     `json:"count"`
	Health          string  `json:"health"`
	ReassignedCount int     `json:"reassigned_count"`
	Severity        string  `json:"severity"`
	Description     string  `json:"description"`
	EngineerID      string  `json:"engineer_id"`
}

// CategoryBreakdown holds per-category ticket stats.
type CategoryBreakdown struct {
	Category    string  `json:"category"`
	Count       int     `json:"count"`
	Percentage  float64 `json:"percentage"`
	Open        int     `json:"open"`
	Assigned    int     `json:"assigned"`
	Resolved    int     `json:"resolved"`
	Closed      int     `json:"closed"`
}

// RootCauseCorrelation holds cross-ticket root cause analysis.
type RootCauseCorrelation struct {
	TicketIDs       []string `json:"ticket_ids"`
	RelatedCount    int      `json:"related_count"`
	CommonKeywords  []string `json:"common_keywords"`
	Category        string   `json:"category"`
	Priority        string   `json:"priority"`
	Resolution      string   `json:"resolution"`
	CorrelationScore float64  `json:"correlation_score"`
	Confidence       float64  `json:"confidence"`
	RootCause        string   `json:"root_cause"`
}

// --- Additional missing types ---

// AssignmentSuccessMetrics holds assignment success rate stats.
type AssignmentSuccessMetrics struct {
	TotalAssignments   int     `json:"total_assignments"`
	SuccessfulFirstTry int     `json:"successful_first_try"`
	Reassignments      int     `json:"reassignments"`
	SuccessRate        float64 `json:"success_rate"`
}

// LoadBalanceSuggestion suggests engineer rebalancing.
type LoadBalanceSuggestion struct {
	EngineerID   string  `json:"engineer_id"`
	EngineerName string  `json:"engineer_name"`
	CurrentLoad  int     `json:"current_load"`
	MaxCapacity  int     `json:"max_capacity"`
	Utilization  float64 `json:"utilization"`
	Action       string  `json:"action"`
}

// TeamCapacity holds per-team load info.
type TeamCapacity struct {
	TeamID          string  `json:"team_id"`
	TeamName        string  `json:"team_name"`
	TotalLoad       int     `json:"total_load"`
	MaxCapacity     int     `json:"max_capacity"`
	Utilization     float64 `json:"utilization"`
	Engineers       int     `json:"engineers"`
	TotalEngineers  int     `json:"total_engineers"`
	TotalCapacity   int     `json:"total_capacity"`
	CurrentLoad     int     `json:"current_load"`
	AvailableCount  int     `json:"available_count"`
	CanAcceptMore   bool    `json:"can_accept_more"`
}

// EngineerCapacityCheck evaluates a single engineer's capacity.
type EngineerCapacityCheck struct {
	EngineerID    string  `json:"engineer_id"`
	EngineerName  string  `json:"engineer_name"`
	CurrentLoad   int     `json:"current_load"`
	MaxCapacity   int     `json:"max_capacity"`
	Available     bool    `json:"available"`
	Utilization   float64 `json:"utilization"`
	CanAcceptMore bool    `json:"can_accept_more"`
	AvailableSlots int    `json:"available_slots"`
}

// SLAQueueEntry holds a ticket queued for SLA monitoring.
type SLAQueueEntry struct {
	TicketID       string    `json:"ticket_id"`
	Priority       string    `json:"priority"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	TargetMs       int64     `json:"target_ms"`
	RemainingMs    int64     `json:"remaining_ms"`
	Breached       bool      `json:"breached"`
	DispatchQueueEntry
	SLAPriority    float64   `json:"sla_priority"`
	Age            string    `json:"age"`
	IsBreached     bool      `json:"is_breached"`
	SLAStatus      string    `json:"sla_status"`
}

// QueueAlert flags a queue health issue.
type QueueAlert struct {
	QueueID     string    `json:"queue_id"`
	AlertType   string    `json:"alert_type"`
	Message     string    `json:"message"`
	Severity    string    `json:"severity"`
	TicketCount int       `json:"ticket_count"`
	CreatedAt   time.Time `json:"created_at"`
	Type        string    `json:"type"`
}

// SLAAlertType is the alert type for queue alerts
type SLAAlertType string

// SuspendImpact holds impact assessment for an engineer suspension.
type SuspendImpact struct {
	EngineerID       string  `json:"engineer_id"`
	EngineerName     string  `json:"engineer_name"`
	SuspendID        string  `json:"suspend_id"`
	PendingCount     int     `json:"pending_count"`
	ActiveCount      int     `json:"active_count"`
	PendingTickets   int     `json:"pending_tickets"`
	ActiveTickets    int     `json:"active_tickets"`
	ReassignCount    int     `json:"reassign_count"`
	BackupEngineerID string  `json:"backup_engineer_id"`
	BackupEngineer   string  `json:"backup_engineer"`
	EstimatedDelayMs int64   `json:"estimated_delay_ms"`
}

// CreateCommentRequest is the body for creating a ticket comment.
type CreateCommentRequest struct {
	TicketID string `json:"ticket_id" binding:"required"`
	Text     string `json:"text" binding:"required"`
	Type     string `json:"type"`
}

// TrendDataPoint holds a single point in a trend series.
type TrendDataPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
}

// TrendSummary holds summary stats for a trend report.
type TrendSummary struct {
	TotalCreated int     `json:"total_created"`
	Trend        string  `json:"trend"`
	ChangeRate   float64 `json:"change_rate"`
}

// EngineDash fields added inline

// Missing types for analytics.go service code
type PeriodStats struct {
	PeriodStart     time.Time `json:"period_start"`
	PeriodEnd       time.Time `json:"period_end"`
	TotalTickets    int       `json:"total_tickets"`
	ResolvedTickets int       `json:"resolved_tickets"`
	AvgResolutionMs int64     `json:"avg_resolution_ms"`
}
type PeriodDelta struct {
	Created         int     `json:"created"`
	Resolved        int     `json:"resolved"`
	ChangePct       float64 `json:"change_pct"`
	TicketsDelta    int     `json:"tickets_delta"`
	TicketsDeltaPct float64 `json:"tickets_delta_pct"`
}

// ValidRelationTypes is the allowed relation type values.
var ValidRelationTypes = []string{"blocks", "blocked_by", "relates", "duplicate"}

// --- Dispatch availability constants ---

const (
	AvailabilityAvailable   = "available"
	AvailabilityUnavailable = "unavailable"
	AvailabilityBusy        = "busy"
)

// --- Ticket status constants ---

const StatusAssigned = "assigned"

// --- DefaultWeights returns the default dispatch scoring weights ---

func DefaultWeights() DispatchWeights {
	return DispatchWeights{
		Expertise:    0.30,
		Workload:     0.20,
		SLA:          0.10,
		Response:     0.10,
		Availability: 0.15,
		SuccessRate:  0.10,
		SLAUrgency:   0.05,
	}
}

// --- EngineerLoad holds per-engineer load info for LoadBalanceReport ---

type EngineerLoad struct {
	EngineerID  string  `json:"engineer_id"`
	Name        string  `json:"name"`
	CurrentLoad int     `json:"current_load"`
	MaxCapacity int     `json:"max_capacity"`
	Utilization float64 `json:"utilization"`
}

