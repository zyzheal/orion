// Package models — Builtin extension point catalog.
//
// Phase 303 T-SPI: introduces 15 builtin extension points that are the
// first-class citizens of the platform's pluggable surface. They represent
// well-known lifecycle hooks that any tenant or plugin can register a
// handler against. The catalog is immutable and read-only at runtime;
// dynamic registration continues to happen via ServiceEx.Register (HTTP)
// or ExtensionRegistry.Register (programmatic).
//
// Usage:
//
//	builtins := models.ListBuiltinPoints()           // all 15
//	byCat := models.ListBuiltinPointsByCategory(models.CategoryAPI) // subset
//	meta := models.BuiltinPointRegistry[models.BuiltinPreRequest]
package models

import "sort"

// ---------------------------------------------------------------------------
// Builtin extension point IDs (15)
// ---------------------------------------------------------------------------

const (
	// --- CategoryAPI ---
	BuiltinPreRequest     = "pre_request"      // API 前置钩子（可修改 request 上下文）
	BuiltinPostRequest    = "post_request"     // API 后置钩子（可修改 response）
	BuiltinAuthMiddleware = "auth_middleware"  // 认证中间件注入点

	// --- CategoryHandler ---
	BuiltinBeforeHandler = "before_handler" // Handler 执行前
	BuiltinAfterHandler  = "after_handler"  // Handler 执行后

	// --- CategoryService ---
	BuiltinPreSave    = "pre_save"     // 实体保存前（校验/默认值/脱敏）
	BuiltinPostSave   = "post_save"    // 实体保存后（副作用/事件广播）
	BuiltinDeleteHook = "delete_hook"  // 实体删除前（级联/软删/审计）

	// --- CategoryListener ---
	BuiltinAuditHook       = "audit_hook"       // 审计日志钩子
	BuiltinNotification    = "notification"     // 通知发送钩子
	BuiltinWebhookDispatch = "webhook_dispatch" // Webhook 分派

	// --- CategoryStartup ---
	BuiltinOnStartup     = "on_startup"     // 启动初始化
	BuiltinOnShutdown    = "on_shutdown"    // 优雅关闭
	BuiltinConfigChanged = "config_changed" // 配置变更通知
)

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

// BuiltinPointMeta describes a builtin extension point. It is exposed via
// GET /extension-points/builtins so the console / SDK can render a stable
// catalog. All fields are read-only at runtime.
type BuiltinPointMeta struct {
	ID           string `json:"id"`                       // unique id (snake_case)
	Category     string `json:"category"`                 // startup|api|handler|service|listener
	Description  string `json:"description"`              // 一句话语义
	DefaultOrder int    `json:"defaultOrder"`             // 默认 priority（越小越先执行）
	BuiltIn      bool   `json:"builtin"`                  // 恒为 true；用于 UI 区分内置 vs 用户注册
}

