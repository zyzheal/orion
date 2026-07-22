package models

import (
	"encoding/json"
	"time"
)

// UnixNow returns current unix seconds (UTC).
func UnixNow() int64 {
	return time.Now().UTC().Unix()
}

// TS returns unix timestamp as *int64.
func TS(t time.Time) *int64 {
	v := t.Unix()
	return &v
}

// --- Enums ---

// ExperimentStatus is the status of a chaos experiment.
type ExperimentStatus string

const (
	StatusDraft     ExperimentStatus = "draft"
	StatusPending   ExperimentStatus = "pending"
	StatusRunning   ExperimentStatus = "running"
	StatusPaused    ExperimentStatus = "paused"
	StatusCompleted ExperimentStatus = "completed"
	StatusFailed    ExperimentStatus = "failed"
	StatusStopped   ExperimentStatus = "stopped"
)

// IsTerminal returns true if the status is a terminal one.
func (s ExperimentStatus) IsTerminal() bool {
	return s == StatusCompleted || s == StatusFailed || s == StatusStopped
}

// ChaosScenarioType is the type of chaos scenario.
type ChaosScenarioType string

const (
	ScenarioPodKill          ChaosScenarioType = "pod_kill"
	ScenarioPodFailure       ChaosScenarioType = "pod_failure"
	ScenarioNetworkDelay     ChaosScenarioType = "network_delay"
	ScenarioNetworkPartition ChaosScenarioType = "network_partition"
	ScenarioNetworkCorrupt   ChaosScenarioType = "network_corrupt"
	ScenarioCPUSTress        ChaosScenarioType = "cpu_stress"
	ScenarioMemoryStress     ChaosScenarioType = "memory_stress"
	ScenarioIOStress         ChaosScenarioType = "io_stress"
	ScenarioDNSFault         ChaosScenarioType = "dns_fault"
	ScenarioTimeSkew         ChaosScenarioType = "time_skew"
	ScenarioDiskFill         ChaosScenarioType = "disk_fill"
	ScenarioServiceKill      ChaosScenarioType = "service_kill"
	ScenarioAPIFailure       ChaosScenarioType = "api_failure"
	ScenarioLatencyInjection ChaosScenarioType = "latency_injection"
	ScenarioCustom           ChaosScenarioType = "custom"
)

// TargetType is the target type of a chaos target.
type TargetType string

const (
	TargetPod       TargetType = "pod"
	TargetService   TargetType = "service"
	TargetNode      TargetType = "node"
	TargetContainer TargetType = "container"
	TargetNetwork   TargetType = "network"
	TargetAPI       TargetType = "api"
	TargetDatabase  TargetType = "database"
)

// --- Domain entities ---

// ChaosTarget defines a target for the chaos experiment.
type ChaosTarget struct {
	Type       TargetType            `json:"type" db:"type"`
	Selector   map[string]string     `json:"selector" db:"selector"`
	Namespace  *string               `json:"namespace,omitempty" db:"namespace"`
	Count      *int                  `json:"count,omitempty" db:"count"`
	Percentage *float64              `json:"percentage,omitempty" db:"percentage"`
}

// ExperimentSchedule defines the schedule for the experiment.
type ExperimentSchedule struct {
	Type           string  `json:"type" db:"type"`          // once|recurring|cron
	StartTime      int64   `json:"start_time" db:"start_time"`
	EndTime        *int64  `json:"end_time,omitempty" db:"end_time"`
	Interval       *int64  `json:"interval,omitempty" db:"interval"`
	CronExpression *string `json:"cron_expression,omitempty" db:"cron_expression"`
}

// MonitoringThreshold represents a metric threshold for the monitoring config.
type MonitoringThreshold struct {
	Metric    string `json:"metric" db:"metric"`
	Threshold float64 `json:"threshold" db:"threshold"`
	Action    string `json:"action" db:"action"` // alert|stop|pause
}

// MonitoringConfig defines the monitoring configuration for the experiment.
type MonitoringConfig struct {
	Metrics      []string              `json:"metrics" db:"metrics"`
	Endpoints    []string              `json:"endpoints" db:"endpoints"`
	Thresholds   []MonitoringThreshold `json:"thresholds" db:"thresholds"`
	CollectLogs  bool                  `json:"collect_logs" db:"collect_logs"`
}

