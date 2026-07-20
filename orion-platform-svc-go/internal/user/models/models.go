package models

import "time"

// User represents a user entity
type User struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Username  string    `json:"username" db:"username"`
	Email     string    `json:"email" db:"email"`
	FullName  string    `json:"full_name" db:"full_name"`
	Role      string    `json:"role" db:"role"`
	Status    string    `json:"status" db:"status"`
	AvatarURL string    `json:"avatar_url" db:"avatar_url"`
	Settings  string    `json:"settings" db:"settings"`
	Password  string    `json:"-" db:"password"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateUserRequest for creating a user
type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

// UpdateUserRequest for updating a user
type UpdateUserRequest struct {
	FullName  *string `json:"full_name"`
	Email     *string `json:"email"`
	Role      *string `json:"role"`
	Status    *string `json:"status"`
	AvatarURL *string `json:"avatar_url"`
	Settings  *string `json:"settings"`
}

// AuthenticateRequest for user login
type AuthenticateRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordRequest for changing password
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// UserTenant represents user-tenant membership
type UserTenant struct {
	UserID    string    `json:"user_id" db:"user_id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Role      string    `json:"role" db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// PaginatedResponse for list endpoints
type PaginatedResponse struct {
	Data     []User `json:"data"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// GetUserFilters for filtered user lookup
type GetUserFilters struct {
	Username *string `json:"username"`
	Email    *string `json:"email"`
	FullName *string `json:"full_name"`
	Role     *string `json:"role"`
	Status   *string `json:"status"`
}
