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
	VerificationStatusPending     VerificationStatus = "pending"
	VerificationStatusPassed      VerificationStatus = "passed"
	VerificationStatusFailed      VerificationStatus = "failed"
	VerificationStatusInProgress  VerificationStatus = "in_progress"
)

// ==================== Backup Plan ====================

// BackupPlan represents a configured backup plan.
type BackupPlan struct {
	ID           string          `db:"id" json:"id"`
	TenantID     string          `db:"tenant_id" json:"tenant_id"`
	Name         string          `db:"name" json:"name"`
	Type         BackupType      `db:"type" json:"type"`
	Schedule     *string         `db:"schedule" json:"schedule,omitempty"` // cron expression
	RetentionDays int            `db:"retention_days" json:"retention_days"`
	Target       json.RawMessage `db:"target" json:"target"`
	StorageConfig json.RawMessage `db:"storage_config" json:"storage_config"`
	EncryptionKey *string         `db:"encryption_key" json:"encryption_key,omitempty"`
	Enabled      bool            `db:"enabled" json:"enabled"`
	CreatedAt    time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updated_at"`
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

// BackupRecord represents a single backup execution record.
type BackupRecord struct {
	ID            string         `db:"id" json:"id"`
	TenantID      string         `db:"tenant_id" json:"tenant_id"`
	PlanID        string         `db:"plan_id" json:"plan_id"`
	Status        BackupStatus   `db:"status" json:"status"`
	SizeBytes     int64          `db:"size_bytes" json:"size_bytes"`
	StoragePath   *string        `db:"storage_path" json:"storage_path"`
	Checksum      *string        `db:"checksum" json:"checksum"`
	CompressionRatio *float64     `db:"compression_ratio" json:"compression_ratio"`
	ErrorMessage  *string        `db:"error_message" json:"error_message"`
	StartedAt     time.Time      `db:"started_at" json:"started_at"`
	CompletedAt   *time.Time     `db:"completed_at" json:"completed_at"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
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

// RecoveryRecord represents a recovery execution record.
type RecoveryRecord struct {
	ID            string          `db:"id" json:"id"`
	TenantID      string          `db:"tenant_id" json:"tenant_id"`
	PlanID        string          `db:"plan_id" json:"plan_id"`
	PlanName      string          `db:"plan_name" json:"plan_name"`
	BackupID      *string         `db:"backup_id" json:"backup_id"`
	Status        RecoveryStatus  `db:"status" json:"status"`
	TargetTime    *time.Time      `db:"target_time" json:"target_time,omitempty"`
	RtoTargetMs   int64           `db:"rto_target_ms" json:"rto_target_ms"`
	RpoTargetMs   int64           `db:"rpo_target_ms" json:"rpo_target_ms"`
	ActualRtoMs   *int64          `db:"actual_rto_ms" json:"actual_rto_ms"`
	ActualRpoMs   *int64          `db:"actual_rpo_ms" json:"actual_rpo_ms"`
	RtoMet        *bool           `db:"rto_met" json:"rto_met"`
	RpoMet        *bool           `db:"rpo_met" json:"rpo_met"`
	StepExecutions json.RawMessage `db:"step_executions" json:"step_executions"`
	ErrorMessage  *string         `db:"error_message" json:"error_message,omitempty"`
	InitiatedAt   time.Time       `db:"initiated_at" json:"initiated_at"`
	CompletedAt   *time.Time      `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt     time.Time       `db:"created_at" json:"created_at"`
}

// CreateRecoveryInput is the payload for initiating a recovery.
type CreateRecoveryInput struct {
	TenantID string     `json:"tenant_id"`
	PlanID   string     `json:"plan_id" binding:"required"`
	BackupID *string    `json:"backup_id"`
	TargetTime *time.Time `json:"target_time"`
}

// ==================== Backup Storage ====================

// BackupStorage represents storage information for a backup.
type BackupStorage struct {
	ID              string   `db:"id" json:"id"`
	TenantID        string   `db:"tenant_id" json:"tenant_id"`
	StorageType     string   `db:"storage_type" json:"storage_type"`
	BasePath        string   `db:"base_path" json:"base_path"`
	MaxStorageBytes int64    `db:"max_storage_bytes" json:"max_storage_bytes"`
	UsedBytes       int64    `db:"used_bytes" json:"used_bytes"`
	FileCount       int      `db:"file_count" json:"file_count"`
	Enabled         bool     `db:"enabled" json:"enabled"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// ==================== Verification Result ====================

// VerificationResult represents a backup verification result.
type VerificationResult struct {
	ID              string              `db:"id" json:"id"`
	TenantID        string              `db:"tenant_id" json:"tenant_id"`
	BackupID        string              `db:"backup_id" json:"backup_id"`
	Status          VerificationStatus  `db:"status" json:"status"`
	IntegrityCheck  bool                `db:"integrity_check" json:"integrity_check"`
	IntegrityDetails *string            `db:"integrity_details" json:"integrity_details"`
	RestoreTest     bool                `db:"restore_test" json:"restore_test"`
	RestoreDetails  *string             `db:"restore_details" json:"restore_details"`
	ErrorMessage    *string             `db:"error_message" json:"error_message"`
	VerifiedAt      *time.Time          `db:"verified_at" json:"verified_at"`
	StartedAt       time.Time           `db:"started_at" json:"started_at"`
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
