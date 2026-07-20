package models

import "time"

// Policy represents a notification policy.
type Policy struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	UserID      string    `db:"user_id" json:"userId"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Conditions  string    `db:"conditions" json:"conditions"`
	Actions     string    `db:"actions" json:"actions"`
	Priority    int       `db:"priority" json:"priority"`
	Order       int       `db:"order" json:"order"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// PolicyWorkflow represents a workflow associated with a notification policy.
type PolicyWorkflow struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	UserID      string    `db:"user_id" json:"userId"`
	PolicyID    string    `db:"policy_id" json:"policyId"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Steps       string    `db:"steps" json:"steps"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// CreatePolicyRequest is the request body for creating a notification policy.
type CreatePolicyRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Conditions  string `json:"conditions"`
	Actions     string `json:"actions"`
	Priority    int    `json:"priority"`
	Order       int    `json:"order"`
	Enabled     bool   `json:"enabled"`
}

// UpdatePolicyRequest is the request body for updating a notification policy.
type UpdatePolicyRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Conditions  *string `json:"conditions"`
	Actions     *string `json:"actions"`
	Priority    *int    `json:"priority"`
	Order       *int    `json:"order"`
	Enabled     *bool   `json:"enabled"`
}

// ListFilter contains optional filters for listing policies.
type ListFilter struct {
	Enabled  *bool `json:"enabled"`
	Priority *int  `json:"priority"`
}

// CreateWorkflowRequest is the request body for creating a policy workflow.
type CreateWorkflowRequest struct {
	PolicyID    string `json:"policyId" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Steps       string `json:"steps"`
	Enabled     bool   `json:"enabled"`
}

// UpdateWorkflowRequest is the request body for updating a policy workflow.
type UpdateWorkflowRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Steps       *string `json:"steps"`
	Enabled     *bool   `json:"enabled"`
}

// EvaluateRequest is the request body for evaluating notification policies.
type EvaluateRequest struct {
	UserID  string            `json:"userId"`
	Context map[string]string `json:"context"`
}

// EvaluateResult represents the result of a policy evaluation.
type EvaluateResult struct {
	PolicyID   string   `json:"policyId"`
	PolicyName string   `json:"policyName"`
	Matched    bool     `json:"matched"`
	Actions    []string `json:"actions"`
	Reason     string   `json:"reason"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
