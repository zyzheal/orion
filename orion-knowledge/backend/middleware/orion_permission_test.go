package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/orion-platform/orion-knowledge/config"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/stretchr/testify/assert"
)

func newTestLogger() *log.Logger {
	cfg := &config.Config{Log: config.LogConfig{Level: -4}} // debug level
	return log.NewLogger(cfg)
}

func TestOrionPermissionMiddleware(t *testing.T) {
	logger := newTestLogger()

	// 创建测试用的中间件（使用模拟的权限服务）
	config := &OrionPermissionConfig{
		EngineURL: "http://localhost:9999", // 无效地址，会超时
		Timeout:   100 * 1000 * 1000,       // 100ms超时
	}

	m := NewOrionPermissionMiddleware(config, logger)

	// 测试 RequirePermission 返回正确的中间件函数
	permFunc := m.RequirePermission("knowledge", "write")
	assert.NotNil(t, permFunc)

	// 测试基本流程
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/test")

	// 模拟 JWT claims 注入
	c.Set("jwt_claims", map[string]interface{}{
		"user_id":   "user-123",
		"tenant_id": "tenant-1",
	})

	// 由于权限服务不可用，应该返回503
	handler := permFunc(func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	err := handler(c)
	// 预期返回错误（权限服务不可用）
	assert.Error(t, err)
}

func TestGetUserID(t *testing.T) {
	logger := newTestLogger()
	config := &OrionPermissionConfig{
		EngineURL: "http://localhost:3001",
		Timeout:   5e9,
	}
	m := NewOrionPermissionMiddleware(config, logger)

	e := echo.New()

	// 测试：从 JWT claims 获取用户ID
	t.Run("from JWT claims", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.Set("jwt_claims", map[string]interface{}{
			"user_id": "user-from-jwt",
		})

		userID := m.getUserID(c)
		assert.Equal(t, "user-from-jwt", userID)
	})

	// 测试：无 JWT claims 时返回空
	t.Run("missing JWT returns empty", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		// 不设置 jwt_claims

		userID := m.getUserID(c)
		assert.Empty(t, userID)
	})
}