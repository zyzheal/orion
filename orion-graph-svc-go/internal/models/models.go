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

type GraphNode struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`

	CreatedAt time.Time    `db:"created_at" json:"created_at"`
	NodeType   string `db:"node_type" json:"node_type"`
	Properties JSONB  `db:"properties" json:"properties,omitempty"`
}

type CreateGraphNodeRequest struct {
	Name string `json:"name" binding:"required"`

	NodeType   string `json:"node_type" binding:"required"`
	Properties JSONB  `json:"properties"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
