package models

import "encoding/json"

// ModelType represents the type of an AI model.
type ModelType string

const (
	ModelTypeLLM        ModelType = "llm"
	ModelTypeEmbedding  ModelType = "embedding"
	ModelTypeClassifier ModelType = "classifier"
	ModelTypeRegressor  ModelType = "regressor"
	ModelTypeDetector   ModelType = "detector"
	ModelTypeGenerator  ModelType = "generator"
	ModelTypeCustom     ModelType = "custom"
)

// ModelStatus represents the lifecycle status of a model.
type ModelStatus string

const (
	ModelStatusDraft      ModelStatus = "draft"
	ModelStatusTraining   ModelStatus = "training"
	ModelStatusStaging    ModelStatus = "staging"
	ModelStatusProduction ModelStatus = "production"
	ModelStatusDeprecated ModelStatus = "deprecated"
	ModelStatusArchived   ModelStatus = "archived"
)

// Environment represents the deployment environment.
type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvStaging     Environment = "staging"
	EnvCanary      Environment = "canary"
	EnvProduction  Environment = "production"
)

// CanaryStatus represents the status of a canary release.
type CanaryStatus string

const (
	CanaryStatusPending CanaryStatus = "pending"
	CanaryStatusRunning CanaryStatus = "running"
	CanaryStatusSuccess CanaryStatus = "success"
	CanaryStatusFailed  CanaryStatus = "failed"
	CanaryStatusAborted CanaryStatus = "aborted"
)

// --- Core entities ---

// AIModel represents an AI model definition.
type AIModel struct {
	ID             string      `json:"id" db:"id"`
	Name           string      `json:"name" db:"name"`
	DisplayName    string      `json:"display_name" db:"display_name"`
	Description    string      `json:"description" db:"description"`
	Type           ModelType   `json:"type" db:"type"`
	Status         ModelStatus `json:"status" db:"status"`
	Framework      string      `json:"framework" db:"framework"`
	CurrentVersion *string     `json:"current_version,omitempty" db:"current_version"`
	Tags           string      `json:"tags" db:"tags"`         // JSON array
	Metadata       string      `json:"metadata" db:"metadata"` // JSON
	CreatedBy      string      `json:"created_by" db:"created_by"`
	TenantID       string      `json:"tenant_id" db:"tenant_id"`
	CreatedAt      int64       `json:"created_at" db:"created_at"`
	UpdatedAt      int64       `json:"updated_at" db:"updated_at"`
}

// TagsList returns the model tags as a slice.
func (m *AIModel) TagsList() []string {
	if m.Tags == "" {
		return make([]string, 0)
	}
	var t []string
	_ = json.Unmarshal([]byte(m.Tags), &t)
	return t
}

// MetadataMap returns the model metadata as a map.
func (m *AIModel) MetadataMap() map[string]interface{} {
	if m.Metadata == "" {
		return make(map[string]interface{})
	}
	var v map[string]interface{}
	_ = json.Unmarshal([]byte(m.Metadata), &v)
	return v
}

// ModelVersion represents a released version of a model.
type ModelVersion struct {
	ID           string      `json:"id" db:"id"`
	ModelID      string      `json:"model_id" db:"model_id"`
	Version      string      `json:"version" db:"version"`
	ArtifactUri  string      `json:"artifact_uri" db:"artifact_uri"`
	Environment  Environment `json:"environment" db:"environment"`
	Status       ModelStatus `json:"status" db:"status"`
	Metrics      string      `json:"metrics" db:"metrics"` // JSON
	Config       string      `json:"config" db:"config"`   // JSON
	CreatedBy    string      `json:"created_by" db:"created_by"`
	TenantID     string      `json:"tenant_id" db:"tenant_id"`
	CreatedAt    int64       `json:"created_at" db:"created_at"`
	PromotedAt   *int64      `json:"promoted_at,omitempty" db:"promoted_at"`
	PromotedBy   *string     `json:"promoted_by,omitempty" db:"promoted_by"`
	DeprecatedAt *int64      `json:"deprecated_at,omitempty" db:"deprecated_at"`
}

// MetricsMap returns the version metrics as a ModelMetrics struct.
func (v *ModelVersion) MetricsMap() *ModelMetrics {
	if v.Metrics == "" {
		return &ModelMetrics{}
	}
	var m ModelMetrics
	_ = json.Unmarshal([]byte(v.Metrics), &m)
	return &m
}

// ConfigMap returns the version config as a map.
func (v *ModelVersion) ConfigMap() map[string]interface{} {
	if v.Config == "" {
		return make(map[string]interface{})
	}
	var m map[string]interface{}
	_ = json.Unmarshal([]byte(v.Config), &m)
	return m
}

