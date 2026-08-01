package models

import "encoding/json"

// DegradationStrategy represents the degradation strategy type.
type DegradationStrategy string

const (
	StrategyFallback       DegradationStrategy = "fallback"
	StrategyCircuitBreaker DegradationStrategy = "circuit_breaker"
	StrategyTimeout        DegradationStrategy = "timeout"
	StrategyRateLimit      DegradationStrategy = "rate_limit"
	StrategyQueue          DegradationStrategy = "queue"
	StrategyCache          DegradationStrategy = "cache"
	StrategyGraceful       DegradationStrategy = "graceful"
	StrategyCustom         DegradationStrategy = "custom"
)

// TriggerCondition represents the condition that triggers degradation.
type TriggerCondition string

const (
	ConditionErrorRate     TriggerCondition = "error_rate"
	ConditionLatency       TriggerCondition = "latency"
	ConditionThroughput    TriggerCondition = "throughput"
	ConditionResourceUsage TriggerCondition = "resource_usage"
	ConditionManual        TriggerCondition = "manual"
	ConditionScheduled     TriggerCondition = "scheduled"
)

// DegradationStatus represents the status of a degradation config.
type DegradationStatus string

const (
	StatusActive     DegradationStatus = "active"
	StatusInactive   DegradationStatus = "inactive"
	StatusTriggered  DegradationStatus = "triggered"
	StatusRecovering DegradationStatus = "recovering"
)

// ServiceStatus represents the operational status of a service.
type ServiceStatus string

const (
	ServiceHealthy  ServiceStatus = "healthy"
	ServiceDegraded ServiceStatus = "degraded"
	ServiceCritical ServiceStatus = "critical"
	ServiceUnknown  ServiceStatus = "unknown"
)

// HistoryStatus represents the status of a degradation history record.
type HistoryStatus string

const (
	HistoryStatusTriggered HistoryStatus = "triggered"
	HistoryStatusRecovered HistoryStatus = "recovered"
	HistoryStatusFailed    HistoryStatus = "failed"
)

// --- Core entities ---

// DegradationConfig is the primary degradation configuration entity.
type DegradationConfig struct {
	ID              string              `json:"id" db:"id"`
	Name            string              `json:"name" db:"name"`
	Description     string              `json:"description" db:"description"`
	ServiceName     string              `json:"service_name" db:"service_name"`
	Strategy        DegradationStrategy `json:"strategy" db:"strategy"`
	Status          DegradationStatus   `json:"status" db:"status"`
	Triggers        string              `json:"triggers" db:"triggers"` // JSONB array
	Actions         string              `json:"actions" db:"actions"`   // JSONB array
	Recovery        string              `json:"recovery" db:"recovery"` // JSONB
	Metadata        string              `json:"metadata" db:"metadata"` // JSONB
	Enabled         bool                `json:"enabled" db:"enabled"`
	CreatedAt       int64               `json:"created_at" db:"created_at"`
	UpdatedAt       int64               `json:"updated_at" db:"updated_at"`
	LastTriggeredAt *int64              `json:"last_triggered_at,omitempty" db:"last_triggered_at"`
	TriggerCount    int                 `json:"trigger_count" db:"trigger_count"`
	TenantID        string              `json:"tenant_id" db:"tenant_id"`
}

// DegradationHistory records a single degradation event.
type DegradationHistory struct {
	ID               string           `json:"id" db:"id"`
	ConfigID         string           `json:"config_id" db:"config_id"`
	TriggeredAt      int64            `json:"triggered_at" db:"triggered_at"`
	RecoveredAt      *int64           `json:"recovered_at,omitempty" db:"recovered_at"`
	TriggerType      TriggerCondition `json:"trigger_type" db:"trigger_type"`
	TriggerValue     float64          `json:"trigger_value" db:"trigger_value"`
	TriggerThreshold float64          `json:"trigger_threshold" db:"trigger_threshold"`
	Duration         int64            `json:"duration" db:"duration"`
	Status           HistoryStatus    `json:"status" db:"status"`
	Actions          string           `json:"actions" db:"actions"` // JSONB array
	TenantID         string           `json:"tenant_id" db:"tenant_id"`
	CreatedAt        int64            `json:"created_at" db:"created_at"`
}

// TriggerConfig represents a degradation trigger.
type TriggerConfig struct {
	Type      string  `json:"type"`
	Threshold float64 `json:"threshold"`
	Duration  int64   `json:"duration"`
	Operator  string  `json:"operator"` // gt, lt, eq, gte, lte
}

// ActionConfig represents a degradation action.
type ActionConfig struct {
	Type     string                 `json:"type"` // response, redirect, queue, cache, custom
	Config   map[string]interface{} `json:"config"`
	Priority int                    `json:"priority"`
}

