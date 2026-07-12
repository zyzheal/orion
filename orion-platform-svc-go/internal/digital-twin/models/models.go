package models

import "time"

// --- Digital Twin ---

type DigitalTwin struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	Name         string    `json:"name" db:"name"`
	ServiceType  string    `json:"service_type" db:"service_type"`
	SourceService string   `json:"source_service" db:"source_service"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreateDigitalTwinRequest struct {
	Name         string `json:"name" binding:"required"`
	ServiceType  string `json:"serviceType" binding:"required"`
	SourceService string `json:"sourceService" binding:"required"`
}

// --- Snapshot ---

type Snapshot struct {
	ID        string    `json:"id" db:"id"`
	TwinID    string    `json:"twin_id" db:"twin_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateSnapshotRequest struct {
	Name string `json:"name" binding:"required"`
}

// --- Sandbox ---

type Sandbox struct {
	TwinID     string `json:"twin_id"`
	Name       string `json:"name"`
	SnapshotID string `json:"snapshot_id"`
	Status     string `json:"status"`
}

type CreateSandboxRequest struct {
	TwinID     string `json:"twinId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	SnapshotID string `json:"snapshotId"`
}

// --- Traffic Record ---

type TrafficRecord struct {
	ID           string     `json:"id" db:"id"`
	TwinID       string     `json:"twin_id" db:"twin_id"`
	Type         string     `json:"type" db:"type"`
	RequestCount int        `json:"request_count" db:"request_count"`
	Duration     string     `json:"duration" db:"duration"`
	StartedAt    time.Time  `json:"started_at" db:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

type CreateTrafficRecordInput struct {
	TwinID      string
	Type        string
	StartedAt   time.Time
	CompletedAt *time.Time
	RequestCount int
	Duration    string
}

// --- Recording session (in-memory managed by TrafficRecorderService) ---

type RecordingSession struct {
	ID          string    `json:"id"`
	TwinID      string    `json:"twinId"`
	Name        string    `json:"name"`
	Status      string    `json:"status"` // recording, paused, completed
	RecordCount int       `json:"recordCount"`
	Records     []any     `json:"records"`
	StartedAt   time.Time `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

// --- Replay Session ---

type ReplaySession struct {
	ID                  string     `json:"id" db:"id"`
	TwinID              string     `json:"twin_id" db:"twin_id"`
	RecordingSessionID  string     `json:"recording_session_id" db:"recording_session_id"`
	SandboxEndpoint     string     `json:"sandbox_endpoint" db:"sandbox_endpoint"`
	Status              string     `json:"status" db:"status"` // running, completed, cancelled, failed
	Progress            int        `json:"progress" db:"progress"`
	TotalRequests       int        `json:"total_requests" db:"total_requests"`
	CompletedRequests   int        `json:"completed_requests" db:"completed_requests"`
	MatchedRequests     int        `json:"matched_requests" db:"matched_requests"`
	FailedRequests      int        `json:"failed_requests" db:"failed_requests"`
	StartedAt           time.Time  `json:"started_at" db:"started_at"`
	CompletedAt         *time.Time `json:"completed_at,omitempty" db:"completed_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateReplaySessionInput struct {
	TwinID              string
	RecordingSessionID  string
	SandboxEndpoint     string
	Status              string
	StartedAt           time.Time
}

type CreateReplayStartRequest struct {
	RecordingSessionId string                 `json:"recordingSessionId" binding:"required"`
	SandboxEndpoint    string                 `json:"sandboxEndpoint" binding:"required"`
	Config             map[string]interface{} `json:"config"`
}
