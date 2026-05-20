package middleware

import (
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
			// 1. 优先从Header获取租户ID
			tenantID := c.Request().Header.Get("x-tenant-id")

			// 2. 如果Header没有，尝试从JWT claims获取
			if tenantID == "" {
				claims := c.Get("jwt_claims")
				if claims != nil {
					// 根据实际JWT结构获取tenant_id
					// 这里假设claims是一个map或者有TenantID方法
					switch v := claims.(type) {
					case map[string]interface{}:
						if tid, ok := v["tenant_id"].(string); ok {
							tenantID = tid
						}
					}
				}
			}

			// 3. 如果都没有，使用默认租户
			if tenantID == "" {
				tenantID = m.defaultTenant
			}

			// 4. 设置到上下文
			c.Set(contextkey.TenantIDKey, tenantID)

			// 5. 同时设置到响应头（可选，用于调试）
			c.Response().Header().Set("x-tenant-id", tenantID)

			// 6. 记录日志
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
	return "default"
}

// WithUserID 从Echo Context获取用户ID
func WithUserID(c echo.Context) string {
	if userID, ok := c.Get(contextkey.UserIDKey).(string); ok && userID != "" {
		return userID
	}
	return ""
}