package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}

type JSONArray []interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

func (a JSONArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

type FederatedCluster struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`

	CreatedAt time.Time    `db:"created_at" json:"created_at"`
	PeerURL  string     `db:"peer_url" json:"peer_url"`
	Protocol string     `db:"protocol" json:"protocol"`
	Status   string     `db:"status" json:"status"`
	Config   JSONB      `db:"config" json:"config,omitempty"`
	LastSync *time.Time `db:"last_sync" json:"last_sync,omitempty"`
}

type CreateFederatedClusterRequest struct {
	Name string `json:"name" binding:"required"`

	PeerURL  string `json:"peer_url" binding:"required"`
	Protocol string `json:"protocol" binding:"required"`
	Status   string `json:"status"`
	Config   JSONB  `json:"config,omitempty"`
}

type UpdateFederatedClusterRequest struct {
	Name     string `json:"name" binding:"required"`
	PeerURL  string `json:"peer_url" binding:"required"`
	Protocol string `json:"protocol" binding:"required"`
	Status   string `json:"status"`
	Config   JSONB  `json:"config,omitempty"`
}

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

// ---------------------------------------------------------------------------
// Federation Config (POST/GET/PUT/DELETE /federation)
// ---------------------------------------------------------------------------

type FederationConfig struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Clusters    JSONArray `db:"clusters" json:"clusters"`
	Strategy    string    `db:"strategy" json:"strategy"`
	Status      string    `db:"status" json:"status"`
	Metadata    JSONB     `db:"metadata" json:"metadata"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateFederationConfigRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Clusters    []string `json:"clusters"`
	Strategy    string `json:"strategy"`
	Metadata    JSONB `json:"metadata"`
}

type UpdateFederationConfigRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Clusters    []string `json:"clusters"`
	Strategy    string `json:"strategy"`
	Status      string `json:"status"`
}

// ---------------------------------------------------------------------------
// Executor (POST/GET /executors, health, heartbeat, dashboard, dispatch)
// ---------------------------------------------------------------------------

type Executor struct {
	ID                  string    `db:"id" json:"id"`
	TenantID            string    `db:"tenant_id" json:"tenant_id"`
	ClusterID           string    `db:"cluster_id" json:"cluster_id"`
	Name                string    `db:"name" json:"name"`
	Region              string    `db:"region" json:"region"`
	Status              string    `db:"status" json:"status"`
	CPUCapacity         float64   `db:"cpu_capacity" json:"cpu_capacity"`
	MemoryCapacityMB    float64   `db:"memory_capacity_mb" json:"memory_capacity_mb"`
	CPUUsed             float64   `db:"cpu_used" json:"cpu_used"`
	MemoryUsedMB        float64   `db:"memory_used_mb" json:"memory_used_mb"`
	RunningJobs         int       `db:"running_jobs" json:"running_jobs"`
	MaxConcurrentJobs   int       `db:"max_concurrent_jobs" json:"max_concurrent_jobs"`
	LastHeartbeat       *time.Time `db:"last_heartbeat" json:"last_heartbeat"`
	RegisteredAt        time.Time `db:"registered_at" json:"registered_at"`
	Labels              JSONB     `db:"labels" json:"labels"`
}

type CreateExecutorRequest struct {
	ClusterID         string  `json:"cluster_id" binding:"required"`
	Name              string  `json:"name" binding:"required"`
	Region            string  `json:"region" binding:"required"`
	CPUCapacity       float64 `json:"cpu_capacity"`
	MemoryCapacityMB  float64 `json:"memory_capacity_mb"`
	MaxConcurrentJobs int     `json:"max_concurrent_jobs"`
	Labels            JSONB   `json:"labels"`
}

type ExecutorHeartbeatRequest struct {
	CPUUsed        float64 `json:"cpu_used"`
	MemoryUsedMB   float64 `json:"memory_used_mb"`
	RunningJobs    int     `json:"running_jobs"`
	ResponseTimeMs int     `json:"response_time_ms"`
}

