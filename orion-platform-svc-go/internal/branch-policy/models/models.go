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

// ============================================================================
// P0-MB Phase 2 — L2 NamespaceBinding + naming rules
// ============================================================================

// Canonical naming formats used by NamespaceBinding. Each format takes one
// slug argument (typically the branch semantic + short name joined by "-").
//
//	K8sNamespaceFmt:     "orion-%s"        -> "orion-release-ent"
//	ConfigNamespaceFmt:  "nacos/orion-%s"  -> "nacos/orion-release-ent"
//	DBNameFmt:           "orion_%s"         -> "orion_release-ent"  (hyphens OK)
//	MQTopicPrefixFmt:    "orion-%s-*"      -> "orion-release-ent-*"
//	RedisKeyPrefixFmt:   "orion:%s:*"      -> "orion:release-ent:*"
//	ImageTagPrefixFmt:   "%s/%s"           -> "myrepo/release-ent"
const (
	ImageTagPrefixFmt  = "%s/%s"
	K8sNamespaceFmt    = "orion-%s"
	ConfigNamespaceFmt = "nacos/orion-%s"
	DBNameFmt          = "orion_%s"
	MQTopicPrefixFmt   = "orion-%s-*"
	RedisKeyPrefixFmt  = "orion:%s:*"
)

// Canonical env names. EnvName validation is enforced by the service layer
// against these values; other envs can be added here if the org uses custom
// environments (e.g. "uat", "perf", "canary").
var CanonicalEnvs = []string{"dev", "staging", "prod"}

// NamespaceBinding binds a BranchProfile to a specific environment, defining
// the namespace/image-tag prefix/DB/MQ/Redis names that MUST be used for
// deployments targeting that (branch, env) pair. Enforced by BranchEnvGuard
// middleware at deploy time.
type NamespaceBinding struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenantId" db:"tenant_id"`
	BranchProfileID string    `json:"branchProfileId" db:"branch_profile_id"`
	EnvName         string    `json:"envName" db:"env_name"`
	K8sNamespace    string    `json:"k8sNamespace" db:"k8s_namespace"`
	ConfigNamespace string    `json:"configNamespace" db:"config_namespace"`
	DBName          string    `json:"dbName" db:"db_name"`
	MQTopicPrefix   string    `json:"mqTopicPrefix" db:"mq_topic_prefix"`
	RedisKeyPrefix  string    `json:"redisKeyPrefix" db:"redis_key_prefix"`
	ImageTagPrefix  string    `json:"imageTagPrefix" db:"image_tag_prefix"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
}

// CreateNamespaceRequest is the POST body for namespace binding creation.
// BranchProfileID + EnvName must be unique per tenant. Optional fields are
// auto-generated from the branch profile name if empty.
type CreateNamespaceRequest struct {
	BranchProfileID string `json:"branchProfileId" binding:"required"`
	EnvName         string `json:"envName" binding:"required"`
	ImageTagPrefix  string `json:"imageTagPrefix" binding:"required"`
	K8sNamespace    string `json:"k8sNamespace"`
	ConfigNamespace string `json:"configNamespace"`
	DBName          string `json:"dbName"`
	MQTopicPrefix   string `json:"mqTopicPrefix"`
	RedisKeyPrefix  string `json:"redisKeyPrefix"`
	ImageRepo       string `json:"imageRepo"`
}

// NamespaceBindingQuery filters the namespace binding list endpoint.
type NamespaceBindingQuery struct {
	BranchProfileID *string `json:"branchProfileId"`
	EnvName         *string `json:"envName"`
	Page            int     `json:"page"`
	Limit           int     `json:"limit"`
}

// NamespaceValidationResult is the response for the validate action.
type NamespaceValidationResult struct {
	BranchProfileID string               `json:"branchProfileId"`
	EnvName         string               `json:"envName"`
	Valid           bool                 `json:"valid"`
	Checks          []NamespaceCheck     `json:"checks"`
	ValidatedAt     time.Time            `json:"validatedAt"`
}

// NamespaceCheck is a single rule check result.
type NamespaceCheck struct {
	Field   string `json:"field"`
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
}

// BranchEnvMatrix is the branch × env grid used by the frontend matrix view.
type BranchEnvMatrix struct {
	Branches    []MatrixRow `json:"branches"`
	Envs        []string    `json:"envs"`
	GeneratedAt time.Time   `json:"generatedAt"`
}

// MatrixRow represents one branch in the matrix. Bindings maps envName to
// the cell for that env; missing envs indicate the branch is not bound
// to that environment (i.e. no NamespaceBinding exists).
type MatrixRow struct {
	BranchProfileID string               `json:"branchProfileId"`
	BranchName      string               `json:"branchName"`
	Semantic        string               `json:"semantic"`
	Status          string               `json:"status"`
	Bindings        map[string]MatrixCell `json:"bindings"`
}

// MatrixCell represents one (branch, env) cell in the matrix.
type MatrixCell struct {
	Exists         bool   `json:"exists"`
	K8sNamespace   string `json:"k8sNamespace,omitempty"`
	ImageTagPrefix string `json:"imageTagPrefix,omitempty"`
	DbName         string `json:"dbName,omitempty"`
}

// DeployRequest is the body of a deploy API call, used by BranchEnvGuard
// middleware to validate image-tag/env compatibility.
type DeployRequest struct {
	TenantID  string `json:"tenantId"`
	Branch    string `json:"branch"`
	TargetEnv string `json:"targetEnv"`
	ImageTag  string `json:"imageTag"`
}
