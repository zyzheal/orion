// Package models 定义 G4 Triage 域的数据模型。
//
// 参见: triage-api-contract-design-2026-10-11.md §1
package models

import "time"

// Severity 告警严重级别。
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

// Status 项目状态。
type Status string

const (
	StatusOpen        Status = "open"
	StatusAcknowledged Status = "acknowledged"
	StatusAssigned    Status = "assigned"
	StatusInProgress  Status = "in_progress"
	StatusResolved    Status = "resolved"
	StatusCancelled   Status = "cancelled"
)

// AssignedScope 表示分配范围。
type AssignedScope string

const (
	ScopeUnassigned AssignedScope = "unassigned"
	ScopeAssigned   AssignedScope = "assigned"
	ScopeMine       AssignedScope = "mine"
	ScopeTeam       AssignedScope = "team"
)

// TimeRange 是时间范围选择。
type TimeRange string

const (
	Range1H  TimeRange = "1h"
	Range24H TimeRange = "24h"
	Range7D  TimeRange = "7d"
	Range30D TimeRange = "30d"
)

// TriageItem 是 Triage 面板的每一项。
type TriageItem struct {
	ID             string        `json:"id"`
	TenantID       string        `json:"tenant_id"`
	Type           string        `json:"type"` // alert / ticket / oncall
	SourceType     string        `json:"source_type"`
	SourceID       string        `json:"source_id"`
	Title          string        `json:"title"`
	Summary        string        `json:"summary,omitempty"`
	Severity       Severity      `json:"severity"`
	Status         Status        `json:"status"`
	AssignedTo     string        `json:"assigned_to,omitempty"`
	AssignedScope  AssignedScope `json:"assigned_scope"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	AcknowledgedAt *time.Time    `json:"acknowledged_at,omitempty"`
	ResolvedAt     *time.Time    `json:"resolved_at,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
}

// MyOverview 是当前用户的总览视图数据。
type MyOverview struct {
	Me              OnCallInfo    `json:"me"`
	OpenBySeverity  map[Severity]int `json:"open_by_severity"`
	OpenByStatus    map[Status]int   `json:"open_by_status"`
	AssignedToMe    int           `json:"assigned_to_me"`
	TeamOpen        int           `json:"team_open"`
	RecentActivity  []TriageItem  `json:"recent_activity"`
	GeneratedAt     time.Time     `json:"generated_at"`
}

// OnCallInfo 描述当前用户的值班信息。
type OnCallInfo struct {
	UserID        string    `json:"user_id"`
	DisplayName   string    `json:"display_name"`
	IsOnDuty      bool      `json:"is_on_duty"`
	ScheduleID    string    `json:"schedule_id,omitempty"`
	RotationID    string    `json:"rotation_id,omitempty"`
	ShiftStart    time.Time `json:"shift_start,omitempty"`
	ShiftEnd      time.Time `json:"shift_end,omitempty"`
	ShiftRole     string    `json:"shift_role,omitempty"` // primary / secondary
	HandoffPending bool     `json:"handoff_pending,omitempty"`
}

// Filter 是查询过滤器。
type Filter struct {
	Severity      *Severity      `json:"severity,omitempty"`
	SourceType    *string        `json:"source_type,omitempty"`
	Status        *Status        `json:"status,omitempty"`
	AssignedScope *AssignedScope `json:"assigned_scope,omitempty"`
	TimeRange     *TimeRange     `json:"time_range,omitempty"`
	Search        *string        `json:"search,omitempty"`
}

// OverviewRequest GET /api/v1/triage/overview 请求。
type OverviewRequest struct {
	IncludeActivity  bool `json:"include_activity"`
	LimitActivity    int  `json:"limit_activity"`
}

// SubsetRequest 通用子集查询。
type SubsetRequest struct {
	Filter   *Filter `json:"filter"`
	Page     int     `json:"page"`
	PageSize int     `json:"page_size"`
}

// SubsetResponse 子集查询响应。
type SubsetResponse struct {
	Data     []TriageItem `json:"data"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
	Total    int          `json:"total"`
	HasMore  bool         `json:"has_more"`
}

// AcknowledgeRequest POST /api/v1/triage/acknowledge。
type AcknowledgeRequest struct {
	ItemID   string `json:"item_id" binding:"required"`
	Type     string `json:"type" binding:"required"` // alert / ticket
	TenantID string `json:"tenant_id"`
}

// AssignRequest POST /api/v1/triage/assign。
type AssignRequest struct {
	ItemID   string `json:"item_id" binding:"required"`
	Type     string `json:"type" binding:"required"`
	ToUserID string `json:"to_user_id" binding:"required"`
	ToRole   string `json:"to_role"` // primary / secondary
	Reason   string `json:"reason"`
	TenantID string `json:"tenant_id"`
}

// HandoffRequest POST /api/v1/triage/handoff。
type HandoffRequest struct {
	ScheduleID string `json:"schedule_id" binding:"required"`
	RotationID string `json:"rotation_id" binding:"required"`
	FromUserID string `json:"from_user_id" binding:"required"`
	ToUserID   string `json:"to_user_id" binding:"required"`
	Reason     string `json:"reason"`
	TenantID   string `json:"tenant_id"`
}

// HandoffResponse POST /api/v1/triage/handoff 响应。
type HandoffResponse struct {
	HandoffID     string     `json:"handoff_id"`
	FromUserID    string     `json:"from_user_id"`
	ToUserID      string     `json:"to_user_id"`
	PendingItems  int        `json:"pending_items"`
	CreatedAt     time.Time  `json:"created_at"`
}

// WS Event 类型。
type WSEvent string

const (
	WSAlertNew      WSEvent = "triage.alert.new"
	WSAlertUpdated  WSEvent = "triage.alert.updated"
	WSOnCallHandoff WSEvent = "triage.oncall.handoff"
)

// WSPayload 是 WebSocket 事件的通用载荷。
type WSPayload struct {
	Type      WSEvent    `json:"type"`
	TenantID  string     `json:"tenant_id"`
	UserID    string     `json:"user_id,omitempty"`
	Payload   any        `json:"payload"`
	Timestamp time.Time  `json:"timestamp"`
}
