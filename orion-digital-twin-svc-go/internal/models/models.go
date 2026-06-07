package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB represents a PostgreSQL JSONB column storing a JSON object.
type JSONB map[string]interface{}

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

// JSONBRaw represents a PostgreSQL JSONB column that can hold any JSON value
// (object, array, string, number, etc.). Stored as raw bytes.
type JSONBRaw []byte

func (j JSONBRaw) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return string(j), nil
}

func (j *JSONBRaw) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		*j = make(JSONBRaw, len(v))
		copy(*j, v)
		return nil
	case string:
		*j = JSONBRaw(v)
		return nil
	default:
		return fmt.Errorf("cannot scan %T into JSONBRaw", src)
	}
}

// MarshalJSONBRaw marshals any value into JSONBRaw.
func MarshalJSONBRaw(v interface{}) (JSONBRaw, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return JSONBRaw(b), nil
}

// ==================== Digital Twin ====================

// DigitalTwin represents a registered digital twin configuration.
type DigitalTwin struct {
	ID                string     `db:"id" json:"id"`
	TenantID          string     `db:"tenant_id" json:"tenant_id"`
	Name              string     `db:"name" json:"name"`
	Description       *string    `db:"description" json:"description,omitempty"`
	Environment       string     `db:"environment" json:"environment"`
	Services          JSONBRaw   `db:"services" json:"services"`
	SyncInterval      int        `db:"sync_interval" json:"sync_interval"`
	DataRetentionDays int        `db:"data_retention_days" json:"data_retention_days"`
	Status            string     `db:"status" json:"status"`
	HealthScore       int        `db:"health_score" json:"health_score"`
	ServiceStates     JSONB      `db:"service_states" json:"service_states"`
	LastSyncAt        *string    `db:"last_sync_at" json:"last_sync_at,omitempty"`
	Config            JSONB      `db:"config" json:"config,omitempty"`
	EntityType        string     `db:"entity_type" json:"entity_type"`
	State             JSONB      `db:"state" json:"state"`
	LastSynced        *time.Time `db:"last_synced" json:"last_synced,omitempty"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateDigitalTwinRequest is the request body for creating a digital twin.
type CreateDigitalTwinRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description *string  `json:"description,omitempty"`
	Environment string   `json:"environment"`
	Services    []string `json:"services"`
	SyncInterval int    `json:"sync_interval"`
	EntityType  string   `json:"entity_type"`
}

// UpdateDigitalTwinRequest is the request body for updating a digital twin.
type UpdateDigitalTwinRequest struct {
	Name              *string  `json:"name,omitempty"`
	Description       *string  `json:"description,omitempty"`
	Services          []string `json:"services,omitempty"`
	SyncInterval      *int     `json:"sync_interval,omitempty"`
	DataRetentionDays *int     `json:"data_retention_days,omitempty"`
}

// TwinMetrics contains aggregate metrics for a digital twin.
type TwinMetrics struct {
	HealthScore    int    `json:"health_score"`
	Status         string `json:"status"`
	ServiceCount   int    `json:"service_count"`
	LastSyncAt     string `json:"last_sync_at,omitempty"`
	SandboxCount   int    `json:"sandbox_count"`
	RecordingCount int    `json:"recording_count"`
}

// SyncResult is the result of a twin sync operation.
type SyncResult struct {
	Success  bool   `json:"success"`
	SyncedAt string `json:"synced_at"`
}

// ==================== Twin Snapshot ====================

// SnapshotComponent represents a single component in a snapshot.
type SnapshotComponent struct {
	Name         string            `json:"name"`
	Type         string            `json:"type"`
	Version      string            `json:"version"`
	Replicas     int               `json:"replicas"`
	EnvVars      map[string]string `json:"env_vars"`
	ConfigMapRefs []string         `json:"config_map_refs"`
}

// TwinSnapshot represents a point-in-time snapshot of a production environment.
type TwinSnapshot struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Name        string     `db:"name" json:"name"`
	Environment string     `db:"environment" json:"environment"`
	Status      string     `db:"status" json:"status"`
	Components  JSONBRaw   `db:"components" json:"components"`
	Topology    JSONBRaw   `db:"topology" json:"topology"`
	SizeBytes   int64      `db:"size_bytes" json:"size_bytes"`
	StoragePath *string    `db:"storage_path" json:"storage_path,omitempty"`
	Config      JSONB      `db:"config" json:"config,omitempty"`
	Metadata    JSONB      `db:"metadata" json:"metadata,omitempty"`
	CreatedBy   *string    `db:"created_by" json:"created_by,omitempty"`
	Note        *string    `db:"note" json:"note,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

// CreateSnapshotRequest is the request body for creating a snapshot.
type CreateSnapshotRequest struct {
	Environment string   `json:"environment" binding:"required"`
	Scope       []string `json:"scope,omitempty"`
	Note        *string  `json:"note,omitempty"`
	CreatedBy   *string  `json:"created_by,omitempty"`
}

// RestoreSnapshotRequest is the request body for restoring a snapshot.
type RestoreSnapshotRequest struct {
	TargetEnv string `json:"target_env" binding:"required"`
	DryRun    bool   `json:"dry_run,omitempty"`
}

// ==================== Sandbox ====================

// SandboxResources describes resource limits for a sandbox.
type SandboxResources struct {
	CPU      string `json:"cpu"`
	Memory   string `json:"memory"`
	Replicas int    `json:"replicas"`
}

// TwinSandbox represents a sandbox environment for testing.
type TwinSandbox struct {
	ID               string     `db:"id" json:"id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	TwinID           string     `db:"twin_id" json:"twin_id"`
	Name             string     `db:"name" json:"name"`
	SnapshotID       *string    `db:"snapshot_id" json:"snapshot_id,omitempty"`
	Status           string     `db:"status" json:"status"`
	Endpoint         string     `db:"endpoint" json:"endpoint"`
	Resources        JSONB      `db:"resources" json:"resources"`
	EnvVars          JSONB      `db:"env_vars" json:"env_vars"`
	NetworkIsolation bool       `db:"network_isolation" json:"network_isolation"`
	HealthStatus     string     `db:"health_status" json:"health_status"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	StartedAt        *time.Time `db:"started_at" json:"started_at,omitempty"`
	StoppedAt        *time.Time `db:"stopped_at" json:"stopped_at,omitempty"`
	LastHealthCheck  *time.Time `db:"last_health_check" json:"last_health_check,omitempty"`
}

// CreateSandboxRequest is the request body for creating a sandbox.
type CreateSandboxRequest struct {
	Name        *string          `json:"name,omitempty"`
	SnapshotID  *string          `json:"snapshot_id,omitempty"`
	Resources   *SandboxResources `json:"resources,omitempty"`
	EnvVars     map[string]string `json:"env_vars,omitempty"`
	NetworkIsolation *bool       `json:"network_isolation,omitempty"`
}

// ==================== Recording Session ====================

// RecordedRequest represents a captured HTTP request.
type RecordedRequest struct {
	Method      string            `json:"method"`
	Path        string            `json:"path"`
	Headers     map[string]string `json:"headers"`
	Body        interface{}       `json:"body,omitempty"`
	QueryParams map[string]string `json:"query_params,omitempty"`
}

// RecordedResponse represents a captured HTTP response.
type RecordedResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       interface{}       `json:"body,omitempty"`
	LatencyMs  int               `json:"latency_ms"`
}

