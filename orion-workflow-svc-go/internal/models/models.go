package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}
func (j JSONB) Value() (driver.Value, error) { if j == nil { return nil, nil }; return json.Marshal(j) }
func (j *JSONB) Scan(src interface{}) error { if src == nil { *j = nil; return nil }; switch v := src.(type) { case []byte: return json.Unmarshal(v, j); case string: return json.Unmarshal([]byte(v), j); default: return fmt.Errorf("cannot scan %T into JSONB", src) } }

type WorkflowStatus string
const (
	WfActive   WorkflowStatus = "active"
	WfDisabled WorkflowStatus = "disabled"
)

type RunStatus string
const (
	RunPending   RunStatus = "pending"
	RunRunning   RunStatus = "running"
	RunCompleted RunStatus = "completed"
	RunFailed    RunStatus = "failed"
)

type Workflow struct {
	ID          string         `db:"id" json:"id"`
	TenantID    string         `db:"tenant_id" json:"tenant_id"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	Steps       JSONB          `db:"steps" json:"steps"`
	Status      WorkflowStatus `db:"status" json:"status"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type WorkflowRun struct {
	ID          string    `db:"id" json:"id"`
	WorkflowID  string    `db:"workflow_id" json:"workflow_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Status      RunStatus `db:"status" json:"status"`
	Input       JSONB     `db:"input" json:"input"`
	Output      JSONB     `db:"output" json:"output"`
	StartedAt   time.Time `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

type CreateWorkflowRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Steps       map[string]interface{} `json:"steps"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
