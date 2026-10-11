// Package reader 定义 Triage 域的 4 个外部数据 Reader 接口。
//
// Triage 域不直接依赖 alert / ticket / oncall / notification 包，
// 而是通过这 4 个接口抽象，由装配层注入具体实现。
//
// 参见: backend-g1-g3-implementation-spec-2026-10-11.md §5
// 参见: triage-api-contract-design-2026-10-11.md §2
package reader

import (
	"context"

	"orion/platform-svc-go/internal/triage/models"
)

// AlertReader 读取告警数据。
type AlertReader interface {
	// List 按过滤条件列出告警，返回 TriageItem 转换后的视图。
	List(ctx context.Context, tenantID string, filter *models.Filter, offset, limit int) ([]models.TriageItem, int, error)

	// Get 根据 alert ID 获取单条。
	Get(ctx context.Context, tenantID, alertID string) (*models.TriageItem, error)

	// Acknowledge 确认告警。
	Acknowledge(ctx context.Context, tenantID, userID, alertID string) error

	// Assign 分配告警给某人。
	Assign(ctx context.Context, tenantID, alertID, toUserID string) error
}

// TicketReader 读取工单数据。
type TicketReader interface {
	List(ctx context.Context, tenantID string, filter *models.Filter, offset, limit int) ([]models.TriageItem, int, error)
	Get(ctx context.Context, tenantID, ticketID string) (*models.TriageItem, error)
	Acknowledge(ctx context.Context, tenantID, userID, ticketID string) error
	Assign(ctx context.Context, tenantID, ticketID, toUserID string) error
}

// OnCallReader 读取值班数据。
type OnCallReader interface {
	// CurrentDuty 返回某用户在指定时刻是否值班。
	CurrentDuty(ctx context.Context, tenantID, userID string) (*models.OnCallInfo, error)

	// Handoff 执行值班交接，返回交接 ID 和未处理项计数。
	Handoff(ctx context.Context, req *models.HandoffRequest) (*models.HandoffResponse, error)
}

// NotificationReader 提供发送 Triage 通知的能力。
type NotificationReader interface {
	// Notify 通过指定渠道通知用户 Triage 相关事件。
	Notify(ctx context.Context, tenantID, userID, channel string, title, body string) error
}
