package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB provides a pgx-compatible map type for JSONB columns.
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

// JSONBFromSlice converts a string slice into a JSONB map via JSON marshaling.
func JSONBFromSlice(s []string) (JSONB, error) {
	if s == nil {
		return nil, nil
	}
	data, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	var j JSONB
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	return j, nil
}

// ConfigItem represents a configuration entry (key-value).
type ConfigItem struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Key         string    `db:"key" json:"key"`
	Value       string    `db:"value" json:"value"`
	Environment string    `db:"environment" json:"environment"`
	Version     int       `db:"version" json:"version"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ConfigVersionV2 represents a single version snapshot (blueprint-extended).
type ConfigVersionV2 struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ConfigID       string    `db:"config_id" json:"config_id"`
	ConfigKey      string    `db:"config_key" json:"config_key"`
	Environment    string    `db:"environment" json:"environment"`
	Value          string    `db:"value" json:"value"`
	VersionNumber  int       `db:"version_number" json:"version_number"`
	ChangeType     string    `db:"change_type" json:"change_type"`
	ChangedBy      string    `db:"changed_by" json:"changed_by"`
	ChangeReason   string    `db:"change_reason" json:"change_reason"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// ConfigDiff describes a single difference between two configurations.
type ConfigDiffV2 struct {
	Key         string `json:"key"`
	Environment string `json:"environment"`
	OldValue    string `json:"old_value,omitempty"`
	NewValue    string `json:"new_value,omitempty"`
	ChangeType  string `json:"change_type"` // added, removed, modified
}

// DiffReport is the result of comparing two environments.
type DiffReport struct {
	SourceEnv    string       `json:"source_environment"`
	TargetEnv    string       `json:"target_environment"`
	Diffs        []ConfigDiffV2 `json:"diffs"`
	TotalChanges int          `json:"total_changes"`
	Added        int          `json:"added"`
	Removed      int          `json:"removed"`
	Modified     int          `json:"modified"`
	GeneratedAt  time.Time    `json:"generated_at"`
}

// VersionDiffReport compares two specific versions of a config.
type VersionDiffReport struct {
	ConfigID    string    `json:"config_id"`
	Key         string    `json:"key"`
	Environment string    `json:"environment"`
	FromVersion int       `json:"from_version"`
	ToVersion   int       `json:"to_version"`
	OldValue    string    `json:"old_value"`
	NewValue    string    `json:"new_value"`
	GeneratedAt time.Time `json:"generated_at"`
}

// RollbackResultV2 describes the outcome of a rollback operation.
type RollbackResultV2 struct {
	Success          bool      `json:"success"`
	NewVersionID     string    `json:"new_version_id"`
	NewVersionNumber int       `json:"new_version_number"`
	RolledBackTo     int       `json:"rolled_back_to"`
	RolledBackBy     string    `json:"rolled_back_by"`
	RolledBackAt     time.Time `json:"rolled_back_at"`
}

// ExportData is a serializable snapshot of a set of configurations.
type ExportData struct {
	TenantID    string       `json:"tenant_id"`
	Environment string       `json:"environment"`
	ExportedAt  time.Time    `json:"exported_at"`
	Count       int          `json:"count"`
	Items       []ConfigItem `json:"items"`
}

// ValidationIssue describes a single config validation problem.
type ValidationIssue struct {
	Key     string `json:"key"`
	Field   string `json:"field"`
	Message string `json:"message"`
	Level   string `json:"level"` // error, warning
}

// ValidationResult is the result of validating a configuration value.
type ValidationResult struct {
	Valid  bool               `json:"valid"`
	Issues []ValidationIssue  `json:"issues"`
}

// --- Request / Response DTOs ---

// CreateConfigRequestV2 is the blueprint's create request (key-value style).
type CreateConfigRequestV2 struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value" binding:"required"`
	Env   string `json:"environment"`
}

