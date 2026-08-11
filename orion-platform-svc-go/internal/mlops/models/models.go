package models

import (
	"time"

	"orion/platform-svc-go/internal/shared/crud"
)

// Record, CreateRequest, ListQuery are type aliases to the shared CRUD types.
type (
	Record      = crud.Record
	CreateRequest = crud.CreateRequest
	ListQuery   = crud.ListQuery
)

// ==================== Model Registry ====================

type Model struct {
	ID           string                 `json:"id" db:"id"`
	TenantID     string                 `json:"tenantId" db:"tenant_id"`
	Name         string                 `json:"name" db:"name"`
	Framework    string                 `json:"framework" db:"framework"`
	Version      string                 `json:"version" db:"version"`
	Description  string                 `json:"description" db:"description"`
	Status       string                 `json:"status" db:"status"`
	ArtifactPath string                 `json:"artifactPath" db:"artifact_path"`
	Metrics      map[string]interface{} `json:"metrics" db:"metrics"`
	Metadata     map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt    time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time              `json:"updatedAt" db:"updated_at"`
}

type CreateModelRequest struct {
	Name         string                 `json:"name" binding:"required"`
	Framework    string                 `json:"framework"`
	Version      string                 `json:"version"`
	Description  string                 `json:"description"`
	ArtifactPath string                 `json:"artifactPath"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// ==================== Training Jobs ====================

type TrainingJob struct {
	ID          string                 `json:"id" db:"id"`
	ModelID     string                 `json:"modelId" db:"model_id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Status      string                 `json:"status" db:"status"`
	Config      map[string]interface{} `json:"config" db:"config"`
	Metrics     map[string]interface{} `json:"metrics" db:"metrics"`
	StartedAt   *time.Time             `json:"startedAt" db:"started_at"`
	CompletedAt *time.Time             `json:"completedAt" db:"completed_at"`
	Error       string                 `json:"error" db:"error"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
}

type TrainingJobRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Config map[string]interface{} `json:"config"`
}

// ==================== Experiments ====================

type Experiment struct {
	ID          string                 `json:"id" db:"id"`
	ModelID     string                 `json:"modelId" db:"model_id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	Status      string                 `json:"status" db:"status"`
	Config      map[string]interface{} `json:"config" db:"config"`
	Results     map[string]interface{} `json:"results" db:"results"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
}

type CreateExperimentRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
}

// ==================== Artifacts ====================

type Artifact struct {
	ID          string                 `json:"id" db:"id"`
	ModelID     string                 `json:"modelId" db:"model_id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Type        string                 `json:"type" db:"type"`
	StoragePath string                 `json:"storagePath" db:"storage_path"`
	SizeBytes   int64                  `json:"sizeBytes" db:"size_bytes"`
	Checksum    string                 `json:"checksum" db:"checksum"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
}

type CreateArtifactRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Type        string                 `json:"type"`
	StoragePath string                 `json:"storagePath" binding:"required"`
	SizeBytes   int64                  `json:"sizeBytes"`
	Checksum    string                 `json:"checksum"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ==================== Deployments ====================

type Deployment struct {
	ID          string                 `json:"id" db:"id"`
	ModelID     string                 `json:"modelId" db:"model_id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	Environment string                 `json:"environment" db:"environment"`
	Status      string                 `json:"status" db:"status"`
	EndpointURL string                 `json:"endpointUrl" db:"endpoint_url"`
	Config      map[string]interface{} `json:"config" db:"config"`
	DeployedAt  *time.Time             `json:"deployedAt" db:"deployed_at"`
	RollbackOf  string                 `json:"rollbackOf" db:"rollback_of"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
}

type CreateDeploymentRequest struct {
	Environment string                 `json:"environment"`
	EndpointURL string                 `json:"endpointUrl"`
	Config      map[string]interface{} `json:"config"`
}

type RollbackRequest struct {
	Environment string                 `json:"environment"`
	RollbackOf  string                 `json:"rollbackOf"`
	Config      map[string]interface{} `json:"config"`
}

// ==================== Pipelines ====================

type Pipeline struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	Status      string                 `json:"status" db:"status"`
	Config      map[string]interface{} `json:"config" db:"config"`
	LastRunAt   *time.Time             `json:"lastRunAt" db:"last_run_at"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
}

// ==================== Metrics ====================

type Metric struct {
	ID          string                 `json:"id" db:"id"`
	ModelID     string                 `json:"modelId" db:"model_id"`
	TenantID    string                 `json:"tenantId" db:"tenant_id"`
	MetricName  string                 `json:"metricName" db:"metric_name"`
	MetricValue float64                `json:"metricValue" db:"metric_value"`
	Unit        string                 `json:"unit" db:"unit"`
	Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
	Tags        map[string]interface{} `json:"tags" db:"tags"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
}

type RecordMetricRequest struct {
	MetricName  string  `json:"metricName" binding:"required"`
	MetricValue float64 `json:"metricValue" binding:"required"`
	Unit        string  `json:"unit"`
}

// ==================== Stats ====================

type MLOpsStats struct {
	TotalModels          int `json:"totalModels"`
	ActiveDeployments    int `json:"activeDeployments"`
	RunningJobs          int `json:"runningJobs"`
	CompletedExperiments int `json:"completedExperiments"`
}