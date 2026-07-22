package models

import "time"

// HealthCheck defines a registered health check.
type HealthCheck struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	URL         string    `db:"url" json:"url"`
	CheckType   string    `db:"check_type" json:"checkType"`
	IntervalSec int       `db:"interval_sec" json:"intervalSec"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Status      string    `db:"status" json:"status"`
	LastResult  string    `db:"last_result" json:"lastResult"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// HealthCheckResult is the result of executing a health check.
type HealthCheckResult struct {
	Status    string                 `json:"status"`
	Message   string                 `json:"message"`
	LatencyMs float64                `json:"latencyMs"`
	CheckType string                 `json:"checkType"`
	Timestamp time.Time              `json:"timestamp"`
	Details   map[string]interface{} `json:"details"`
}

// CreateHealthCheckRequest registers a health check.
type CreateHealthCheckRequest struct {
	Name        string `json:"name" binding:"required"`
	CheckType   string `json:"checkType" binding:"required"`
	URL         string `json:"url"`
	IntervalSec int    `json:"intervalSec"`
}

// ExecuteHealthCheckRequest runs a health check.
type ExecuteHealthCheckRequest struct {
	TimeoutMs int `json:"timeoutMs"`
	Retries   int `json:"retries"`
}

// QuickHealthCheckRequest performs a one-off check.
type QuickHealthCheckRequest struct {
	CheckType     string                 `json:"checkType" binding:"required"`
	URL           string                 `json:"url"`
	ConnectionStr string                 `json:"connectionString"`
	TimeoutMs     int                    `json:"timeoutMs"`
	Kubeconfig    string                 `json:"kubeconfig"`
	Resources     map[string]interface{} `json:"resources"`
}
