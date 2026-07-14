package models

import "time"

// DecisionExplanation represents a DecisionExplanation.
type DecisionExplanation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateDecisionExplanationRequest is the request body for creating a DecisionExplanation.
type CreateDecisionExplanationRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateDecisionExplanationRequest is the request body for updating a DecisionExplanation.
type UpdateDecisionExplanationRequest struct {
	Name *string `json:"name"`
}
