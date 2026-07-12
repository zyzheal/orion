package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// PostgreSQL JSONB-compatible types
// ---------------------------------------------------------------------------

// JSONB is a PostgreSQL JSONB-compatible map type (for history old/new values).
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

// StringArray is a PostgreSQL JSONB-compatible string slice (for routes/permissions).
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = StringArray{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

// SubAppStatus represents the lifecycle state of a sub-app configuration.
type SubAppStatus string

const (
	SubAppStatusEnabled  SubAppStatus = "enabled"
	SubAppStatusDisabled SubAppStatus = "disabled"
)

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

// SubApp is the core domain model persisted in PostgreSQL (subapp_configs table).
type SubApp struct {
	ID        string        `db:"id" json:"id"`
	TenantID  string        `db:"tenant_id" json:"tenant_id"`
	Name      string        `db:"name" json:"name"`
	Key       string        `db:"key" json:"key"`
	Version   string        `db:"version" json:"version"`
	EntryDev  string        `db:"entry_dev" json:"entry_dev"`
	EntryProd string        `db:"entry_prod" json:"entry_prod"`
	Routes    StringArray   `db:"routes" json:"routes"`
	Permissions StringArray `db:"permissions" json:"permissions"`
	KeepAlive bool          `db:"keep_alive" json:"keep_alive"`
	Preload   bool          `db:"preload" json:"preload"`
	Description *string     `db:"description" json:"description"`
	Icon      *string       `db:"icon" json:"icon"`
	APIDomain *string       `db:"api_domain" json:"api_domain"`
	Status    SubAppStatus  `db:"status" json:"status"`
	SortOrder int           `db:"sort_order" json:"sort_order"`
	CreatedBy *string       `db:"created_by" json:"created_by"`
	UpdatedBy *string       `db:"updated_by" json:"updated_by"`
	CreatedAt time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt time.Time     `db:"updated_at" json:"updated_at"`
}

// SubAppConfigHistory records configuration change history.
type SubAppConfigHistory struct {
	ID            string    `db:"id" json:"id"`
	SubAppKey     string    `db:"subapp_key" json:"subapp_key"`
	Action        string    `db:"action" json:"action"`
	OldValue      JSONB     `db:"old_value" json:"old_value"`
	NewValue      JSONB     `db:"new_value" json:"new_value"`
	ChangedBy     *string   `db:"changed_by" json:"changed_by"`
	ChangeSummary *string   `db:"change_summary" json:"change_summary"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

// CreateSubAppRequest is the input for creating a new sub-app.
type CreateSubAppRequest struct {
	Name        string   `json:"name" binding:"required"`
	Key         string   `json:"key" binding:"required"`
	Version     *string  `json:"version"`
	EntryDev    string   `json:"entry_dev" binding:"required"`
	EntryProd   string   `json:"entry_prod" binding:"required"`
	Routes      []string `json:"routes" binding:"required"`
	Permissions []string `json:"permissions"`
	KeepAlive   *bool    `json:"keep_alive"`
	Preload     *bool    `json:"preload"`
	Description *string  `json:"description"`
	Icon        *string  `json:"icon"`
	APIDomain   *string  `json:"api_domain"`
	Status      *SubAppStatus `json:"status"`
	SortOrder   *int     `json:"sort_order"`
}

// UpdateSubAppRequest is the input for updating an existing sub-app.
type UpdateSubAppRequest struct {
	Name        *string       `json:"name"`
	Key         *string       `json:"key"`
	Version     *string       `json:"version"`
	EntryDev    *string       `json:"entry_dev"`
	EntryProd   *string       `json:"entry_prod"`
	Routes      *[]string     `json:"routes"`
	Permissions *[]string     `json:"permissions"`
	KeepAlive   *bool         `json:"keep_alive"`
	Preload     *bool         `json:"preload"`
	Description *string       `json:"description"`
	Icon        *string       `json:"icon"`
	APIDomain   *string       `json:"api_domain"`
	Status      *SubAppStatus `json:"status"`
	SortOrder   *int          `json:"sort_order"`
}
