package models

import "time"

type Deployment struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Environment string     `db:"environment" json:"environment"`
	ServiceName string     `db:"service_name" json:"service_name"`
	Version     string     `db:"version" json:"version"`
	ImageTag    string     `db:"image_tag" json:"image_tag"`
	Status      string     `db:"status" json:"status"`
	DeployedBy  string     `db:"deployed_by" json:"deployed_by"`
	RollbackTo  *string    `db:"rollback_to" json:"rollback_to,omitempty"`
	DeployedAt  *time.Time `db:"deployed_at" json:"deployed_at,omitempty"`
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
