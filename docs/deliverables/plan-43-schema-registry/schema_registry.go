// ============================================================
// Plan 43 — 事件 Schema Registry
// ============================================================
// 优先级: P1
// 来源: 合并 Plan-24 event_bus.go 中的 SchemaRegistry 部分
// 本地证据:
//   - internal/eventbus/ (10文件, 632行): 有完整 service 但无 Schema Registry
//   - Plan-24 提供了 SchemaRegistry + EventSchema + FieldDef + 兼容性检查
// 技术约束: Go, JSON Schema
// ============================================================

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// --- Types ---

type FieldType string

const (
	FieldTypeString   FieldType = "string"
	FieldTypeInteger  FieldType = "integer"
	FieldTypeNumber   FieldType = "number"
	FieldTypeBoolean  FieldType = "boolean"
	FieldTypeArray    FieldType = "array"
	FieldTypeObject   FieldType = "object"
	FieldTypeTimestamp FieldType = "timestamp"
	FieldTypeUUID     FieldType = "uuid"
	FieldTypeEnum     FieldType = "enum"
)

type CompatibilityMode string

const (
	CompatBackward CompatibilityMode = "backward" // 新 schema 能读旧数据
	CompatForward  CompatibilityMode = "forward"  // 旧 schema 能读新数据
	CompatFull     CompatibilityMode = "full"      // 双向兼容
	CompatNone     CompatibilityMode = "none"       // 不检查
)

type FieldDef struct {
	Name        string      `json:"name"`
	Type        FieldType   `json:"type"`
	Required    bool        `json:"required"`
	Description string      `json:"description,omitempty"`
	Default     interface{} `json:"default,omitempty"`
	// 枚举值 (type=enum)
	EnumValues  []string    `json:"enumValues,omitempty"`
	// 嵌套字段 (type=object)
	Fields      []FieldDef  `json:"fields,omitempty"`
	// 数组元素类型 (type=array)
	Items       *FieldDef   `json:"items,omitempty"`
	// 最小/最大值约束
	MinValue    *float64    `json:"minValue,omitempty"`
	MaxValue    *float64    `json:"maxValue,omitempty"`
	// 字符串约束
	MinLength   int         `json:"minLength,omitempty"`
	MaxLength   int         `json:"maxLength,omitempty"`
	Pattern     string      `json:"pattern,omitempty"`
}

type EventSchema struct {
	ID            string            `json:"id"`
	Subject       string            `json:"subject"`       // e.g. "orion.alert.created"
	Name          string            `json:"name"`
	Version       string            `json:"version"`       // e.g. "1.0.0"
	Description   string            `json:"description,omitempty"`
	Fields        []FieldDef        `json:"fields"`
	Compatibility CompatibilityMode `json:"compatibility"`
	// 元数据
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
	CreatedBy     string            `json:"createdBy,omitempty"`
	// 版本历史
	PreviousVersion string          `json:"previousVersion,omitempty"`
}