// SafeguardConfig defines a safeguard configuration.
type SafeguardConfig struct {
	Type    string                 `json:"type" db:"type"`
	Config  map[string]interface{} `json:"config" db:"config"`
	Enabled bool                   `json:"enabled" db:"enabled"`
}

// MetricPoint represents a before/after metric delta.
type MetricPoint struct {
	Name   string  `json:"name" db:"name"`
	Before float64 `json:"before" db:"before"`
	After  float64 `json:"after" db:"after"`
	Delta  float64 `json:"delta" db:"delta"`
}

// ExperimentResult stores the results of an experiment run.
type ExperimentResult struct {
	ID              string        `json:"id" db:"id"`
	ExperimentID    string        `json:"experiment_id" db:"experiment_id"`
	Status          string        `json:"status" db:"status"`
	StartTime       *int64        `json:"start_time" db:"start_time"`
	EndTime         *int64        `json:"end_time" db:"end_time"`
	Duration        int64         `json:"duration" db:"duration"`
	Metrics         string        `json:"metrics" db:"metrics"` // JSON
	ImpactedTargets string        `json:"impacted_targets" db:"impacted_targets"` // JSON
	RecoveryTime    int64         `json:"recovery_time" db:"recovery_time"`
	DetectionTime   int64         `json:"detection_time" db:"detection_time"`
	Insights        string        `json:"insights" db:"insights"` // JSON
	Recommendations string        `json:"recommendations" db:"recommendations"` // JSON
	TenantID        string        `json:"tenant_id" db:"tenant_id"`
	CreatedAt       int64         `json:"created_at" db:"created_at"`
}

// ExperimentLog stores a log entry of an experiment run.
type ExperimentLog struct {
	ID           string                 `json:"id" db:"id"`
	ExperimentID string                 `json:"experiment_id" db:"experiment_id"`
	Timestamp    int64                  `json:"timestamp" db:"timestamp"`
	Level        string                 `json:"level" db:"level"`
	Message      string                 `json:"message" db:"message"`
	Details      string                 `json:"details" db:"details"` // JSON
	TenantID     string                 `json:"tenant_id" db:"tenant_id"`
	CreatedAt    int64                  `json:"created_at" db:"created_at"`
}

// --- Scenario definitions ---

// ScenarioParameter defines a parameter for a chaos scenario.
type ScenarioParameter struct {
	Name         string                 `json:"name" db:"name"`
	Type         string                 `json:"type" db:"type"`
	Required     bool                   `json:"required" db:"required"`
	DefaultValue *string                `json:"default_value,omitempty" db:"default_value"`
	Description  string                 `json:"description" db:"description"`
}

// ChaosScenario defines a built-in chaos scenario.
type ChaosScenario struct {
	Type        ChaosScenarioType   `json:"type" db:"type"`
	Name        string              `json:"name" db:"name"`
	Description string              `json:"description" db:"description"`
	Category    string              `json:"category" db:"category"`
	RiskLevel   string              `json:"risk_level" db:"risk_level"` // low|medium|high|critical
	Parameters  []ScenarioParameter `json:"parameters" db:"parameters"`
}

// --- Core entity: Experiment ---

// ChaosExperiment is the main entity representing a chaos experiment.
type ChaosExperiment struct {
	ID            string              `json:"id" db:"id"`
	Name          string              `json:"name" db:"name"`
	Description   string              `json:"description" db:"description"`
	Status        ExperimentStatus    `json:"status" db:"status"`
	Scenario      ChaosScenarioType   `json:"scenario" db:"scenario"`
	Targets       string              `json:"targets" db:"targets"`          // JSONB
	Duration      int64               `json:"duration" db:"duration"`
	Intensity     int64               `json:"intensity" db:"intensity"`
	Schedule      string              `json:"schedule" db:"schedule"`        // JSONB (nullable)
	Monitoring    string              `json:"monitoring" db:"monitoring"`    // JSONB
	Safeguards    string              `json:"safeguards" db:"safeguards"`    // JSONB
	CreatedBy     string              `json:"created_by" db:"created_by"`
	CreatedAt     int64               `json:"created_at" db:"created_at"`
	UpdatedAt     int64               `json:"updated_at" db:"updated_at"`
	StartedAt     *int64              `json:"started_at,omitempty" db:"started_at"`
	CompletedAt   *int64              `json:"completed_at,omitempty" db:"completed_at"`
	TenantID      string              `json:"tenant_id" db:"tenant_id"`
}