// RecoveryConfig represents the recovery settings.
type RecoveryConfig struct {
	AutoRecover         bool    `json:"auto_recover"`
	RecoveryTimeout     int64   `json:"recovery_timeout"`
	HealthCheckInterval int64   `json:"health_check_interval"`
	HealthCheckEndpoint *string `json:"health_check_endpoint,omitempty"`
	MinHealthyDuration  int64   `json:"min_healthy_duration"`
}

// --- Request / Response models ---

// CreateDegradationConfigRequest is the request body for creating a degradation config.
type CreateDegradationConfigRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	ServiceName string                 `json:"service_name" binding:"required"`
	Strategy    DegradationStrategy    `json:"strategy" binding:"required"`
	Triggers    []TriggerConfig        `json:"triggers"`
	Actions     []ActionConfig         `json:"actions"`
	Recovery    *RecoveryConfig        `json:"recovery,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Enabled     *bool                  `json:"enabled"`
}

// UpdateDegradationConfigRequest is the request body for updating a degradation config.
type UpdateDegradationConfigRequest struct {
	Name        *string                 `json:"name"`
	Description *string                 `json:"description"`
	Triggers    *[]TriggerConfig        `json:"triggers"`
	Actions     *[]ActionConfig         `json:"actions"`
	Recovery    *RecoveryConfig         `json:"recovery"`
	Metadata    *map[string]interface{} `json:"metadata"`
}

// TriggerDegradationRequest is the request body for manually triggering degradation.
type TriggerDegradationRequest struct {
	Reason   string `json:"reason"`
	Duration *int64 `json:"duration"`
}

// ListConfigsQuery is the query params for listing degradation configs.
type ListConfigsQuery struct {
	ServiceName string `json:"service_name" form:"service_name"`
	Strategy    string `json:"strategy" form:"strategy"`
	Status      string `json:"status" form:"status"`
	Enabled     string `json:"enabled" form:"enabled"` // "true" or "false"
	Sort        string `json:"sort" form:"sort"`
	Order       string `json:"order" form:"order"`
	Limit       int    `json:"limit" form:"limit"`
	Offset      int    `json:"offset" form:"offset"`
}

// ListHistoryQuery is the query params for listing degradation history.
type ListHistoryQuery struct {
	Limit  int `json:"limit" form:"limit"`
	Offset int `json:"offset" form:"offset"`
}

// ConfigListResponse wraps a paginated config list.
type ConfigListResponse struct {
	Data   []DegradationConfig `json:"data"`
	Total  int                 `json:"total"`
	Offset int                 `json:"offset"`
	Limit  int                 `json:"limit"`
}

// HistoryListResponse wraps a paginated history list.
type HistoryListResponse struct {
	Data   []DegradationHistory `json:"data"`
	Total  int                  `json:"total"`
	Offset int                  `json:"offset"`
	Limit  int                  `json:"limit"`
}

// GlobalDegradationStatus represents the global degradation status.
type GlobalDegradationStatus struct {
	Services       []ServiceStatusEntry `json:"services"`
	ActiveConfigs  int                  `json:"active_configs"`
	TotalConfigs   int                  `json:"total_configs"`
	RecentTriggers int                  `json:"recent_triggers"`
	SystemHealth   string               `json:"system_health"` // healthy, warning, critical
}

// ServiceStatusEntry represents the status of a single service.
type ServiceStatusEntry struct {
	Name               string        `json:"name"`
	Status             ServiceStatus `json:"status"`
	ActiveDegradations int           `json:"active_degradations"`
	LastIncident       *int64        `json:"last_incident"`
}

// --- Helper methods ---

// TriggerConfigArray deserializes the triggers JSONB field.
func (c *DegradationConfig) TriggerConfigArray() []TriggerConfig {
	if c.Triggers == "" || c.Triggers == "[]" {
		return []TriggerConfig{}
	}
	var arr []TriggerConfig
	_ = json.Unmarshal([]byte(c.Triggers), &arr)
	return arr
}

// ActionConfigArray deserializes the actions JSONB field.
func (c *DegradationConfig) ActionConfigArray() []ActionConfig {
	if c.Actions == "" || c.Actions == "[]" {
		return []ActionConfig{}
	}
	var arr []ActionConfig
	_ = json.Unmarshal([]byte(c.Actions), &arr)
	return arr
}

// RecoveryConfigStruct deserializes the recovery JSONB field.
func (c *DegradationConfig) RecoveryConfigStruct() RecoveryConfig {
	if c.Recovery == "" {
		return RecoveryConfig{
			AutoRecover:         true,
			RecoveryTimeout:     60000,
			HealthCheckInterval: 10000,
			MinHealthyDuration:  30000,
		}
	}
	var rc RecoveryConfig
	_ = json.Unmarshal([]byte(c.Recovery), &rc)
	return rc
}

// ActionNames returns action type names for history records.
func (c *DegradationConfig) ActionNames() []string {
	actions := c.ActionConfigArray()
	names := make([]string, len(actions))
	for i, a := range actions {
		names[i] = a.Type
	}
	return names
}
