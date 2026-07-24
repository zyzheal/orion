package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/orion-platform/orion-knowledge/contextkey"
)

/**
 * 租户隔离中间件
 *
 * 从请求头或JWT中提取租户ID，并设置到请求上下文中
 */

// TenantMiddleware 租户中间件
type TenantMiddleware struct {
	defaultTenant string
}

// NewTenantMiddleware 创建租户中间件
func NewTenantMiddleware(defaultTenant string) *TenantMiddleware {
	if defaultTenant == "" {
		defaultTenant = "default"
	}
	return &TenantMiddleware{
		defaultTenant: defaultTenant,
	}
}

// Middleware 返回Echo中间件函数
func (m *TenantMiddleware) Middleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var tenantID string

			// 1. 优先从 JWT claims 获取租户ID（可信来源）
			claims := c.Get("jwt_claims")
			if claims != nil {
				switch v := claims.(type) {
				case map[string]interface{}:
					if tid, ok := v["tenant_id"].(string); ok && tid != "" {
						tenantID = tid
					}
				}
			}

			// 2. 如果JWT中没有租户ID，拒绝请求（安全修复：不允许客户端伪造）
			if tenantID == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "tenant_id required in JWT claims")
			}

			// 3. 设置到上下文
			c.Set(contextkey.TenantIDKey, tenantID)

			// 4. 记录日志
			c.Logger().Debugf("[Tenant] Request tenant: %s, path: %s", tenantID, c.Request().URL.Path)

			return next(c)
		}
	}
}

// WithTenant 从Echo Context获取租户ID
func WithTenant(c echo.Context) string {
	if tenantID, ok := c.Get(contextkey.TenantIDKey).(string); ok && tenantID != "" {
		return tenantID
	}
	return ""
}

// WithUserID 从Echo Context获取用户ID
func WithUserID(c echo.Context) string {
	if userID, ok := c.Get(contextkey.UserIDKey).(string); ok && userID != "" {
		return userID
	}
	return ""
}