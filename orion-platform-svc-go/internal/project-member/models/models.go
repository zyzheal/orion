package models

import "time"

// ProjectMember represents a user's membership in a project.
type ProjectMember struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	ProjectID   string    `json:"project_id" db:"project_id"`
	UserID      string    `json:"user_id" db:"user_id"`
	Role        string    `json:"role" db:"role"`        // "owner"|"admin"|"developer"|"viewer"
	Permissions []string  `json:"permissions" db:"permissions"`
	Status      string    `json:"status" db:"status"`     // "active"|"invited"|"left"
	InvitedBy   string    `json:"invited_by" db:"invited_by"`
	InvitedAt   time.Time `json:"invited_at" db:"invited_at"`
	JoinedAt    time.Time `json:"joined_at" db:"joined_at"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// CreateProjectMemberRequest creates a new project membership.
type CreateProjectMemberRequest struct {
	ProjectID   string   `json:"project_id" binding:"required"`
	UserID      string   `json:"user_id" binding:"required"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	InvitedBy   string   `json:"invited_by"`
}

// UpdateProjectMemberRequest updates a member's role or status.
type UpdateProjectMemberRequest struct {
	Role        *string   `json:"role"`
	Status      *string   `json:"status"`
	Permissions []string  `json:"permissions"`
}

// ListMembersQuery filters project member records.
type ListMembersQuery struct {
	ProjectID  string `json:"project_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
	Status     string `json:"status"`
	Limit      *int   `json:"limit"`
	Offset     *int   `json:"offset"`
}
