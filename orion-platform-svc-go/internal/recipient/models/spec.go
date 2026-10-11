package models

import (
	"encoding/json"
	"time"
)

// Kind 是收件人规范类型。
type Kind string

const (
	KindUser        Kind = "user"         // 显式用户列表
	KindRole        Kind = "role"         // 拥有某角色的用户
	KindTeam        Kind = "team"         // 团队全部成员
	KindOncallDuty  Kind = "oncall-duty"  // 当班主/备人员
	KindEscalation  Kind = "escalation"   // 升级策略某级别接收人
	KindBroadcast   Kind = "broadcast"    // 广播到全体/某范围
)

// RecipientSpec 是标准收件人规范。
type RecipientSpec struct {
	Kind      Kind              `json:"kind" binding:"required"`
	TenantID  string            `json:"tenant_id" binding:"required"`
	Params    map[string]any    `json:"params"`
}

// ResolvedUser 是解析后的具体接收人。
type ResolvedUser struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name,omitempty"`
	Role        string `json:"role,omitempty"` // primary / secondary / member
}

// ResolveResult 是 Resolver 的输出。
type ResolveResult struct {
	ResolvedAt    time.Time      `json:"resolved_at"`
	SpecKind      Kind           `json:"spec_kind"`
	ResolvedUsers []ResolvedUser `json:"resolved_users"`
	CacheHit      bool           `json:"cache_hit"`
	TTLSeconds    int            `json:"ttl_seconds"`
}

// 参数辅助函数：安全地从 Params 中取值。
func (s RecipientSpec) ParamString(key string) string {
	if v, ok := s.Params[key]; ok {
		if str, ok := v.(string); ok {
			return str
		}
	}
	return ""
}

func (s RecipientSpec) ParamInt(key string) (int, bool) {
	if v, ok := s.Params[key]; ok {
		switch n := v.(type) {
		case int:
			return n, true
		case float64:
			return int(n), true
		case json.Number:
			i, err := n.Int64()
			if err == nil {
				return int(i), true
			}
		}
	}
	return 0, false
}

func (s RecipientSpec) ParamStringSlice(key string) []string {
	var out []string
	if v, ok := s.Params[key]; ok {
		switch arr := v.(type) {
		case []string:
			out = arr
		case []any:
			for _, item := range arr {
				if s, ok := item.(string); ok {
					out = append(out, s)
				}
			}
		}
	}
	return out
}

// ResolveRequest 是 POST /api/v1/recipient-resolve 的请求体。
type ResolveRequest struct {
	Spec RecipientSpec `json:"spec" binding:"required"`
}

// ResolveResponse 是响应体。
type ResolveResponse struct {
	Data ResolveResult `json:"data"`
}
