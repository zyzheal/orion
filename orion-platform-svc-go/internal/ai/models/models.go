package models

import "time"

// AIModel is the core domain model persisted in PostgreSQL.
type AIModel struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Type      string    `db:"type" json:"type"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// CreateAIModelRequest is the input for creating a new AI model.
type CreateAIModelRequest struct {
	Name string `json:"name" binding:"required"`
	Type string `json:"type" binding:"required"`
}

// ListFilter carries optional filter criteria for listing AI models.
type ListFilter struct {
	Type *string
}
