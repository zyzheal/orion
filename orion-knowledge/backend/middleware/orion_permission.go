package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/orion-platform/orion-knowledge/config"
	"github.com/orion-platform/orion-knowledge/log"
)

/**
 * Orion 权限引擎集成中间件
 *
 * 通过调用 Orion Platform 的 AuthorizationEngine API 进行权限验证
 */

// OrionPermissionConfig Orion权限配置
type OrionPermissionConfig struct {
	EngineURL string // 权限引擎地址，如 http://localhost:3001
	Timeout   time.Duration
}

// DefaultOrionPermissionConfig 默认配置
func DefaultOrionPermissionConfig(cfg *config.Config) *OrionPermissionConfig {
	return &OrionPermissionConfig{
		EngineURL: "http://localhost:3001", // 从配置获取
		Timeout:   5 * time.Second,
	}
}

// AuthZRequest 权限请求
type AuthZRequest struct {
	User      UserContext      `json:"user"`
	Resource  ResourceContext  `json:"resource"`
	Action    ActionContext    `json:"action"`
	Environment EnvironmentContext `json:"environment"`
}

type UserContext struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Roles     []string `json:"roles"`
	TenantID  string   `json:"tenantId"`
	Department string  `json:"department,omitempty"`
	Level     string   `json:"level,omitempty"`
	Status    string   `json:"status"`
	Teams     []string `json:"teams,omitempty"`
}

type ResourceContext struct {
	Type      string `json:"type"`
	ID        string `json:"id,omitempty"`
	TenantID  string `json:"tenantId"`
	ProjectID string `json:"projectId,omitempty"`
	OwnerID   string `json:"ownerId,omitempty"`
}

type ActionContext struct {
	Type   string `json:"type"`
	Impact string `json:"impact,omitempty"`
}

type EnvironmentContext struct {
	Time         time.Time `json:"time"`
	SourceIP     string    `json:"sourceIp"`
	Network      string    `json:"network"`
	RequestOrigin string   `json:"requestOrigin"`
}

// AuthZResponse 权限响应
type AuthZResponse struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

// OrionPermissionMiddleware Orion权限中间件
type OrionPermissionMiddleware struct {
	config     *OrionPermissionConfig
	httpClient *http.Client
	logger     *log.Logger
}

// NewOrionPermissionMiddleware 创建权限中间件
func NewOrionPermissionMiddleware(cfg *OrionPermissionConfig, logger *log.Logger) *OrionPermissionMiddleware {
	return &OrionPermissionMiddleware{
		config: cfg,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		logger: logger,
	}
}

// RequirePermission 创建权限验证中间件
func (m *OrionPermissionMiddleware) RequirePermission(resource string, action string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// 1. 获取用户信息
			userID := m.getUserID(c)
			tenantID := WithTenant(c)

			// 2. 构建权限请求
			authzReq := AuthZRequest{
				User: UserContext{
					ID:       userID,
					TenantID: tenantID,
					Status:   "active",
				},
				Resource: ResourceContext{
					Type:      resource,
					TenantID: tenantID,
				},
				Action: ActionContext{
					Type: action,
				},
				Environment: EnvironmentContext{
					Time:         time.Now(),
					SourceIP:     c.RealIP(),
					Network:      "internal",
					RequestOrigin: "api",
				},
			}

			// 3. 调用权限引擎
			allowed, err := m.checkPermission(c.Request().Context(), authzReq)
			if err != nil {
				m.logger.Error("[Permission] Failed to check permission", "error", err)
				// 权限服务不可用时，根据配置决定是拒绝还是允许
				// 这里选择拒绝以保证安全
				return echo.NewHTTPError(http.StatusServiceUnavailable, "Permission service unavailable")
			}

			// 4. 检查结果
			if !allowed {
				m.logger.Warnf("[Permission] Denied - user: %s, resource: %s, action: %s", userID, resource, action)
				return echo.NewHTTPError(http.StatusForbidden, "Permission denied")
			}

			m.logger.Debugf("[Permission] Allowed - user: %s, resource: %s, action: %s", userID, resource, action)
			return next(c)
		}
	}
}

// checkPermission 调用权限引擎检查权限
func (m *OrionPermissionMiddleware) checkPermission(ctx context.Context, req AuthZRequest) (bool, error) {
	// 构建请求
	url := fmt.Sprintf("%s/api/v1/authz/evaluate", m.config.EngineURL)
	reqBody, err := json.Marshal(req)
	if err != nil {
		return false, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(reqBody)))
	if err != nil {
		return false, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// 发送请求
	resp, err := m.httpClient.Do(httpReq)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// 解析响应
	var authzResp AuthZResponse
	if err := json.NewDecoder(resp.Body).Decode(&authzResp); err != nil {
		return false, err
	}

	return authzResp.Allowed, nil
}

// getUserID 从Context获取用户ID
func (m *OrionPermissionMiddleware) getUserID(c echo.Context) string {
	// 尝试从 JWT claims 获取
	if claims := c.Get("jwt_claims"); claims != nil {
		switch v := claims.(type) {
		case map[string]interface{}:
			if sub, ok := v["sub"].(string); ok {
				return sub
			}
			if userID, ok := v["user_id"].(string); ok {
				return userID
			}
		}
	}
	// 尝试从 header 获取
	if userID := c.Request().Header.Get("x-user-id"); userID != "" {
		return userID
	}
	return ""
}

// QuickCheckPermission 快速权限检查（不通过中间件）
func (m *OrionPermissionMiddleware) QuickCheckPermission(ctx context.Context, userID, tenantID, resource, action string) (bool, error) {
	req := AuthZRequest{
		User: UserContext{
			ID:       userID,
			TenantID: tenantID,
			Status:   "active",
		},
		Resource: ResourceContext{
			Type:     resource,
			TenantID: tenantID,
		},
		Action: ActionContext{
			Type: action,
		},
		Environment: EnvironmentContext{
			Time:   time.Now(),
			Network: "internal",
		},
	}
	return m.checkPermission(ctx, req)
}