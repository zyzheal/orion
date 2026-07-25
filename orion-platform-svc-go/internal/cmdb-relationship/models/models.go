// Package models defines data models for the CMDB relationship service.
//
// The CMDB Relationship service manages relationship type lifecycle and CI-to-CI
// relationship records. Relationship types define the allowed connections between
// CI types (source/target), cardinality constraints, and bidirectional semantics.
// Relationship records are the concrete links between individual CIs.
//
// Tables:
//   - cmdb_relationship_types: lifecycle-managed relationship type definitions
//   - cmdb_relationships: concrete CI-to-CI relationship records
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB helpers (consistent with runner/inception JSONB definitions)
// ---------------------------------------------------------------------------

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ---------------------------------------------------------------------------
// Relationship status / cardinality constants
// ---------------------------------------------------------------------------

// ValidCardinalities enumerates allowed cardinality values.
var ValidCardinalities = map[string]bool{
	"1:1": true,
	"1:N": true,
	"N:1": true,
	"N:N": true,
}

// ---------------------------------------------------------------------------
// CMDBRelationshipType — lifecycle-managed relationship type definition
// ---------------------------------------------------------------------------

// CMDBRelationshipType defines an allowed relationship between two CI types.
type CMDBRelationshipType struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Name          string     `db:"name" json:"name"`
	Description   string     `db:"description" json:"description"`
	SourceType    string     `db:"source_type" json:"source_type"`    // allowed source CI type
	TargetType    string     `db:"target_type" json:"target_type"`    // allowed target CI type
	Cardinality   string     `db:"cardinality" json:"cardinality"`    // 1:1, 1:N, N:1, N:N
	Bidirectional bool       `db:"bidirectional" json:"bidirectional"`
	InverseName   string     `db:"inverse_name" json:"inverse_name"`  // label for reverse direction
	Icon          string     `db:"icon" json:"icon"`
	Color         string     `db:"color" json:"color"`
	Attributes    string     `db:"attributes" json:"attributes"`      // JSON: custom attributes
	Enabled       bool       `db:"enabled" json:"enabled"`
	Status        string     `db:"status" json:"status"`              // active, deprecated
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Request / response models
// ---------------------------------------------------------------------------

// CreateRelationshipTypeRequest is the payload for creating a relationship type.
type CreateRelationshipTypeRequest struct {
	Name          string            `json:"name" binding:"required"`
	Description   string            `json:"description"`
	SourceType    string            `json:"source_type" binding:"required"`
	TargetType    string            `json:"target_type" binding:"required"`
	Cardinality   string            `json:"cardinality" binding:"required"`
	Bidirectional bool              `json:"bidirectional"`
	InverseName   string            `json:"inverse_name"`
	Icon          string            `json:"icon"`
	Color         string            `json:"color"`
	Attributes    map[string]string `json:"attributes"`
}

// UpdateRelationshipTypeRequest is the payload for partial type updates.
type UpdateRelationshipTypeRequest struct {
	Description   *string `json:"description"`
	Cardinality   *string `json:"cardinality"`
	Bidirectional *bool   `json:"bidirectional"`
	InverseName   *string `json:"inverse_name"`
	Icon          *string `json:"icon"`
	Color         *string `json:"color"`
	Attributes    *JSONB  `json:"attributes"`
	Enabled       *bool   `json:"enabled"`
	Status        *string `json:"status"`
}

// ---------------------------------------------------------------------------
// CMDBRelationship — concrete CI-to-CI relationship record
// ---------------------------------------------------------------------------

// CMDBRelationship is a concrete link between two CIs of a given relationship type.
type CMDBRelationship struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	SourceID   string    `db:"source_id" json:"source_id"`
	TargetID   string    `db:"target_id" json:"target_id"`
	TypeID     string    `db:"type_id" json:"type_id"`
	Attributes string    `db:"attributes" json:"attributes"` // JSON
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

// CreateRelationshipRequest is the payload for creating a relationship.
type CreateRelationshipRequest struct {
	SourceID string            `json:"source_id" binding:"required"`
	TargetID string            `json:"target_id" binding:"required"`
	TypeID   string            `json:"type_id" binding:"required"`
	Attributes map[string]interface{} `json:"attributes"`
}

// TopologyNode represents a node in the relationship topology graph.
type TopologyNode struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"` // CI type label
	Depth     int         `json:"depth"`
	Children  []TopologyNode `json:"children,omitempty"`
}

// TopologyEdge represents an edge in the topology graph.
type TopologyEdge struct {
	ID       string `json:"id"`
	SourceID string `json:"source_id"`
	TargetID string `json:"target_id"`
	TypeID   string `json:"type_id"`
	Direction string `json:"direction"` // outbound | inbound
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value, applying defaults.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capping at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
