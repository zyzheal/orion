package scheduler

import (
	"time"
)

// JobStatus represents the status of a cron job
type JobStatus string

const (
	JobStatusActive   JobStatus = "ACTIVE"
	JobStatusPaused   JobStatus = "PAUSED"
	JobStatusDisabled JobStatus = "DISABLED"
)

// CronJob represents a scheduled job
type CronJob struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	TenantID    int64     `json:"tenant_id" gorm:"index"`
	UserID      string    `json:"user_id" gorm:"index"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Command     string    `json:"command"`
	Schedule    string    `json:"schedule"` // cron expression
	Status      JobStatus `json:"status" gorm:"default:ACTIVE"`
	HostIDs     string    `json:"host_ids"` // JSON array of host IDs
	Timeout     int       `json:"timeout"`  // timeout in seconds
	LastRunAt   *time.Time `json:"last_run_at"`
	NextRunAt   *time.Time `json:"next_run_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// JobSchedule represents the scheduling configuration
type JobSchedule struct {
	CronExpr string
	Interval time.Duration
}