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

type LLMModel struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`

	CreatedAt time.Time    `db:"created_at" json:"created_at"`
	Provider   string  `db:"provider" json:"provider"`
	ModelName  string  `db:"model_name" json:"model_name"`
	TokenCount int64   `db:"token_count" json:"token_count"`
	CostUSD    float64 `db:"cost_usd" json:"cost_usd"`
	LatencyMs  int     `db:"latency_ms" json:"latency_ms,omitempty"`
}

type CreateLLMModelRequest struct {
	Name string `json:"name" binding:"required"`

	Provider  string `json:"provider" binding:"required"`
	ModelName string `json:"model_name" binding:"required"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
