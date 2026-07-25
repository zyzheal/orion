// Package models defines data models for the CMDB Attribute Value Handler service.
//
// This module manages typed attribute values for Configuration Items (CI). Each CI
// attribute is stored as a JSON-serialised value with a declared type, and validation,
// parsing, comparison, and serialisation are delegated to per-type handlers.
//
// Supported attribute types (22): string, number, boolean, datetime, enum, multiselect,
// reference, json, array, binary, password, ip, email, url, percentage, memory, disk,
// cpu, version, mac, uuid, tags.
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// CMDBAttributeValue represents a single typed attribute value on a CI.
type CMDBAttributeValue struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	CIID        string    `db:"ci_id"`
	AttributeID string    `db:"attribute_id"`
	Value       string    `db:"value"`      // JSON representation of the typed value
	Type        string    `db:"type"`       // attribute type identifier
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

// ---------------------------------------------------------------------------
// JSONB helpers (self-contained, copied from runner models)
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

// JSONArray is a PostgreSQL JSONB-compatible slice type.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

// SetAttributeValueRequest is the request payload for setting an attribute value.
type SetAttributeValueRequest struct {
	CIID        string `json:"ci_id" binding:"required"`
	AttributeID string `json:"attribute_id" binding:"required"`
	Type        string `json:"type" binding:"required"`
	Value       string `json:"value"`
}

// ValidateAttributeValueRequest is the request payload for validating a value.
type ValidateAttributeValueRequest struct {
	Type  string `json:"type" binding:"required"`
	Value string `json:"value"`
	CIID  string `json:"ci_id"`
}

// HandlerInfo is the response describing a registered attribute type handler.
type HandlerInfo struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

// PaginatedRequest holds pagination parameters.
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// All registered attribute type identifiers.
var AllAttributeTypes = []string{
	"string", "number", "boolean", "datetime", "enum",
	"multiselect", "reference", "json", "array", "binary",
	"password", "ip", "email", "url", "percentage",
	"memory", "disk", "cpu", "version", "mac", "uuid", "tags",
}
