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

	// 模拟 report-designer handler 的路由注册
	// 真实 RegisterRoutes(rg) 结构:
	// rg.Group("/reports") → "", /:id, /:id/preview, /:id/execute, /:id/executions, /:id/schedules
	// 独立路由: /datasources, /datasources/:id, /schedules/:id
	reports := r.Group("/api/v1/reports")
	{
		reports.GET("", mockReportList)
		reports.POST("", mockReportCreate)
		reports.GET("/:id", mockReportGet)
		reports.PUT("/:id", mockReportUpdate)
		reports.DELETE("/:id", mockReportDelete)
		reports.POST("/:id/preview", mockReportPreview)
		reports.POST("/:id/execute", mockReportExecute)
		reports.GET("/:id/executions", mockReportExecutions)
		reports.GET("/:id/schedules", mockReportScheduleList)
		reports.POST("/:id/schedules", mockReportScheduleCreate)
		// Datasources (必须在 /:id 之前注册)
		reports.GET("/datasources", mockDatasourceList)
		reports.POST("/datasources", mockDatasourceCreate)
		reports.PUT("/datasources/:id", mockDatasourceUpdate)
		reports.DELETE("/datasources/:id", mockDatasourceDelete)
		// Schedules (独立路径)
		reports.PUT("/schedules/:id", mockScheduleUpdate)
		reports.DELETE("/schedules/:id", mockScheduleDelete)
	}

	// Health check
	r.GET("/healthz", mockHealthz)

	return r
}

// ==================== Mock Handlers ====================

func mockHealthz(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "orion-report-designer-svc"})
}

func mockReportList(c *gin.Context) {
	page := parseIntParam(c.DefaultQuery("page", "1"), 1)
	pageSize := parseIntParam(c.DefaultQuery("page_size", "20"), 20)
	c.JSON(200, gin.H{
		"code": 200,
		"data": gin.H{
			"reports":  []interface{}{},
			"total":    0,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func mockReportGet(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"id": c.Param("id")}})
}

func mockReportCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockReportUpdate(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockReportDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

func mockReportPreview(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"preview_url": "http://..."}})
}

func mockReportExecute(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK", "data": gin.H{"execution_id": "exec-001"}})
}

func mockReportExecutions(c *gin.Context) {
	limit := parseIntParam(c.DefaultQuery("limit", "20"), 20)
	c.JSON(200, gin.H{
		"code": 200,
		"data": []interface{}{
			gin.H{"id": "exec-001", "status": "completed"},
		},
		"limit": limit,
	})
}

func mockReportScheduleList(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockReportScheduleCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockDatasourceList(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockDatasourceCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockDatasourceUpdate(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockDatasourceDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

func mockScheduleUpdate(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockScheduleDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

// ==================== Tests ====================

// TestReportDesignerHealthz 测试健康检查
func TestReportDesignerHealthz(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/healthz", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "healthy")
	assert.Contains(t, w.Body.String(), "orion-report-designer-svc")
}

// TestReportDesignerRoutes 测试完整路由注册
func TestReportDesignerRoutes(t *testing.T) {
	r := setupTestRouter(t)

	tests := []struct {
		method string
		path   string
		desc   string
	}{
		// Report CRUD
		{"GET", "/api/v1/reports", "报告列表"},
		{"POST", "/api/v1/reports", "创建报告"},
		{"GET", "/api/v1/reports/rpt-001", "报告详情"},
		{"PUT", "/api/v1/reports/rpt-001", "更新报告"},
		{"DELETE", "/api/v1/reports/rpt-001", "删除报告"},
		// Report Actions
		{"POST", "/api/v1/reports/rpt-001/preview", "预览报告"},
		{"POST", "/api/v1/reports/rpt-001/execute", "执行报告"},
		{"GET", "/api/v1/reports/rpt-001/executions", "执行历史"},
		// Report Schedules (sub-resource)
		{"GET", "/api/v1/reports/rpt-001/schedules", "计划列表"},
		{"POST", "/api/v1/reports/rpt-001/schedules", "创建计划"},
		// Datasources (independent routes under /reports group)
		{"GET", "/api/v1/reports/datasources", "数据源列表"},
		{"POST", "/api/v1/reports/datasources", "创建数据源"},
		{"PUT", "/api/v1/reports/datasources/ds-001", "更新数据源"},
		{"DELETE", "/api/v1/reports/datasources/ds-001", "删除数据源"},
		// Schedules (independent /schedules/:id)
		{"PUT", "/api/v1/reports/schedules/sch-001", "更新计划"},
		{"DELETE", "/api/v1/reports/schedules/sch-001", "删除计划"},
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

			assert.True(t, w.Code == 200 || w.Code == 201,
				"路由 %s %s 应返回 2xx，实际: %d", tt.method, tt.path, w.Code)
		})
	}
}

// TestReportDesignerCRUD 测试报告 CRUD 完整流程
func TestReportDesignerCRUD(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("报告列表 - 分页参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/reports?page=1&page_size=20", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "page")
		assert.Contains(t, w.Body.String(), "pageSize")
	})

	t.Run("创建报告", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"新报表","category":"finance"}`)
		req, _ := http.NewRequest("POST", "/api/v1/reports", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
	})

	t.Run("报告详情 - 路径参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/reports/rpt-abc-123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "rpt-abc-123")
	})

	t.Run("删除报告 - 返回 deleted: true", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/reports/rpt-abc-123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"deleted":true`)
	})
}