// SetConfigRequest is the blueprint's upsert request.
type SetConfigRequest struct {
	Key         string `json:"key" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Environment string `json:"environment"`
	ChangedBy   string `json:"changed_by"`
	Reason      string `json:"reason"`
}

// RollbackRequestV2 is the blueprint's rollback request (integer version).
type RollbackRequestV2 struct {
	TargetVersion int    `json:"target_version" binding:"required"`
	RolledBackBy  string `json:"rolled_back_by"`
}

// ImportRequest is the blueprint's import request.
type ImportRequest struct {
	Items     []SetConfigRequest `json:"items" binding:"required"`
	ChangedBy string             `json:"changed_by"`
}

// DiffRequest is the blueprint's diff request.
type DiffRequest struct {
	SourceEnv string `json:"source_environment" binding:"required"`
	TargetEnv string `json:"target_environment" binding:"required"`
}

// PaginatedRequest is the blueprint's paginated request.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ---------- Drift ----------

// DriftRecord represents a detected configuration drift.
type DriftRecord struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	ConfigID      string    `db:"config_id" json:"config_id"`
	ConfigKey     string    `db:"config_key" json:"config_key"`
	Environment   string    `db:"environment" json:"environment"`
	ExpectedValue string    `db:"expected_value" json:"expected_value"`
	ActualValue   string    `db:"actual_value" json:"actual_value"`
	DriftType     string    `db:"drift_type" json:"drift_type"`
	DetectedAt    time.Time `db:"detected_at" json:"detected_at"`
	ResolvedAt    *time.Time `db:"resolved_at" json:"resolved_at,omitempty"`
	ResolvedBy    string    `db:"resolved_by" json:"resolved_by,omitempty"`
}

// DriftScanResult is the result of a drift scan.
type DriftScanResult struct {
	TenantID    string        `json:"tenant_id"`
	Environment string        `json:"environment"`
	ScannedAt   time.Time     `json:"scanned_at"`
	TotalKeys   int           `json:"total_keys"`
	DriftCount  int           `json:"drift_count"`
	Drifts      []DriftRecord `json:"drifts"`
}

// ---------- Feature Flag ----------

// FeatureFlag represents a feature flag.
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
	Whitelist   JSONB     `db:"whitelist" json:"whitelist,omitempty"`
	Variations  JSONB     `db:"variations" json:"variations,omitempty"`
	Tags        JSONB     `db:"tags" json:"tags,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// CreateFeatureFlagRequest is the request to create a feature flag.
type CreateFeatureFlagRequest struct {
	Key         string   `json:"key" binding:"required"`
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Enabled     *bool    `json:"enabled"`
	Environment string   `json:"environment"`
	FlagType    string   `json:"flag_type"`
	RolloutPct  int      `json:"rollout_pct"`
	Whitelist   []string `json:"whitelist"`
	Variations  *JSONB   `json:"variations"`
	Tags        []string `json:"tags"`
}

// UpdateFeatureFlagRequest is the request to update a feature flag.
type UpdateFeatureFlagRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
	FlagType    *string `json:"flag_type"`
	RolloutPct  *int    `json:"rollout_pct"`
	Variations  *JSONB  `json:"variations"`
	Tags        *[]string `json:"tags"`
}

// EvaluateFlagRequest is the request to evaluate a feature flag for a user.
type EvaluateFlagRequest struct {
	Key         string `json:"key" binding:"required"`
	UserID      string `json:"user_id"`
	Environment string `json:"environment"`
}

// EvaluateFlagResult is the result of evaluating a feature flag.
type EvaluateFlagResult struct {
	Key     string `json:"key"`
	Enabled bool   `json:"enabled"`
	Reason  string `json:"reason"`
}

// ---------- Git Sync ----------

// GitSyncConfig represents a GitOps configuration sync.
type GitSyncConfig struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	Name            string    `db:"name" json:"name"`
	RepoURL         string    `db:"repo_url" json:"repo_url"`
	Branch          string    `db:"branch" json:"branch"`
	Path            string    `db:"path" json:"path"`
	Environment     string    `db:"environment" json:"environment"`
	AutoSync        bool      `db:"auto_sync" json:"auto_sync"`
	SyncIntervalSec int       `db:"sync_interval_sec" json:"sync_interval_sec"`
	Enabled         bool      `db:"enabled" json:"enabled"`
	LastSyncAt      *time.Time `db:"last_sync_at" json:"last_sync_at"`
	LastSyncStatus  string    `db:"last_sync_status" json:"last_sync_status"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
}

// CreateGitSyncRequest is the request to create a Git sync config.
type CreateGitSyncRequest struct {
	Name            string  `json:"name" binding:"required"`
	RepoURL         string  `json:"repo_url" binding:"required"`
	Branch          string  `json:"branch"`
	Path            string  `json:"path"`
	Environment     string  `json:"environment"`
	AutoSync        *bool   `json:"auto_sync"`
	SyncIntervalSec int     `json:"sync_interval_sec"`
	Enabled         *bool   `json:"enabled"`
}

// SyncResult is the result of a Git sync operation.
type SyncResult struct {
	Success      bool      `json:"success"`
	SyncedAt     time.Time `json:"synced_at"`
	ItemsSynced  int       `json:"items_synced"`
	ItemsAdded   int       `json:"items_added"`
	ItemsUpdated int       `json:"items_updated"`
	ItemsRemoved int       `json:"items_removed"`
}

// ---------- Config Approval ----------

// ConfigApproval represents a config change approval request.
type ConfigApproval struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	ConfigKey     string    `db:"config_key" json:"config_key"`
	Environment   string    `db:"environment" json:"environment"`
	CurrentValue  string    `db:"current_value" json:"current_value"`
	ProposedValue string    `db:"proposed_value" json:"proposed_value"`
	Status        string    `db:"status" json:"status"` // pending, approved, rejected, applied
	RequestedBy   string    `db:"requested_by" json:"requested_by"`
	RequestedAt   time.Time `db:"requested_at" json:"requested_at"`
	ReviewedBy    string    `db:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time `db:"reviewed_at" json:"reviewed_at"`
	ReviewComment string    `db:"review_comment" json:"review_comment,omitempty"`
	AppliedAt     *time.Time `db:"applied_at" json:"applied_at"`
}

