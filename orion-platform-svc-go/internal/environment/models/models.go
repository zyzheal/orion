package models

import (
	"errors"
	"time"
)

var ErrEnvironmentNotFound = errors.New("environment not found")

type Environment struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	ProjectID   string    `db:"project_id" json:"project_id"`
	Status      string    `db:"status" json:"status"`
	Locked      bool      `db:"locked" json:"locked"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	UpdatedBy   string    `db:"updated_by" json:"updated_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateEnvironmentRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ProjectID   string `json:"project_id"`
}

type UpdateEnvironmentRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}