package models

import "time"

// TransferType categorizes the reason for transfer
type TransferType string

const (
	TransferTypeManual    TransferType = "manual"
	TransferTypeAuto      TransferType = "auto"
	TransferTypeTimeout   TransferType = "timeout"
	TransferTypeSuspend   TransferType = "suspend"
	TransferTypeEscalate  TransferType = "escalate"
)

// AutoTransferConfig controls automatic transfer behavior per priority
type AutoTransferConfig struct {
	NotStarted  map[string]time.Duration `json:"not_started"`  // priority -> max hold time before auto-transfer
	InProgress  map[string]time.Duration `json:"in_progress"`  // priority -> max hold time before auto-transfer
	MaxTransfers int                     `json:"max_transfers"` // max transfers per ticket
	ExcludePrevious bool                 `json:"exclude_previous"` // exclude previous assignees from auto-transfer
}

// DefaultAutoTransferConfig returns the default auto-transfer configuration
func DefaultAutoTransferConfig() AutoTransferConfig {
	return AutoTransferConfig{
		NotStarted: map[string]time.Duration{
			"critical": 15 * time.Minute,
			"high":     30 * time.Minute,
			"medium":   2 * time.Hour,
			"low":      8 * time.Hour,
		},
		InProgress: map[string]time.Duration{
			"critical": 2 * time.Hour,
			"high":     4 * time.Hour,
			"medium":   12 * time.Hour,
			"low":      36 * time.Hour,
		},
		MaxTransfers:    3,
		ExcludePrevious: true,
	}
}

// TransferStats aggregates transfer statistics
type TransferStats struct {
	TotalTransfers   int                    `json:"total_transfers"`
	ByType           map[TransferType]int   `json:"by_type"`
	ByPriority       map[string]int         `json:"by_priority"`
	AvgHoldDuration  float64                `json:"avg_hold_duration_ms"`
	MaxHoldDuration  float64                `json:"max_hold_duration_ms"`
	TopReceivers     []EngineerTransferCount `json:"top_receivers"`
	TopSenders       []EngineerTransferCount `json:"top_senders"`
	TransferRate     float64                `json:"transfer_rate"` // transfers per ticket
}

// EngineerTransferCount pairs an engineer with their transfer count
type EngineerTransferCount struct {
	EngineerID string `json:"engineer_id"`
	Name       string `json:"name"`
	Count      int    `json:"count"`
}

// ReassignmentSuggestion recommends reassigning tickets from overloaded engineers
type ReassignmentSuggestion struct {
	TicketID        string  `json:"ticket_id"`
	CurrentEngineer string  `json:"current_engineer"`
	SuggestedEngineer string `json:"suggested_engineer"`
	Reason          string  `json:"reason"`
	Urgency         string  `json:"urgency"` // high, medium, low
	CurrentLoad     int     `json:"current_load"`
	SuggestedLoad   int     `json:"suggested_load"`
}

// TeamCapacity represents team-level capacity metrics
type TeamCapacity struct {
	TeamName        string  `json:"team_name"`
	TotalEngineers  int     `json:"total_engineers"`
	AvailableCount  int     `json:"available_count"`
	TotalCapacity   int     `json:"total_capacity"`
	CurrentLoad     int     `json:"current_load"`
	Utilization     float64 `json:"utilization"`
	CanAcceptMore   bool    `json:"can_accept_more"`
}

// EngineerCapacityCheck checks if an engineer can accept more tickets
type EngineerCapacityCheck struct {
	EngineerID   string `json:"engineer_id"`
	CanAccept    bool   `json:"can_accept"`
	CurrentLoad  int    `json:"current_load"`
	MaxCapacity  int    `json:"max_capacity"`
	Available    int    `json:"available_slots"`
	Utilization  float64 `json:"utilization"`
}

// SLAQueueEntry extends DispatchQueueEntry with SLA-aware priority scoring
type SLAQueueEntry struct {
	DispatchQueueEntry
	SLADeadline     *time.Time `json:"sla_deadline,omitempty"`
	SLAPriority     float64    `json:"sla_priority"`     // computed priority score
	EscalationLevel int        `json:"escalation_level"`
	Age             string     `json:"age"`              // human-readable age
}

// SLAAlertType categorizes SLA alerts
type SLAAlertType string

const (
	SLAAlertWarning  SLAAlertType = "sla-warning"
	SLAAlertCritical SLAAlertType = "sla-critical"
	SLAAlertBreach   SLAAlertType = "sla-breach"
)

// QueueAlert represents an alert from the dispatch queue
type QueueAlert struct {
	Type      SLAAlertType `json:"type"`
	TicketID  string       `json:"ticket_id"`
	Priority  string       `json:"priority"`
	Message   string       `json:"message"`
	Since     time.Time    `json:"since"`
	Deadline  time.Time    `json:"deadline"`
	Percent   float64      `json:"percent_elapsed"`
}

// HeatmapData represents workload distribution for heatmap visualization
type HeatmapData struct {
	Rows    []string    `json:"rows"`    // engineer names
	Cols    []string    `json:"cols"`    // time periods
	Values  [][]float64 `json:"values"`  // load values
}

// BottleneckAnalysis identifies bottlenecks in ticket processing
type BottleneckAnalysis struct {
	Bottlenecks    []Bottleneck `json:"bottlenecks"`
	OverallHealth  string       `json:"overall_health"` // healthy, warning, critical
	Recommendations []string    `json:"recommendations"`
}

// Bottleneck represents a single bottleneck
type Bottleneck struct {
	Type        string `json:"type"` // overloaded_engineer, sla_risk, queue_backlog, category_imbalance
	Severity    string `json:"severity"` // high, medium, low
	Description string `json:"description"`
	EngineerID  string `json:"engineer_id,omitempty"`
	Count       int    `json:"count,omitempty"`
}

// CategoryBreakdown shows ticket distribution by category for an engineer
type CategoryBreakdown struct {
	Category    string  `json:"category"`
	Count       int     `json:"count"`
	Percentage  float64 `json:"percentage"`
	AvgResolutionMs float64 `json:"avg_resolution_ms"`
}
