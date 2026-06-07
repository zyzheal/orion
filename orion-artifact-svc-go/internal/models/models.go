package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ArtifactStatus represents the lifecycle status of an artifact.
type ArtifactStatus string

const (
	ArtifactStatusAvailable   ArtifactStatus = "available"
	ArtifactStatusDeprecated  ArtifactStatus = "deprecated"
	ArtifactStatusQuarantined ArtifactStatus = "quarantined"
	ArtifactStatusDeleted     ArtifactStatus = "deleted"
)

// ArtifactType represents the kind of artifact.
type ArtifactType string

const (
	ArtifactTypeDocker ArtifactType = "docker"
	ArtifactTypeNpm    ArtifactType = "npm"
	ArtifactTypeMaven  ArtifactType = "maven"
	ArtifactTypeGeneric ArtifactType = "generic"
	ArtifactTypeHelm   ArtifactType = "helm"
	ArtifactTypeBinary ArtifactType = "binary"
)

// PromotionStage represents the promotion lifecycle of an artifact.
type PromotionStage string

const (
	PromotionStageDevelopment PromotionStage = "development"
	PromotionStageTesting     PromotionStage = "testing"
	PromotionStageStaging     PromotionStage = "staging"
	PromotionStageProduction  PromotionStage = "production"
	PromotionStageReleased    PromotionStage = "released"
)

// PromotionOrder defines the valid stage progression.
var PromotionOrder = []PromotionStage{
	PromotionStageDevelopment,
	PromotionStageTesting,
	PromotionStageStaging,
	PromotionStageProduction,
	PromotionStageReleased,
}

// Artifact is the core data model for stored artifacts.
type Artifact struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Namespace      string    `db:"namespace" json:"namespace"`
	Name           string    `db:"name" json:"name"`
	Version        string    `db:"version" json:"version"`
	Type           string    `db:"type" json:"type"`
	Status         string    `db:"status" json:"status"`
	Description    string    `db:"description" json:"description,omitempty"`
	SizeBytes      int64     `db:"size_bytes" json:"size_bytes"`
	ChecksumSHA256 string    `db:"checksum_sha256" json:"checksum_sha256,omitempty"`
	ChecksumSHA512 string    `db:"checksum_sha512" json:"checksum_sha512,omitempty"`
	StoragePath    string    `db:"storage_path" json:"storage_path,omitempty"`
	RepoURL        string    `db:"repo_url" json:"repo_url,omitempty"`
	Metadata       JSONB     `db:"metadata" json:"metadata,omitempty"`
	Tags           []string  `db:"-" json:"tags,omitempty"`
	CreatedBy      string    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// ArtifactTag represents a tag attached to an artifact.
type ArtifactTag struct {
	ID         string    `db:"id" json:"id"`
	ArtifactID string    `db:"artifact_id" json:"artifact_id"`
	Tag        string    `db:"tag" json:"tag"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// DownloadRecord tracks artifact download events.
type DownloadRecord struct {
	ID           string    `db:"id" json:"id"`
	ArtifactID   string    `db:"artifact_id" json:"artifact_id"`
	DownloadedBy string    `db:"downloaded_by" json:"downloaded_by"`
	IPAddress    string    `db:"ip_address" json:"ip_address,omitempty"`
	UserAgent    string    `db:"user_agent" json:"user_agent,omitempty"`
	DownloadedAt time.Time `db:"downloaded_at" json:"downloaded_at"`
}

// PromotionRecord tracks artifact promotion events.
type PromotionRecord struct {
	ID          string     `db:"id" json:"id"`
	ArtifactID  string     `db:"artifact_id" json:"artifact_id"`
	FromStage   string     `db:"from_stage" json:"from_stage"`
	ToStage     string     `db:"to_stage" json:"to_stage"`
	Status      string     `db:"status" json:"status"`
	PromotedBy  string     `db:"promoted_by" json:"promoted_by"`
	ApprovedBy  *string    `db:"approved_by" json:"approved_by,omitempty"`
	ApprovedAt  *time.Time `db:"approved_at" json:"approved_at,omitempty"`
	Reason      *string    `db:"reason" json:"reason,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// --- Request / Response DTOs ---

// CreateArtifactRequest is the payload for creating a new artifact.
type CreateArtifactRequest struct {
	Name           string                 `json:"name" binding:"required"`
	Namespace      string                 `json:"namespace"`
	Version        string                 `json:"version" binding:"required"`
	Type           string                 `json:"type" binding:"required"`
	Description    string                 `json:"description"`
	SizeBytes      int64                  `json:"size_bytes"`
	ChecksumSHA256 string                 `json:"checksum_sha256"`
	ChecksumSHA512 string                 `json:"checksum_sha512"`
	StoragePath    string                 `json:"storage_path"`
	RepoURL        string                 `json:"repo_url"`
	Metadata       map[string]interface{} `json:"metadata"`
	CreatedBy      string                 `json:"created_by"`
}

// UpdateArtifactRequest is the payload for updating an artifact.
type UpdateArtifactRequest struct {
	Status      *string                `json:"status"`
	Description *string                `json:"description"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// PromoteRequest is the payload for promoting an artifact to the next stage.
type PromoteRequest struct {
	PromotedBy string `json:"promoted_by" binding:"required"`
	Reason     string `json:"reason"`
}

// PromoteWithApprovalRequest is the payload for promoting with approval.
type PromoteWithApprovalRequest struct {
	PromotedBy string `json:"promoted_by" binding:"required"`
	ApprovedBy string `json:"approved_by" binding:"required"`
	Reason     string `json:"reason"`
}

// DownloadRequest records metadata for a download event.
type DownloadRequest struct {
	DownloadedBy string `json:"downloaded_by" binding:"required"`
	IPAddress    string `json:"ip_address"`
	UserAgent    string `json:"user_agent"`
}

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// PaginatedResponse wraps a list of items with total count.
type PaginatedResponse struct {
	Items      interface{} `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

// ListQueryOptions holds query parameters for listing artifacts.
type ListQueryOptions struct {
	Namespace string `form:"namespace"`
	Name      string `form:"name"`
	Type      string `form:"type"`
	Status    string `form:"status"`
	Search    string `form:"search"`
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
}

// Offset returns the SQL OFFSET value.
func (o *ListQueryOptions) Offset() int {
	if o.Page <= 0 {
		o.Page = 1
	}
	if o.PageSize <= 0 {
		o.PageSize = 20
	}
	return (o.Page - 1) * o.PageSize
}

// Limit returns the SQL LIMIT value.
func (o *ListQueryOptions) Limit() int {
	if o.PageSize <= 0 {
		o.PageSize = 20
	}
	if o.PageSize > 100 {
		o.PageSize = 100
	}
	return o.PageSize
}
