package models

import "time"

// CanaryStatus represents the lifecycle of a canary deployment.
type CanaryStatus string

const (
	CanaryPending  CanaryStatus = "pending"
	CanaryRunning  CanaryStatus = "running"
	CanarySuccess  CanaryStatus = "success"
	CanaryFailed   CanaryStatus = "failed"
	CanaryRolled   CanaryStatus = "rolled_back"
)

// Canary represents a canary deployment.
type Canary struct {
	ID            string       `db:"id" json:"id"`
	TenantID      string       `db:"tenant_id" json:"tenant_id"`
	DeploymentID  string       `db:"deployment_id" json:"deployment_id"`
	ServiceName   string       `db:"service_name" json:"service_name"`
	Version       string       `db:"version" json:"version"`
	Status        CanaryStatus `db:"status" json:"status"`
	Weight        int          `db:"weight" json:"weight"`
	TargetWeight  int          `db:"target_weight" json:"target_weight"`
	StartedAt     *time.Time   `db:"started_at" json:"started_at,omitempty"`
	CompletedAt   *time.Time   `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt     time.Time    `db:"created_at" json:"created_at"`
}

// CanaryMetric represents a metric collected during canary analysis.
type CanaryMetric struct {
	ID        string    `db:"id" json:"id"`
	CanaryID  string    `db:"canary_id" json:"canary_id"`
	MetricName string   `db:"metric_name" json:"metric_name"`
	Value     float64   `db:"value" json:"value"`
	Source    string    `db:"source" json:"source"`
	Timestamp time.Time `db:"timestamp" json:"timestamp"`
}

// CanaryAnalysis represents the analysis result of a canary deployment.
type CanaryAnalysis struct {
	ID        string    `db:"id" json:"id"`
	CanaryID  string    `db:"canary_id" json:"canary_id"`
	Score     float64   `db:"score" json:"score"`
	Verdict   string    `db:"verdict" json:"verdict"`
	Details   string    `db:"details" json:"details"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateCanaryRequest is the input for creating a canary deployment.
type CreateCanaryRequest struct {
	DeploymentID string `json:"deployment_id" binding:"required"`
	ServiceName  string `json:"service_name" binding:"required"`
	Version      string `json:"version" binding:"required"`
	Weight       int    `json:"weight"`
	TargetWeight int    `json:"target_weight"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
