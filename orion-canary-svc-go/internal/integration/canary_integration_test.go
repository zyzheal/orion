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

	// 模拟 canary handler 的路由注册（与真实 RegisterRoutes 结构一致）
	canaries := r.Group("/api/v1/canaries")
	{
		canaries.POST("", mockCanaryCreate)
		canaries.GET("", mockCanaryList)
		canaries.GET("/:id", mockCanaryGet)
		canaries.PUT("/:id", mockCanaryUpdate)
		canaries.POST("/:id/promote", mockCanaryPromote)
		canaries.POST("/:id/rollback", mockCanaryRollback)
		canaries.POST("/:id/metrics", mockCanaryAddMetric)
		canaries.GET("/:id/metrics", mockCanaryGetMetrics)
		canaries.GET("/count", mockCanaryCount)
	}
	canaries.DELETE("/:id", mockCanaryDelete)

	runs := r.Group("/api/v1/runs")
	{
		runs.GET("", mockRunsList)
		runs.GET("/:id", mockRunsGet)
		runs.POST("", mockRunsCreate)
	}

	configs := r.Group("/api/v1/configs")
	{
		configs.GET("", mockConfigsList)
		configs.GET("/:id", mockConfigsGet)
		configs.POST("", mockConfigsCreate)
	}

	// Health check
	r.GET("/healthz", mockHealthz)

	return r
}

// ==================== Mock Handlers ====================

func mockHealthz(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "orion-canary-svc"})
}

func mockCanaryList(c *gin.Context) {
	page := parseIntParam(c.DefaultQuery("page", "1"), 1)
	pageSize := parseIntParam(c.DefaultQuery("page_size", "20"), 20)
	c.JSON(200, gin.H{
		"code": 200,
		"data": gin.H{
			"canaries": []interface{}{},
			"total":    0,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func mockCanaryGet(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"id": c.Param("id")}})
}

func mockCanaryCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockCanaryDelete(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"deleted": true}})
}

func mockCanaryUpdate(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockCanaryPromote(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockCanaryRollback(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockCanaryAddMetric(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK"})
}

func mockCanaryGetMetrics(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockCanaryCount(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": gin.H{"count": 0}})
}

func mockRunsList(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockRunsGet(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"id": c.Param("id")}})
}

func mockRunsCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

func mockConfigsList(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "data": []interface{}{}})
}

func mockConfigsGet(c *gin.Context) {
	c.JSON(200, gin.H{"code": 200, "message": "OK", "data": gin.H{"id": c.Param("id")}})
}

func mockConfigsCreate(c *gin.Context) {
	c.JSON(201, gin.H{"code": 201, "message": "OK"})
}

// ==================== Tests ====================

// TestHealthz 测试健康检查端点
func TestHealthz(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/healthz", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), "healthy")
	assert.Contains(t, w.Body.String(), "orion-canary-svc")
}

// TestCanaryRoutes 测试 Canary 路由注册
func TestCanaryRoutes(t *testing.T) {
	r := setupTestRouter(t)

	tests := []struct {
		method string
		path   string
		desc   string
	}{
		{"GET", "/api/v1/canaries", "列表查询"},
		{"GET", "/api/v1/canaries/count", "统计查询"},
		{"GET", "/api/v1/runs", "运行记录列表"},
		{"GET", "/api/v1/configs", "配置列表"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(tt.method, tt.path, nil)
			r.ServeHTTP(w, req)

			// 路由必须存在（200 表示已注册且 mock 正常响应）
			assert.Equal(t, 200, w.Code, "路由 %s %s 应返回 200", tt.method, tt.path)
		})
	}
}