type ValidationResult struct {
	Valid   bool     `json:"valid"`
	Errors  []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

type CompatibilityResult struct {
	Compatible     bool   `json:"compatible"`
	Mode           CompatibilityMode `json:"mode"`
	Errors         []string `json:"errors,omitempty"`
	BreakingChanges []string `json:"breakingChanges,omitempty"`
}

// --- Repository Interface ---

type SchemaRepositoryInterface interface {
	Create(ctx context.Context, schema *EventSchema) error
	Get(ctx context.Context, subject, version string) (*EventSchema, error)
	GetLatest(ctx context.Context, subject string) (*EventSchema, error)
	List(ctx context.Context, subject string) ([]*EventSchema, error)
	ListSubjects(ctx context.Context) ([]string, error)
	Delete(ctx context.Context, subject, version string) error
}

// --- Schema Registry ---

type SchemaRegistry struct {
	repo SchemaRepositoryInterface
	mu   sync.RWMutex
	// 本地缓存: subject → latest schema
	cache map[string]*EventSchema
}

func NewSchemaRegistry(repo SchemaRepositoryInterface) *SchemaRegistry {
	return &SchemaRegistry{
		repo:  repo,
		cache: make(map[string]*EventSchema),
	}
}

// --- Schema Registration ---

// Register 注册新 schema (检查兼容性)
func (r *SchemaRegistry) Register(ctx context.Context, schema *EventSchema) error {
	// 验证 schema 结构
	if err := r.validateSchema(schema); err != nil {
		return fmt.Errorf("validate schema: %w", err)
	}

	// 检查版本是否已存在
	existing, err := r.repo.Get(ctx, schema.Subject, schema.Version)
	if err == nil && existing != nil {
		return fmt.Errorf("schema %s version %s already exists", schema.Subject, schema.Version)
	}

	// 获取上一个版本，检查兼容性
	if schema.PreviousVersion != "" {
		prev, err := r.repo.Get(ctx, schema.Subject, schema.PreviousVersion)
		if err != nil {
			return fmt.Errorf("get previous version: %w", err)
		}

		result := r.checkCompatibility(prev, schema)
		if !result.Compatible {
			return fmt.Errorf("schema incompatible: %s (breaking changes: %v)",
				result.Errors, result.BreakingChanges)
		}
	}

	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()

	if err := r.repo.Create(ctx, schema); err != nil {
		return fmt.Errorf("create schema: %w", err)
	}

	// 更新缓存
	r.mu.Lock()
	r.cache[schema.Subject] = schema
	r.mu.Unlock()

	return nil
}

// --- Validation ---

// ValidateEvent 验证事件是否符合 schema
func (r *SchemaRegistry) ValidateEvent(ctx context.Context, subject string, data []byte) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// 获取最新 schema
	schema, err := r.getSchemaCached(ctx, subject)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("schema not found: %s", subject))
		return result
	}

	// 解析 JSON
	var dataMap map[string]interface{}
	if err := json.Unmarshal(data, &dataMap); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("invalid JSON: %v", err))
		return result
	}

	// 验证字段
	r.validateFields(dataMap, schema.Fields, "", result)

	return result
}

// validateFields 递归验证字段
func (r *SchemaRegistry) validateFields(data map[string]interface{}, fields []FieldDef, prefix string, result *ValidationResult) {
	for _, field := range fields {
		path := field.Name
		if prefix != "" {
			path = prefix + "." + field.Name
		}

		value, exists := data[field.Name]

		// 检查必填
		if field.Required && !exists {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("field '%s' is required", path))
			continue
		}

		if !exists {
			continue // 可选字段不存在，跳过
		}

		// 类型检查
		if err := r.validateFieldType(value, field, path); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, err.Error())
		}

		// 嵌套对象验证
		if field.Type == FieldTypeObject && field.Fields != nil {
			if nestedMap, ok := value.(map[string]interface{}); ok {
				r.validateFields(nestedMap, field.Fields, path, result)
			}
		}
	}
}

