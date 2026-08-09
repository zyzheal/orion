package models

// PipelineTrend represents a computed trend summary for a single pipeline
// aggregated over a given time period (day/week/month).
type PipelineTrend struct {
	ID          string  `json:"id" db:"id"`
	PipelineID  string  `json:"pipelineId" db:"pipeline_id"`
	SuccessRate float64 `json:"successRate" db:"success_rate"`
	AvgDuration float64 `json:"avgDuration" db:"avg_duration"`
	TotalRuns   int     `json:"totalRuns" db:"total_runs"`
	FailedRuns  int     `json:"failedRuns" db:"failed_runs"`
	Period      string  `json:"period" db:"period"` // day/week/month
	PeriodStart string  `json:"periodStart" db:"period_start"`
	TenantID    string  `json:"tenantId" db:"tenant_id"`
	CreatedAt   string  `json:"createdAt" db:"created_at"`
}

// TrendEntry represents a single data point in a pipeline run history trend.
type TrendEntry struct {
	Date        string   `json:"date"`
	Total       int      `json:"total"`
	Succeeded   int      `json:"succeeded"`
	Failed      int      `json:"failed"`
	Cancelled   int      `json:"cancelled"`
	AvgDuration *float64 `json:"avgDuration,omitempty"`
}

// TrendResponse is the API response for a single pipeline trend query.
type TrendResponse struct {
	Data        []TrendEntry `json:"data"`
	PipelineID  string       `json:"pipelineId"`
	Period      string       `json:"period"`
	Granularity string       `json:"granularity"`
	Total       int          `json:"total"`
}

// CompareRequest represents a request to compare multiple pipeline run histories.
type CompareRequest struct {
	PipelineIDs []string `json:"pipelineIds" binding:"required"`
	Period      string   `json:"period"`
	Granularity string   `json:"granularity"`
}

// CompareResponse is the API response for a cross-pipeline comparison query.
type CompareResponse struct {
	Data          map[string][]TrendEntry `json:"data"`
	Period        string                  `json:"period"`
	Granularity   string                  `json:"granularity"`
	PipelineCount int                     `json:"pipelineCount"`
}
