package models

import "time"

// BuilderImage represents a builder image record
type BuilderImage struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Registry  string    `db:"registry" json:"registry"`
	Tag       string    `db:"tag" json:"tag"`
	BaseImage string    `db:"base_image" json:"base_image"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// CreateBuilderImageRequest represents a request to create a builder image
type CreateBuilderImageRequest struct {
	Name      string `db:"-" json:"name" binding:"required"`
	Registry  string `db:"-" json:"registry" binding:"required"`
	Tag       string `db:"-" json:"tag" binding:"required"`
	BaseImage string `db:"-" json:"base_image" binding:"required"`
}

// UpdateBuilderImageRequest represents a request to update a builder image
type UpdateBuilderImageRequest struct {
	Name      *string `db:"-" json:"name"`
	Registry  *string `db:"-" json:"registry"`
	Tag       *string `db:"-" json:"tag"`
	BaseImage *string `db:"-" json:"base_image"`
	Status    *string `db:"-" json:"status"`
}