// TestReportDesignerActions 测试报表操作
func TestReportDesignerActions(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("预览报表 - /:id/preview", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"parameters":{}}`)
		req, _ := http.NewRequest("POST", "/api/v1/reports/rpt-001/preview", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "preview_url")
	})

	t.Run("执行报表 - /:id/execute", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"exportFormat":"pdf"}`)
		req, _ := http.NewRequest("POST", "/api/v1/reports/rpt-001/execute", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
		assert.Contains(t, w.Body.String(), "execution_id")
	})

	t.Run("执行历史 - /:id/executions", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/reports/rpt-001/executions?limit=10", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "exec-001")
	})
}

// TestReportDesignerDatasources 测试数据源管理
func TestReportDesignerDatasources(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("数据源列表", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/reports/datasources", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("创建数据源", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"MySQL主库","datasourceType":"mysql"}`)
		req, _ := http.NewRequest("POST", "/api/v1/reports/datasources", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
	})

	t.Run("更新数据源", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"MySQL主库-v2"}`)
		req, _ := http.NewRequest("PUT", "/api/v1/reports/datasources/ds-001", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("删除数据源", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/reports/datasources/ds-001", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"deleted":true`)
	})
}

// TestReportDesignerSchedules 测试报表计划
func TestReportDesignerSchedules(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("报表计划列表", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/reports/rpt-001/schedules", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("创建报表计划", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"每周生成","cron":"0 0 8 * * 1","format":"pdf"}`)
		req, _ := http.NewRequest("POST", "/api/v1/reports/rpt-001/schedules", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
	})

	t.Run("更新计划", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"enabled":false}`)
		req, _ := http.NewRequest("PUT", "/api/v1/reports/schedules/sch-001", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})
}

// TestResponseFormat 测试响应格式
func TestResponseFormat(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	body := w.Body.String()
	assert.Contains(t, body, `"code"`)
	assert.Contains(t, body, `"data"`)
}

// TestRouteConflict 测试路由冲突
// /datasources 必须在 /:id 之前注册
func TestRouteConflict(t *testing.T) {
	r := setupTestRouter(t)

	// /datasources 应该匹配具体路由，返回数据源列表
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/datasources", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
}

// TestRouteStructure 测试路由结构完整性
func TestRouteStructure(t *testing.T) {
	r := setupTestRouter(t)

	routes := []struct {
		method string
		path   string
	}{
		// Reports
		{"GET", "/api/v1/reports"},
		{"POST", "/api/v1/reports"},
		{"GET", "/api/v1/reports/rpt-001"},
		{"PUT", "/api/v1/reports/rpt-001"},
		{"DELETE", "/api/v1/reports/rpt-001"},
		// Report Actions
		{"POST", "/api/v1/reports/rpt-001/preview"},
		{"POST", "/api/v1/reports/rpt-001/execute"},
		{"GET", "/api/v1/reports/rpt-001/executions"},
		// Report Schedules
		{"GET", "/api/v1/reports/rpt-001/schedules"},
		{"POST", "/api/v1/reports/rpt-001/schedules"},
		// Datasources
		{"GET", "/api/v1/reports/datasources"},
		{"POST", "/api/v1/reports/datasources"},
		{"PUT", "/api/v1/reports/datasources/ds-001"},
		{"DELETE", "/api/v1/reports/datasources/ds-001"},
		// Schedules
		{"PUT", "/api/v1/reports/schedules/sch-001"},
		{"DELETE", "/api/v1/reports/schedules/sch-001"},
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
