// Package featureflag 集中管理 Triage 相关 Feature Flag。
//
// 参见: triage-api-contract-design §7 (Feature Flag 灰度)
package featureflag

// Flag Key 常量。
const (
	TriageEnabled           = "triage.enabled"
	TriageWebSocketEnabled  = "triage.websocket.enabled"
	TriagePartialFailure    = "triage.partial_failure"
	TriageDndFilter         = "triage.dnd_filter"
	TriageGroupBy           = "triage.group_by"
	NotificationPipeline    = "notification.pipeline_adapter"
	LayoutNavA11yV2         = "layout-nav-a11y-v2"
	G1UserRoleEnabled       = "g1.user_role.enabled"
	G2RecipientEnabled      = "g2.recipient.enabled"
	G3AdapterEnabled        = "g3.adapter.enabled"
)

// AllTriageFlags 列出 Triage 相关的所有 Flag Key，便于集中管理。
func AllTriageFlags() []string {
	return []string{
		TriageEnabled,
		TriageWebSocketEnabled,
		TriagePartialFailure,
		TriageDndFilter,
		TriageGroupBy,
		NotificationPipeline,
		LayoutNavA11yV2,
		G1UserRoleEnabled,
		G2RecipientEnabled,
		G3AdapterEnabled,
	}
}

// DefaultValues 返回各 Flag 的默认值（用于装配层初始化）。
func DefaultValues() map[string]bool {
	return map[string]bool{
		TriageEnabled:          true,
		TriageWebSocketEnabled: true,
		TriagePartialFailure:   false,
		TriageDndFilter:        false,
		TriageGroupBy:          true,
		NotificationPipeline:   false, // 灰度阶段默认关闭
		LayoutNavA11yV2:        false,
		G1UserRoleEnabled:      true,
		G2RecipientEnabled:     true,
		G3AdapterEnabled:       false,
	}
}
