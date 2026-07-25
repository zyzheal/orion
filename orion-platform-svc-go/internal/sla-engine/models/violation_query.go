package models

// ViolationListQuery is the query filter for listing violations.
type ViolationListQuery struct {
	TrackerID     string `form:"tracker_id"`
	Severity      string `form:"severity"`
	ViolationType string `form:"violation_type"`
	Limit         int    `form:"limit"`
	Offset        int    `form:"offset"`
}

// ViolationStatistics holds a count summary of violations.
type ViolationStatistics struct {
	TotalViolations   int `json:"total_violations"`
	ResponseBreach    int `json:"response_breach"`
	ResolutionBreach  int `json:"resolution_breach"`
	Notified          int `json:"notified"`
}
