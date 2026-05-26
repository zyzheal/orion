package models

import "time"

type Build struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	RepoID      *string    `db:"repo_id" json:"repo_id,omitempty"`
	Branch      string     `db:"branch" json:"branch"`
	CommitSHA   string     `db:"commit_sha" json:"commit_sha"`
	Status      string     `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Logs        *string    `db:"logs" json:"logs,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
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
