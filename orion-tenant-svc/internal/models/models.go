package models

import "time"

type Tenant struct {
	ID             string    `db:"id" json:"id"`
	Name           string    `db:"name" json:"name"`
	DisplayName    string    `db:"display_name" json:"display_name"`
	Status         string    `db:"status" json:"status"`
	QuotaUsers     int       `db:"quota_users" json:"quota_users"`
	QuotaStorageMB int       `db:"quota_storage_mb" json:"quota_storage_mb"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type CreateTenantRequest struct {
	Name           string `json:"name" binding:"required"`
	DisplayName    string `json:"display_name"`
	QuotaUsers     int    `json:"quota_users"`
	QuotaStorageMB int    `json:"quota_storage_mb"`
}

type UpdateTenantRequest struct {
	DisplayName string `json:"display_name"`
	Status      string `json:"status" binding:"oneof=active suspended deleted"`
}

type UpdateSettingsRequest struct {
	DisplayName string `json:"display_name" binding:"required"`
}