// TrafficRecordEntry is a single captured request/response pair.
type TrafficRecordEntry struct {
	ID        string                 `json:"id"`
	TwinID    string                 `json:"twin_id"`
	Request   RecordedRequest        `json:"request"`
	Response  RecordedResponse       `json:"response"`
	Timestamp string                 `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// RecordingSession represents a traffic recording session.
type RecordingSession struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	TwinID         string     `db:"twin_id" json:"twin_id"`
	Name           string     `db:"name" json:"name"`
	Status         string     `db:"status" json:"status"`
	Records        JSONBRaw   `db:"records" json:"records"`
	FilterPatterns JSONBRaw   `db:"filter_patterns" json:"filter_patterns,omitempty"`
	StartedAt      time.Time  `db:"started_at" json:"started_at"`
	PausedAt       *time.Time `db:"paused_at" json:"paused_at,omitempty"`
	CompletedAt    *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

// StartRecordingRequest is the request body for starting a recording.
type StartRecordingRequest struct {
	Name           string   `json:"name" binding:"required"`
	FilterPatterns []string `json:"filter_patterns,omitempty"`
	MaxRecords     int      `json:"max_records,omitempty"`
	CaptureHeaders []string `json:"capture_headers,omitempty"`
	CaptureBody    bool     `json:"capture_body,omitempty"`
}

// RecordTrafficRequest is the request body for recording a traffic entry.
type RecordTrafficRequest struct {
	Request  RecordedRequest  `json:"request" binding:"required"`
	Response RecordedResponse `json:"response" binding:"required"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ==================== Replay Session ====================

// ReplayResult is the result of replaying a single request.
type ReplayResult struct {
	RequestIndex  int         `json:"request_index"`
	RecordID      string      `json:"record_id"`
	OriginalStatus int        `json:"original_status"`
	ReplayStatus  int         `json:"replay_status,omitempty"`
	OriginalBody  interface{} `json:"original_body"`
	ReplayBody    interface{} `json:"replay_body,omitempty"`
	LatencyDiff   int         `json:"latency_diff"`
	Matched       bool        `json:"matched"`
	Error         string      `json:"error,omitempty"`
}

// ReplaySession represents a traffic replay session.
type ReplaySession struct {
	ID                  string     `db:"id" json:"id"`
	TenantID            string     `db:"tenant_id" json:"tenant_id"`
	TwinID              string     `db:"twin_id" json:"twin_id"`
	RecordingSessionID  string     `db:"recording_session_id" json:"recording_session_id"`
	SandboxEndpoint     string     `db:"sandbox_endpoint" json:"sandbox_endpoint"`
	Status              string     `db:"status" json:"status"`
	TotalRequests       int        `db:"total_requests" json:"total_requests"`
	CompletedRequests   int        `db:"completed_requests" json:"completed_requests"`
	MatchedRequests     int        `db:"matched_requests" json:"matched_requests"`
	FailedRequests      int        `db:"failed_requests" json:"failed_requests"`
	Results             JSONBRaw   `db:"results" json:"results"`
	Config              JSONB      `db:"config" json:"config"`
	Progress            int        `db:"progress" json:"progress"`
	StartedAt           *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt         *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

// StartReplayRequest is the request body for starting a replay.
type StartReplayRequest struct {
	TwinID             string `json:"twin_id" binding:"required"`
	RecordingSessionID string `json:"recording_session_id" binding:"required"`
	SandboxEndpoint    string `json:"sandbox_endpoint" binding:"required"`
	SpeedMultiplier    int    `json:"speed_multiplier,omitempty"`
	MaxConcurrency     int    `json:"max_concurrency,omitempty"`
	FilterPaths        []string `json:"filter_paths,omitempty"`
	TargetEndpoint     string `json:"target_endpoint,omitempty"`
	CompareResponses   *bool  `json:"compare_responses,omitempty"`
	StopOnFailure      *bool  `json:"stop_on_failure,omitempty"`
}

// UpdateProgressRequest is the request body for updating replay progress.
type UpdateProgressRequest struct {
	Completed int `json:"completed" binding:"required"`
	Matched   int `json:"matched"`
	Failed    int `json:"failed"`
	Progress  int `json:"progress"`
}

// ==================== Pagination ====================

// PaginatedRequest contains pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
