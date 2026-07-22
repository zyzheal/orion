package models

import "time"

// ArtifactStatus represents the lifecycle status of an artifact.
type ArtifactStatus string

const (
	StatusUploading  ArtifactStatus = "UPLOADING"
	StatusAvailable  ArtifactStatus = "AVAILABLE"
	StatusDeprecated ArtifactStatus = "DEPRECATED"
	StatusDeleted    ArtifactStatus = "DELETED"
	StatusQuarantined ArtifactStatus = "QUARANTINED"
)

// ArtifactType represents the type of artifact.
type ArtifactType string

const (
	TypeDockerImage     ArtifactType = "DOCKER_IMAGE"
	TypeHelmChart       ArtifactType = "HELM_CHART"
	TypeFunctionPackage ArtifactType = "FUNCTION_PACKAGE"
	TypeModelFile       ArtifactType = "MODEL_FILE"
	TypePluginPackage   ArtifactType = "PLUGIN_PACKAGE"
	TypeConfigFile      ArtifactType = "CONFIG_FILE"
	TypeBuildOutput     ArtifactType = "BUILD_OUTPUT"
	TypeTestReport      ArtifactType = "TEST_REPORT"
)

// Artifact is the core artifact record.
type Artifact struct {
	ID            string          `json:"id" db:"id"`
	TenantID      string          `json:"tenant_id" db:"tenant_id"`
	Name          string          `json:"name" db:"name"`
	Namespace     string          `json:"namespace" db:"namespace"`
	Version       string          `json:"version" db:"version"`
	Type          ArtifactType    `json:"type" db:"type"`
	Status        ArtifactStatus  `json:"status" db:"status"`
	SizeBytes     int64           `json:"size_bytes" db:"size_bytes"`
	ChecksumSha256 *string        `json:"checksum_sha256,omitempty" db:"checksum_sha256"`
	ChecksumSha512 *string        `json:"checksum_sha512,omitempty" db:"checksum_sha512"`
	Metadata      string          `json:"metadata" db:"metadata"`       // JSON
	StoragePath   string          `json:"storage_path" db:"storage_path"`
	CreatedBy     string          `json:"created_by" db:"created_by"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at" db:"updated_at"`
	DeletedAt     *time.Time      `json:"deleted_at,omitempty" db:"deleted_at"`
}

// ArtifactTag represents a tag attached to an artifact.
type ArtifactTag struct {
	ID        string    `json:"id" db:"id"`
	ArtifactID string   `json:"artifact_id" db:"artifact_id"`
	Tag       string    `json:"tag" db:"tag"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ArtifactDownload represents a download history record.
type ArtifactDownload struct {
	ID          string    `json:"id" db:"id"`
	ArtifactID  string    `json:"artifact_id" db:"artifact_id"`
	DownloadedBy string   `json:"downloaded_by" db:"downloaded_by"`
	DownloadedAt time.Time `json:"downloaded_at" db:"downloaded_at"`
	IPAddress   *string   `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent   *string   `json:"user_agent,omitempty" db:"user_agent"`
}

// ArtifactPromotion represents a promotion record.
type ArtifactPromotion struct {
	ID         string    `json:"id" db:"id"`
	ArtifactID string    `json:"artifact_id" db:"artifact_id"`
	FromStage  string    `json:"from_stage" db:"from_stage"`
	ToStage    string    `json:"to_stage" db:"to_stage"`
	PromotedBy string    `json:"promoted_by" db:"promoted_by"`
	ApprovedBy *string   `json:"approved_by,omitempty" db:"approved_by"`
	Reason     string    `json:"reason" db:"reason"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// --- Request models ---

type CreateArtifactRequest struct {
	Name           string     `json:"name" binding:"required"`
	Namespace      string     `json:"namespace" binding:"required"`
	Version        string     `json:"version" binding:"required"`
	Type           ArtifactType `json:"type" binding:"required"`
	SizeBytes      int64      `json:"size_bytes" binding:"required"`
	ChecksumSha256 *string    `json:"checksum_sha256"`
	ChecksumSha512 *string    `json:"checksum_sha512"`
	Metadata       string     `json:"metadata"`
	StoragePath    string     `json:"storage_path" binding:"required"`
	CreatedBy      string     `json:"created_by"`
}

type UpdateArtifactRequest struct {
	Status   *ArtifactStatus `json:"status"`
	Metadata *string         `json:"metadata"`
}

type ListArtifactsQuery struct {
	Namespace string `json:"namespace" form:"namespace"`
	Name      string `json:"name" form:"name"`
	Type      string `json:"type" form:"type"`
	Status    string `json:"status" form:"status"`
	Limit     int    `json:"limit" form:"limit"`
	Offset    int    `json:"offset" form:"offset"`
}

type AddTagsRequest struct {
	Tags []string `json:"tags" binding:"required"`
}

type RemoveTagsRequest struct {
	Tags []string `json:"tags" binding:"required"`
}

type DownloadArtifactRequest struct {
	DownloadedBy string  `json:"downloaded_by" binding:"required"`
	IPAddress    *string `json:"ip_address"`
	UserAgent    *string `json:"user_agent"`
}

type SearchArtifactsRequest struct {
	Query  string `json:"query" form:"query" binding:"required"`
	Limit  int    `json:"limit" form:"limit"`
	Offset int    `json:"offset" form:"offset"`
}

type PromoteArtifactRequest struct {
	PromotedBy string  `json:"promoted_by" binding:"required"`
	ApprovedBy *string `json:"approved_by"`
	Reason     string  `json:"reason"`
	Stage      string  `json:"stage" binding:"required"`
}

type QuarantineArtifactRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// --- Response models ---

type ArtifactListResponse struct {
	Artifacts []Artifact `json:"artifacts"`
	Total     int        `json:"total"`
}

type ArtifactTagResponse struct {
	ArtifactID string  `json:"artifact_id"`
	Tags       []string `json:"tags"`
}

type ArtifactStats struct {
	Total       int  `json:"total"`
	ByType      map[string]int   `json:"by_type"`
	ByStatus    map[string]int   `json:"by_status"`
	TotalSize   int64 `json:"total_size_bytes"`
}

type ArtifactTypeStat struct {
	Type   string `json:"type"`
	Count  int    `json:"count"`
	Size   int64  `json:"total_size_bytes"`
}

type NamespaceStat struct {
	Namespace string `json:"namespace"`
	Count     int    `json:"count"`
}