// CreateApprovalRequest is the request to create a config approval.
type CreateApprovalRequest struct {
	ConfigKey     string `json:"config_key" binding:"required"`
	ProposedValue string `json:"proposed_value" binding:"required"`
	Environment   string `json:"environment"`
	RequestedBy   string `json:"requested_by"`
}

// ReviewApprovalRequest is the request to review an approval.
type ReviewApprovalRequest struct {
	Status     string `json:"status" binding:"required"`
	ReviewedBy string `json:"reviewed_by"`
	Comment    string `json:"comment"`
}

// ---------- Config Snapshot (blueprint-extended) ----------

// ConfigSnapshotV2 is the blueprint-extended snapshot model.
type ConfigSnapshotV2 struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ConfigID    string    `db:"config_id" json:"config_id"`
	VersionID   string    `db:"version_id" json:"version_id"`
	Data        JSONB     `db:"data" json:"data"`
	Description string    `db:"description" json:"description"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// CreateSnapshotRequest is the request to create a snapshot.
type CreateSnapshotRequest struct {
	Description string `json:"description"`
	CreatedBy   string `json:"created_by"`
}

// ---------- Config Canary (blueprint-extended) ----------

// ConfigCanary represents a canary deployment for a config.
type ConfigCanary struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	ConfigID      string    `db:"config_id" json:"config_id"`
	CanaryValue   string    `db:"canary_value" json:"canary_value"`
	BaselineValue string    `db:"baseline_value" json:"baseline_value"`
	Status        string    `db:"status" json:"status"` // active, promoted, rolled_back
	CreatedBy     string    `db:"created_by" json:"created_by"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

const (
	CanaryStatusActive     = "active"
	CanaryStatusPromoted   = "promoted"
	CanaryStatusRolledBack = "rolled_back"
)

// CreateCanaryRequestV2 is the blueprint's canary request.
type CreateCanaryRequestV2 struct {
	CanaryValue string `json:"canary_value" binding:"required"`
	CreatedBy   string `json:"created_by"`
}

// ---------- Template (blueprint-extended) ----------

// TemplateVersion is the blueprint's template version model.
type TemplateVersion struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	TemplateID    string    `db:"template_id" json:"template_id"`
	VersionNumber int       `db:"version_number" json:"version_number"`
	Content       string    `db:"content" json:"content"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// CreateTemplateRequestV2 is the blueprint's template request.
type CreateTemplateRequestV2 struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Content     string   `json:"content" binding:"required"`
	Format      string   `json:"format"`
	Tags        []string `json:"tags"`
}

// UpdateTemplateRequestV2 is the blueprint's update template request.
type UpdateTemplateRequestV2 struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Content     *string `json:"content"`
	Format      *string `json:"format"`
	Tags        *[]string `json:"tags"`
}

// CreateTemplateVersionRequest is the blueprint's template version request.
type CreateTemplateVersionRequest struct {
	Content string `json:"content" binding:"required"`
}

// ---------- Webhook (blueprint-extended) ----------

// Webhook is the blueprint's webhook model.
type Webhook struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	URL       string    `db:"url" json:"url"`
	Secret    string    `db:"secret" json:"secret"`
	Events    JSONB     `db:"events" json:"events,omitempty"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// CreateWebhookRequestV2 is the blueprint's webhook request.
type CreateWebhookRequestV2 struct {
	Name    string   `json:"name" binding:"required"`
	URL     string   `json:"url" binding:"required"`
	Secret  string   `json:"secret"`
	Events  []string `json:"events"`
	Enabled *bool    `json:"enabled"`
}

// UpdateWebhookRequestV2 is the blueprint's update webhook request.
type UpdateWebhookRequestV2 struct {
	Name    *string `json:"name"`
	URL     *string `json:"url"`
	Secret  *string `json:"secret"`
	Events  *[]string `json:"events"`
	Enabled *bool    `json:"enabled"`
}
