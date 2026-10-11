package models

import "time"

// Ticket's db tags name 076_create_ticketing_tables.sql's columns, not the
// historical ones this struct was written against. The API contract (json tags)
// is unchanged; only the storage names moved:
//
//	Type       -> category      (076 has category VARCHAR(100), no type column)
//	CreatedBy  -> reporter_id   (076's reporter_id VARCHAR(255) NOT NULL is the
//	                             reporter of the ticket, which is who the
//	                             create request names; 572's created_by is
//	                             UUID REFERENCES users(id) and would reject a
//	                             non-UUID string in the driver)
//	AssignedTo -> assignee_id   (076 has assignee_id VARCHAR(255), no
//	                             assigned_to column)
// Ticket.Source / SourceID 已由 076 DDL 定义（VARCHAR 100/255），本迁移仅做模型暴露。
// Ticket.AlertSeverity 由 Migration 705 引入，独立于 Type / Category 的严重度语义解耦。
type Ticket struct {
	ID            string     `json:"id" db:"id"`
	TenantID      string     `json:"tenant_id" db:"tenant_id"`
	Title         string     `json:"title" db:"title"`
	Description   string     `json:"description" db:"description"`
	Type          string     `json:"type" db:"category"`
	Priority      string     `json:"priority" db:"priority"`
	Status        string     `json:"status" db:"status"`
	Source        string     `json:"source,omitempty" db:"source"`
	SourceID      string     `json:"source_id,omitempty" db:"source_id"`
	AlertSeverity string     `json:"alert_severity,omitempty" db:"alert_severity"`
	CreatedBy     string     `json:"created_by" db:"reporter_id"`
	AssignedTo    string     `json:"assigned_to" db:"assignee_id"`
	ResolvedAt    *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	ClosedAt      *time.Time `json:"closed_at,omitempty" db:"closed_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// TicketComment 存储工单评论。TenantID 由 Migration 704 引入（ADR-011 多租户隔离）：
// nullable，回填自 tickets.tenant_id；repository 查询时用它做 WHERE tenant_id = $N
// 过滤，与 tickets 表租户对齐。旧行 tenant_id 为空的场景由 repository 兼容路径处理。
type TicketComment struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id,omitempty" db:"tenant_id"`
	TicketID   string    `json:"ticket_id" db:"ticket_id"`
	Author     string    `json:"author" db:"author"`
	Content    string    `json:"content" db:"content"`
	IsInternal bool      `json:"is_internal" db:"is_internal"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type TicketAttachment struct {
	ID         string    `json:"id" db:"id"`
	TicketID   string    `json:"ticket_id" db:"ticket_id"`
	FileName   string    `json:"file_name" db:"file_name"`
	FilePath   string    `json:"file_path" db:"file_path"`
	FileSize   int64     `json:"file_size" db:"file_size"`
	UploadedBy string    `json:"uploaded_by" db:"uploaded_by"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type AssignRequest struct {
	AssignedTo string `json:"assigned_to" binding:"required"`
}

// CreateTicketRequest 接受 Source / AlertSeverity（P1-2 语义解耦）：
//   - Source: alert_auto / sla_breach / manual / inspection / change / api / webhook / email / chatops / other
//   - AlertSeverity: P0 / P1 / P2 / P3 / P4（仅 alert 来源使用）
// 老客户端不传 source 时后端会默认 "manual"。
type CreateTicketRequest struct {
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description"`
	Type          string `json:"type"`
	Priority      string `json:"priority"`
	Source        string `json:"source,omitempty"`
	SourceID      string `json:"source_id,omitempty"`
	AlertSeverity string `json:"alert_severity,omitempty"`
}

type CreateCommentRequest struct {
	Author     string `json:"author" binding:"required"`
	Content    string `json:"content" binding:"required"`
	IsInternal bool   `json:"is_internal"`
}

type ListQuery struct {
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"page_size,default=20"`
	Status   string `form:"status"`
	Type     string `form:"type"`
	Priority string `form:"priority"`
}
