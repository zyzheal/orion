package models

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// Text is a column value that 395 or 406 allows to be NULL. A plain string
// field cannot receive a NULL: database/sql refuses the scan before sqlx
// ever sees the row, so one NULL anywhere in the result set fails the whole
// read and the route answers 500. Text accepts the NULL and stores it as the
// zero string, which is what the rest of the module already treats as absent.
type Text string

func (t *Text) Scan(src interface{}) error {
	if src == nil {
		*t = ""
		return nil
	}
	switch v := src.(type) {
	case string:
		*t = Text(v)
	case []byte:
		*t = Text(v)
	default:
		return fmt.Errorf("cannot scan %T into Text", src)
	}
	return nil
}

// Value is mandatory as well as Scan: without it lib/pq would hit its
// unknown-type branch and fail the write.
func (t Text) Value() (driver.Value, error) {
	return string(t), nil
}

type ConfigValueType string

const (
	ValueTypeString ConfigValueType = "string"
	ValueTypeInt    ConfigValueType = "int"
	ValueTypeFloat  ConfigValueType = "float"
	ValueTypeBool   ConfigValueType = "bool"
	ValueTypeJSON   ConfigValueType = "json"
	ValueTypeSecret ConfigValueType = "secret"
)

type NamespaceStatus string

const (
	NamespaceActive   NamespaceStatus = "active"
	NamespaceArchived NamespaceStatus = "archived"
)

// --- Config Level (Phase 302: platform/tenant/user 三层覆盖) ---

// ConfigLevel 表示配置项的层级作用范围。
// 覆盖顺序：platform (100) → tenant (50) → user (10)，数值越大越优先。
type ConfigLevel string

const (
	ConfigLevelPlatform ConfigLevel = "platform"
	ConfigLevelTenant   ConfigLevel = "tenant"
	ConfigLevelUser     ConfigLevel = "user"
)

// Priority 返回该 Level 的数值优先级（用于 ResolveEffectiveConfig 合并）。
func (l ConfigLevel) Priority() int {
	switch l {
	case ConfigLevelPlatform:
		return 100
	case ConfigLevelTenant:
		return 50
	case ConfigLevelUser:
		return 10
	default:
		return 0
	}
}

// IsValid 校验 Level 是否合法（platform/tenant/user）。
func (l ConfigLevel) IsValid() bool {
	switch l {
	case ConfigLevelPlatform, ConfigLevelTenant, ConfigLevelUser:
		return true
	}
	return false
}

// NormalizeLevel 将空值/非法值归一化为 tenant（向后兼容旧数据）。
func NormalizeLevel(l ConfigLevel) ConfigLevel {
	if l.IsValid() {
		return l
	}
	return ConfigLevelTenant
}

// --- Namespace ---

