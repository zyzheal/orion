package models

import "time"

// BackupPlan represents a backup policy/plan.
type BackupPlan struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenantId"`
	Name         string     `db:"name" json:"name"`
	Schedule     *string    `db:"schedule" json:"schedule"`
	RetentionDays int       `db:"retention_days" json:"retentionDays"`
	Sources      string     `db:"sources" json:"sources"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateBackupPlanRequest is the request body for creating a backup plan.
type CreateBackupPlanRequest struct {
	Name         string  `json:"name" binding:"required"`
	Schedule     *string `json:"schedule"`
	RetentionDays *int   `json:"retentionDays"`
	Sources      *string `json:"sources"`
}

// UpdateBackupPlanRequest is the request body for updating a backup plan.
type UpdateBackupPlanRequest struct {
	Name         *string `json:"name"`
	Schedule     *string `json:"schedule"`
	RetentionDays *int   `json:"retentionDays"`
	Sources      *string `json:"sources"`
}

// RecoveryPlan represents a recovery plan.
type RecoveryPlan struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	Name        string    `db:"name" json:"name"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRecoveryPlanRequest is the request body for creating a recovery plan.
type CreateRecoveryPlanRequest struct {
	Name   string  `json:"name" binding:"required"`
	Status *string `json:"status"`
}

// UpdateRecoveryPlanRequest is the request body for updating a recovery plan.
type UpdateRecoveryPlanRequest struct {
	Name   *string `json:"name"`
	Status *string `json:"status"`
}

// BackupJob represents a backup execution job.
type BackupJob struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Type        string     `db:"type" json:"type"`
	Source      *string    `db:"source" json:"source"`
	Status      string     `db:"status" json:"status"`
	Progress    *float64   `db:"progress" json:"progress"`
	StartedAt   *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time `db:"completed_at" json:"completedAt"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`
}

// Restore represents a restore operation.
type Restore struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	BackupJobID string     `db:"backup_job_id" json:"backupJobId"`
	Status      string     `db:"status" json:"status"`
	RestoredAt  *time.Time `db:"restored_at" json:"restoredAt"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
