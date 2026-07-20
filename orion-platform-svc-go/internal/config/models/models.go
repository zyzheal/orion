package models

import "time"

// ---------- Config ----------

type Config struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Key         string    `json:"key" db:"key"`
	Value       string    `json:"value" db:"value"`
	Environment string    `json:"environment" db:"environment"`
	DataType    string    `json:"data_type" db:"data_type"`
	Status      string    `json:"status" db:"status"` // active, archived
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateConfigRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Key         string `json:"key" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Environment string `json:"environment"`
	DataType    string `json:"data_type"`
}

type ConfigFilter struct {
	Environment string `form:"environment"`
	Status      string `form:"status"`
	Search      string `form:"search"`
	Page        int    `form:"page"`
	PageSize    int    `form:"pageSize"`
}

type UpdateConfigRequest struct {
	Description *string `json:"description"`
	Key         *string `json:"key"`
	Value       *string `json:"value"`
	Environment *string `json:"environment"`
	DataType    *string `json:"data_type"`
	Status      *string `json:"status"`
}

type CloneConfigRequest struct {
	TargetEnvironment string `json:"target_environment" binding:"required"`
}

// ---------- ConfigVersion ----------

type ConfigVersion struct {
	ID        string    `json:"id" db:"id"`
	ConfigID  string    `json:"config_id" db:"config_id"`
	Version   string    `json:"version" db:"version"`
	Value     string    `json:"value" db:"value"`
	Data      any       `json:"data" db:"data"`
	CreatedBy string    `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type RollbackRequest struct {
	Version string `json:"version" binding:"required"`
}

// ---------- GitOps ----------

type GitOpsConfig struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	RepositoryURL string    `json:"repository_url" db:"repository_url"`
	Branch        string    `json:"branch" db:"branch"`
	Path          string    `json:"path" db:"path"`
	Status        string    `json:"status" db:"status"` // enabled, disabled
	LastSyncAt    time.Time `json:"last_sync_at" db:"last_sync_at"`
	SyncStatus    string    `json:"sync_status" db:"sync_status"` // synced, pending, failed
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type CreateGitOpsRequest struct {
	RepositoryURL string `json:"repository_url" binding:"required"`
	Branch        string `json:"branch"`
	Path          string `json:"path"`
}

type GitOpsSyncStatus struct {
	ID        string    `json:"id" db:"id"`
	ConfigID  string    `json:"config_id" db:"config_id"`
	Status    string    `json:"status" db:"status"`
	Error     string    `json:"error" db:"error"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ---------- Change Request ----------

type ChangeRequest struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	ConfigID     string    `json:"config_id" db:"config_id"`
	Description  string    `json:"description" db:"description"`
	Status       string    `json:"status" db:"status"` // pending, approved, rejected, cancelled
	RequestedBy  string    `json:"requested_by" db:"requested_by"`
	ApprovedBy   string    `json:"approved_by" db:"approved_by"`
	RejectReason string    `json:"reject_reason" db:"reject_reason"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CreateChangeRequestRequest struct {
	ConfigID    string `json:"config_id" binding:"required"`
	Description string `json:"description" binding:"required"`
}

type ChangeApprovalRequest struct {
	Reason string `json:"reason"`
}

// ---------- Audit Trail ----------

type AuditEntry struct {
	ID        string    `json:"id" db:"id"`
	ConfigID  string    `json:"config_id" db:"config_id"`
	Action    string    `json:"action" db:"action"`
	Details   any       `json:"details" db:"details"`
	UserID    string    `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ---------- Config Template ----------

type ConfigTemplate struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Schema      any       `json:"schema" db:"schema"`
	Version     string    `json:"version" db:"version"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Schema      any    `json:"schema"`
}

type UpdateTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Schema      any     `json:"schema"`
}

type ConfigTemplateVersion struct {
	ID         string    `json:"id" db:"id"`
	TemplateID string    `json:"template_id" db:"template_id"`
	Version    string    `json:"version" db:"version"`
	Schema     any       `json:"schema" db:"schema"`
	CreatedBy  string    `json:"created_by" db:"created_by"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// ---------- Canary Deployment ----------

type CanaryDeployment struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	ConfigID       string    `json:"config_id" db:"config_id"`
	Status         string    `json:"status" db:"status"` // running, promoted, rolled_back
	TrafficPercent int       `json:"traffic_percent" db:"traffic_percent"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type CreateCanaryRequest struct {
	ConfigID       string `json:"config_id" binding:"required"`
	TrafficPercent int    `json:"traffic_percent"`
}

// ---------- Snapshot ----------

type ConfigSnapshot struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	ConfigID  string    `json:"config_id" db:"config_id"`
	Data      any       `json:"data" db:"data"`
	CreatedBy string    `json:"created_by" db:"created_by"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ---------- Diff ----------

type ConfigDiff struct {
	Key    string `json:"key"`
	OldVal string `json:"old_val"`
	NewVal string `json:"new_val"`
	Status string `json:"status"` // added, removed, modified
}

type EnvironmentDiffResult struct {
	SourceEnv   string       `json:"source_env"`
	TargetEnv   string       `json:"target_env"`
	Differences []ConfigDiff `json:"differences"`
	TotalCount  int          `json:"total_count"`
}

type VersionDiffResult struct {
	ConfigID    string       `json:"config_id"`
	VersionFrom string       `json:"version_from"`
	VersionTo   string       `json:"version_to"`
	Differences []ConfigDiff `json:"differences"`
}

// ---------- Dependency Graph ----------

type DependencyNode struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Type string   `json:"type"`
	Deps []string `json:"dependencies"`
}

// ---------- Webhook ----------

type ConfigWebhook struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	URL       string    `json:"url" db:"url"`
	Secret    string    `json:"secret" db:"secret"`
	Events    any       `json:"events" db:"events"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateWebhookRequest struct {
	Name    string `json:"name" binding:"required"`
	URL     string `json:"url" binding:"required"`
	Secret  string `json:"secret"`
	Events  any    `json:"events"`
	Enabled *bool  `json:"enabled"`
}

type UpdateWebhookRequest struct {
	Name    *string `json:"name"`
	URL     *string `json:"url"`
	Secret  *string `json:"secret"`
	Events  any     `json:"events"`
	Enabled *bool   `json:"enabled"`
}

// ---------- Response helpers ----------

type ListResult[T any] struct {
	Data     []T `json:"data"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
