package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestTenantMiddleware(t *testing.T) {
	e := echo.New()

	// 测试用例
	tests := []struct {
		name           string
		jwtTenant      string
		expectedStatus int
	}{
		{
			name:           "with valid JWT tenant",
			jwtTenant:      "tenant-123",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing tenant in JWT returns 401",
			jwtTenant:      "",
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建请求
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetPath("/test")

			// 模拟 JWT claims 注入
			if tt.jwtTenant != "" {
				c.Set("jwt_claims", map[string]interface{}{
					"tenant_id": tt.jwtTenant,
					"user_id":   "user-1",
				})
			}

			// 创建中间件
			m := NewTenantMiddleware("")

			// 执行中间件
			handler := m.Middleware()(func(c echo.Context) error {
				tenantID := WithTenant(c)
				assert.Equal(t, tt.jwtTenant, tenantID)
				return c.String(http.StatusOK, "OK")
			})

			err := handler(c)
			if tt.expectedStatus == http.StatusUnauthorized {
				assert.Error(t, err)
				he, ok := err.(*echo.HTTPError)
				assert.True(t, ok)
				assert.Equal(t, http.StatusUnauthorized, he.Code)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}