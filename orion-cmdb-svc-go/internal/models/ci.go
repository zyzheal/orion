package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type JSONB map[string]any

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value any) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		*j = make(JSONB)
		return nil
	}
	return json.Unmarshal(bytes, j)
}

type CIItem struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	Name       string    `json:"name" db:"name"`
	CIType     string    `json:"ci_type" db:"ci_type"`
	Status     string    `json:"status" db:"status"`
	Owner      string    `json:"owner" db:"owner"`
	Attributes JSONB     `json:"attributes" db:"attributes"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type CIRelation struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	SourceCIID   string    `json:"source_ci_id" db:"source_ci_id"`
	TargetCIID   string    `json:"target_ci_id" db:"target_ci_id"`
	RelationType string    `json:"relation_type" db:"relation_type"`
}

type CIAuditLog struct {
	ID       string    `json:"id" db:"id"`
	TenantID string    `json:"tenant_id" db:"tenant_id"`
	CIID     string    `json:"ci_id" db:"ci_id"`
	Action   string    `json:"action" db:"action"`
	Actor    string    `json:"actor" db:"actor"`
	OldValue JSONB     `json:"old_value,omitempty" db:"old_value"`
	NewValue JSONB     `json:"new_value,omitempty" db:"new_value"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateCIRequest struct {
	Name       string `json:"name" binding:"required"`
	CIType     string `json:"ci_type" binding:"required"`
	Status     string `json:"status"`
	Owner      string `json:"owner"`
	Attributes JSONB  `json:"attributes"`
}

type UpdateCIRequest struct {
	Name       *string `json:"name"`
	CIType     *string `json:"ci_type"`
	Status     *string `json:"status"`
	Owner      *string `json:"owner"`
	Attributes *JSONB  `json:"attributes"`
}

type CreateRelationRequest struct {
	SourceCIID   string `json:"source_ci_id" binding:"required"`
	TargetCIID   string `json:"target_ci_id" binding:"required"`
	RelationType string `json:"relation_type" binding:"required"`
}

type ListQuery struct {
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"page_size,default=20"`
	CIType   string `form:"ci_type"`
	Status   string `form:"status"`
	Name     string `form:"name"`
}

type TopologyNode struct {
	CIItem
	Relations []TopologyEdge `json:"relations"`
}

type TopologyEdge struct {
	ID           string `json:"id" db:"id"`
	TargetCIID   string `json:"target_ci_id" db:"target_ci_id"`
	RelationType string `json:"relation_type" db:"relation_type"`
}
