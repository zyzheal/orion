package models

import "time"

// SSEConnection represents a single SSE client connection.
type SSEConnection struct {
	ID           string    `json:"id"`
	PipelineID   string    `json:"pipelineId"`
	RunID        string    `json:"runId"`
	UserID       string    `json:"userId"`
	ConnectedAt  time.Time `json:"connectedAt"`
	LogLevels    []string  `json:"logLevels"`
	IncludeLogs  bool      `json:"includeLogs"`
	IncludeStatus bool     `json:"includeStatus"`
}

// LogEvent represents a pipeline log line emitted over SSE.
type LogEvent struct {
	PipelineID string `json:"pipelineId"`
	RunID      string `json:"runId"`
	StageID    string `json:"stageId"`
	StageName  string `json:"stageName"`
	StepName   string `json:"stepName"`
	LogLine    string `json:"logLine"`
	Timestamp  string `json:"timestamp"`
	Level      string `json:"level"`
}

// StatusEvent represents a pipeline status update emitted over SSE.
type StatusEvent struct {
	PipelineID string  `json:"pipelineId"`
	RunID      string  `json:"runId"`
	Status     string  `json:"status"`
	StageID    string  `json:"stageId"`
	StageName  string  `json:"stageName"`
	Progress   float64 `json:"progress"`
	Timestamp  string  `json:"timestamp"`
}

// PublishLogRequest is the request body for publishing a log event.
type PublishLogRequest struct {
	PipelineID string `json:"pipelineId" binding:"required"`
	RunID      string `json:"runId" binding:"required"`
	StageID    string `json:"stageId"`
	StageName  string `json:"stageName"`
	StepName   string `json:"stepName"`
	LogLine    string `json:"logLine" binding:"required"`
	Level      string `json:"level"`
}

// PublishStatusRequest is the request body for publishing a status event.
type PublishStatusRequest struct {
	PipelineID string  `json:"pipelineId" binding:"required"`
	RunID      string  `json:"runId" binding:"required"`
	Status     string  `json:"status" binding:"required"`
	StageID    string  `json:"stageId"`
	StageName  string  `json:"stageName"`
	Progress   float64 `json:"progress"`
}

// SSEStats holds connection statistics.
type SSEStats struct {
	TotalConnections int              `json:"totalConnections"`
	ConnectionsByUser map[string]int  `json:"connectionsByUser"`
}

// SSELogEventRecord is the database model for persisted SSE log events.
type SSELogEventRecord struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenantId"`
	PipelineID string    `db:"pipeline_id" json:"pipelineId"`
	RunID      string    `db:"run_id" json:"runId"`
	StageID    string    `db:"stage_id" json:"stageId"`
	StageName  string    `db:"stage_name" json:"stageName"`
	StepName   string    `db:"step_name" json:"stepName"`
	LogLine    string    `db:"log_line" json:"logLine"`
	Level      string    `db:"level" json:"level"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}

// SSEStatusEventRecord is the database model for persisted SSE status events.
type SSEStatusEventRecord struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenantId"`
	PipelineID string    `db:"pipeline_id" json:"pipelineId"`
	RunID      string    `db:"run_id" json:"runId"`
	Status     string    `db:"status" json:"status"`
	StageID    string    `db:"stage_id" json:"stageId"`
	StageName  string    `db:"stage_name" json:"stageName"`
	Progress   float64   `db:"progress" json:"progress"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}