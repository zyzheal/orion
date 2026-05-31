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

type InspectionRule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	RuleType    string    `db:"rule_type" json:"rule_type"`
	Target      string    `db:"target" json:"target"`
	Condition   JSONB     `db:"condition" json:"condition"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Schedule    string    `db:"schedule" json:"schedule,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type InspectionResult struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	RuleID     string    `db:"rule_id" json:"rule_id"`
	RuleName   string    `db:"rule_name" json:"rule_name"`
	Status     string    `db:"status" json:"status"`
	Target     string    `db:"target" json:"target"`
	Details    JSONB     `db:"details" json:"details,omitempty"`
	Remediation string   `db:"remediation" json:"remediation,omitempty"`
	ExecutedAt time.Time `db:"executed_at" json:"executed_at"`
}

type CreateRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	RuleType    string `json:"rule_type" binding:"required"`
	Target      string `json:"target" binding:"required"`
	Condition   JSONB  `json:"condition" binding:"required"`
	Severity    string `json:"severity"`
	Schedule    string `json:"schedule"`
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
