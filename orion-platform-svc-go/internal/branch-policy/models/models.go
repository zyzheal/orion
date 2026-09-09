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
//
// Phase 5 adds optional fields (ApprovalID, ArtifactID, PipelineName,
// SourceCommit) so PreDeployGate R1-R6 can consult the same request payload.
// Empty strings are interpreted as "not supplied" — a missing field is not an
// error at this layer; individual rules decide how to treat empties.
type DeployRequest struct {
	TenantID  string `json:"tenantId"`
	Branch    string `json:"branch"`
	TargetEnv string `json:"targetEnv"`
	ImageTag  string `json:"imageTag"`
	// ApprovalID is the ID of a prior approval record required for R3.
	// Empty means no approval has been recorded — R3 fails closed.
	ApprovalID string `json:"approvalId,omitempty"`
	// ArtifactID is the build-artifact ID under test. R2 verifies its
	// signature when present; when empty R2 is skipped with a warning.
	ArtifactID string `json:"artifactId,omitempty"`
	// PipelineName is the CI pipeline that produced the artifact. R5 allows
	// the deploy when it is in the branch's allowedPipelines list.
	PipelineName string `json:"pipelineName,omitempty"`
	// SourceCommit is the SHA that the deployment is promoting. R6 (schema
	// compatibility) uses this to look up migration diffs.
	SourceCommit string `json:"sourceCommit,omitempty"`
}

// ============================================================================
// P0-MB Phase 3 — L4 SyncPolicy + SyncRunLog (branch synchronization)
// ============================================================================

// SyncFrequency enumerates how often a SyncPolicy should run.
type SyncFrequency string

const (
	SyncFrequencyDaily   SyncFrequency = "daily"
	SyncFrequencyWeekly  SyncFrequency = "weekly"
	SyncFrequencyMonthly SyncFrequency = "monthly"
)

// IsValid reports whether f is one of the three canonical frequencies.
func (f SyncFrequency) IsValid() bool {
	switch f {
	case SyncFrequencyDaily, SyncFrequencyWeekly, SyncFrequencyMonthly:
		return true
	}
	return false
}

// SyncStrategy describes how source commits are applied to target branches.
type SyncStrategy string

const (
	SyncStrategyRebase     SyncStrategy = "rebase"
	SyncStrategyCherryPick SyncStrategy = "cherry-pick"
	SyncStrategyMerge      SyncStrategy = "merge"
)

// IsValid reports whether s is one of the three canonical strategies.
func (s SyncStrategy) IsValid() bool {
	switch s {
	case SyncStrategyRebase, SyncStrategyCherryPick, SyncStrategyMerge:
		return true
	}
	return false
}

// SyncResolve describes what to do when a sync run detects conflicts.
type SyncResolve string

const (
	SyncResolveNone           SyncResolve = "none"
	SyncResolveSkipConflict   SyncResolve = "skip-conflict"
	SyncResolveManualRequired SyncResolve = "manual-required"
)

// IsValid reports whether r is one of the three canonical resolve modes.
func (r SyncResolve) IsValid() bool {
	switch r {
	case SyncResolveNone, SyncResolveSkipConflict, SyncResolveManualRequired:
		return true
	}
	return false
}

// SyncRunStatus is the terminal status of a single sync execution.
type SyncRunStatus string

const (
	SyncStatusSuccess  SyncRunStatus = "success"
	SyncStatusConflict SyncRunStatus = "conflict"
	SyncStatusFailed   SyncRunStatus = "failed"
)

// SyncTriggerBy identifies the trigger source for a SyncRunLog entry.
type SyncTriggerBy string

const (
	SyncTriggerScheduler SyncTriggerBy = "scheduler"
	SyncTriggerManual    SyncTriggerBy = "manual"
)

