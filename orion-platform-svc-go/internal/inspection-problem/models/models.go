package models

import "time"

// ProblemRecord represents a single inspection problem.
type ProblemRecord struct {
	ID          string            `json:"id" db:"id"`
	TenantID    string            `json:"tenantId" db:"tenant_id"`
	InspectionID string           `json:"inspectionId" db:"inspection_id"`
	Name        string            `json:"name" db:"name"`
	Severity    string            `json:"severity" db:"severity"`
	Value       float64           `json:"value" db:"value"`
	Reason      string            `json:"reason" db:"reason"`
	Labels      map[string]string `json:"labels" db:"labels"`
	Resolved    bool              `json:"resolved" db:"resolved"`
	CreatedAt   time.Time         `json:"createdAt" db:"created_at"`
	ResolvedAt  *time.Time        `json:"resolvedAt" db:"resolved_at"`
}
