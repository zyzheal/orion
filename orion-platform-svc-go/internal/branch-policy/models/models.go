package models

import "time"

type Record struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type ListQuery struct {
	Page   int    `json:"page" query:"page"`
	Limit  int    `json:"limit" query:"limit"`
	Status string `json:"status" query:"status"`
}

type CreateRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Status string                 `json:"status"`
	Config map[string]interface{} `json:"config"`
}

// ============================================================================
// P0-MB Phase 1 — L1 BranchProfile + L3 BuildArtifact
// ============================================================================

// BranchSemantic enumerates the branch purpose categories used by
// BranchProfile. The value drives name-pattern validation and required
// auxiliary fields (see service.validateBranchProfile).
type BranchSemantic string

const (
	BranchMain           BranchSemantic = "main"
	BranchRelease        BranchSemantic = "release"
	BranchHotfix         BranchSemantic = "hotfix"
	BranchLTS            BranchSemantic = "lts"
	BranchCustomerCustom BranchSemantic = "customer-custom"
)

// AllBranchSemantics returns every valid semantic value. Used by validation
// and by handlers to build enum dropdowns.
func AllBranchSemantics() []BranchSemantic {
	return []BranchSemantic{BranchMain, BranchRelease, BranchHotfix, BranchLTS, BranchCustomerCustom}
}

// Valid returns true if s is a defined BranchSemantic value.
func (s BranchSemantic) Valid() bool {
	switch s {
	case BranchMain, BranchRelease, BranchHotfix, BranchLTS, BranchCustomerCustom:
		return true
	}
	return false
}

// RequiredNamePrefix returns the required branch-name prefix for the semantic.
// Empty string means no prefix constraint (only BranchMain uses literal "main").
func (s BranchSemantic) RequiredNamePrefix() string {
	switch s {
	case BranchMain:
		return "main"
	case BranchRelease:
		return "release/"
	case BranchHotfix:
		return "hotfix/"
	case BranchLTS:
		return "lts/"
	case BranchCustomerCustom:
		return "custom/"
	}
	return ""
}

// BranchStatus enumerates the lifecycle state of a BranchProfile.
type BranchStatus string

const (
	BranchStatusActive   BranchStatus = "active"
	BranchStatusArchived BranchStatus = "archived"
	BranchStatusRetired  BranchStatus = "retired"
)

func (s BranchStatus) Valid() bool {
	switch s {
	case BranchStatusActive, BranchStatusArchived, BranchStatusRetired:
		return true
	}
	return false
}

// BranchProfile is L1 of the multi-branch strategy. It describes a branch's
// business meaning (release channel, owner, allowed merge sources/targets,
// protected environments) independent of the underlying git branch name.
type BranchProfile struct {
	ID               string         `json:"id" db:"id"`
	TenantID         string         `json:"tenantId" db:"tenant_id"`
	RepoID           string         `json:"repoId" db:"repo_id"`
	Name             string         `json:"name" db:"name"` // e.g. "release/enterprise-2026"
	Semantic         BranchSemantic `json:"semantic" db:"semantic"`
	OwnerID          string         `json:"ownerId" db:"owner_id"`
	OwnerName        string         `json:"ownerName" db:"owner_name"`
	Description      string         `json:"description" db:"description"`
	LTSUntil         *time.Time     `json:"ltsUntil" db:"lts_until"`
	MergeTargets     []string       `json:"mergeTargets" db:"merge_targets"`
	MergeSources     []string       `json:"mergeSources" db:"merge_sources"`
	ProtectedEnvs    []string       `json:"protectedEnvs" db:"protected_envs"`
	AllowedPipelines []string       `json:"allowedPipelines" db:"allowed_pipelines"`
	Status           BranchStatus   `json:"status" db:"status"`
	CreatedAt        time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time      `json:"updatedAt" db:"updated_at"`
	ArchivedAt       *time.Time     `json:"archivedAt" db:"archived_at"`
}

// CreateBranchProfileRequest is the POST body for branch-profile creation.
// Semantic validation rules (enforced in service):
//   - Semantic must be one of the defined values.
//   - Name must satisfy RequiredNamePrefix (e.g. "release/*" for release).
//   - Semantic != main → MergeTargets must be non-empty.
//   - Semantic == lts → LTSUntil must be set (and in the future).
type CreateBranchProfileRequest struct {
	RepoID           string         `json:"repoId" binding:"required"`
	Name             string         `json:"name" binding:"required"`
	Semantic         BranchSemantic `json:"semantic" binding:"required"`
	OwnerID          string         `json:"ownerId" binding:"required"`
	OwnerName        string         `json:"ownerName"`
	Description      string         `json:"description"`
	LTSUntil         *time.Time     `json:"ltsUntil"`
	MergeTargets     []string       `json:"mergeTargets"`
	MergeSources     []string       `json:"mergeSources"`
	ProtectedEnvs    []string       `json:"protectedEnvs"`
	AllowedPipelines []string       `json:"allowedPipelines"`
}

