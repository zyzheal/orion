package models

import "time"

// InspectionReport is the output report of a completed inspection.
type InspectionReport struct {
	ID          string            `json:"id" db:"id"`
	TenantID    string            `json:"tenantId" db:"tenant_id"`
	InspectionID string           `json:"inspectionId" db:"inspection_id"`
	Name        string            `json:"name" db:"name"`
	Status      string            `json:"status" db:"status"`
	Problems    int               `json:"problems" db:"problems"`
	Warnings    int               `json:"warnings" db:"warnings"`
	Errors      int               `json:"errors" db:"errors"`
	Results     map[string]any    `json:"results" db:"results"`
	GeneratedAt time.Time         `json:"generatedAt" db:"generated_at"`
	CreatedAt   time.Time         `json:"createdAt" db:"created_at"`
}
