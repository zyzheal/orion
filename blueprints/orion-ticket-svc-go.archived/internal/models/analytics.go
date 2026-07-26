package models

import "time"

// ExecutiveDashboard is the top-level BI dashboard
type ExecutiveDashboard struct {
	PeriodStart    time.Time              `json:"period_start"`
	PeriodEnd      time.Time              `json:"period_end"`
	TotalTickets   int                    `json:"total_tickets"`
	OpenTickets    int                    `json:"open_tickets"`
	ResolvedTickets int                   `json:"resolved_tickets"`
	AvgResolutionMs float64               `json:"avg_resolution_ms"`
	SLACompliance  float64                `json:"sla_compliance"`
	TrendData      []TrendPoint           `json:"trend_data"`
	ByPriority     map[string]int         `json:"by_priority"`
	ByCategory     map[string]int         `json:"by_category"`
	TopEngineers   []EngineerSummary      `json:"top_engineers"`
}

// ManagerDashboard is the team-level dashboard
type ManagerDashboard struct {
	PeriodStart     time.Time              `json:"period_start"`
	PeriodEnd       time.Time              `json:"period_end"`
	TeamTickets     int                    `json:"team_tickets"`
	TeamOpenTickets int                    `json:"team_open_tickets"`
	TeamAvgMs       float64                `json:"team_avg_resolution_ms"`
	Engineers       []EngineerSummary      `json:"engineers"`
	TrendData       []TrendPoint           `json:"trend_data"`
	Bottlenecks     []string               `json:"bottlenecks"`
}

// EngineerDashboard is the individual engineer dashboard
type EngineerDashboard struct {
	EngineerID      string        `json:"engineer_id"`
	PeriodStart     time.Time     `json:"period_start"`
	PeriodEnd       time.Time     `json:"period_end"`
	AssignedTickets int           `json:"assigned_tickets"`
	ResolvedTickets int           `json:"resolved_tickets"`
	AvgResolutionMs float64       `json:"avg_resolution_ms"`
	SLACompliance   float64       `json:"sla_compliance"`
	TrendData       []TrendPoint  `json:"trend_data"`
	CategoryBreakdown map[string]int `json:"category_breakdown"`
}

// EngineerSummary is a brief engineer stat
type EngineerSummary struct {
	EngineerID   string  `json:"engineer_id"`
	Name         string  `json:"name"`
	TicketsHandled int   `json:"tickets_handled"`
	AvgResolutionMs float64 `json:"avg_resolution_ms"`
	SLACompliance float64 `json:"sla_compliance"`
}

// EngineerEfficiency tracks efficiency over time
type EngineerEfficiency struct {
	EngineerID string         `json:"engineer_id"`
	Granularity string        `json:"granularity"`
	DataPoints []EfficiencyPoint `json:"data_points"`
}

// EfficiencyPoint is a single efficiency measurement
type EfficiencyPoint struct {
	Timestamp       time.Time `json:"timestamp"`
	TicketsResolved int       `json:"tickets_resolved"`
	AvgResolutionMs float64   `json:"avg_resolution_ms"`
	SLACompliance   float64   `json:"sla_compliance"`
}

// EfficiencyScore is a computed efficiency rating
type EfficiencyScore struct {
	EngineerID  string  `json:"engineer_id"`
	Score       float64 `json:"score"`
	Grade       string  `json:"grade"` // A, B, C, D, F
	Components  map[string]float64 `json:"components"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
}

// PeriodComparison compares two time periods
type PeriodComparison struct {
	Current   PeriodStats `json:"current"`
	Previous  PeriodStats `json:"previous"`
	Delta     PeriodDelta `json:"delta"`
}

// PeriodStats is stats for a time period
type PeriodStats struct {
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
	TotalTickets   int       `json:"total_tickets"`
	ResolvedTickets int      `json:"resolved_tickets"`
	AvgResolutionMs float64  `json:"avg_resolution_ms"`
	SLACompliance  float64   `json:"sla_compliance"`
}

// PeriodDelta is the change between periods
type PeriodDelta struct {
	TicketsDelta     int     `json:"tickets_delta"`
	TicketsDeltaPct  float64 `json:"tickets_delta_pct"`
	ResolutionDeltaMs float64 `json:"resolution_delta_ms"`
	SLADelta         float64 `json:"sla_delta"`
}

// TrendPoint is a data point in a time series
type TrendPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Label     string    `json:"label,omitempty"`
}

// BIExportRequest is input for exporting BI data
type BIExportRequest struct {
	Dataset     string `json:"dataset" binding:"required"` // tickets, sla, dispatch, efficiency
	Granularity string `json:"granularity"`
	PeriodStart string `json:"period_start"`
	PeriodEnd   string `json:"period_end"`
}

// BITrendRequest is input for time trend queries
type BITrendRequest struct {
	Metric      string `form:"metric"`
	Start       string `form:"start"`
	End         string `form:"end"`
	Granularity string `form:"granularity"`
}

// ResolutionStats summarizes resolution metrics
type ResolutionStats struct {
	TotalResolved   int     `json:"total_resolved"`
	AvgResolutionMs float64 `json:"avg_resolution_ms"`
	MedianMs        float64 `json:"median_ms"`
	P95Ms           float64 `json:"p95_ms"`
	ByPriority      map[string]float64 `json:"by_priority"`
	ByCategory      map[string]float64 `json:"by_category"`
}

// BacklogAnalysis analyzes the current ticket backlog
type BacklogAnalysis struct {
	TotalOpen      int            `json:"total_open"`
	ByPriority     map[string]int `json:"by_priority"`
	ByCategory     map[string]int `json:"by_category"`
	OldestTicketAge string        `json:"oldest_ticket_age"`
	AvgAge         string         `json:"avg_age"`
	StaleCount     int            `json:"stale_count"`
}

// TrendReport shows ticket trends over time
type TrendReport struct {
	Days        int          `json:"days"`
	Granularity string       `json:"granularity"`
	DataPoints  []TrendPoint `json:"data_points"`
	Summary     TrendSummary `json:"summary"`
}

// TrendSummary is a brief trend summary
type TrendSummary struct {
	TotalCreated  int     `json:"total_created"`
	TotalResolved int     `json:"total_resolved"`
	Trend         string  `json:"trend"` // increasing, decreasing, stable
	ChangeRate    float64 `json:"change_rate"`
}

// TicketStatistics is the overall ticket statistics
type TicketStatistics struct {
	TotalTickets    int            `json:"total_tickets"`
	OpenTickets     int            `json:"open_tickets"`
	AssignedTickets int            `json:"assigned_tickets"`
	InProgressTickets int          `json:"in_progress_tickets"`
	ResolvedTickets int            `json:"resolved_tickets"`
	ClosedTickets   int            `json:"closed_tickets"`
	ByPriority      map[string]int `json:"by_priority"`
	ByCategory      map[string]int `json:"by_category"`
	AvgResolutionMs float64        `json:"avg_resolution_ms"`
}
