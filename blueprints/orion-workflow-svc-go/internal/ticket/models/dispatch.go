package models

import "time"

// EngineerAvailability states
const (
	AvailabilityAvailable   = "available"
	AvailabilityBusy        = "busy"
	AvailabilityUnavailable = "unavailable"
)

// EngineerProfile represents an engineer in the dispatch system
type EngineerProfile struct {
	ID              string              `json:"id" db:"id"`
	Name            string              `json:"name" db:"name"`
	Expertise       []string            `json:"expertise" db:"expertise"`
	CurrentLoad     int                 `json:"current_load" db:"current_load"`
	MaxCapacity     int                 `json:"max_capacity" db:"max_capacity"`
	Availability    string              `json:"availability" db:"availability"`
	Skills          []string            `json:"skills,omitempty" db:"skills"`
	Team            string              `json:"team,omitempty" db:"team"`
	OnCall          bool                `json:"on_call" db:"on_call"`
	TotalResolved   int                 `json:"total_resolved" db:"total_resolved"`
	AvgResolutionMs float64             `json:"avg_resolution_ms" db:"avg_resolution_ms"`
	SLACompliance   float64             `json:"sla_compliance" db:"sla_compliance"`
	SuccessRate     float64             `json:"success_rate" db:"success_rate"`
	CreatedAt       time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at" db:"updated_at"`
}

// RegisterEngineerRequest is the input for registering an engineer
type RegisterEngineerRequest struct {
	ID           string   `json:"id" binding:"required"`
	Name         string   `json:"name" binding:"required"`
	Expertise    []string `json:"expertise" binding:"required"`
	CurrentLoad  int      `json:"current_load"`
	MaxCapacity  int      `json:"max_capacity" binding:"required"`
	Availability string   `json:"availability"`
	Skills       []string `json:"skills"`
	Team         string   `json:"team"`
	OnCall       bool     `json:"on_call"`
}

// DispatchRecord tracks a ticket dispatch event
type DispatchRecord struct {
	ID          string    `json:"id" db:"id"`
	TicketID    string    `json:"ticket_id" db:"ticket_id"`
	EngineerID  string    `json:"engineer_id" db:"engineer_id"`
	AssignedBy  string    `json:"assigned_by" db:"assigned_by"`
	Method      string    `json:"method" db:"method"` // auto, manual, rule
	Score       float64   `json:"score" db:"score"`
	Reason      string    `json:"reason,omitempty" db:"reason"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// DispatchRule defines a conditional dispatch rule
type DispatchRule struct {
	ID         string `json:"id" db:"id"`
	Name       string `json:"name" db:"name"`
	Condition  string `json:"condition" db:"condition"`
	EngineerID string `json:"engineer_id" db:"engineer_id"`
	Priority   int    `json:"priority" db:"priority"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// CreateDispatchRuleRequest is input for creating a dispatch rule
type CreateDispatchRuleRequest struct {
	Name       string `json:"name" binding:"required"`
	Condition  string `json:"condition" binding:"required"`
	EngineerID string `json:"engineer_id"`
	Priority   int    `json:"priority"`
}

// DispatchWeights controls the dispatch scoring algorithm
type DispatchWeights struct {
	Expertise   float64 `json:"expertise"`
	Workload    float64 `json:"workload"`
	Availability float64 `json:"availability"`
	SuccessRate float64 `json:"success_rate"`
	SLAUrgency  float64 `json:"sla_urgency"`
}

// DefaultWeights returns the default dispatch weights
func DefaultWeights() DispatchWeights {
	return DispatchWeights{
		Expertise:   0.3,
		Workload:    0.25,
		Availability: 0.2,
		SuccessRate: 0.15,
		SLAUrgency:  0.1,
	}
}

// DispatchMatch represents a scored engineer match for a ticket
type DispatchMatch struct {
	EngineerID  string  `json:"engineer_id"`
	EngineerName string `json:"engineer_name"`
	Score       float64 `json:"score"`
	Reasons     []string `json:"reasons"`
}

// DispatchQueueEntry is a ticket waiting in the dispatch queue
type DispatchQueueEntry struct {
	TicketID    string    `json:"ticket_id" db:"ticket_id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Priority    string    `json:"priority" db:"priority"`
	EnqueuedAt  time.Time `json:"enqueued_at" db:"enqueued_at"`
	Attempts    int       `json:"attempts" db:"attempts"`
	LastError   string    `json:"last_error,omitempty" db:"last_error"`
}

// DispatchQueueStatus is the current state of the dispatch queue
type DispatchQueueStatus struct {
	PendingCount  int       `json:"pending_count"`
	ProcessingCount int     `json:"processing_count"`
	OldestEntry   *time.Time `json:"oldest_entry,omitempty"`
	AvgWaitMs     float64   `json:"avg_wait_ms"`
}

// DispatchMetrics summarizes dispatch performance
type DispatchMetrics struct {
	TotalDispatches    int     `json:"total_dispatches"`
	AutoDispatches     int     `json:"auto_dispatches"`
	ManualDispatches   int     `json:"manual_dispatches"`
	AvgTimeToAssignMs  float64 `json:"avg_time_to_assign_ms"`
	SuccessRate        float64 `json:"success_rate"`
	ReassignmentRate   float64 `json:"reassignment_rate"`
}

// SLAAlert represents a dispatch SLA alert
type SLAAlert struct {
	Type      string    `json:"type"`
	TicketID  string    `json:"ticket_id"`
	Priority  string    `json:"priority"`
	EngineerID string   `json:"engineer_id,omitempty"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// LoadBalanceReport shows engineer load distribution
type LoadBalanceReport struct {
	Engineers     []EngineerLoad `json:"engineers"`
	AvgLoad       float64        `json:"avg_load"`
	MaxLoad       int            `json:"max_load"`
	MinLoad       int            `json:"min_load"`
	ImbalanceScore float64       `json:"imbalance_score"`
}

// EngineerLoad is a single engineer's load info
type EngineerLoad struct {
	EngineerID   string  `json:"engineer_id"`
	Name         string  `json:"name"`
	CurrentLoad  int     `json:"current_load"`
	MaxCapacity  int     `json:"max_capacity"`
	Utilization  float64 `json:"utilization"`
}

// AssignmentSuccessMetrics tracks assignment outcomes
type AssignmentSuccessMetrics struct {
	TotalAssignments   int     `json:"total_assignments"`
	SuccessfulFirstTry int     `json:"successful_first_try"`
	Reassignments      int     `json:"reassignments"`
	SuccessRate        float64 `json:"success_rate"`
}

// TimeToAssignmentStats summarizes time-to-assignment
type TimeToAssignmentStats struct {
	AvgMs    float64 `json:"avg_ms"`
	MedianMs float64 `json:"median_ms"`
	P95Ms    float64 `json:"p95_ms"`
	MaxMs    float64 `json:"max_ms"`
}

// EngineerPerformance summarizes an engineer's performance
type EngineerPerformance struct {
	EngineerID       string  `json:"engineer_id"`
	Name             string  `json:"name"`
	TotalAssigned    int     `json:"total_assigned"`
	TotalResolved    int     `json:"total_resolved"`
	AvgResolutionMs  float64 `json:"avg_resolution_ms"`
	SLACompliance    float64 `json:"sla_compliance"`
	EscalationCount  int     `json:"escalation_count"`
	TransferCount    int     `json:"transfer_count"`
	SuccessRate      float64 `json:"success_rate"`
}