// --- JSON helpers ---

// ParseTargets deserializes the Targets JSON field.
func (e *ChaosExperiment) ParseTargets() []ChaosTarget {
	if e.Targets == "" {
		return nil
	}
	var t []ChaosTarget
	_ = json.Unmarshal([]byte(e.Targets), &t)
	return t
}

// SetTargets marshals the targets into the JSON field.
func (e *ChaosExperiment) SetTargets(targets []ChaosTarget) error {
	b, err := json.Marshal(targets)
	if err != nil {
		return err
	}
	e.Targets = string(b)
	return nil
}

// ParseSchedule deserializes the Schedule JSON field.
func (e *ChaosExperiment) ParseSchedule() *ExperimentSchedule {
	if e.Schedule == "" || e.Schedule == "null" {
		return nil
	}
	var s *ExperimentSchedule
	_ = json.Unmarshal([]byte(e.Schedule), &s)
	return s
}

// ParseMonitoring deserializes the Monitoring JSON field.
func (e *ChaosExperiment) ParseMonitoring() *MonitoringConfig {
	if e.Monitoring == "" {
		return nil
	}
	var m *MonitoringConfig
	_ = json.Unmarshal([]byte(e.Monitoring), &m)
	return m
}

// ParseSafeguards deserializes the Safeguards JSON field.
func (e *ChaosExperiment) ParseSafeguards() []SafeguardConfig {
	if e.Safeguards == "" {
		return nil
	}
	var s []SafeguardConfig
	_ = json.Unmarshal([]byte(e.Safeguards), &s)
	return s
}

// MarshalString marshals a value to a JSON string.
func MarshalString(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

// --- Request / Response models ---

// CreateExperimentRequest is the request body for creating an experiment.
type CreateExperimentRequest struct {
	Name        string              `json:"name" binding:"required"`
	Description string              `json:"description"`
	Scenario    ChaosScenarioType   `json:"scenario" binding:"required"`
	Targets     []ChaosTarget       `json:"targets"`
	Duration    int64               `json:"duration" binding:"required"`
	Intensity   int64               `json:"intensity"`
	Schedule    *ExperimentSchedule `json:"schedule"`
	Monitoring  *MonitoringConfig   `json:"monitoring"`
	Safeguards  []SafeguardConfig   `json:"safeguards"`
}

// UpdateExperimentRequest is the request body for updating an experiment.
type UpdateExperimentRequest struct {
	Name        *string             `json:"name"`
	Description *string             `json:"description"`
	Targets     *[]ChaosTarget      `json:"targets"`
	Duration    *int64              `json:"duration"`
	Intensity   *int64              `json:"intensity"`
	Schedule    *ExperimentSchedule `json:"schedule"`
	Monitoring  *MonitoringConfig   `json:"monitoring"`
	Safeguards  *[]SafeguardConfig  `json:"safeguards"`
}

// ListQuery is the query params for listing experiments.
type ListQuery struct {
	Status    string            `form:"status"`
	Scenario  ChaosScenarioType `form:"scenario"`
	CreatedBy string            `form:"createdBy"`
	Sort      string            `form:"sort"`
	Order     string            `form:"order"`
	Limit     int               `form:"limit"`
	Offset    int               `form:"offset"`
}

// PaginatedResponse wraps a paginated list response.
type PaginatedResponse struct {
	Data   interface{} `json:"data"`
	Offset int         `json:"offset"`
	Limit  int         `json:"limit"`
	Total  int         `json:"total"`
}

// ScheduleExperimentRequest is the request body for creating a scheduled experiment.
type ScheduleExperimentRequest struct {
	Name        string              `json:"name" binding:"required"`
	Description string              `json:"description"`
	Scenario    ChaosScenarioType   `json:"scenario" binding:"required"`
	Targets     []ChaosTarget       `json:"targets"`
	Duration    int64               `json:"duration" binding:"required"`
	Intensity   int64               `json:"intensity"`
	Schedule    *ExperimentSchedule `json:"schedule" binding:"required"`
	Monitoring  *MonitoringConfig   `json:"monitoring"`
	Safeguards  []SafeguardConfig   `json:"safeguards"`
}
