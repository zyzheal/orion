package models

import (
	"encoding/json"
	"time"
)

// BackupType represents the type of backup.
type BackupType string

const (
	BackupTypeFull         BackupType = "full"
	BackupTypeIncremental  BackupType = "incremental"
	BackupTypeDifferential BackupType = "differential"
)

// BackupStatus represents the current status of a backup.
type BackupStatus string

const (
	BackupStatusPending   BackupStatus = "pending"
	BackupStatusRunning   BackupStatus = "running"
	BackupStatusCompleted BackupStatus = "completed"
	BackupStatusFailed    BackupStatus = "failed"
	BackupStatusVerified  BackupStatus = "verified"
	BackupStatusExpired   BackupStatus = "expired"
	BackupStatusDeleted   BackupStatus = "deleted"
)

// RecoveryStatus represents the status of a recovery execution.
type RecoveryStatus string

const (
	RecoveryStatusInitiated  RecoveryStatus = "initiated"
	RecoveryStatusInProgress RecoveryStatus = "in_progress"
	RecoveryStatusCompleted  RecoveryStatus = "completed"
	RecoveryStatusFailed     RecoveryStatus = "failed"
	RecoveryStatusRolledBack RecoveryStatus = "rolled_back"
)

// VerificationStatus represents the status of a backup verification.
type VerificationStatus string

const (
	VerificationStatusPending    VerificationStatus = "pending"
	VerificationStatusPassed     VerificationStatus = "passed"
	VerificationStatusFailed     VerificationStatus = "failed"
	VerificationStatusInProgress VerificationStatus = "in_progress"
)

// ==================== Backup Plan ====================

