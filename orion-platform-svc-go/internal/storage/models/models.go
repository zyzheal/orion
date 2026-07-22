package models

import "time"

// ObjectStorageProvider is the interface that all object storage backends implement.
type ObjectStorageProvider interface {
	// Put uploads an object to the given bucket and key.
	Put(bucket string, key string, data []byte) error
	// Get downloads an object from the given bucket and key.
	Get(bucket string, key string) ([]byte, error)
	// Delete removes an object from the given bucket and key.
	Delete(bucket string, key string) error
	// List returns all object keys under the given prefix.
	List(bucket string, prefix string) ([]string, error)
}

// StorageConfig holds common configuration for object storage providers.
type StorageConfig struct {
	Endpoint  string `json:"endpoint"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	UseSSL    bool   `json:"useSSL"`
	Region    string `json:"region"`
	// LocalPath is used by FilesystemProvider for local disk storage.
	LocalPath string `json:"localPath"`
}

// StorageEntry represents a persistent metadata record for an object.
type StorageEntry struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenantId"`
	Bucket     string    `db:"bucket" json:"bucket"`
	Key        string    `db:"key" json:"key"`
	Size       int64     `db:"size" json:"size"`
	Provider   string    `db:"provider" json:"provider"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt  time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateStorageRequest is the request body for creating a storage entry.
type CreateStorageRequest struct {
	Bucket   string `json:"bucket" binding:"required"`
	Key      string `json:"key" binding:"required"`
	Provider string `json:"provider" binding:"required"`
}

// UpdateStorageRequest is the request body for updating a storage entry.
type UpdateStorageRequest struct {
	Key *string `json:"key"`
}
