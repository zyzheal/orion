package models

import "time"

// ==================== Drift Detection ====================

// DriftRecord represents a detected configuration drift.
type DriftRecord struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ConfigID       string    `db:"config_id" json:"config_id"`
	ConfigKey      string    `db:"config_key" json:"config_key"`
	Environment    string    `db:"environment" json:"environment"`
	ExpectedValue  string    `db:"expected_value" json:"expected_value"`
	ActualValue    string    `db:"actual_value" json:"actual_value"`
	DriftType      string    `db:"drift_type" json:"drift_type"` // value_changed, missing, unexpected
	DetectedAt     time.Time `db:"detected_at" json:"detected_at"`
	ResolvedAt     *time.Time `db:"resolved_at" json:"resolved_at,omitempty"`
	ResolvedBy     string    `db:"resolved_by" json:"resolved_by"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type DriftScanResult struct {
	TenantID    string        `json:"tenant_id"`
	Environment string        `json:"environment"`
	ScannedAt   time.Time     `json:"scanned_at"`
	TotalKeys   int           `json:"total_keys"`
	DriftCount  int           `json:"drift_count"`
	Drifts      []DriftRecord `json:"drifts"`
}

type ResolveDriftRequest struct {
	Resolution string `json:"revert" binding:"required"` // revert or accept
	ResolvedBy string `json:"resolved_by"`
}

// ==================== Feature Flags ====================

// FeatureFlag represents a feature toggle.
type FeatureFlag struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Key         string    `db:"key" json:"key"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Environment string    `db:"environment" json:"environment"`
	FlagType    string    `db:"flag_type" json:"flag_type"` // boolean, percentage, whitelist
	RolloutPct  int       `db:"rollout_pct" json:"rollout_pct"`
	Whitelist   JSONB `db:"whitelist" json:"whitelist"`
	Variations  JSONB     `db:"variations" json:"variations"`
	Tags        JSONB `db:"tags" json:"tags"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateFeatureFlagRequest struct {
	Key         string      `json:"key" binding:"required"`
	Name        string      `json:"name" binding:"required"`
	Description string      `json:"description"`
	Enabled     *bool       `json:"enabled"`
	Environment string      `json:"environment"`
	FlagType    string      `json:"flag_type"`
	RolloutPct  int         `json:"rollout_pct"`
	Whitelist   []string    `json:"whitelist"`
	Variations  JSONB       `json:"variations"`
	Tags        []string    `json:"tags"`
}

type UpdateFeatureFlagRequest struct {
	Name        *string     `json:"name"`
	Description *string     `json:"description"`
	Enabled     *bool       `json:"enabled"`
	FlagType    *string     `json:"flag_type"`
	RolloutPct  *int        `json:"rollout_pct"`
	Whitelist   *[]string   `json:"whitelist"`
	Variations  *JSONB      `json:"variations"`
	Tags        *[]string   `json:"tags"`
}

type EvaluateFlagRequest struct {
	Key         string `json:"key" binding:"required"`
	UserID      string `json:"user_id"`
	Environment string `json:"environment"`
}

type EvaluateFlagResult struct {
	Key       string `json:"key"`
	Enabled   bool   `json:"enabled"`
	Variant   string `json:"variant,omitempty"`
	Reason    string `json:"reason"`
}

// ==================== GitOps Sync ====================

// GitSyncConfig represents a Git repository sync configuration.
type GitSyncConfig struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	RepoURL        string    `db:"repo_url" json:"repo_url"`
	Branch         string    `db:"branch" json:"branch"`
	Path           string    `db:"path" json:"path"`
	Environment    string    `db:"environment" json:"environment"`
	AutoSync       bool      `db:"auto_sync" json:"auto_sync"`
	SyncIntervalSec int      `db:"sync_interval_sec" json:"sync_interval_sec"`
	LastSyncAt     *time.Time `db:"last_sync_at" json:"last_sync_at,omitempty"`
	LastSyncStatus string    `db:"last_sync_status" json:"last_sync_status"`
	Enabled        bool      `db:"enabled" json:"enabled"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type CreateGitSyncRequest struct {
	Name            string `json:"name" binding:"required"`
	RepoURL         string `json:"repo_url" binding:"required"`
	Branch          string `json:"branch"`
	Path            string `json:"path"`
	Environment     string `json:"environment"`
	AutoSync        *bool  `json:"auto_sync"`
	SyncIntervalSec int    `json:"sync_interval_sec"`
}

type SyncResult struct {
	Success       bool      `json:"success"`
	SyncedAt      time.Time `json:"synced_at"`
	ItemsSynced   int       `json:"items_synced"`
	ItemsAdded    int       `json:"items_added"`
	ItemsUpdated  int       `json:"items_updated"`
	ItemsRemoved  int       `json:"items_removed"`
	Errors        []string  `json:"errors,omitempty"`
}

// ==================== Approval Workflow ====================

// ConfigApproval represents a pending config change approval.
type ConfigApproval struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	ConfigKey     string    `db:"config_key" json:"config_key"`
	Environment   string    `db:"environment" json:"environment"`
	CurrentValue  string    `db:"current_value" json:"current_value"`
	ProposedValue string    `db:"proposed_value" json:"proposed_value"`
	Status        string    `db:"status" json:"status"` // pending, approved, rejected, applied
	RequestedBy   string    `db:"requested_by" json:"requested_by"`
	ReviewedBy    string    `db:"reviewed_by" json:"reviewed_by"`
	ReviewComment string    `db:"review_comment" json:"review_comment"`
	RequestedAt   time.Time `db:"requested_at" json:"requested_at"`
	ReviewedAt    *time.Time `db:"reviewed_at" json:"reviewed_at,omitempty"`
	AppliedAt     *time.Time `db:"applied_at" json:"applied_at,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

type CreateApprovalRequest struct {
	ConfigKey     string `json:"config_key" binding:"required"`
	Environment   string `json:"environment" binding:"required"`
	ProposedValue string `json:"proposed_value" binding:"required"`
	RequestedBy   string `json:"requested_by" binding:"required"`
}

type ReviewApprovalRequest struct {
	Status      string `json:"status" binding:"required"` // approved, rejected
	ReviewedBy  string `json:"reviewed_by" binding:"required"`
	Comment     string `json:"comment"`
}
