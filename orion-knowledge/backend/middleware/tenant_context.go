package contextkey

// 租户上下文键
const (
	TenantIDKey    = "tenant_id"
	UserIDKey      = "user_id"
	UserRolesKey   = "user_roles"
)

// TenantContext 租户上下文
type TenantContext struct {
	TenantID string
	UserID   string
	Roles    []string
}

// GetTenantID 从Context获取租户ID
func GetTenantID(c interface{ Get(string) (string, bool) }) string {
	if tenantID, ok := c.Get(TenantIDKey).(string); ok && tenantID != "" {
		return tenantID
	}
	// 默认租户
	return "default"
}

// GetUserID 从Context获取用户ID
func GetUserID(c interface{ Get(string) (string, bool) }) string {
	if userID, ok := c.Get(UserIDKey).(string); ok && userID != "" {
		return userID
	}
	return ""
}