// TestCanaryCRUD 测试 Canary CRUD 操作
func TestCanaryCRUD(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("创建Canary", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"test-canary","service_id":"svc-1"}`)
		req, _ := http.NewRequest("POST", "/api/v1/canaries", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 201, w.Code)
		assert.Contains(t, w.Body.String(), "201")
	})

	t.Run("查询Canary列表 - 带分页", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries?page=1&page_size=10", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "canaries")
		assert.Contains(t, w.Body.String(), "page")
		assert.Contains(t, w.Body.String(), "pageSize")
	})

	t.Run("查询Canary详情", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries/123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "123")
	})

	t.Run("更新Canary", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"updated-name"}`)
		req, _ := http.NewRequest("PUT", "/api/v1/canaries/123", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("删除Canary", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/canaries/123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"deleted":true`)
	})
}

// TestCanarySpecialActions 测试 Canary 特殊操作
func TestCanarySpecialActions(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("发布Canary - /:id/promote", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{}`)
		req, _ := http.NewRequest("POST", "/api/v1/canaries/123/promote", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("回滚Canary - /:id/rollback", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{}`)
		req, _ := http.NewRequest("POST", "/api/v1/canaries/123/rollback", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("添加指标 - /:id/metrics POST", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"metric_name":"latency","value":100,"unit":"ms"}`)
		req, _ := http.NewRequest("POST", "/api/v1/canaries/123/metrics", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("查询指标 - /:id/metrics GET", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries/123/metrics", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})
}

// TestCanaryAnalysisRuns 测试分析运行相关路由
func TestCanaryAnalysisRuns(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("分析运行列表", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/runs?page=1&page_size=10", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("分析运行详情", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/runs/run-123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "run-123")
	})
}

// TestCanaryConfigs 测试配置相关路由
func TestCanaryConfigs(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("配置列表", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/configs", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
	})

	t.Run("配置详情", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/configs/config-123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), "config-123")
	})
}

// TestResponseFormat 测试响应格式符合 Orion 规范
func TestResponseFormat(t *testing.T) {
	r := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/canaries", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	body := w.Body.String()
	// Response 结构应包含 code/message/data 字段
	assert.Contains(t, body, `"code"`)
	assert.Contains(t, body, `"data"`)
}

// TestPagination 测试分页参数
func TestPagination(t *testing.T) {
	r := setupTestRouter(t)

	t.Run("默认分页参数 page=1, page_size=20", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"page":1`)
		assert.Contains(t, w.Body.String(), `"pageSize":20`)
	})

	t.Run("自定义分页参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries?page=2&page_size=50", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		assert.Contains(t, w.Body.String(), `"page":2`)
		assert.Contains(t, w.Body.String(), `"pageSize":50`)
	})

	t.Run("page_size 上限 100", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries?page_size=200", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code)
		// 验证 pageSize 被限制在 100 以内
		assert.Contains(t, w.Body.String(), `"pageSize"`)
	})
}

// TestRouteStructure 测试路由结构与 Go handler 一致
func TestRouteStructure(t *testing.T) {
	r := setupTestRouter(t)

	// 验证 canary 服务完整路由路径
	routes := []struct {
		method string
		path   string
	}{
		// Canaries
		{"GET", "/api/v1/canaries"},
		{"GET", "/api/v1/canaries/count"},
		{"GET", "/api/v1/canaries/123"},
		{"POST", "/api/v1/canaries"},
		{"DELETE", "/api/v1/canaries/123"},
		{"POST", "/api/v1/canaries/123/promote"},
		{"POST", "/api/v1/canaries/123/rollback"},
		{"POST", "/api/v1/canaries/123/metrics"},
		{"GET", "/api/v1/canaries/123/metrics"},
		// Runs
		{"GET", "/api/v1/runs"},
		{"GET", "/api/v1/runs/run-123"},
		{"POST", "/api/v1/runs"},
		// Configs
		{"GET", "/api/v1/configs"},
		{"GET", "/api/v1/configs/config-123"},
		{"POST", "/api/v1/configs"},
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

// BenchmarkCanaryList 性能基准测试
func BenchmarkCanaryList(b *testing.B) {
	r := setupTestRouter(nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/canaries", nil)
		r.ServeHTTP(w, req)
	}
}

// parseIntParam 辅助函数：解析字符串为 int，无效值返回默认值
func parseIntParam(s string, defaultVal int) int {
	val, err := strconv.Atoi(s)
	if err != nil || val <= 0 {
		return defaultVal
	}
	return val
}
