package models

import "time"

type Pipeline struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	RepoID         *string   `db:"repo_id" json:"repo_id,omitempty"`
	Branch         string    `db:"branch" json:"branch"`
	TriggerType    string    `db:"trigger_type" json:"trigger_type"`
	CronExpression *string   `db:"cron_expression" json:"cron_expression,omitempty"`
	YAMLConfig     string    `db:"yaml_config" json:"yaml_config"`
	Status         string    `db:"status" json:"status"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
	DeletedAt      *time.Time `db:"deleted_at" json:"-"`
}

type PipelineRun struct {
	ID          string     `db:"id" json:"id"`
	PipelineID  string     `db:"pipeline_id" json:"pipeline_id"`
	TriggerType string     `db:"trigger_type" json:"trigger_type"`
	TriggerBy   string     `db:"trigger_by" json:"trigger_by"`
	Status      string     `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Context     *string    `db:"context" json:"context,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

type PipelineStage struct {
	ID          string     `db:"id" json:"id"`
	RunID       string     `db:"run_id" json:"run_id"`
	Name        string     `db:"name" json:"name"`
	Status      string     `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Logs        *string    `db:"logs" json:"logs,omitempty"`
}

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
