package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/lib/pq"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
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

// CIItem represents a Configuration Item in the CMDB.
// Ports all fields from the Node.js CI type including soft delete,
// version tracking, environment, and tags.
type CIItem struct {
	ID          string         `json:"id" db:"id"`
	TenantID    string         `json:"tenant_id" db:"tenant_id"`
	Name        string         `json:"name" db:"name"`
	CIType      string         `json:"ci_type" db:"ci_type"`
	Description string         `json:"description" db:"description"`
	Status      string         `json:"status" db:"status"`
	Environment string         `json:"environment" db:"environment"`
	Tags        pq.StringArray `json:"tags" db:"tags"`
	Owner       string         `json:"owner" db:"owner"`
	Attributes  JSONB          `json:"attributes" db:"attributes"`
	Version     int            `json:"version" db:"version"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
	DeletedAt   *time.Time     `json:"deleted_at,omitempty" db:"deleted_at"`
}

// CIRelation represents a relationship between two CIs.
// Ports the full relation model from Node.js including description
// and soft delete support.
type CIRelation struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	SourceCIID   string     `json:"source_ci_id" db:"source_ci_id"`
	TargetCIID   string     `json:"target_ci_id" db:"target_ci_id"`
	RelationType string     `json:"relation_type" db:"relation_type"`
	Description  string     `json:"description" db:"description"`
	CreatedBy    string     `json:"created_by" db:"created_by"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// CIAuditLog records every mutation for compliance and rollback traceability.
type CIAuditLog struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	CIID      string    `json:"ci_id" db:"ci_id"`
	Action    string    `json:"action" db:"action"`
	Actor     string    `json:"actor" db:"actor"`
	OldValue  JSONB     `json:"old_value,omitempty" db:"old_value"`
	NewValue  JSONB     `json:"new_value,omitempty" db:"new_value"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CIVersion stores the version history of a CI for audit and rollback.
// Ports the CIVersion model from Node.js.
type CIVersion struct {
	ID        string    `json:"id" db:"id"`
	CIID      string    `json:"ci_id" db:"ci_id"`
	Version   int       `json:"version" db:"version"`
	Changes   string    `json:"changes" db:"changes"`
	Data      JSONB     `json:"data" db:"data"`
	Actor     string    `json:"actor" db:"actor"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CreateCIRequest is the inbound payload for creating a CI.
type CreateCIRequest struct {
	Name        string   `json:"name" binding:"required"`
	CIType      string   `json:"ci_type" binding:"required"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Environment string   `json:"environment"`
	Tags        []string `json:"tags"`
	Owner       string   `json:"owner"`
	Attributes  JSONB    `json:"attributes"`
}

// UpdateCIRequest is the inbound payload for updating a CI.
// All fields are optional (pointer = nil means "do not change").
type UpdateCIRequest struct {
	Name        *string  `json:"name"`
	CIType      *string  `json:"ci_type"`
	Description *string  `json:"description"`
	Status      *string  `json:"status"`
	Environment *string  `json:"environment"`
	Tags        *[]string `json:"tags"`
	Owner       *string  `json:"owner"`
	Attributes  *JSONB   `json:"attributes"`
}

// CreateRelationRequest is the inbound payload for creating a relation.
type CreateRelationRequest struct {
	SourceCIID   string `json:"source_ci_id" binding:"required"`
	TargetCIID   string `json:"target_ci_id" binding:"required"`
	RelationType string `json:"relation_type" binding:"required"`
	Description  string `json:"description"`
}

// RestoreVersionRequest is the inbound payload for restoring a CI to a prior version.
type RestoreVersionRequest struct {
	Version int `json:"version" binding:"required"`
}

// ListQuery carries filter/pagination parameters from the query string.
type ListQuery struct {
	Page        int    `form:"page,default=1"`
	PageSize    int    `form:"page_size,default=20"`
	CIType      string `form:"ci_type"`
	Status      string `form:"status"`
	Environment string `form:"environment"`
	Tags        string `form:"tags"` // comma-separated tag values
	Name        string `form:"name"`
	Search      string `form:"search"` // free-text search across name + description
	OrderBy     string `form:"order_by,default=created_at"`
	Order       string `form:"order,default=DESC"`
}

// TopologyNode is a CI with its direct relations attached.
type TopologyNode struct {
	CIItem
	Relations []TopologyEdge `json:"relations"`
}

// TopologyEdge is a single directed edge in the CI topology graph.
type TopologyEdge struct {
	ID           string `json:"id" db:"id"`
	TargetCIID   string `json:"target_ci_id" db:"target_ci_id"`
	RelationType string `json:"relation_type" db:"relation_type"`
}

// TopologyResponse is the full topology graph for a tenant or subtree.
type TopologyResponse struct {
	Nodes []TopologyNode   `json:"nodes"`
	Edges []TopologyEdge   `json:"edges"`
}

// ImpactAnalysisResult holds the blast-radius analysis for a single CI.
type ImpactAnalysisResult struct {
	AffectedNodes []TopologyNode `json:"affected_nodes"`
	AffectedEdges []TopologyEdge `json:"affected_edges"`
	ImpactLevel   string         `json:"impact_level"` // critical, high, medium, low
}