// SyncPolicy is the L4 layer of the multi-branch strategy: a rule that
// periodically synchronizes commits from a source branch to one or more
// target branches. Enforced by wireSyncScheduler (5-min ticker).
type SyncPolicy struct {
	ID                   string          `json:"id" db:"id"`
	TenantID             string          `json:"tenantId" db:"tenant_id"`
	Name                 string          `json:"name" db:"name"`
	SourceBranch         string          `json:"sourceBranch" db:"source_branch"`
	TargetBranches       []string        `json:"targetBranches" db:"target_branches"`
	Frequency            SyncFrequency   `json:"frequency" db:"frequency"`
	CronExpr             string          `json:"cronExpr" db:"cron_expr"`
	Strategy             SyncStrategy    `json:"strategy" db:"strategy"`
	AutoResolve          SyncResolve     `json:"autoResolve" db:"auto_resolve"`
	NotifyOnConflict     []string        `json:"notifyOnConflict" db:"notify_on_conflict"`
	NotifyWebhook        string          `json:"notifyWebhook" db:"notify_webhook"`
	Enabled              bool            `json:"enabled" db:"enabled"`
	LastRunAt            *time.Time      `json:"lastRunAt" db:"last_run_at"`
	LastRunStatus        *SyncRunStatus  `json:"lastRunStatus" db:"last_run_status"`
	LastRunConflictFiles []string        `json:"lastRunConflictFiles" db:"last_run_conflict_files"`
	ChangeManagementID   string          `json:"changeManagementId" db:"change_management_id"`
	CreatedAt            time.Time       `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time       `json:"updatedAt" db:"updated_at"`
}

// CreateSyncPolicyRequest is the POST body for sync policy creation.
// Frequency + Strategy + AutoResolve are required. TargetBranches must be
// non-empty. SourceBranch must be a real branch name (validated against
// models.BranchStatusActive profiles via the service layer).
type CreateSyncPolicyRequest struct {
	Name             string        `json:"name" binding:"required"`
	SourceBranch     string        `json:"sourceBranch" binding:"required"`
	TargetBranches   []string      `json:"targetBranches" binding:"required"`
	Frequency        SyncFrequency `json:"frequency"`
	CronExpr         string        `json:"cronExpr"`
	Strategy         SyncStrategy  `json:"strategy"`
	AutoResolve      SyncResolve   `json:"autoResolve"`
	NotifyOnConflict []string      `json:"notifyOnConflict"`
	NotifyWebhook    string        `json:"notifyWebhook"`
	Enabled          *bool         `json:"enabled"`
}

// UpdateSyncPolicyRequest is the PUT body for sync policy updates. All
// fields are optional; only non-nil values are applied.
type UpdateSyncPolicyRequest struct {
	Name             *string       `json:"name"`
	SourceBranch     *string       `json:"sourceBranch"`
	TargetBranches   *[]string     `json:"targetBranches"`
	Frequency        *SyncFrequency `json:"frequency"`
	CronExpr         *string       `json:"cronExpr"`
	Strategy         *SyncStrategy `json:"strategy"`
	AutoResolve      *SyncResolve  `json:"autoResolve"`
	NotifyOnConflict *[]string     `json:"notifyOnConflict"`
	NotifyWebhook    *string       `json:"notifyWebhook"`
	Enabled          *bool         `json:"enabled"`
}

// SyncPolicyQuery filters the sync-policy list endpoint. Nil fields mean
// "no filter".
type SyncPolicyQuery struct {
	Enabled      *bool            `json:"enabled"`
	Frequency    *SyncFrequency   `json:"frequency"`
	Strategy     *SyncStrategy    `json:"strategy"`
	SourceBranch *string          `json:"sourceBranch"`
	AutoResolve  *SyncResolve     `json:"autoResolve"`
}

// SyncRunLog is a single execution of a SyncPolicy. It is immutable once
// written (except DurationMs which is updated at completion).
type SyncRunLog struct {
	ID             string          `json:"id" db:"id"`
	TenantID       string          `json:"tenantId" db:"tenant_id"`
	PolicyID       string          `json:"policyId" db:"policy_id"`
	TriggeredAt    time.Time       `json:"triggeredAt" db:"triggered_at"`
	TriggeredBy    SyncTriggerBy   `json:"triggeredBy" db:"triggered_by"`
	SourceCommit   string          `json:"sourceCommit" db:"source_commit"`
	TargetBranches []string        `json:"targetBranches" db:"target_branches"`
	Status         SyncRunStatus   `json:"status" db:"status"`
	ConflictFiles  []string        `json:"conflictFiles" db:"conflict_files"`
	ErrorMsg       string          `json:"errorMsg" db:"error_msg"`
	DurationMs     int64           `json:"durationMs" db:"duration_ms"`
	ChangeID       string          `json:"changeId" db:"change_id"`
}

// SyncRunLogQuery filters the run-logs list endpoint.
type SyncRunLogQuery struct {
	PolicyID *string        `json:"policyId"`
	Status   *SyncRunStatus `json:"status"`
	From     *time.Time     `json:"from"`
	To       *time.Time     `json:"to"`
	Limit    int            `json:"limit"`
}

// SyncRunResult is the internal output of the sync executor. When
// AutoResolve == SyncResolveManualRequired and Conflicts is non-empty, the
// service layer blocks the run and returns status=conflict without
// persisting any ChangeManagement side-effect (other than the SyncRunLog).
type SyncRunResult struct {
	TargetBranch   string
	Applied        bool
	ConflictFiles  []string
	Error          string
	NewCommitSHA   string
}

// ============================================================================
// P0-MB Phase 4 — L5 DeployEvent (change audit + one-click rollback)
// ============================================================================

// DeployOutcome enumerates the terminal state of a single deploy attempt.
// Transitions:
//
//	started (implicit) --success--> success     --rollback--> rolled-back
//	started (implicit) --failed---> failed      --rollback--> rolled-back
//	rolled-back is a terminal state (no further transitions allowed).
type DeployOutcome string

const (
	DeployOutcomeSuccess    DeployOutcome = "success"
	DeployOutcomeRolledBack DeployOutcome = "rolled-back"
	DeployOutcomeFailed     DeployOutcome = "failed"
)

// AllDeployOutcomes returns every canonical outcome value (used by handlers
// to build enum dropdowns and by tests to enumerate transitions).
func AllDeployOutcomes() []DeployOutcome {
	return []DeployOutcome{DeployOutcomeSuccess, DeployOutcomeRolledBack, DeployOutcomeFailed}
}

// Valid reports whether o is one of the three canonical outcomes.
func (o DeployOutcome) Valid() bool {
	switch o {
	case DeployOutcomeSuccess, DeployOutcomeRolledBack, DeployOutcomeFailed:
		return true
	}
	return false
}

// CanRollback reports whether the outcome permits a rollback. Both success
// and failed deployments can be rolled back; rolled-back is terminal.
func (o DeployOutcome) CanRollback() bool {
	return o == DeployOutcomeSuccess || o == DeployOutcomeFailed
}

// DeployEvent is the L5 layer of the multi-branch strategy: a change audit
// record for a single deploy attempt. Fields FromCommit/ToCommit identify
// the delta; ArtifactID and ImageDigest identify the immutable binary;
// ApprovalID links to ChangeManagement; RollbackTo points back to the
// original event when this is a rollback deployment.
//
// Lifecycle: an event is created on deploy start with Outcome=success (best
// guess — the caller will call UpdateOutcome later if the deploy failed) and
// CompletedAt=nil. UpdateOutcome + UpdateMetrics then close it out. Rollback
// creates a NEW DeployEvent with Outcome=rolled-back and RollbackTo=&id.
type DeployEvent struct {
	ID          string        `json:"id" db:"id"`
	TenantID    string        `json:"tenantId" db:"tenant_id"`
	ActorID     string        `json:"actorId" db:"actor_id"`
	ActorName   string        `json:"actorName" db:"actor_name"`
	Branch      string        `json:"branch" db:"branch"`
	Env         string        `json:"env" db:"env"`
	FromCommit  string        `json:"fromCommit" db:"from_commit"`
	ToCommit    string        `json:"toCommit" db:"to_commit"`
	ArtifactID  string        `json:"artifactId" db:"artifact_id"`
	ImageDigest string        `json:"imageDigest" db:"image_digest"`
	ApprovalID  string        `json:"approvalId" db:"approval_id"`
	Outcome     DeployOutcome `json:"outcome" db:"outcome"`
	RollbackTo  *string       `json:"rollbackTo" db:"rollback_to"`
	DurationMs  int64         `json:"durationMs" db:"duration_ms"`
	ErrorRate   float64       `json:"errorRate" db:"error_rate"`
	P99Latency  int64         `json:"p99Latency" db:"p99_latency"`
	StartedAt   time.Time     `json:"startedAt" db:"started_at"`
	CompletedAt *time.Time    `json:"completedAt" db:"completed_at"`
	GateResult  string        `json:"gateResult" db:"gate_result"`
	ErrorMsg    string        `json:"errorMsg" db:"error_msg"`
	CreatedAt   time.Time     `json:"createdAt" db:"created_at"`
}

// CreateDeployEventRequest is the POST body for /deploy-events. ActorID,
// Branch, Env, ToCommit are required. Outcome defaults to success when
// omitted (the caller is expected to call UpdateOutcome later if the deploy
// fails).
type CreateDeployEventRequest struct {
	ActorID     string        `json:"actorId" binding:"required"`
	ActorName   string        `json:"actorName"`
	Branch      string        `json:"branch" binding:"required"`
	Env         string        `json:"env" binding:"required"`
	FromCommit  string        `json:"fromCommit"`
	ToCommit    string        `json:"toCommit" binding:"required"`
	ArtifactID  string        `json:"artifactId"`
	ImageDigest string        `json:"imageDigest"`
	ApprovalID  string        `json:"approvalId"`
	Outcome     DeployOutcome `json:"outcome"`
	GateResult  string        `json:"gateResult"`
}

// DeployEventQuery filters the deploy-events list endpoint. Nil fields
// mean "no filter"; Limit is capped at 1000 by the service layer.
type DeployEventQuery struct {
	Branch     *string         `json:"branch"`
	Env        *string         `json:"env"`
	ActorID    *string         `json:"actorId"`
	ApprovalID *string         `json:"approvalId"`
	Outcome    *DeployOutcome  `json:"outcome"`
	From       *time.Time      `json:"from"`
	To         *time.Time      `json:"to"`
	Limit      int             `json:"limit"`
}

// DeployMetrics is the payload for UpdateMetrics. All fields are optional —
// zero values mean "leave unchanged".
type DeployMetrics struct {
	DurationMs int64
	ErrorRate  float64
	P99Latency int64
}

// AuditTrailParams identifies a filter set for GetAuditTrail. Zero-length
// strings mean "no filter" for that field.
type AuditTrailParams struct {
	Branch     string `json:"branch"`
	Env        string `json:"env"`
	ArtifactID string `json:"artifactId"`
	ApprovalID string `json:"approvalId"`
	Limit      int    `json:"limit"`
}

// AuditTrailResult is the aggregated chain returned by GetAuditTrail. It
// surfaces the matched events plus unique deduped lists of branches, envs,
// artifact ids, and approval ids so callers can render a graph in the UI.
type AuditTrailResult struct {
	Events      []DeployEvent `json:"events"`
	Branches    []string      `json:"branches"`
	Envs        []string      `json:"envs"`
	ArtifactIDs []string      `json:"artifactIds"`
	ApprovalIDs []string      `json:"approvalIds"`
	GeneratedAt time.Time     `json:"generatedAt"`
}

// ============================================================================
// P0-MB Phase 5 — PreDeployGate R1-R6 + MergePreview (conflict pre-check)
// ============================================================================

// GateSeverity enumerates the severity of a PreDeployGate rule violation.
// "blocking" rules must pass or the deploy is rejected; "warning" rules are
// advisory only.
type GateSeverity string

const (
	GateSeverityBlocking GateSeverity = "blocking"
	GateSeverityWarning  GateSeverity = "warning"
)

// RiskLevel classifies the risk of a MergePreview. It is derived from the
// number of conflict files: >10 critical, >5 high, >2 medium, else low.
type RiskLevel string

const (
	RiskLevelLow      RiskLevel = "low"
	RiskLevelMedium   RiskLevel = "medium"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// GateRuleResult is the outcome of a single PreDeployGate rule (R1-R6).
// Severity "blocking" rules populate result.Blocked when they fail.
type GateRuleResult struct {
	RuleID   string       `json:"ruleId"`   // R1-R6
	Name     string       `json:"name"`     // e.g. "Branch-Env 匹配"
	Passed   bool         `json:"passed"`
	Detail   string       `json:"detail"`
	Severity GateSeverity `json:"severity"`
}

// DeployExecutionResult is the combined output of ExecuteDeploy: the gate
// result (always present) plus the persisted DeployEvent (present only when
// the gate passed). Handlers return this struct so callers can inspect both
// the gate decision and the audit record in a single response.
type DeployExecutionResult struct {
	GateResult *PreDeployGateResult `json:"gateResult"`
	Event      *DeployEvent         `json:"event,omitempty"`
}

// PreDeployGateResult is the aggregated output of the PreDeployGate service.
// Passed is true only when all blocking rules pass. Blocked lists the IDs of
// the blocking rules that failed. PreDeployGateResult is NOT persisted — it is
// an API response only.
type PreDeployGateResult struct {
	Passed    bool             `json:"passed"`
	RequestID string           `json:"requestId"`
	CheckedAt time.Time        `json:"checkedAt"`
	Branch    string           `json:"branch"`
	Env       string           `json:"env"`
	Rules     []GateRuleResult `json:"rules"`
	Blocked   []string         `json:"blocked"`
}

// MergePreviewRequest is the POST body for /merge-preview. SourceBranch and
// TargetBranch are required; SourceCommit / TargetCommit are optional (the
// service falls back to the branch HEADs when omitted).
//
// ConflictFiles / AddedFiles / ModifiedFiles / DeletedFiles are optional
// server-side inputs: when the caller has already run git merge-tree (or a
// similar tool) it can supply the result directly. When omitted, the service
// persists empty slices and RiskLevel defaults to "low". The service always
// recomputes ConflictCount from len(ConflictFiles) so the two stay in sync.
type MergePreviewRequest struct {
	SourceBranch  string   `json:"sourceBranch" binding:"required"`
	TargetBranch  string   `json:"targetBranch" binding:"required"`
	SourceCommit  string   `json:"sourceCommit"`
	TargetCommit  string   `json:"targetCommit"`
	ConflictFiles []string `json:"conflictFiles"`
	AddedFiles    []string `json:"addedFiles"`
	ModifiedFiles []string `json:"modifiedFiles"`
	DeletedFiles  []string `json:"deletedFiles"`
}

// MergePreview is the persisted result of a merge-tree preview. ConflictFiles
// is the primary signal — it feeds MergePreview.RiskLevel and the downstream
// PreDeployGate R3 (conflict count) rule.
type MergePreview struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenantId" db:"tenant_id"`
	SourceBranch  string    `json:"sourceBranch" db:"source_branch"`
	TargetBranch  string    `json:"targetBranch" db:"target_branch"`
	SourceCommit  string    `json:"sourceCommit" db:"source_commit"`
	TargetCommit  string    `json:"targetCommit" db:"target_commit"`
	ConflictFiles []string  `json:"conflictFiles" db:"conflict_files"`
	AddedFiles    []string  `json:"addedFiles" db:"added_files"`
	ModifiedFiles []string  `json:"modifiedFiles" db:"modified_files"`
	DeletedFiles  []string  `json:"deletedFiles" db:"deleted_files"`
	ConflictCount int       `json:"conflictCount" db:"conflict_count"`
	RiskLevel     RiskLevel `json:"riskLevel" db:"risk_level"`
	PreviewedAt   time.Time `json:"previewedAt" db:"previewed_at"`
}
