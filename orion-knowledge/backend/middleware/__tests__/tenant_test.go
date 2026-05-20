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
		tenantHeader  string
		expectedTenant string
	}{
		{
			name:           "with tenant header",
			tenantHeader:  "tenant-123",
			expectedTenant: "tenant-123",
		},
		{
			name:           "without tenant header",
			tenantHeader:  "",
			expectedTenant: "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建请求
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tt.tenantHeader != "" {
				req.Header.Set("x-tenant-id", tt.tenantHeader)
			}
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetPath("/test")

			// 创建中间件
			m := NewTenantMiddleware("default")

			// 执行中间件
			handler := m.Middleware()(func(c echo.Context) error {
				tenantID := WithTenant(c)
				assert.Equal(t, tt.expectedTenant, tenantID)
				return c.String(http.StatusOK, "OK")
			})

			err := handler(c)
			assert.NoError(t, err)
		})
	}
}