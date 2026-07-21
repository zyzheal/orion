package models

import "time"

// DisasterPlan defines a disaster recovery plan.
type DisasterPlan struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Steps       string    `db:"steps" json:"steps"`
	Status      string    `db:"status" json:"status"`
	LastRun     time.Time `db:"last_run" json:"last_run"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// CreateDisasterPlanRequest is the request body for creating a plan.
type CreateDisasterPlanRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Steps       []string `json:"steps" binding:"required"`
}

// UpdateDisasterPlanRequest is the request body for updating a plan.
type UpdateDisasterPlanRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Steps       []string `json:"steps" binding:"required"`
}

// RecoveryRun represents one execution of a disaster plan.
type RecoveryRun struct {
	ID        string    `db:"id" json:"id"`
	PlanID    string    `db:"plan_id" json:"plan_id"`
	Status    string    `db:"status" json:"status"`
	StartedAt time.Time `db:"started_at" json:"started_at"`
	EndedAt   time.Time `db:"ended_at" json:"ended_at"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ListPlansResponse returns a paginated list of plans.
type ListPlansResponse struct {
	Plans []DisasterPlan `json:"plans"`
	Total int            `json:"total"`
}