// validateFieldType 验证字段类型
func (r *SchemaRegistry) validateFieldType(value interface{}, field FieldDef, path string) error {
	switch field.Type {
	case FieldTypeString:
		if _, ok := value.(string); !ok {
			return fmt.Errorf("field '%s' must be string, got %T", path, value)
		}
		// 字符串约束
		s := value.(string)
		if field.MaxLength > 0 && len(s) > field.MaxLength {
			return fmt.Errorf("field '%s' exceeds max length %d", path, field.MaxLength)
		}
		if field.MinLength > 0 && len(s) < field.MinLength {
			return fmt.Errorf("field '%s' below min length %d", path, field.MinLength)
		}

	case FieldTypeInteger:
		if _, ok := value.(float64); !ok {
			// JSON 数字解析为 float64
			return fmt.Errorf("field '%s' must be integer, got %T", path, value)
		}
		n := value.(float64)
		if field.MinValue != nil && n < *field.MinValue {
			return fmt.Errorf("field '%s' below min value %v", path, *field.MinValue)
		}
		if field.MaxValue != nil && n > *field.MaxValue {
			return fmt.Errorf("field '%s' exceeds max value %v", path, *field.MaxValue)
		}

	case FieldTypeBoolean:
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("field '%s' must be boolean, got %T", path, value)
		}

	case FieldTypeArray:
		arr, ok := value.([]interface{})
		if !ok {
			return fmt.Errorf("field '%s' must be array, got %T", path, value)
		}
		if field.Items != nil {
			for i, item := range arr {
				if err := r.validateFieldType(item, *field.Items, fmt.Sprintf("%s[%d]", path, i)); err != nil {
					return err
				}
			}
		}

	case FieldTypeEnum:
		s, ok := value.(string)
		if !ok {
			return fmt.Errorf("field '%s' must be string (enum), got %T", path, value)
		}
		found := false
		for _, v := range field.EnumValues {
			if s == v {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("field '%s' value '%s' not in enum %v", path, s, field.EnumValues)
		}
	}

	return nil
}

// --- Compatibility Check ---

// checkCompatibility 检查新 schema 与旧 schema 的兼容性
func (r *SchemaRegistry) checkCompatibility(old, new *EventSchema) *CompatibilityResult {
	result := &CompatibilityResult{
		Mode: new.Compatibility,
	}

	// 构建旧字段映射
	oldFields := make(map[string]FieldDef)
	for _, f := range old.Fields {
		oldFields[f.Name] = f
	}

	// 构建新字段映射
	newFields := make(map[string]FieldDef)
	for _, f := range new.Fields {
		newFields[f.Name] = f
	}

	// Backward: 新 schema 能读旧数据
	// → 新增的必填字段 → 不兼容 (旧数据没有)
	// → 删除字段 → 兼容
	// → 类型变更 → 不兼容
	if new.Compatibility == CompatBackward || new.Compatibility == CompatFull {
		for name, newField := range newFields {
			oldField, exists := oldFields[name]
			if !exists {
				// 新增字段
				if newField.Required && newField.Default == nil {
					result.Compatible = false
					result.BreakingChanges = append(result.BreakingChanges,
						fmt.Sprintf("new required field '%s' without default", name))
				}
				continue
			}
			// 类型变更检查
			if oldField.Type != newField.Type {
				result.Compatible = false
				result.BreakingChanges = append(result.BreakingChanges,
					fmt.Sprintf("field '%s' type changed: %s → %s", name, oldField.Type, newField.Type))
			}
			// 必填变更: 可选→必填 → 不兼容
			if !oldField.Required && newField.Required {
				result.Compatible = false
				result.BreakingChanges = append(result.BreakingChanges,
					fmt.Sprintf("field '%s' changed from optional to required", name))
			}
		}
	}

	// Forward: 旧 schema 能读新数据
	// → 删除的必填字段 → 不兼容 (新数据没有)
	if new.Compatibility == CompatForward || new.Compatibility == CompatFull {
		for name, oldField := range oldFields {
			newField, exists := newFields[name]
			if !exists {
				// 删除字段
				if oldField.Required {
					result.Compatible = false
					result.BreakingChanges = append(result.BreakingChanges,
						fmt.Sprintf("required field '%s' was deleted", name))
				}
				continue
			}
			// 类型变更
			if oldField.Type != newField.Type {
				result.Compatible = false
				result.BreakingChanges = append(result.BreakingChanges,
					fmt.Sprintf("field '%s' type changed: %s → %s", name, oldField.Type, newField.Type))
			}
		}
	}

	if new.Compatibility == CompatNone {
		result.Compatible = true
	}

	if result.Compatible {
		result.Errors = nil
		result.BreakingChanges = nil
	}

	return result
}

// --- Helpers ---