// BackupPlan represents a configured backup plan.
type BackupPlan struct {
	ID            string          `db:"id" json:"id"`
	TenantID      string          `db:"tenant_id" json:"tenant_id"`
	Name          string          `db:"name" json:"name"`
	Type          BackupType      `db:"type" json:"type"`
	Schedule      *string         `db:"schedule" json:"schedule,omitempty"` // cron expression
	RetentionDays int             `db:"retention_days" json:"retention_days"`
	Target        json.RawMessage `db:"target" json:"target"`
	StorageConfig json.RawMessage `db:"storage_config" json:"storage_config"`
	EncryptionKey *string         `db:"encryption_key" json:"encryption_key,omitempty"`
	Enabled       bool            `db:"enabled" json:"enabled"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateBackupPlanInput is the payload for creating a backup plan.
type CreateBackupPlanInput struct {
	TenantID      string          `json:"tenant_id"`
	Name          string          `json:"name" binding:"required"`
	Type          BackupType      `json:"type" binding:"required"`
	Schedule      string          `json:"schedule,omitempty"`
	RetentionDays int             `json:"retention_days"`
	Target        json.RawMessage `json:"target"`
	StorageConfig json.RawMessage `json:"storage_config"`
	EncryptionKey *string         `json:"encryption_key"`
	Enabled       bool            `json:"enabled"`
}

// UpdateBackupPlanInput is the payload for updating a backup plan.
type UpdateBackupPlanInput struct {
	Name          string          `json:"name,omitempty"`
	Type          BackupType      `json:"type,omitempty"`
	Schedule      string          `json:"schedule,omitempty"`
	RetentionDays *int            `json:"retention_days"`
	Target        json.RawMessage `json:"target"`
	StorageConfig json.RawMessage `json:"storage_config"`
	EncryptionKey *string         `json:"encryption_key"`
	Enabled       *bool           `json:"enabled"`
}

// ==================== Backup Record ====================

// BackupTarget is the concrete shape of the JSON stored in BackupPlan.Target.
// It is unmarshalled by the service before invoking an executor so the
// executor sees typed fields rather than an opaque json.RawMessage.
//
// Dialect selects which Executor is used (postgresql | mysql | oceanbase).
// TenantName is required for OceanBase MySQL-mode and ignored otherwise.
type BackupTarget struct {
	Dialect    string `json:"dialect" binding:"required"`
	Host       string `json:"host" binding:"required"`
	Port       string `json:"port"`
	DB         string `json:"db"`
	User       string `json:"user"`
	Password   string `json:"password"` // plaintext at rest is discouraged; prefer EncryptionKey in the plan
	SSLMode    string `json:"ssl_mode,omitempty"`
	TenantName string `json:"tenant_name,omitempty"`

	// Tables/Exclude are the table-level selection applied by the executor.
	Tables  []string `json:"tables,omitempty"`
	Exclude []string `json:"exclude_tables,omitempty"`
}

// BackupStorageConfig is the concrete shape of BackupPlan.StorageConfig.
// It controls where the final artifact is uploaded and how it is encrypted.
//
// Type is "local" | "s3" | "minio". PathTemplate supports {{plan_id}} and
// {{backup_id}} placeholders; the service fills them before calling Put.
type BackupStorageConfig struct {
	Type         string `json:"type"`                    // local | s3 | minio
	BasePath     string `json:"base_path,omitempty"`     // local only
	Endpoint     string `json:"endpoint,omitempty"`      // s3 only
	Region       string `json:"region,omitempty"`
	Bucket       string `json:"bucket,omitempty"`
	AccessKey    string `json:"access_key,omitempty"`
	SecretKey    string `json:"secret_key,omitempty"`
	UseSSL       bool   `json:"use_ssl,omitempty"`
	PathTemplate string `json:"path_template,omitempty"`
}

// BackupRecord represents a single backup execution record.
type BackupRecord struct {
	ID               string       `db:"id" json:"id"`
	TenantID         string       `db:"tenant_id" json:"tenant_id"`
	PlanID           string       `db:"plan_id" json:"plan_id"`
	Status           BackupStatus `db:"status" json:"status"`
	SizeBytes        int64        `db:"size_bytes" json:"size_bytes"`
	StoragePath      *string      `db:"storage_path" json:"storage_path"`
	Checksum         *string      `db:"checksum" json:"checksum"`
	CompressionRatio *float64     `db:"compression_ratio" json:"compression_ratio"`
	ErrorMessage     *string      `db:"error_message" json:"error_message"`
	StartedAt        time.Time    `db:"started_at" json:"started_at"`
	CompletedAt      *time.Time   `db:"completed_at" json:"completed_at"`
	CreatedAt        time.Time    `db:"created_at" json:"created_at"`
}

// CreateBackupInput is the payload for triggering a manual backup.
type CreateBackupInput struct {
	TenantID string `json:"tenant_id"`
	PlanID   string `json:"plan_id" binding:"required"`
}

// BackupFilter holds query parameters for listing backups.
type BackupFilter struct {
	PlanID string
	Status string
	Type   string
}

// ==================== Recovery Record ====================

// RecoveryRecord represents a recovery execution record. The PITR-related
// fields (PITRMode, WALArchivePath, BinlogArchivePath, ArchiveStart/End)
// are only populated when a recovery targets a specific point in time;
// full restores leave them nil.
type RecoveryRecord struct {
	ID                string          `db:"id" json:"id"`
	TenantID          string          `db:"tenant_id" json:"tenant_id"`
	PlanID            string          `db:"plan_id" json:"plan_id"`
	PlanName          string          `db:"plan_name" json:"plan_name"`
	BackupID          *string         `db:"backup_id" json:"backup_id"`
	Status            RecoveryStatus  `db:"status" json:"status"`
	TargetTime        *time.Time      `db:"target_time" json:"target_time,omitempty"`
	RtoTargetMs       int64           `db:"rto_target_ms" json:"rto_target_ms"`
	RpoTargetMs       int64           `db:"rpo_target_ms" json:"rpo_target_ms"`
	ActualRtoMs       *int64          `db:"actual_rto_ms" json:"actual_rto_ms"`
	ActualRpoMs       *int64          `db:"actual_rpo_ms" json:"actual_rpo_ms"`
	RtoMet            *bool           `db:"rto_met" json:"rto_met"`
	RpoMet            *bool           `db:"rpo_met" json:"rpo_met"`
	StepExecutions    json.RawMessage `db:"step_executions" json:"step_executions"`
	ErrorMessage      *string         `db:"error_message" json:"error_message,omitempty"`
	// PITR fields (added by migration 055).
	PITRMode        *string    `db:"pitr_mode" json:"pitr_mode,omitempty"`             // "wal" | "binlog" | "" (full restore)
	WALArchivePath  *string    `db:"wal_archive_path" json:"wal_archive_path,omitempty"`
	BinlogArchivePath *string  `db:"binlog_archive_path" json:"binlog_archive_path,omitempty"`
	ArchiveStart    *time.Time `db:"archive_start" json:"archive_start,omitempty"`
	ArchiveEnd      *time.Time `db:"archive_end" json:"archive_end,omitempty"`
	InitiatedAt     time.Time  `db:"initiated_at" json:"initiated_at"`
	CompletedAt     *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}

// CreateRecoveryInput is the payload for initiating a recovery.
type CreateRecoveryInput struct {
	TenantID   string     `json:"tenant_id"`
	PlanID     string     `json:"plan_id" binding:"required"`
	BackupID   *string    `json:"backup_id"`
	TargetTime *time.Time `json:"target_time"`
}

// ==================== Backup Storage ====================

// ArchiveStatus is the lifecycle state of an archive record.
type ArchiveStatus string

const (
	ArchiveStatusPending ArchiveStatus = "pending"
	ArchiveStatusRunning ArchiveStatus = "running"
	ArchiveStatusCompleted ArchiveStatus = "completed"
	ArchiveStatusFailed  ArchiveStatus = "failed"
)

// ArchiveType is the kind of transaction log being archived.
type ArchiveType string

const (
	ArchiveTypeWAL        ArchiveType = "wal"        // PostgreSQL Write-Ahead Log
	ArchiveTypeBinlog     ArchiveType = "binlog"     // MySQL binary log
	ArchiveTypeArchivelog ArchiveType = "archivelog" // Oracle archivelog
	ArchiveTypeRedolog    ArchiveType = "redolog"    // DB2 redo log
	ArchiveTypeLogBackup  ArchiveType = "log_backup" // SQL Server transaction log backup
	ArchiveTypeClog       ArchiveType = "clog"       // OceanBase clog
)

// ArchiveRecord tracks a single WAL/binlog archive window. Phase 1a creates
// the schema and lifecycle fields; the actual capture logic lands in
// Phase 2 alongside the redo-stream collector.
type ArchiveRecord struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	PlanID      string    `db:"plan_id" json:"plan_id"`
	BackupID    *string   `db:"backup_id" json:"backup_id"`
	ArchiveType ArchiveType `db:"archive_type" json:"archive_type"`
	WindowStart time.Time `db:"window_start" json:"window_start"`
	WindowEnd   *time.Time `db:"window_end" json:"window_end,omitempty"`
	SizeBytes   int64     `db:"size_bytes" json:"size_bytes"`
	Path        string    `db:"path" json:"path"`
	Checksum    *string   `db:"checksum" json:"checksum,omitempty"`
	Status      ArchiveStatus `db:"status" json:"status"`
	ErrorMessage *string  `db:"error_message" json:"error_message,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// BackupStorage represents storage information for a backup.
type BackupStorage struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	StorageType     string    `db:"storage_type" json:"storage_type"`
	BasePath        string    `db:"base_path" json:"base_path"`
	MaxStorageBytes int64     `db:"max_storage_bytes" json:"max_storage_bytes"`
	UsedBytes       int64     `db:"used_bytes" json:"used_bytes"`
	FileCount       int       `db:"file_count" json:"file_count"`
	Enabled         bool      `db:"enabled" json:"enabled"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// ==================== Verification Result ====================

// VerificationResult represents a backup verification result.
type VerificationResult struct {
	ID               string             `db:"id" json:"id"`
	TenantID         string             `db:"tenant_id" json:"tenant_id"`
	BackupID         string             `db:"backup_id" json:"backup_id"`
	Status           VerificationStatus `db:"status" json:"status"`
	IntegrityCheck   bool               `db:"integrity_check" json:"integrity_check"`
	IntegrityDetails *string            `db:"integrity_details" json:"integrity_details"`
	RestoreTest      bool               `db:"restore_test" json:"restore_test"`
	RestoreDetails   *string            `db:"restore_details" json:"restore_details"`
	ErrorMessage     *string            `db:"error_message" json:"error_message"`
	VerifiedAt       *time.Time         `db:"verified_at" json:"verified_at"`
	StartedAt        time.Time          `db:"started_at" json:"started_at"`
}

// ==================== Pagination ====================

// PaginatedRequest is a generic pagination helper.
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

// PaginatedResult wraps a paginated response.
type PaginatedResult struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}
