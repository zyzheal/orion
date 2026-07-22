package models

import "time"

// ScheduledNotification represents a scheduled notification plan.
type ScheduledNotification struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	UserID         string     `db:"user_id" json:"userId"`
	Name           string     `db:"name" json:"name"`
	Title          string     `db:"title" json:"title"`
	Body           string     `db:"body" json:"body"`
	Channel        string     `db:"channel" json:"channel"`
	Status         string     `db:"status" json:"status"`
	CronExpression string     `db:"cron_expression" json:"cronExpression"`
	Recipients     string     `db:"recipients" json:"recipients"`
	Metadata       string     `db:"metadata" json:"metadata"`
	StartDate      *time.Time `db:"start_date" json:"startDate"`
	EndDate        *time.Time `db:"end_date" json:"endDate"`
	LastRunAt      *time.Time `db:"last_run_at" json:"lastRunAt"`
	NextRunAt      *time.Time `db:"next_run_at" json:"nextRunAt"`
	MaxRetries     int        `db:"max_retries" json:"maxRetries"`
	RetryCount     int        `db:"retry_count" json:"retryCount"`
	Enabled        bool       `db:"enabled" json:"enabled"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateScheduleRequest is the request body for creating a scheduled notification.
type CreateScheduleRequest struct {
	Name           string     `json:"name" binding:"required"`
	Title          string     `json:"title" binding:"required"`
	Body           string     `json:"body" binding:"required"`
	Channel        string     `json:"channel" binding:"required"`
	CronExpression string     `json:"cronExpression" binding:"required"`
	Recipients     string     `json:"recipients"`
	Metadata       string     `json:"metadata"`
	StartDate      *time.Time `json:"startDate"`
	EndDate        *time.Time `json:"endDate"`
	MaxRetries     int        `json:"maxRetries"`
	Enabled        bool       `json:"enabled"`
}

// UpdateScheduleRequest is the request body for updating a scheduled notification.
type UpdateScheduleRequest struct {
	Name           *string    `json:"name"`
	Title          *string    `json:"title"`
	Body           *string    `json:"body"`
	Channel        *string    `json:"channel"`
	CronExpression *string    `json:"cronExpression"`
	Recipients     *string    `json:"recipients"`
	Metadata       *string    `json:"metadata"`
	StartDate      *time.Time `json:"startDate"`
	EndDate        *time.Time `json:"endDate"`
	MaxRetries     *int       `json:"maxRetries"`
	Enabled        *bool      `json:"enabled"`
}

// ListFilter represents optional filters for listing scheduled notifications.
type ListFilter struct {
	Channel *string `json:"channel"`
	Status  *string `json:"status"`
	Enabled *bool   `json:"enabled"`
}

// ExecutionLog represents a single execution record for a scheduled notification.
type ExecutionLog struct {
	ID           string    `db:"id" json:"id"`
	ScheduleID   string    `db:"schedule_id" json:"scheduleId"`
	Status       string    `db:"status" json:"status"`
	ErrorMessage string    `db:"error_message" json:"errorMessage"`
	StartedAt    time.Time `db:"started_at" json:"startedAt"`
	CompletedAt  time.Time `db:"completed_at" json:"completedAt"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
