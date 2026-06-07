package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

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

// SecretScope defines the visibility scope of a secret.
type SecretScope string

const (
	ScopeOrg         SecretScope = "org"
	ScopeProject     SecretScope = "project"
	ScopeEnvironment SecretScope = "environment"
)

// Secret represents an encrypted secret stored in the database.
type Secret struct {
	ID          string      `db:"id" json:"id"`
	TenantID    string      `db:"tenant_id" json:"tenant_id"`
	Name        string      `db:"name" json:"name"`
	Value       string      `db:"value_encrypted" json:"value_encrypted"`
	Scope       SecretScope `db:"scope" json:"scope"`
	Description *string     `db:"description" json:"description,omitempty"`
	CreatedBy   *string     `db:"created_by" json:"created_by,omitempty"`
	Version     int         `db:"version" json:"version"`
	Env         string      `db:"environment" json:"environment"`
	CreatedAt   time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time   `db:"updated_at" json:"updated_at"`
}

// CreateSecretRequest is the payload for creating a secret.
type CreateSecretRequest struct {
	Name        string `json:"name" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Scope       string `json:"scope"`
	Description string `json:"description"`
	Env         string `json:"environment"`
}

// UpdateSecretRequest is the payload for updating a secret.
type UpdateSecretRequest struct {
	Value       *string `json:"value"`
	Description *string `json:"description"`
}

// ResolveRequest is the payload for resolving secret references.
type ResolveRequest struct {
	Parameters map[string]string `json:"parameters" binding:"required"`
}

// ResolvedResult is the response from resolving secret references.
type ResolvedResult struct {
	Parameters map[string]string `json:"parameters"`
	Resolved   int               `json:"resolved"`
	Unresolved []string          `json:"unresolved"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
