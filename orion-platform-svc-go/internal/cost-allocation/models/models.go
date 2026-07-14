package models

import (
	"encoding/json"
	"time"
)

// Allocation represents a cost allocation definition.
type Allocation struct {
	ID              string            `json:"id" db:"id"`
	TenantID        string            `json:"tenantId" db:"tenant_id"`
	Name            string            `json:"name" db:"name"`
	Description     *string           `json:"description" db:"description"`
	Type            string            `json:"type" db:"type"`
	Status          string            `json:"status" db:"status"`
	SourceAccount   *string           `json:"sourceAccount" db:"source_account"`
	AllocationKey   *string           `json:"allocationKey" db:"allocation_key"`
	AllocationRules json.RawMessage   `json:"allocationRules" db:"allocation_rules"`
	CreatedBy       *string           `json:"createdBy" db:"created_by"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time         `json:"updatedAt" db:"updated_at"`
}

// CreateAllocationRequest is the request body for creating an allocation.
type CreateAllocationRequest struct {
	Name            string            `json:"name" binding:"required"`
	Description     *string           `json:"description"`
	Type            string            `json:"type" binding:"required"`
	SourceAccount   *string           `json:"sourceAccount"`
	AllocationKey   *string           `json:"allocationKey"`
	AllocationRules json.RawMessage   `json:"allocationRules"`
}

// UpdateAllocationRequest is the request body for updating an allocation.
type UpdateAllocationRequest struct {
	Name            *string           `json:"name"`
	Description     *string           `json:"description"`
	Type            *string           `json:"type"`
	Status          *string           `json:"status"`
	SourceAccount   *string           `json:"sourceAccount"`
	AllocationKey   *string           `json:"allocationKey"`
	AllocationRules json.RawMessage   `json:"allocationRules"`
}

// Rule represents an allocation rule.
type Rule struct {
	ID               string            `json:"id" db:"id"`
	AllocationID     string            `json:"allocationId" db:"allocation_id"`
	ConditionType    string            `json:"conditionType" db:"condition_type"`
	ConditionValue   json.RawMessage   `json:"conditionValue" db:"condition_value"`
	Percentage       float64           `json:"percentage" db:"percentage"`
	TargetServices   []string          `json:"targetServices" db:"target_services"`
	TargetTags       []string          `json:"targetTags" db:"target_tags"`
	CreatedAt        time.Time         `json:"createdAt" db:"created_at"`
}

// CreateRuleRequest is the request body for creating a rule.
type CreateRuleRequest struct {
	AllocationID   string            `json:"allocationId" binding:"required"`
	ConditionType  string            `json:"conditionType" binding:"required"`
	ConditionValue json.RawMessage   `json:"conditionValue" binding:"required"`
	Percentage     float64           `json:"percentage"`
	TargetServices []string          `json:"targetServices"`
	TargetTags     []string          `json:"targetTags"`
}

// Report represents an allocation report.
type Report struct {
	ID              string            `json:"id" db:"id"`
	TenantID        string            `json:"tenantId" db:"tenant_id"`
	AllocationID    string            `json:"allocationId" db:"allocation_id"`
	PeriodStart     string            `json:"periodStart" db:"period_start"`
	PeriodEnd       string            `json:"periodEnd" db:"period_end"`
	Status          string            `json:"status" db:"status"`
	TotalCost       *float64          `json:"totalCost" db:"total_cost"`
	AllocatedCost   *float64          `json:"allocatedCost" db:"allocated_cost"`
	ResultData      json.RawMessage   `json:"resultData" db:"result_data"`
	StartedAt       *time.Time        `json:"startedAt" db:"started_at"`
	CompletedAt     *time.Time        `json:"completedAt" db:"completed_at"`
	ErrorMessage    *string           `json:"errorMessage" db:"error_message"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time         `json:"updatedAt" db:"updated_at"`
}

// CreateReportRequest is the request body for creating a report.
type CreateReportRequest struct {
	AllocationID string  `json:"allocationId" binding:"required"`
	PeriodStart  string  `json:"periodStart" binding:"required"`
	PeriodEnd    string  `json:"periodEnd" binding:"required"`
}

// AllocationFilter represents filter parameters for listing allocations.
type AllocationFilter struct {
	Status    *string
	Type      *string
	Limit     int
	Offset    int
}

// ReportFilter represents filter parameters for listing reports.
type ReportFilter struct {
	AllocationID *string
	Status       *string
	PeriodStart  *string
	PeriodEnd    *string
	Limit        int
	Offset       int
}