// CanaryConfig represents canary release configuration for a model.
type CanaryConfig struct {
	ID                 string       `json:"id" db:"id"`
	ModelID            string       `json:"model_id" db:"model_id"`
	Enabled            bool         `json:"enabled" db:"enabled"`
	TargetVersion      string       `json:"target_version" db:"target_version"`
	TrafficPercent     float64      `json:"traffic_percent" db:"traffic_percent"`
	SuccessThreshold   float64      `json:"success_threshold" db:"success_threshold"`
	LatencyThreshold   float64      `json:"latency_threshold" db:"latency_threshold"`
	ErrorRateThreshold float64      `json:"error_rate_threshold" db:"error_rate_threshold"`
	StartTime          int64        `json:"start_time" db:"start_time"`
	Duration           int64        `json:"duration" db:"duration"`
	Status             CanaryStatus `json:"status" db:"status"`
	CurrentMetrics     *string      `json:"current_metrics,omitempty" db:"current_metrics"` // JSON
	TenantID           string       `json:"tenant_id" db:"tenant_id"`
	CreatedAt          int64        `json:"created_at" db:"created_at"`
	UpdatedAt          int64        `json:"updated_at" db:"updated_at"`
}

// CurrentMetricsMap returns current metrics as a ModelMetrics struct.
func (c *CanaryConfig) CurrentMetricsMap() *ModelMetrics {
	if c.CurrentMetrics == nil {
		return &ModelMetrics{}
	}
	var m ModelMetrics
	_ = json.Unmarshal([]byte(*c.CurrentMetrics), &m)
	return &m
}

// ModelMetrics represents model performance metrics.
type ModelMetrics struct {
	Accuracy   *float64           `json:"accuracy,omitempty"`
	Precision  *float64           `json:"precision,omitempty"`
	Recall     *float64           `json:"recall,omitempty"`
	F1Score    *float64           `json:"f1_score,omitempty"`
	Latency    *float64           `json:"latency,omitempty"`
	Throughput *float64           `json:"throughput,omitempty"`
	ErrorRate  *float64           `json:"error_rate,omitempty"`
	Custom     map[string]float64 `json:"custom,omitempty"`
}

// --- Request / Response models ---

// RegisterModelRequest is the request body for registering a new model.
type RegisterModelRequest struct {
	Name        string                 `json:"name" binding:"required"`
	DisplayName string                 `json:"display_name" binding:"required"`
	Description string                 `json:"description"`
	Type        ModelType              `json:"type" binding:"required"`
	Framework   string                 `json:"framework" binding:"required"`
	Tags        []string               `json:"tags,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateModelRequest is the request body for updating a model.
type UpdateModelRequest struct {
	DisplayName *string                `json:"display_name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PublishVersionRequest is the request body for publishing a new version.
type PublishVersionRequest struct {
	ArtifactUri string                 `json:"artifact_uri" binding:"required"`
	Environment *Environment           `json:"environment,omitempty"`
	Metrics     *ModelMetrics          `json:"metrics,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
	Description *string                `json:"description,omitempty"`
}

// PromoteVersionRequest is the request body for promoting a version.
type PromoteVersionRequest struct {
	TargetEnvironment Environment `json:"target_environment" binding:"required"`
	TrafficPercent    *float64    `json:"traffic_percent,omitempty"`
}

// CanaryConfigRequest is the request body for configuring a canary.
type CanaryConfigRequest struct {
	TargetVersion      string   `json:"target_version" binding:"required"`
	TrafficPercent     float64  `json:"traffic_percent" binding:"required"`
	Duration           int64    `json:"duration" binding:"required"`
	SuccessThreshold   *float64 `json:"success_threshold,omitempty"`
	LatencyThreshold   *float64 `json:"latency_threshold,omitempty"`
	ErrorRateThreshold *float64 `json:"error_rate_threshold,omitempty"`
}

// ListModelsQuery is the query params for listing models.
type ListModelsQuery struct {
	Type   string `json:"type" form:"type"`
	Status string `json:"status" form:"status"`
	Tags   string `json:"tags" form:"tags"`
	Search string `json:"q" form:"q"`
	Limit  int    `json:"limit" form:"limit"`
	Offset int    `json:"offset" form:"offset"`
	Sort   string `json:"sort" form:"sort"`
	Order  string `json:"order" form:"order"`
}

// ListVersionsQuery is the query params for listing versions.
type ListVersionsQuery struct {
	Environment string `json:"environment" form:"environment"`
	Limit       int    `json:"limit" form:"limit"`
	Offset      int    `json:"offset" form:"offset"`
}

// ModelListResponse wraps a paginated model list.
type ModelListResponse struct {
	Data  []AIModel `json:"data"`
	Total int       `json:"total"`
}

// VersionListResponse wraps a paginated version list.
type VersionListResponse struct {
	Data  []ModelVersion `json:"data"`
	Total int            `json:"total"`
}

// ModelMetricsResponse wraps current metrics and history.
type ModelMetricsResponse struct {
	Current ModelMetrics   `json:"current"`
	History []ModelMetrics `json:"history"`
}
