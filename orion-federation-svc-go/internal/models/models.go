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

type FederatedCluster struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`

	CreatedAt time.Time    `db:"created_at" json:"created_at"`
	PeerURL  string     `db:"peer_url" json:"peer_url"`
	Protocol string     `db:"protocol" json:"protocol"`
	Status   string     `db:"status" json:"status"`
	Config   JSONB      `db:"config" json:"config,omitempty"`
	LastSync *time.Time `db:"last_sync" json:"last_sync,omitempty"`
}

type CreateFederatedClusterRequest struct {
	Name string `json:"name" binding:"required"`

	PeerURL  string `json:"peer_url" binding:"required"`
	Protocol string `json:"protocol" binding:"required"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
