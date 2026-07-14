package models

import "time"

// RunHistoryEntry represents one time-period bucket in pipeline run history.
type RunHistoryEntry struct {
	PeriodStart time.Time `db:"period_start" json:"periodStart"`
	PeriodEnd   time.Time `db:"period_end" json:"periodEnd"`
	TotalRuns   int64     `db:"total_runs" json:"totalRuns"`
	Succeeded   int64     `db:"succeeded" json:"succeeded"`
	Failed      int64     `db:"failed" json:"failed"`
	Cancelled   int64     `db:"cancelled" json:"cancelled"`
	AvgDuration *float64  `db:"avg_duration" json:"avgDuration"`
}

// RunHistoryResponse is the response body for pipeline run history.
type RunHistoryResponse struct {
	Entries    []RunHistoryEntry `json:"entries"`
	PipelineID string            `json:"pipelineId"`
	Period     string            `json:"period"`
	TotalCount int               `json:"totalCount"`
}
