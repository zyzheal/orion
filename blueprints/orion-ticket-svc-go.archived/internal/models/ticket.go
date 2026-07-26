package models

import "time"

type Ticket struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Title       string     `json:"title" db:"title"`
	Description string     `json:"description" db:"description"`
	Type        string     `json:"type" db:"type"`
	Priority    string     `json:"priority" db:"priority"`
	Status      string     `json:"status" db:"status"`
	CreatedBy   string     `json:"created_by" db:"created_by"`
	AssignedTo  string     `json:"assigned_to" db:"assigned_to"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
	ClosedAt    *time.Time `json:"closed_at,omitempty" db:"closed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

type TicketComment struct {
	ID        string    `json:"id" db:"id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	Author    string    `json:"author" db:"author"`
	Content   string    `json:"content" db:"content"`
	IsInternal bool     `json:"is_internal" db:"is_internal"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
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

type CreateTicketRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Priority    string `json:"priority"`
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
