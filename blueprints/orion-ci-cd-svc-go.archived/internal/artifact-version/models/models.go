package models

import "time"

// ArtifactVersion represents a version of an artifact.
type ArtifactVersion struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	ArtifactID     string    `json:"artifact_id" db:"artifact_id"`
	Version        string    `json:"version" db:"version"`
	BuildNumber    int       `json:"build_number" db:"build_number"`
	Checksum       string    `json:"checksum" db:"checksum"`
	Size           int64     `json:"size" db:"size"`
	StoragePath    string    `json:"storage_path" db:"storage_path"`
	Status         string    `json:"status" db:"status"` // published, deprecated, archived
	Metadata       string    `json:"metadata" db:"metadata"`
	BuildJobID     string    `json:"build_job_id" db:"build_job_id"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	DeprecatedAt   *time.Time `json:"deprecated_at" db:"deprecated_at"`
}

// CreateVersionRequest for creating an artifact version.
type CreateVersionRequest struct {
	ArtifactID  string                 `json:"artifact_id" binding:"required"`
	Version     string                 `json:"version" binding:"required"`
	BuildNumber int                    `json:"build_number"`
	Checksum    string                 `json:"checksum"`
	Size        int64                  `json:"size"`
	StoragePath string                 `json:"storage_path"`
	Metadata    map[string]interface{} `json:"metadata"`
	BuildJobID  string                 `json:"build_job_id"`
}

// VersionResponse wraps version query results.
type VersionResponse struct {
	Total int64            `json:"total"`
	Data  []ArtifactVersion `json:"data"`
}
