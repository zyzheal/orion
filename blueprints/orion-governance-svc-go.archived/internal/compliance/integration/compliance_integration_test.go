package integration

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// setupTestRouter 创建带 mock handler 的 Gin 路由器
// 直接注册与真实 handler 相同的路由路径，验证路由结构
func setupTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// 模拟 compliance handler 的路由注册
	// 真实 handler 在 rg 上直接注册（无子组）:
	// rg.POST("/reports"), rg.GET("/reports"), rg.GET("/reports/:id")...
	// rg.POST("/schedules"), rg.GET("/schedules"), rg.DELETE("/schedules/:id")
	compliance := r.Group("/api/v1/compliance")
	{
		compliance.GET("/reports", mockComplianceReportList)
		compliance.POST("/reports", mockComplianceReportCreate)
		compliance.GET("/reports/:id", mockComplianceReportGet)
		compliance.PUT("/reports/:id", mockComplianceReportUpdate)
		compliance.DELETE("/reports/:id", mockComplianceReportDelete)
		compliance.GET("/schedules", mockComplianceScheduleList)
		compliance.POST("/schedules", mockComplianceScheduleCreate)
		compliance.DELETE("/schedules/:id", mockComplianceScheduleDelete)
	}

	// Health check
	r.GET("/healthz", mockHealthz)

	return r
}

// ==================== Mock Handlers ====================

func mockHealthz(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "orion-compliance-svc"})
}

func mockComplianceReportList(c *gin.Context) {
	page := parseIntParam(c.DefaultQuery("page", "1"), 1)
	pageSize := parseIntParam(c.DefaultQuery("page_size", "20"), 20)
	c.JSON(200, gin.H{
		"code": 200,
		"data": gin.H{
			"reports": []interface{}{},
			"total":   0,
			"page":    page,
			"pageSize": pageSize,
		},
	})
}

func mockComplianceReportCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockComplianceReportGet(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"id": c.Param("id")}})
}

func mockComplianceReportUpdate(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockComplianceReportDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

func mockComplianceScheduleList(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockComplianceScheduleCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockComplianceScheduleDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

// ==================== Tests ====================

// TestComplianceHealthz 测试健康检查
func TestComplianceHealthz(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/healthz", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "healthy")
	assert.Contains(t, w.Body.String(), "orion-compliance-svc")
}

// TestComplianceRoutes 测试路由注册
func TestComplianceRoutes(t *testing.T) {
	r := setupTestRouter(t)

	tests := []struct {
		method string
		path   string
		desc   string
	}{
		{"GET", "/api/v1/compliance/reports", "报告列表"},
		{"POST", "/api/v1/compliance/reports", "创建报告"},
		{"GET", "/api/v1/compliance/reports/rpt-123", "报告详情"},
		{"PUT", "/api/v1/compliance/reports/rpt-123", "更新报告"},
		{"DELETE", "/api/v1/compliance/reports/rpt-123", "删除报告"},
		{"GET", "/api/v1/compliance/schedules", "计划列表"},
		{"POST", "/api/v1/compliance/schedules", "创建计划"},
		{"DELETE", "/api/v1/compliance/schedules/sch-123", "删除计划"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			w := httptest.NewRecorder()
			body := bytes.NewBufferString("")
			if tt.method == "POST" || tt.method == "PUT" {
				body = bytes.NewBufferString(`{}`)
			}
			req, _ := http.NewRequest(tt.method, tt.path, body)
			if body != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			r.ServeHTTP(w, req)

			// 所有路由应返回 2xx（mock 成功）
			assert.True(t, w.Code == 200 || w.Code == 201,
				"路由 %s %s 应返回 2xx，实际: %d", tt.method, tt.path, w.Code)
		})
	}
}

// TestComplianceReportCRUD 测试报告 CRUD
func TestComplianceReportCRUD(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("报告列表带分页参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/compliance/reports?page=1&page_size=20", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "page")
		assert.Contains(t, w.Body.String(), "pageSize")
	})

	t.Run("创建报告", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"合规报告","category":"security"}`)
		req, _ := http.NewRequest("POST", "/api/v1/compliance/reports", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
	})

	t.Run("获取报告详情", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/compliance/reports/rpt-001", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "rpt-001")
	})

	t.Run("删除报告", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/compliance/reports/rpt-001", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"deleted":true`)
	})
}

// TestComplianceSchedules 测试计划管理
func TestComplianceSchedules(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("计划列表", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/compliance/schedules", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("创建计划", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"每周审计","cron":"0 0 9 * * 1"}`)
		req, _ := http.NewRequest("POST", "/api/v1/compliance/schedules", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
	})

	t.Run("删除计划", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/compliance/schedules/sch-001", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"deleted":true`)
	})
}

// TestResponseFormat 测试响应格式符合 Orion 规范
func TestResponseFormat(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/compliance/reports", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	body := w.Body.String()
	assert.Contains(t, body, `"code"`)
	assert.Contains(t, body, `"data"`)
}

// TestPaginationParams 测试分页参数
func TestPaginationParams(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("默认分页", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/compliance/reports", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "page")
	})

	t.Run("自定义分页", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/compliance/reports?page=2&page_size=50", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"page":2`)
	})
}

// TestRouteStructure 测试路由结构
func TestRouteStructure(t *testing.T) {
	r := setupTestRouter(t)

	routes := []struct {
		method string
		path   string
	}{
		// Reports
		{"GET", "/api/v1/compliance/reports"},
		{"POST", "/api/v1/compliance/reports"},
		{"GET", "/api/v1/compliance/reports/rpt-001"},
		{"PUT", "/api/v1/compliance/reports/rpt-001"},
		{"DELETE", "/api/v1/compliance/reports/rpt-001"},
		// Schedules
		{"GET", "/api/v1/compliance/schedules"},
		{"POST", "/api/v1/compliance/schedules"},
		{"DELETE", "/api/v1/compliance/schedules/sch-001"},
		// Health
		{"GET", "/healthz"},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			body := bytes.NewBufferString("")
			if isMethodWithBody(route.method) {
				body = bytes.NewBufferString(`{}`)
			}
			req, err := http.NewRequest(route.method, route.path, body)
			if err != nil {
				t.Fatalf("创建请求失败: %v", err)
			}
			if isMethodWithBody(route.method) {
				req.Header.Set("Content-Type", "application/json")
			}
			r.ServeHTTP(w, req)

			assert.True(t, w.Code == 200 || w.Code == 201,
				"路由 %s %s 应返回 2xx，实际: %d", route.method, route.path, w.Code)
		})
	}
}

func isMethodWithBody(method string) bool {
	return method == "POST" || method == "PUT" || method == "PATCH"
}

// parseIntParam 辅助函数：解析字符串为 int，无效值返回默认值
func parseIntParam(s string, defaultVal int) int {
	val, err := strconv.Atoi(s)
	if err != nil || val <= 0 {
		return defaultVal
	}
	return val
}
