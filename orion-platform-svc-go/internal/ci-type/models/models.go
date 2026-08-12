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
	Icon        *string       `db:"icon" json:"icon"`
	Category    *string       `db:"category" json:"category"`
	Version     int           `db:"version" json:"version"`
	Enabled     bool          `db:"enabled" json:"enabled"`
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
	Icon        *string `json:"icon"`
	Category    *string `json:"category"`
	Status      *string `json:"status"`
}

// UpdateCITypeRequest is the request body for updating a CI type.
type UpdateCITypeRequest struct {
	Name        *string `json:"name"`
	DisplayName *string `json:"displayName"`
	Description *string `json:"description"`
	Icon        *string `json:"icon"`
	Category    *string `json:"category"`
	Enabled     *bool   `json:"enabled"`
	Status      *string `json:"status"`
}

// CIAttribute represents an attribute of a CI type.
type CIAttribute struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenantId"`
	CITypeID       string    `db:"ci_type_id" json:"typeId"`
	AttrKey        string    `db:"attr_key" json:"attrKey"`
	Name           string    `db:"name" json:"name"`
	DisplayName    *string   `db:"display_name" json:"displayName"`
	Type           string    `db:"type" json:"attrType"`
	Required       bool      `db:"required" json:"required"`
	DefaultValue   *string   `db:"default_value" json:"defaultValue"`
	Options        string    `db:"options" json:"options"`
	ValidationRule *string   `db:"validation_rule" json:"validationRule"`
	SortOrder      int       `db:"sort_order" json:"sortOrder"`
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
}

// CreateCIAttributeRequest is the request body for creating/updating a CI attribute.
type CreateCIAttributeRequest struct {
	AttrKey        string   `json:"attrKey" binding:"required"`
	DisplayName    *string  `json:"displayName"`
	Type           string   `json:"attrType"`
	Required       bool     `json:"required"`
	DefaultValue   *string  `json:"defaultValue"`
	Options        []string `json:"options"`
	ValidationRule *string  `json:"validationRule"`
	SortOrder      int      `json:"sortOrder"`
}

// CITypeVersion represents a version snapshot of a CI type.
type CITypeVersion struct {
	ID                 string         `db:"id" json:"id"`
	TenantID           string         `db:"tenant_id" json:"tenantId"`
	CITypeID           string         `db:"ci_type_id" json:"typeId"`
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
