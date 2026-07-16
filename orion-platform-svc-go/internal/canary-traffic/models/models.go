package models

import "time"

// CanaryStatus represents the state of a canary deployment.
type CanaryStatus string

const (
	StatusActive   CanaryStatus = "ACTIVE"
	StatusDraining CanaryStatus = "DRAINING"
	StatusStopped  CanaryStatus = "STOPPED"
)

// CanaryTraffic manages traffic splitting for canary deployments.
type CanaryTraffic struct {
	ID                string       `db:"id" json:"id"`
	TenantID          string       `db:"tenant_id" json:"tenantId"`
	Name              string       `db:"name" json:"name"`
	ServiceName       string       `db:"service_name" json:"serviceName"`
	Strategy          string       `db:"strategy" json:"strategy"`
	ControlPlaneURL   string       `db:"control_plane_url" json:"controlPlaneUrl"`
	CanaryURL         string       `db:"canary_url" json:"canaryUrl"`
	ControlWeight     int          `db:"control_weight" json:"controlWeight"`
	CanaryWeight      int          `db:"canary_weight" json:"canaryWeight"`
	TargetWeight      int          `db:"target_weight" json:"targetWeight"`
	Status            CanaryStatus `db:"status" json:"status"`
	HealthEndpoint    string       `db:"health_endpoint" json:"healthEndpoint"`
	MetricsEndpoint   string       `db:"metrics_endpoint" json:"metricsEndpoint"`
	LastUpdated       time.Time    `db:"last_updated" json:"lastUpdated"`
	Enabled           bool         `db:"enabled" json:"enabled"`
	CreatedAt         time.Time    `db:"created_at" json:"createdAt"`
	UpdatedAt         time.Time    `db:"updated_at" json:"updatedAt"`
}

// TrafficSplit describes the current traffic distribution.
type TrafficSplit struct {
	ControlWeight int `json:"controlWeight"`
	CanaryWeight  int `json:"canaryWeight"`
}

// CanaryMetrics holds health metrics for the canary.
type CanaryMetrics struct {
	ErrorRate     float64 `json:"errorRate"`
	LatencyP99    int64   `json:"latencyP99"`
	Throughput    int64   `json:"throughput"`
	Samples       int     `json:"samples"`
}

// CreateRequest creates a canary traffic config.
type CreateRequest struct {
	Name              string       `json:"name" binding:"required"`
	ServiceName       string       `json:"serviceName"`
	Strategy          string       `json:"strategy"`
	ControlPlaneURL   string       `json:"controlPlaneUrl"`
	CanaryURL         string       `json:"canaryUrl"`
	ControlWeight     int          `json:"controlWeight"`
	CanaryWeight      int          `json:"canaryWeight"`
	TargetWeight      int          `json:"targetWeight"`
	HealthEndpoint    string       `json:"healthEndpoint"`
	MetricsEndpoint   string       `json:"metricsEndpoint"`
}

// UpdateRequest updates a canary traffic config.
type UpdateRequest struct {
	Name              *string       `json:"name"`
	ServiceName       *string       `json:"serviceName"`
	Strategy          *string       `json:"strategy"`
	ControlWeight     *int          `json:"controlWeight"`
	CanaryWeight      *int          `json:"canaryWeight"`
	TargetWeight      *int          `json:"targetWeight"`
	Status            *CanaryStatus `json:"status"`
	Enabled           *bool         `json:"enabled"`
}

// AdjustWeightRequest adjusts traffic weights.
type AdjustWeightRequest struct {
	CanaryWeight int `json:"canaryWeight"`
}

// PaginatedResponse wraps paginated results.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
