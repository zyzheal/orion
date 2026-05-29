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

type AuditLog struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Action       string    `db:"action" json:"action"`
	ResourceType string    `db:"resource_type" json:"resource_type"`
	ResourceID   string    `db:"resource_id" json:"resource_id"`
	ActorID      string    `db:"actor_id" json:"actor_id"`
	ActorName    string    `db:"actor_name" json:"actor_name"`
	Details      JSONB     `db:"details" json:"details"`
	IPAddress    string    `db:"ip_address" json:"ip_address"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type CreateAuditRequest struct {
	Action       string                 `json:"action" binding:"required"`
	ResourceType string                 `json:"resource_type" binding:"required"`
	ResourceID   string                 `json:"resource_id"`
	ActorID      string                 `json:"actor_id"`
	ActorName    string                 `json:"actor_name"`
	Details      map[string]interface{} `json:"details"`
	IPAddress    string                 `json:"ip_address"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
