package models

import "time"

// DatabaseDevopsItem represents a database DevOps operation entry
type DatabaseDevopsItem struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Type        string    `json:"type" db:"type"`             // backup, restore, pitr, migration, vacuum
	Status      string    `json:"status" db:"status"`         // pending, running, completed, failed
	DatabaseID  string    `json:"database_id" db:"database_id"`
	Config      string    `json:"config" db:"config"`        // JSON config
	Result      string    `json:"result" db:"result"`        // JSON result
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateDatabaseDevopsRequest is the request body for creating a new operation
type CreateDatabaseDevopsRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Type        string `json:"type" binding:"required"` // backup, restore, pitr, migration, vacuum
	DatabaseID  string `json:"database_id" binding:"required"`
	Config      string `json:"config"`  // JSON config payload
	Enabled     bool   `json:"enabled"`
}

// UpdateDatabaseDevopsRequest is the request body for updating an operation
type UpdateDatabaseDevopsRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Config      *string `json:"config"`
	Result      *string `json:"result"`
	Enabled     *bool   `json:"enabled"`
}

// BackupConfig defines backup operation parameters
type BackupConfig struct {
	BackupType    string `json:"backup_type"`    // full, incremental, wal
	CompressLevel int    `json:"compress_level"`
	Destination   string `json:"destination"`   // local, s3, minio
	RetainDays    int    `json:"retain_days"`
}

// RestoreConfig defines restore operation parameters
type RestoreConfig struct {
	BackupID    string `json:"backup_id"`
	PointInTime string `json:"point_in_time"` // PITR target timestamp (RFC3339)
	TargetDB    string `json:"target_db"`
	DryRun      bool   `json:"dry_run"`
}

// DatabaseSource represents a database data source
type DatabaseSource struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"` // postgres, mysql, clickhouse
	Host      string    `json:"host" db:"host"`
	Port      int       `json:"port" db:"port"`
	Database  string    `json:"database" db:"database"`
	Username  string    `json:"username" db:"username"`
	Password  string    `json:"password,omitempty" db:"password"`
	SSLMode   string    `json:"ssl_mode" db:"ssl_mode"`
	Status    string    `json:"status" db:"status"` // active, inactive, error
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateDataSourceRequest is the request body for creating a data source
type CreateDataSourceRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port" binding:"required"`
	Database string `json:"database" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	SSLMode  string `json:"ssl_mode"`
}

// BackupResult holds the result of a backup operation
type BackupResult struct {
	BackupID   string `json:"backup_id"`
	Size       int64  `json:"size"`
	Duration   string `json:"duration"`
	Status     string `json:"status"`
	Message    string `json:"message"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
}