type ExecutorHealth struct {
	ExecutorID      string     `db:"executor_id" json:"executor_id"`
	Status          string     `db:"status" json:"status"`
	CPUUsagePct     float64    `db:"cpu_usage_pct" json:"cpu_usage_pct"`
	MemoryUsagePct  float64    `db:"memory_usage_pct" json:"memory_usage_pct"`
	RunningJobs     int        `db:"running_jobs" json:"running_jobs"`
	QueueDepth      int        `db:"queue_depth" json:"queue_depth"`
	LastHeartbeat   *time.Time `db:"last_heartbeat" json:"last_heartbeat"`
	ResponseTimeMs  int        `db:"response_time_ms" json:"response_time_ms"`
	ErrorsLastHour  int        `db:"errors_last_hour" json:"errors_last_hour"`
}

type ExecutorDashboard struct {
	TotalExecutors   int             `json:"total_executors"`
	OnlineExecutors  int             `json:"online_executors"`
	OfflineExecutors int             `json:"offline_executors"`
	AvgCPUUsage      float64         `json:"avg_cpu_usage"`
	AvgMemoryUsage   float64         `json:"avg_memory_usage"`
	TotalRunningJobs int             `json:"total_running_jobs"`
	Executors        []ExecutorHealth `json:"executors"`
}

type DispatchJobRequest struct {
	Name                  string             `json:"name" binding:"required"`
	Description           string             `json:"description"`
	JobType               string             `json:"job_type"`
	SourceClusterID       string             `json:"source_cluster_id" binding:"required"`
	TargetClusterIDs      []string           `json:"target_cluster_ids"`
	Priority              string             `json:"priority"`
	Spec                  JSONB              `json:"spec"`
	ExecutorID            string             `json:"executor_id"`
	ResourceRequirements  *ResourceReqs      `json:"resource_requirements"`
}

type ResourceReqs struct {
	CPU     float64 `json:"cpu"`
	MemoryMB float64 `json:"memory_mb"`
}

type DispatchJobResult struct {
	JobID        string    `json:"job_id"`
	ExecutorID   string    `json:"executor_id"`
	ExecutorName string    `json:"executor_name"`
	Status       string    `json:"status"`
	DispatchedAt time.Time `json:"dispatched_at"`
}

// ---------------------------------------------------------------------------
// Scheduling Policy (POST/GET /scheduling-policies)
// ---------------------------------------------------------------------------

type SchedulingPolicy struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Strategy    string    `db:"strategy" json:"strategy"`
	Rules       JSONB     `db:"rules" json:"rules"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateSchedulingPolicyRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Strategy    string `json:"strategy"`
	Rules       JSONB  `json:"rules"`
}

// ---------------------------------------------------------------------------
// Cross-Cluster Job (POST /cross-cluster-jobs)
// ---------------------------------------------------------------------------

type CrossClusterJob struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	Spec           JSONB     `db:"spec" json:"spec"`
	TargetClusters JSONArray `db:"target_clusters" json:"target_clusters"`
	Status         string    `db:"status" json:"status"`
	ScheduledAt    time.Time `db:"scheduled_at" json:"scheduled_at"`
	CompletedAt    *time.Time `db:"completed_at" json:"completed_at"`
}

type ScheduleCrossClusterJobRequest struct {
	Name                 string          `json:"name" binding:"required"`
	TargetClusters       []string        `json:"target_clusters" binding:"required"`
	ResourceRequirements *ResourceReqs   `json:"resource_requirements"`
}

// ---------------------------------------------------------------------------
// Resource Pool (POST/GET /resource-pools/:poolId)
// ---------------------------------------------------------------------------

type ResourcePool struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	ClusterID   string    `db:"cluster_id" json:"cluster_id"`
	CPU         float64   `db:"cpu" json:"cpu"`
	Memory      float64   `db:"memory" json:"memory"`
	UsedCPU     float64   `db:"used_cpu" json:"used_cpu"`
	UsedMemory  float64   `db:"used_memory" json:"used_memory"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type CreateResourcePoolRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	ClusterID   string  `json:"cluster_id" binding:"required"`
	CPU         float64 `json:"cpu"`
	Memory      float64 `json:"memory"`
}