// BuiltinPointRegistry is the source of truth for the 15 builtin extension
// points. It is intentionally declared as a package-level var (not const map)
// so tests can assert size/stability and future phases can register more.
var BuiltinPointRegistry = map[string]BuiltinPointMeta{
	BuiltinPreRequest: {
		ID:           BuiltinPreRequest,
		Category:     CategoryAPI,
		Description:  "API 前置钩子，可修改 request 上下文（如租户解析、速率限制）",
		DefaultOrder: 10,
		BuiltIn:      true,
	},
	BuiltinPostRequest: {
		ID:           BuiltinPostRequest,
		Category:     CategoryAPI,
		Description:  "API 后置钩子，可修改 response（如响应脱敏、追踪头注入）",
		DefaultOrder: 90,
		BuiltIn:      true,
	},
	BuiltinAuthMiddleware: {
		ID:           BuiltinAuthMiddleware,
		Category:     CategoryAPI,
		Description:  "认证中间件注入点，用于替换或叠加认证策略",
		DefaultOrder: 20,
		BuiltIn:      true,
	},
	BuiltinBeforeHandler: {
		ID:           BuiltinBeforeHandler,
		Category:     CategoryHandler,
		Description:  "Handler 执行前钩子（可短路返回）",
		DefaultOrder: 30,
		BuiltIn:      true,
	},
	BuiltinAfterHandler: {
		ID:           BuiltinAfterHandler,
		Category:     CategoryHandler,
		Description:  "Handler 执行后钩子（响应后处理）",
		DefaultOrder: 70,
		BuiltIn:      true,
	},
	BuiltinPreSave: {
		ID:           BuiltinPreSave,
		Category:     CategoryService,
		Description:  "实体保存前钩子（校验、默认值填充、脱敏）",
		DefaultOrder: 10,
		BuiltIn:      true,
	},
	BuiltinPostSave: {
		ID:           BuiltinPostSave,
		Category:     CategoryService,
		Description:  "实体保存后钩子（副作用、事件广播）",
		DefaultOrder: 90,
		BuiltIn:      true,
	},
	BuiltinDeleteHook: {
		ID:           BuiltinDeleteHook,
		Category:     CategoryService,
		Description:  "实体删除前钩子（级联、软删、审计）",
		DefaultOrder: 20,
		BuiltIn:      true,
	},
	BuiltinAuditHook: {
		ID:           BuiltinAuditHook,
		Category:     CategoryListener,
		Description:  "审计日志钩子（写入审计表 / 上报 SIEM）",
		DefaultOrder: 10,
		BuiltIn:      true,
	},
	BuiltinNotification: {
		ID:           BuiltinNotification,
		Category:     CategoryListener,
		Description:  "通知发送钩子（邮件、IM、短信）",
		DefaultOrder: 30,
		BuiltIn:      true,
	},
	BuiltinWebhookDispatch: {
		ID:           BuiltinWebhookDispatch,
		Category:     CategoryListener,
		Description:  "Webhook 分派钩子（对外回调）",
		DefaultOrder: 50,
		BuiltIn:      true,
	},
	BuiltinOnStartup: {
		ID:           BuiltinOnStartup,
		Category:     CategoryStartup,
		Description:  "服务启动初始化（连接外部依赖、预热缓存）",
		DefaultOrder: 10,
		BuiltIn:      true,
	},
	BuiltinOnShutdown: {
		ID:           BuiltinOnShutdown,
		Category:     CategoryStartup,
		Description:  "优雅关闭钩子（flush、断连）",
		DefaultOrder: 90,
		BuiltIn:      true,
	},
	BuiltinConfigChanged: {
		ID:           BuiltinConfigChanged,
		Category:     CategoryStartup,
		Description:  "配置变更通知钩子（订阅 distributed-config 更新）",
		DefaultOrder: 50,
		BuiltIn:      true,
	},
}

// BuiltinPointCount returns the number of registered builtin extension points.
// It is a stability guardrail: any change to the count must be a deliberate
// breaking change and reflected in the API docs.
func BuiltinPointCount() int {
	return len(BuiltinPointRegistry)
}

// ListBuiltinPoints returns all builtin extension points sorted by category
// then default order (deterministic ordering for UI / SDK rendering).
func ListBuiltinPoints() []BuiltinPointMeta {
	out := make([]BuiltinPointMeta, 0, len(BuiltinPointRegistry))
	for _, m := range BuiltinPointRegistry {
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Category != out[j].Category {
			return out[i].Category < out[j].Category
		}
		if out[i].DefaultOrder != out[j].DefaultOrder {
			return out[i].DefaultOrder < out[j].DefaultOrder
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// ListBuiltinPointsByCategory returns builtin extension points of the given
// category, sorted by default order. Empty result (not nil) when the category
// has no builtins; unknown categories also return an empty slice.
func ListBuiltinPointsByCategory(category string) []BuiltinPointMeta {
	out := make([]BuiltinPointMeta, 0)
	for _, m := range BuiltinPointRegistry {
		if m.Category == category {
			out = append(out, m)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].DefaultOrder != out[j].DefaultOrder {
			return out[i].DefaultOrder < out[j].DefaultOrder
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// IsValidBuiltinPoint reports whether id is a registered builtin extension
// point ID.
func IsValidBuiltinPoint(id string) bool {
	_, ok := BuiltinPointRegistry[id]
	return ok
}
