package models

import "time"

// Team represents a team entity
type Team struct {
	ID           string                 `json:"id" db:"id"`
	TenantID     string                 `json:"tenant_id" db:"tenant_id"`
	Name         string                 `json:"name" db:"name"`
	Slug         string                 `json:"slug" db:"slug"`
	Description  *string                `json:"description" db:"description"`
	TeamType     string                 `json:"team_type" db:"team_type"`
	ParentTeamID *string                `json:"parent_team_id" db:"parent_team_id"`
	ExternalID   *string                `json:"external_id" db:"external_id"`
	Metadata     map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
	CreatedBy    *string                `json:"created_by" db:"created_by"`
}

// TeamMember represents a team membership
type TeamMember struct {
	ID       string `json:"id" db:"id"`
	TeamID   string `json:"team_id" db:"team_id"`
	UserID   string `json:"user_id" db:"user_id"`
	Role     string `json:"role" db:"role"`
	JoinedAt time.Time `json:"joined_at" db:"joined_at"`
	AddedBy  *string `json:"added_by" db:"added_by"`
}

// TeamRole represents a team role assignment
type TeamRole struct {
	ID        string    `json:"id" db:"id"`
	TeamID    string    `json:"team_id" db:"team_id"`
	RoleName  string    `json:"role_name" db:"role_name"`
	GrantedAt time.Time `json:"granted_at" db:"granted_at"`
	GrantedBy *string   `json:"granted_by" db:"granted_by"`
}

// CreateTeamRequest represents the request body for creating a team
type CreateTeamRequest struct {
	Name         string                 `json:"name" binding:"required"`
	Slug         string                 `json:"slug" binding:"required"`
	Description  *string                `json:"description"`
	TeamType     *string                `json:"team_type"`
	ParentTeamID *string                `json:"parent_team_id"`
	ExternalID   *string                `json:"external_id"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// UpdateTeamRequest represents the request body for updating a team
type UpdateTeamRequest struct {
	Name         *string                `json:"name"`
	Description  *string                `json:"description"`
	TeamType     *string                `json:"team_type"`
	ParentTeamID *string                `json:"parent_team_id"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// AddMemberRequest represents the request body for adding a member to a team
type AddMemberRequest struct {
	UserID string `json:"userId" binding:"required"`
	Role   *string `json:"role"`
}

// UpdateMemberRoleRequest represents the request body for updating a member's role
type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// AssignRoleRequest represents the request body for assigning a role to a team
type AssignRoleRequest struct {
	RoleName string `json:"roleName" binding:"required"`
}
