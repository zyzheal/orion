package models

import "time"

type ConfigValueType string

const (
	ValueTypeString  ConfigValueType = "string"
	ValueTypeInt     ConfigValueType = "int"
	ValueTypeFloat   ConfigValueType = "float"
	ValueTypeBool    ConfigValueType = "bool"
	ValueTypeJSON    ConfigValueType = "json"
	ValueTypeSecret  ConfigValueType = "secret"
)

type NamespaceStatus string

const (
	NamespaceActive   NamespaceStatus = "active"
	NamespaceArchived NamespaceStatus = "archived"
)

// --- Namespace ---

type ConfigNamespace struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenantId"`
	Name        string          `db:"name" json:"name"`
	Description string          `db:"description" json:"description"`
	Status      NamespaceStatus `db:"status" json:"status"`
	CreatedAt   time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updatedAt"`
}

// --- Group ---

type ConfigGroup struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	NamespaceID string    `db:"namespace_id" json:"namespaceId"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// --- Item ---

type ConfigItem struct {
	ID         string          `db:"id" json:"id"`
	TenantID   string          `db:"tenant_id" json:"tenantId"`
	GroupID    string          `db:"group_id" json:"groupId"`
	NamespaceID string         `db:"namespace_id" json:"namespaceId"`
	KeyName    string          `db:"key_name" json:"keyName"`
	Value      string          `db:"value" json:"value"`
	ValueType  ConfigValueType `db:"value_type" json:"valueType"`
	Encrypted  bool            `db:"encrypted" json:"encrypted"`
	Description string         `db:"description" json:"description"`
	Labels     string          `db:"labels" json:"-"`
	CreatedAt  time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt  time.Time       `db:"updated_at" json:"updatedAt"`

	LabelsMap map[string]string `json:"labels,omitempty"`
}

// --- Item History ---

type ConfigItemHistory struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	ItemID    string    `db:"item_id" json:"itemId"`
	Version   int       `db:"version" json:"version"`
	OldValue  string    `db:"old_value" json:"oldValue,omitempty"`
	NewValue  string    `db:"new_value" json:"newValue"`
	Operator  string    `db:"operator" json:"operator"`
	Reason    string    `db:"reason" json:"reason"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// --- Snapshot ---

type ConfigSnapshot struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	GroupID     string    `db:"group_id" json:"groupId"`
	NamespaceID string    `db:"namespace_id" json:"namespaceId"`
	Environment string    `db:"environment" json:"environment"`
	Version     int       `db:"version" json:"version"`
	Data        string    `db:"data" json:"data"`
	Checksum    string    `db:"checksum" json:"checksum"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
}

// --- Release ---

type ReleaseStatus string

const (
	ReleasePending  ReleaseStatus = "pending"
	ReleaseReleased ReleaseStatus = "released"
	ReleaseFailed   ReleaseStatus = "failed"
	ReleaseRollback ReleaseStatus = "rollback"
)

type ConfigRelease struct {
	ID                    string        `db:"id" json:"id"`
	TenantID              string        `db:"tenant_id" json:"tenantId"`
	SnapshotID            string        `db:"snapshot_id" json:"snapshotId"`
	GroupID               string        `db:"group_id" json:"groupId"`
	Environment           string        `db:"environment" json:"environment"`
	ReleaseVersion        int           `db:"release_version" json:"releaseVersion"`
	Status                ReleaseStatus `db:"status" json:"status"`
	ReleaseNote           string        `db:"release_note" json:"releaseNote"`
	ReleasedAt            *time.Time    `db:"released_at" json:"releasedAt"`
	ReleasedBy            string        `db:"released_by" json:"releasedBy"`
	RollbackToSnapshotID  string        `db:"rollback_to_snapshot_id" json:"rollbackToSnapshotId,omitempty"`
	CreatedAt             time.Time     `db:"created_at" json:"createdAt"`
}

type ConfigReleaseHistory struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	ReleaseID   string    `db:"release_id" json:"releaseId"`
	GroupID     string    `db:"group_id" json:"groupId"`
	Environment string    `db:"environment" json:"environment"`
	Version     int       `db:"version" json:"version"`
	Operator    string    `db:"operator" json:"operator"`
	Action      string    `db:"action" json:"action"`
	Detail      string    `db:"detail" json:"detail"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

// --- Audit ---

type ConfigAudit struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenantId"`
	Actor      string    `db:"actor" json:"actor"`
	Action     string    `db:"action" json:"action"`
	TargetType string    `db:"target_type" json:"targetType"`
	TargetID   string    `db:"target_id" json:"targetId"`
	Detail     string    `db:"detail" json:"-"`
	IPAddress  string    `db:"ip_address" json:"ipAddress"`
	UserAgent  string    `db:"user_agent" json:"userAgent"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`

	DetailMap map[string]interface{} `json:"detail,omitempty"`
}

// --- Request/Response types ---

type CreateNamespaceRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type CreateGroupRequest struct {
	NamespaceID string `json:"namespaceId" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type CreateItemRequest struct {
	GroupID     string          `json:"groupId" binding:"required"`
	NamespaceID string          `json:"namespaceId" binding:"required"`
	KeyName     string          `json:"keyName" binding:"required"`
	Value       string          `json:"value" binding:"required"`
	ValueType   ConfigValueType `json:"valueType"`
	Encrypted   bool            `json:"encrypted"`
	Description string          `json:"description"`
	Labels      map[string]string `json:"labels"`
}

type UpdateItemRequest struct {
	Value       *string          `json:"value"`
	ValueType   *ConfigValueType `json:"valueType"`
	Encrypted   *bool            `json:"encrypted"`
	Description *string          `json:"description"`
	Labels      map[string]string `json:"labels"`
}

type PublishSnapshotRequest struct {
	Environment string `json:"environment" binding:"required"`
	Operator    string `json:"operator" binding:"required"`
}

type PublishReleaseRequest struct {
	SnapshotID  string `json:"snapshotId" binding:"required"`
	Environment string `json:"environment" binding:"required"`
	Operator    string `json:"operator" binding:"required"`
	ReleaseNote string `json:"releaseNote"`
}

type RollbackReleaseRequest struct {
	SnapshotID string `json:"snapshotId" binding:"required"`
	Operator   string `json:"operator" binding:"required"`
	Reason     string `json:"reason"`
}

type GetItemsFilter struct {
	GroupID    string `form:"groupId"`
	NamespaceID string `form:"namespaceId"`
}

type GetReleasesFilter struct {
	Environment *string `form:"environment"`
}

type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}