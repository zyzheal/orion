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

type MiddlewareInstance struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Type        string    `db:"type" json:"type"`
	Version     string    `db:"version" json:"version"`
	Host        string    `db:"host" json:"host"`
	Port        int       `db:"port" json:"port"`
	Status      string    `db:"status" json:"status"`
	Config      JSONB     `db:"config" json:"config,omitempty"`
	Labels      JSONB     `db:"labels" json:"labels,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type BackupRecord struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	InstanceID  string    `db:"instance_id" json:"instance_id"`
	Status      string    `db:"status" json:"status"`
	SizeBytes   int64     `db:"size_bytes" json:"size_bytes"`
	Location    string    `db:"location" json:"location"`
	StartedAt   time.Time `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

type CreateInstanceRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Version  string `json:"version"`
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port"`
	Config   JSONB  `json:"config"`
	Labels   JSONB  `json:"labels"`
}

type CreateBackupRequest struct {
	InstanceID string `json:"instance_id" binding:"required"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
