package models

import "time"

// FileRecord represents a persistent metadata record for a managed file.
type FileRecord struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenantId"`
	Name         string    `db:"name" json:"name"`
	OriginalName string    `db:"original_name" json:"originalName"`
	Type         string    `db:"type" json:"type"`          // MIME type
	Extension    string    `db:"extension" json:"extension"` // ".pdf", ".jpg", ".go"
	Size         int64     `db:"size" json:"size"`
	StorageType  string    `db:"storage_type" json:"storageType"` // "local", "s3", "minio", "azure", "gcs", "nfs"
	StoragePath  string    `db:"storage_path" json:"storagePath"`
	Bucket       string    `db:"bucket" json:"bucket"`
	Category     string    `db:"category" json:"category"` // "document", "image", "archive", "media", "code", "config"
	Owner        string    `db:"owner" json:"owner"`
	Visibility   string    `db:"visibility" json:"visibility"` // "public", "private", "team"
	Tags         string    `db:"tags" json:"tags"`           // JSON array
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

// StorageBackend holds configuration for a storage backend.
type StorageBackend struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	Type      string    `db:"type" json:"type"`     // "local", "s3", "minio", "azure_blob", "gcs"
	Config    string    `db:"config" json:"config"` // JSON: endpoint, access_key, secret_key, bucket, region
	Enabled   bool      `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// UploadRequest is the file upload payload metadata (body is multipart).
type UploadRequest struct {
	StorageType string `json:"storageType" binding:"required"`
	Bucket      string `json:"bucket" binding:"required"`
	Category    string `json:"category"`
	Visibility  string `json:"visibility"`
	Tags        string `json:"tags"`
}

// MoveRequest moves/renames a file record.
type MoveRequest struct {
	Name     *string `json:"name"`
	Bucket   *string `json:"bucket"`
	Category *string `json:"category"`
}

// CreateBackendRequest creates a new storage backend.
type CreateBackendRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Config string `json:"config"`
	Enabled bool  `json:"enabled"`
}

// ValidateRequest validates whether a file extension + content is allowed.
type ValidateRequest struct {
	Extension string `json:"extension" binding:"required"`
}
