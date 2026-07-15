package models

// Decision represents an AI decision record.
type Decision struct {
	ID         string  `db:"id" json:"id"`
	TenantID   string  `db:"tenant_id" json:"tenant_id"`
	Context    string  `db:"context" json:"context"`
	Choice     string  `db:"choice" json:"choice"`
	Confidence float64 `db:"confidence" json:"confidence"`
	Status     string  `db:"status" json:"status"`
	CreatedBy  string  `db:"created_by" json:"created_by"`
}

// DecisionOptions is the list of possible choices.
type DecisionOptions []string

// MakeDecisionRequest is the request body for creating a decision.
type MakeDecisionRequest struct {
	Context    string  `json:"context"`
	Choice     string  `json:"choice"`
	Confidence float64 `json:"confidence"`
	CreatedBy  string  `json:"created_by"`
}

// OverrideDecisionRequest is the request body for overriding a decision.
type OverrideDecisionRequest struct {
	Choice     string  `json:"choice"`
	Confidence float64 `json:"confidence"`
	CreatedBy  string  `json:"created_by"`
}

// ListDecisionsQuery is the query parameters for listing decisions.
type ListDecisionsQuery struct {
	Status string
	Limit  int
	Offset int
}

// DecisionListResponse wraps a paginated list of decisions.
type DecisionListResponse struct {
	Decisions []Decision `json:"decisions"`
	Total     int        `json:"total"`
}

// DecisionStats holds aggregated decision statistics.
type DecisionStats struct {
	Total      int            `json:"total"`
	ByStatus   map[string]int `json:"by_status"`
	ByChoice   map[string]int `json:"by_choice"`
	AvgConfidence float64      `json:"avg_confidence"`
}