// UpdateBranchProfileRequest is the PUT body for branch-profile update.
// Pointers distinguish "not provided" from "empty value" so callers can clear
// a field by sending an empty slice wrapped in a pointer.
type UpdateBranchProfileRequest struct {
	Name             *string        `json:"name"`
	Description      *string        `json:"description"`
	OwnerID          *string        `json:"ownerId"`
	OwnerName        *string        `json:"ownerName"`
	LTSUntil         *time.Time     `json:"ltsUntil"`
	MergeTargets     *[]string      `json:"mergeTargets"`
	MergeSources     *[]string      `json:"mergeSources"`
	ProtectedEnvs    *[]string      `json:"protectedEnvs"`
	AllowedPipelines *[]string      `json:"allowedPipelines"`
}

// BranchProfileQuery filters the branch-profile list endpoint. Nil fields are
// "no filter"; Page/Limit default in the service layer.
type BranchProfileQuery struct {
	Status   *BranchStatus   `json:"status"`
	Semantic *BranchSemantic `json:"semantic"`
	RepoID   *string         `json:"repoId"`
	OwnerID  *string         `json:"ownerId"`
	Page     int             `json:"page"`
	Limit    int             `json:"limit"`
}

// ============================================================================
// BuildArtifact (L3) — immutable fingerprint of a deployed binary.
// ============================================================================

// BuildArtifactStatus enumerates the lifecycle state of a BuildArtifact.
type BuildArtifactStatus string

const (
	ArtifactStatusActive     BuildArtifactStatus = "active"
	ArtifactStatusDeprecated BuildArtifactStatus = "deprecated"
)

// BuildArtifact is the L3 layer of the multi-branch strategy: an immutable
// record of a binary image + its cryptographic fingerprints. ImageDigest is
// always sha256:* (enforced by service.validateArtifactDigest).
type BuildArtifact struct {
	ID                string              `json:"id" db:"id"`
	TenantID          string              `json:"tenantId" db:"tenant_id"`
	BranchProfileID   string              `json:"branchProfileId" db:"branch_profile_id"`
	Branch            string              `json:"branch" db:"branch"`
	CommitSHA         string              `json:"commitSha" db:"commit_sha"`
	ImageDigest       string              `json:"imageDigest" db:"image_digest"`       // sha256:xxx
	ImageTag          string              `json:"imageTag" db:"image_tag"`
	ImageRepo         string              `json:"imageRepo" db:"image_repo"`
	BuildPipelineID   string              `json:"buildPipelineId" db:"build_pipeline_id"`
	TargetEnvs        []string            `json:"targetEnvs" db:"target_envs"`
	SignedBy          string              `json:"signedBy" db:"signed_by"`
	SignatureValid    bool                `json:"signatureValid" db:"signature_valid"`
	BinaryChecksum    string              `json:"binaryChecksum" db:"binary_checksum"`
	ConfigChecksum    string              `json:"configChecksum" db:"config_checksum"`
	MigrationChecksum string              `json:"migrationChecksum" db:"migration_checksum"`
	BuiltAt           time.Time           `json:"builtAt" db:"built_at"`
	SizeBytes         int64               `json:"sizeBytes" db:"size_bytes"`
	Status            BuildArtifactStatus `json:"status" db:"status"`
	DeprecatedAt      *time.Time          `json:"deprecatedAt" db:"deprecated_at"`
	DeprecatedReason  string              `json:"deprecatedReason" db:"deprecated_reason"`
}

// RegisterArtifactRequest is the POST body for build-artifact registration.
// ImageDigest must start with "sha256:" (65+ chars, 64 hex). CommitSHA must be
// 40-char hex. TargetEnvs must be non-empty.
type RegisterArtifactRequest struct {
	BranchProfileID   string   `json:"branchProfileId" binding:"required"`
	Branch            string   `json:"branch" binding:"required"`
	CommitSHA         string   `json:"commitSha" binding:"required"`
	ImageDigest       string   `json:"imageDigest" binding:"required"`
	ImageTag          string   `json:"imageTag" binding:"required"`
	ImageRepo         string   `json:"imageRepo" binding:"required"`
	BuildPipelineID   string   `json:"buildPipelineId" binding:"required"`
	TargetEnvs        []string `json:"targetEnvs" binding:"required"`
	SignedBy          string   `json:"signedBy"`
	BinaryChecksum    string   `json:"binaryChecksum"`
	ConfigChecksum    string   `json:"configChecksum"`
	MigrationChecksum string   `json:"migrationChecksum"`
	SizeBytes         int64    `json:"sizeBytes"`
}

// ArtifactQuery filters the build-artifact list endpoint.
type ArtifactQuery struct {
	BranchProfileID *string              `json:"branchProfileId"`
	Branch          *string              `json:"branch"`
	CommitSHA       *string              `json:"commitSha"`
	Status          *BuildArtifactStatus `json:"status"`
	SignatureValid  *bool                `json:"signatureValid"`
	Page            int                  `json:"page"`
	Limit           int                  `json:"limit"`
}

// SignatureVerificationResult is the response for the verify-signature action.
type SignatureVerificationResult struct {
	ArtifactID string    `json:"artifactId"`
	Valid      bool      `json:"valid"`
	Reason     string    `json:"reason"`
	VerifiedAt time.Time `json:"verifiedAt"`
}
