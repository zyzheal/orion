package resolver

// 依赖接口：由装配层注入具体实现。
// 这些接口定义在本包以避免反向依赖到 user-role / oncall / team 等包。

// UserRoleReader 提供 user_role 查询能力（G1）。
type UserRoleReader interface {
	UsersWithRole(tenantID, role string) ([]string, error)
}

// TeamReader 提供团队成员查询能力。
type TeamReader interface {
	MembersOf(tenantID, teamID string) ([]TeamMember, error)
}

// TeamMember 描述团队成员。
type TeamMember struct {
	UserID  string
	Role    string // primary / secondary / member
}

// OncallReader 提供当班查询能力。
type OncallReader interface {
	// DutyAt 返回 (scheduleID, asOf) 时刻的值班人员。
	DutyAt(tenantID, scheduleID string, asOf interface{}) ([]DutyUser, error)
}

// DutyUser 描述当班人员。
type DutyUser struct {
	UserID string
	Role   string // primary / secondary
}

// EscalationReader 提供升级策略查询能力。
type EscalationReader interface {
	// RecipientsAtLevel 返回某策略某级别的接收人。
	RecipientsAtLevel(tenantID, policyID string, level int) ([]string, error)
}

// UserReader 提供用户查询能力（用于 Broadcast）。
type UserReader interface {
	// AllActiveUsers 返回某租户下所有活跃用户 ID。
	AllActiveUsers(tenantID string) ([]string, error)
	// GetUsers 按 ID 批量查询用户基本信息。
	GetUsers(tenantID string, ids []string) (map[string]string, error) // id -> display_name
}
