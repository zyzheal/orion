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

type CronJob struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Schedule    string    `db:"schedule" json:"schedule"`
	Command     string    `db:"command" json:"command"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	LastRunAt   *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	NextRunAt   *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type CreateCronJobRequest struct {
	Name     string `json:"name" binding:"required"`
	Schedule string `json:"schedule" binding:"required"`
	Command  string `json:"command" binding:"required"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