type ConfigNamespace struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenantId"`
	Name        string          `db:"name" json:"name"`
	Description Text            `db:"description" json:"description"`
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
	Description Text      `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// --- Item ---

type ConfigItem struct {
	ID          string          `db:"id" json:"id"`
	TenantID    string          `db:"tenant_id" json:"tenantId"`
	GroupID     string          `db:"group_id" json:"groupId"`
	NamespaceID string          `db:"namespace_id" json:"namespaceId"`
	KeyName     string          `db:"key_name" json:"keyName"`
	Value       string          `db:"value" json:"value"`
	ValueType   ConfigValueType `db:"value_type" json:"valueType"`
	Encrypted   bool            `db:"encrypted" json:"encrypted"`
	Description Text            `db:"description" json:"description"`
	Labels      Text            `db:"labels" json:"-"`
	CreatedAt   time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time       `db:"updated_at" json:"updatedAt"`

	// Phase 302: 三层覆盖字段
	Level      ConfigLevel `db:"level" json:"level"`            // platform|tenant|user，默认 tenant
	OverrideOf Text        `db:"override_of" json:"overrideOf"` // 被覆盖的 platform/tenant item ID（可空）
	Priority   int         `db:"priority" json:"priority"`      // 数值越大越优先（platform=100, tenant=50, user=10）

	LabelsMap map[string]string `json:"labels,omitempty"`
}

// --- Item History ---

type ConfigItemHistory struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	ItemID    string    `db:"item_id" json:"itemId"`
	Version   int       `db:"version" json:"version"`
	OldValue  Text      `db:"old_value" json:"oldValue,omitempty"`
	NewValue  string    `db:"new_value" json:"newValue"`
	Operator  string    `db:"operator" json:"operator"`
	Reason    Text      `db:"reason" json:"reason"`
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
	ID                   string        `db:"id" json:"id"`
	TenantID             string        `db:"tenant_id" json:"tenantId"`
	SnapshotID           string        `db:"snapshot_id" json:"snapshotId"`
	GroupID              string        `db:"group_id" json:"groupId"`
	Environment          string        `db:"environment" json:"environment"`
	ReleaseVersion       int           `db:"release_version" json:"releaseVersion"`
	Status               ReleaseStatus `db:"status" json:"status"`
	ReleaseNote          Text          `db:"release_note" json:"releaseNote"`
	ReleasedAt           *time.Time    `db:"released_at" json:"releasedAt"`
	ReleasedBy           Text          `db:"released_by" json:"releasedBy"`
	RollbackToSnapshotID Text          `db:"rollback_to_snapshot_id" json:"rollbackToSnapshotId,omitempty"`
	CreatedAt            time.Time     `db:"created_at" json:"createdAt"`
}

type ConfigReleaseHistory struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	ReleaseID   string    `db:"release_id" json:"releaseId"`
	GroupID     string    `db:"group_id" json:"groupId"`
	Environment string    `db:"environment" json:"environment"`
	Version     int       `db:"version" json:"version"`
	Operator    Text      `db:"operator" json:"operator"`
	Action      string    `db:"action" json:"action"`
	Detail      Text      `db:"detail" json:"detail"`
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
	Detail     Text      `db:"detail" json:"-"`
	IPAddress  Text      `db:"ip_address" json:"ipAddress"`
	UserAgent  Text      `db:"user_agent" json:"userAgent"`
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
	GroupID     string            `json:"groupId" binding:"required"`
	NamespaceID string            `json:"namespaceId" binding:"required"`
	KeyName     string            `json:"keyName" binding:"required"`
	Value       string            `json:"value" binding:"required"`
	ValueType   ConfigValueType   `json:"valueType"`
	Encrypted   bool              `json:"encrypted"`
	Description string            `json:"description"`
	Labels      map[string]string `json:"labels"`
	Level       ConfigLevel       `json:"level"`      // Phase 302: 默认 tenant
	OverrideOf  string            `json:"overrideOf"` // Phase 302: 被覆盖的 item ID
}

type UpdateItemRequest struct {
	Value       *string           `json:"value"`
	ValueType   *ConfigValueType  `json:"valueType"`
	Encrypted   *bool             `json:"encrypted"`
	Description *string           `json:"description"`
	Labels      map[string]string `json:"labels"`
	Level       *ConfigLevel      `json:"level"`      // Phase 302: 可修改 Level
	OverrideOf  *string           `json:"overrideOf"` // Phase 302: 可修改 OverrideOf
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
	GroupID      string      `form:"groupId"`
	NamespaceID  string      `form:"namespaceId"`
	Level        ConfigLevel `form:"level"`        // Phase 302: 按 Level 过滤（platform/tenant/user）
	OverrideOnly bool        `form:"overrideOnly"` // Phase 302: 仅返回有下层覆盖的 item
	UserID       string      `form:"userId"`       // Phase 302: ResolveEffectiveConfig 用（可选）
}

// ConfigValue 表示一个合并后的配置项（含来源信息）。
type ConfigValue struct {
	ItemID    string          `json:"itemId"`
	KeyName   string          `json:"keyName"`
	Value     string          `json:"value"`
	ValueType ConfigValueType `json:"valueType"`
	Level     ConfigLevel     `json:"level"`
	Priority  int             `json:"priority"`
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
