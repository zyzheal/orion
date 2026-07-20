package models

import (
	"database/sql"
	"time"
)

// CIType represents a CI type definition.
type CIType struct {
	ID          string        `db:"id" json:"id"`
	TenantID    string        `db:"tenant_id" json:"tenantId"`
	Name        string        `db:"name" json:"name"`
	DisplayName *string       `db:"display_name" json:"displayName"`
	Description *string       `db:"description" json:"description"`
	Status      string        `db:"status" json:"status"`
	CreatedAt   time.Time     `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time     `db:"updated_at" json:"updatedAt"`
	Attributes  []CIAttribute `json:"attributes,omitempty"`
}

// CreateCITypeRequest is the request body for creating a CI type.
type CreateCITypeRequest struct {
	Name        string  `json:"name" binding:"required"`
	DisplayName *string `json:"displayName"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// UpdateCITypeRequest is the request body for updating a CI type.
type UpdateCITypeRequest struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"displayName"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// CIAttribute represents an attribute of a CI type.
type CIAttribute struct {
	ID           string    `db:"id" json:"id"`
	CITypeID     string    `db:"ci_type_id" json:"ciTypeId"`
	Name         string    `db:"name" json:"name"`
	Type         string    `db:"type" json:"type"`
	Required     bool      `db:"required" json:"required"`
	DefaultValue *string   `db:"default_value" json:"defaultValue"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
}

// CreateCIAttributeRequest is the request body for creating/updating a CI attribute.
type CreateCIAttributeRequest struct {
	Name         string  `json:"name" binding:"required"`
	Type         string  `json:"type"`
	Required     bool    `json:"required"`
	DefaultValue *string `json:"defaultValue"`
}

// CITypeVersion represents a version snapshot of a CI type.
type CITypeVersion struct {
	ID                 string         `db:"id" json:"id"`
	CITypeID           string         `db:"ci_type_id" json:"ciTypeId"`
	Version            string         `db:"version" json:"version"`
	ChangeSummary      sql.NullString `db:"change_summary" json:"changeSummary"`
	AttributesSnapshot string         `db:"attributes_snapshot" json:"attributesSnapshot"`
	CreatedAt          time.Time      `db:"created_at" json:"createdAt"`
}

// CreateCITypeVersionRequest is the request body for creating a version.
type CreateCITypeVersionRequest struct {
	ChangeSummary *string `json:"changeSummary"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// ValidationResult is the response for validating instance data.
type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// TypeWithSchema is a CI type with its schema (attributes) attached.
type TypeWithSchema struct {
	CIType
	Schema []CIAttribute `json:"schema"`
}
