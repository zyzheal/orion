package models

import (
	"time"
)

// PageRegistry represents a page routing configuration entry.
type PageRegistry struct {
	ID          string       `json:"id" db:"id"`
	TenantID    string       `json:"tenant_id" db:"tenant_id"`
	Path        string       `json:"path" db:"path"`
	Component   string       `json:"component" db:"component"`
	Protected   bool         `json:"protected" db:"protected"`
	Permission  *string      `json:"permission" db:"permission"` // JSON string
	HideLayout  bool         `json:"hide_layout" db:"hide_layout"`
	MicroApp    bool         `json:"micro_app" db:"micro_app"`
	SubAppKey   *string      `json:"sub_app_key" db:"sub_app_key"`
	MenuKey     *string      `json:"menu_key" db:"menu_key"`
	MenuLabel   *string      `json:"menu_label" db:"menu_label"`
	MenuIcon    *string      `json:"menu_icon" db:"menu_icon"`
	Hidden      bool         `json:"hidden" db:"hidden"`
	RedirectTo  *string      `json:"redirect_to" db:"redirect_to"`
	Title       *string      `json:"title" db:"title"`
	Breadcrumb  bool         `json:"breadcrumb" db:"breadcrumb"`
	SortOrder   int          `json:"sort_order" db:"sort_order"`
	Status      string       `json:"status" db:"status"` // enabled | disabled
	CreatedAt   time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at" db:"updated_at"`
}

// PageRegistryHistory represents an audit history entry for a page registry.
type PageRegistryHistory struct {
	ID          string       `json:"id" db:"id"`
	PageID      string       `json:"page_id" db:"page_id"`
	TenantID    string       `json:"tenant_id" db:"tenant_id"`
	Action      string       `json:"action" db:"action"` // create | update | delete | toggle_status
	ChangedBy   string       `json:"changed_by" db:"changed_by"`
	Changes     *string      `json:"changes" db:"changes"` // JSON diff as string
	OldValue    *string      `json:"old_value" db:"old_value"`
	NewValue    *string      `json:"new_value" db:"new_value"`
	CreatedAt   time.Time    `json:"created_at" db:"created_at"`
}

// CreatePageRegistryRequest represents the request body for creating a page registry entry.
type CreatePageRegistryRequest struct {
	Path        string  `json:"path" binding:"required"`
	Component   string  `json:"component" binding:"required"`
	Protected   bool    `json:"protected"`
	Permission  *string `json:"permission"`
	HideLayout  bool    `json:"hide_layout"`
	MicroApp    bool    `json:"micro_app"`
	SubAppKey   *string `json:"sub_app_key"`
	MenuKey     *string `json:"menu_key"`
	MenuLabel   *string `json:"menu_label"`
	MenuIcon    *string `json:"menu_icon"`
	Hidden      bool    `json:"hidden"`
	RedirectTo  *string `json:"redirect_to"`
	Title       *string `json:"title"`
	Breadcrumb  bool    `json:"breadcrumb"`
	SortOrder   int     `json:"sort_order"`
	Status      *string `json:"status"` // "enabled" or "disabled"
}

// UpdatePageRegistryRequest represents the request body for updating a page registry entry.
// All fields are optional (pointer or non-pointer for non-required).
type UpdatePageRegistryRequest struct {
	Path        *string  `json:"path"`
	Component   *string  `json:"component"`
	Protected   *bool    `json:"protected"`
	Permission  *string  `json:"permission"`
	HideLayout  *bool    `json:"hide_layout"`
	MicroApp    *bool    `json:"micro_app"`
	SubAppKey   *string  `json:"sub_app_key"`
	MenuKey     *string  `json:"menu_key"`
	MenuLabel   *string  `json:"menu_label"`
	MenuIcon    *string  `json:"menu_icon"`
	Hidden      *bool    `json:"hidden"`
	RedirectTo  *string  `json:"redirect_to"`
	Title       *string  `json:"title"`
	Breadcrumb  *bool    `json:"breadcrumb"`
	SortOrder   *int     `json:"sort_order"`
	Status      *string  `json:"status"` // "enabled" or "disabled"
}