func (r *SchemaRegistry) validateSchema(schema *EventSchema) error {
	if schema.Subject == "" {
		return fmt.Errorf("subject is required")
	}
	if schema.Version == "" {
		return fmt.Errorf("version is required")
	}
	if len(schema.Fields) == 0 {
		return fmt.Errorf("fields cannot be empty")
	}
	return nil
}

func (r *SchemaRegistry) getSchemaCached(ctx context.Context, subject string) (*EventSchema, error) {
	r.mu.RLock()
	if cached, ok := r.cache[subject]; ok {
		r.mu.RUnlock()
		return cached, nil
	}
	r.mu.RUnlock()

	schema, err := r.repo.GetLatest(ctx, subject)
	if err != nil {
		return nil, err
	}

	r.mu.Lock()
	r.cache[subject] = schema
	r.mu.Unlock()

	return schema, nil
}

// --- Public Query API ---

// GetSchema 获取 schema
func (r *SchemaRegistry) GetSchema(ctx context.Context, subject, version string) (*EventSchema, error) {
	return r.repo.Get(ctx, subject, version)
}

// GetLatestSchema 获取最新版本 schema
func (r *SchemaRegistry) GetLatestSchema(ctx context.Context, subject string) (*EventSchema, error) {
	return r.repo.GetLatest(ctx, subject)
}

// ListSchemas 列出 subject 的所有版本
func (r *SchemaRegistry) ListSchemas(ctx context.Context, subject string) ([]*EventSchema, error) {
	return r.repo.List(ctx, subject)
}

// ListSubjects 列出所有 subject
func (r *SchemaRegistry) ListSubjects(ctx context.Context) ([]string, error) {
	return r.repo.ListSubjects(ctx)
}

// --- Default Schemas ---

// DefaultEventSchemas 返回内置事件 schema 定义
func DefaultEventSchemas() []*EventSchema {
	return []*EventSchema{
		{
			Subject: "orion.alert.created", Name: "Alert Created",
			Version: "1.0.0", Compatibility: CompatBackward,
			Fields: []FieldDef{
				{Name: "alertId", Type: FieldTypeUUID, Required: true, Description: "Alert unique ID"},
				{Name: "ruleName", Type: FieldTypeString, Required: true, MaxLength: 255},
				{Name: "severity", Type: FieldTypeEnum, Required: true, EnumValues: []string{"critical", "warning", "info"}},
				{Name: "message", Type: FieldTypeString, Required: true, MaxLength: 4096},
				{Name: "labels", Type: FieldTypeObject, Required: false},
				{Name: "timestamp", Type: FieldTypeTimestamp, Required: true},
			},
		},
		{
			Subject: "orion.pipeline.completed", Name: "Pipeline Completed",
			Version: "1.0.0", Compatibility: CompatFull,
			Fields: []FieldDef{
				{Name: "pipelineId", Type: FieldTypeUUID, Required: true},
				{Name: "status", Type: FieldTypeEnum, Required: true, EnumValues: []string{"success", "failed", "aborted"}},
				{Name: "duration", Type: FieldTypeInteger, Required: true, MinValue: ptrFloat64(0)},
				{Name: "timestamp", Type: FieldTypeTimestamp, Required: true},
			},
		},
		{
			Subject: "orion.deployment.started", Name: "Deployment Started",
			Version: "1.0.0", Compatibility: CompatBackward,
			Fields: []FieldDef{
				{Name: "deploymentId", Type: FieldTypeUUID, Required: true},
				{Name: "environment", Type: FieldTypeString, Required: true},
				{Name: "version", Type: FieldTypeString, Required: true},
				{Name: "strategy", Type: FieldTypeEnum, Required: true, EnumValues: []string{"blue-green", "canary", "rolling"}},
				{Name: "timestamp", Type: FieldTypeTimestamp, Required: true},
			},
		},
	}
}

func ptrFloat64(v float64) *float64 { return &v }
