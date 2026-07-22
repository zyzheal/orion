package models

import (
	"database/sql/driver"
	"encoding/json"
)

// JSON is a wrapper for json.RawMessage that works with sqlx JSONB columns.
type JSON json.RawMessage

// Value implements the driver.Valuer interface for DB writes.
func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

// Scan implements the sql.Scanner interface for DB reads.
func (j *JSON) Scan(v interface{}) error {
	if v == nil {
		*j = nil
		return nil
	}
	switch t := v.(type) {
	case []byte:
		*j = JSON(t)
	case string:
		*j = JSON(t)
	default:
		return nil
	}
	return nil
}

// --- Enums ---

const (
	TwinStatusInitializing = "initializing"
	TwinStatusActive       = "active"
	TwinStatusSyncing      = "syncing"
	TwinStatusSimulating   = "simulating"
	TwinStatusPaused       = "paused"
	TwinStatusError        = "error"
	TwinStatusArchived     = "archived"
)

const (
	SimulationTypePerformance = "performance"
	SimulationTypeCapacity    = "capacity"
	SimulationTypeFailure     = "failure"
	SimulationTypeMigration   = "migration"
	SimulationTypeUpdate      = "update"
	SimulationTypeScaling     = "scaling"
	SimulationTypeSecurity    = "security"
	SimulationTypeCost        = "cost"
	SimulationTypeCustom      = "custom"
)

const (
	EntityTypePipeline      = "pipeline"
	EntityTypeService       = "service"
	EntityTypeInfrastructure = "infrastructure"
	EntityTypeEnvironment   = "environment"
	EntityTypeCluster       = "cluster"
	EntityTypeNetwork       = "network"
	EntityTypeApplication   = "application"
)

const (
	ModelTypeStatic    = "static"
	ModelTypeDynamic   = "dynamic"
	ModelTypePredictive = "predictive"
)

const (
	PrecisionHigh   = "high"
	PrecisionMedium = "medium"
	PrecisionLow    = "low"
)

const (
	DataSourceTypeRealTime = "real-time"
	DataSourceTypeBatch    = "batch"
	DataSourceTypeHybrid   = "hybrid"
)

const (
	SyncHealthHealthy  = "healthy"
	SyncHealthWarning  = "warning"
	SyncHealthCritical = "critical"
)

const (
	SimulationStatusPending   = "pending"
	SimulationStatusRunning   = "running"
	SimulationStatusCompleted = "completed"
	SimulationStatusFailed    = "failed"
)

const (
	DependencyHealthHealthy   = "healthy"
	DependencyHealthDegraded  = "degraded"
	DependencyHealthUnhealthy = "unhealthy"
)

const (
	EventSeverityInfo    = "info"
	EventSeverityWarning = "warning"
	EventSeverityError   = "error"
)

const (
	RiskImpactLow    = "low"
	RiskImpactMedium = "medium"
	RiskImpactHigh   = "high"
)

const (
	TrendIncreasing = "increasing"
	TrendDecreasing = "decreasing"
	TrendStable     = "stable"
)

// --- ListQuery ---

type ListQuery struct {
	EntityType string `form:"entityType"`
	Status     string `form:"status"`
	SourceId   string `form:"sourceId"`
	Offset     int    `form:"offset"`
	Limit      int    `form:"limit"`
	Sort       string `form:"sort"`
	Order      string `form:"order"`
}

// --- DigitalTwin ---

type DigitalTwin struct {
	ID           string `json:"id" db:"id"`
	TenantID     string `json:"tenant_id" db:"tenant_id"`
	Name         string `json:"name" db:"name"`
	Description  string `json:"description" db:"description"`
	EntityType   string `json:"entityType" db:"entity_type"`
	SourceID     string `json:"sourceId" db:"source_id"`
	Status       string `json:"status" db:"status"`
	Config       JSON   `json:"config" db:"config"`
	Metadata     JSON   `json:"metadata" db:"metadata"`
	SyncPolicy   JSON   `json:"syncPolicy" db:"sync_policy"`
	LastSyncTime *int64 `json:"lastSyncTime,omitempty" db:"last_sync_time"`
	SyncHealth   string `json:"syncHealth" db:"sync_health"`
	CreatedAt    int64  `json:"createdAt" db:"created_at"`
	UpdatedAt    int64  `json:"updatedAt" db:"updated_at"`
}

type CreateTwinRequest struct {
	Name         string          `json:"name" binding:"required"`
	Description  string          `json:"description"`
	EntityType   string          `json:"entityType" binding:"required"`
	SourceID     string          `json:"sourceId" binding:"required"`
	Config       *JSON           `json:"config"`
	SyncPolicy   *JSON           `json:"syncPolicy"`
	Metadata     *JSON           `json:"metadata"`
}

type UpdateTwinRequest struct {
	Name       string `json:"name"`
	Description string `json:"description"`
	Config     *JSON  `json:"config"`
	SyncPolicy *JSON  `json:"syncPolicy"`
	Metadata   *JSON  `json:"metadata"`
}

// --- TwinState ---

type TwinState struct {
	TwinID      string           `json:"twinId" db:"twin_id"`
	Timestamp   int64            `json:"timestamp" db:"timestamp"`
	Status      string           `json:"status" db:"status"`
	Resources   JSON             `json:"resources" db:"resources"`
	Performance JSON             `json:"performance" db:"performance"`
	Dependencies JSON            `json:"dependencies" db:"dependencies"`
	Events      JSON             `json:"events" db:"events"`
	CreatedAt   int64            `json:"createdAt" db:"created_at"`
}

// --- Simulation ---

type Simulation struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenant_id" db:"tenant_id"`
	TwinID      string `json:"twinId" db:"twin_id"`
	Type        string `json:"type" db:"type"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	Parameters  JSON   `json:"parameters" db:"parameters"`
	Status      string `json:"status" db:"status"`
	StartTime   int64  `json:"startTime" db:"start_time"`
	EndTime     *int64 `json:"endTime,omitempty" db:"end_time"`
	Duration    *int64 `json:"duration,omitempty" db:"duration"`
	Results     JSON   `json:"results,omitempty" db:"results"`
	CreatedAt   int64  `json:"createdAt" db:"created_at"`
}

type SimulateRequest struct {
	Type        string            `json:"type" binding:"required"`
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	Parameters  map[string]any    `json:"parameters" binding:"required"`
	Duration    *int64            `json:"duration"`
}

type PredictRequest struct {
	PredictionType string `json:"predictionType" binding:"required"`
	ForecastPeriod string `json:"forecastPeriod" binding:"required"`
	Metrics        *[]string `json:"metrics"`
}
