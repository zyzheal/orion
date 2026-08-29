package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/chatops/models"

	"github.com/gin-gonic/gin"
)

// ============================================================
// TR-11: Ops 问答助手场景测试
//
// 场景描述：运维人员通过 ChatOps 进行 Ops 智能问答
//   - 发送消息/提问 (POST /chatops/message) → 获得会话 ID
//   - 获取知识库推荐 (GET /chatops/knowledge) → 获取相关答案
//   - 获取会话历史 (GET /chatops/sessions/:id/messages)
//   - 获取 Dashboard 统计 (GET /chatops/dashboard/stats)
//   - 缺少必填字段返回 400
// ============================================================

// newOpsQAHandler creates a handler with a mock service for Ops QA scenarios.
func newOpsQAHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// makeChatOpsCtx creates a gin context for ChatOps handler tests.
func makeChatOpsCtx(method, path string, body interface{}, params map[string]string, queries map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-ops-1")

	var buf *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	} else {
		buf = bytes.NewBuffer([]byte{})
	}

	c.Params = gin.Params{}
	for k, v := range params {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}

	c.Request = httptest.NewRequest(method, path, buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if queries != nil {
		q := c.Request.URL.Query()
		for k, v := range queries {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	return c, w
}

// --- Test: TR-11 ReceiveMessage (提问/发送消息) ---

func TestHandler_TR11_ReceiveMessage_Success(t *testing.T) {
	svc := &mockSvc{
		receiveMessageFn: func(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			if userID != "user-ops-1" {
				t.Errorf("userID = %q, want user-ops-1", userID)
			}
			if req.Text != "服务器 CPU 使用率为什么飙升" {
				t.Errorf("Text = %q, want CPU 问题", req.Text)
			}
			return map[string]interface{}{
				"sessionId": "sess-ops-1",
				"reply":     "正在分析 CPU 使用情况，请稍候...",
				"status":    "processing",
			}, nil
		},
	}
	h := newOpsQAHandler(svc)

	body := map[string]interface{}{
		"text":     "服务器 CPU 使用率为什么飙升",
		"platform": "slack",
		"source":   "ops-console",
	}
	c, w := makeChatOpsCtx(http.MethodPost, "/chatops/message", body, nil, nil)
	h.ReceiveMessage(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("ReceiveMessage status = %d, want 201; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing data field")
	}
	if data["sessionId"] != "sess-ops-1" {
		t.Errorf("sessionId = %v, want sess-ops-1", data["sessionId"])
	}
}

func TestHandler_TR11_ReceiveMessage_InvalidJSON_400(t *testing.T) {
	svc := &mockSvc{}
	h := newOpsQAHandler(svc)

	// Invalid JSON should trigger binding error (400)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-ops-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/chatops/message", bytes.NewReader([]byte("{invalid json}")))
	c.Request.Header.Set("Content-Type", "application/json")

	h.ReceiveMessage(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ReceiveMessage status = %d, want 400 (invalid JSON)", w.Code)
	}
}

func TestHandler_TR11_ReceiveMessage_WithSessionId(t *testing.T) {
	svc := &mockSvc{
		receiveMessageFn: func(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error) {
			// Verify session continuity: follow-up question in same session
			return map[string]interface{}{
				"sessionId": "sess-ops-1",
				"reply":     "根据分析，服务 order-svc 的 CPU 在 14:00 后飙升 80%",
				"status":    "completed",
			}, nil
		},
	}
	h := newOpsQAHandler(svc)

	body := map[string]interface{}{
		"text":      "哪个服务导致的",
		"sessionId": "sess-ops-1",
	}
	c, w := makeChatOpsCtx(http.MethodPost, "/chatops/message", body, nil, nil)
	h.ReceiveMessage(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("ReceiveMessage status = %d, want 201", w.Code)
	}
}

// --- Test: TR-11 GetKnowledgeRecommendations ---

func TestHandler_TR11_KnowledgeRecommendations_OpsContext(t *testing.T) {
	svc := &mockSvc{
		getKnowledgeRecsFn: func(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			if context != "ops" {
				t.Errorf("context = %q, want ops", context)
			}
			if limit != 5 {
				t.Errorf("limit = %d, want 5", limit)
			}
			return []models.KnowledgeRecommendation{
				{Title: "CPU 高负载排查指南", Description: "检查 top 进程、系统负载...", Context: "ops"},
				{Title: "内存泄漏诊断步骤", Description: "通过 /proc/meminfo 检查...", Context: "ops"},
				{Title: "网络延迟排查", Description: "使用 mtr 和 tcpdump 定位...", Context: "ops"},
			}, nil
		},
	}
	h := newOpsQAHandler(svc)

	c, w := makeChatOpsCtx(http.MethodGet, "/chatops/knowledge", nil, nil, map[string]string{
		"context": "ops",
		"limit":   "5",
	})
	h.GetKnowledgeRecommendations(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetKnowledgeRecommendations status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data := resp["data"].(map[string]interface{})
	recs := data["recommendations"].([]interface{})
	if len(recs) != 3 {
		t.Errorf("recommendations count = %d, want 3", len(recs))
	}
}

func TestHandler_TR11_KnowledgeRecommendations_DefaultParams(t *testing.T) {
	svc := &mockSvc{
		getKnowledgeRecsFn: func(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error) {
			// Default: context="general", limit=10
			if context != "general" {
				t.Errorf("context = %q, want general (default)", context)
			}
			if limit != 10 {
				t.Errorf("limit = %d, want 10 (default)", limit)
			}
			return nil, nil
		},
	}
	h := newOpsQAHandler(svc)

	c, w := makeChatOpsCtx(http.MethodGet, "/chatops/knowledge", nil, nil, nil)
	h.GetKnowledgeRecommendations(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetKnowledgeRecommendations status = %d, want 200", w.Code)
	}
}

// --- Test: TR-11 GetSessionMessages ---

func TestHandler_TR11_SessionMessages_Success(t *testing.T) {
	svc := &mockSvc{
		getSessionMessagesFn: func(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			if sessionID != "sess-ops-1" {
				t.Errorf("sessionID = %q, want sess-ops-1", sessionID)
			}
			return []models.ChatOpsMessage{
				{ID: "msg-1", SessionID: "sess-ops-1", Text: "CPU 为什么飙升", Platform: "slack", CreatedAt: time.Unix(1, 0)},
				{ID: "msg-2", SessionID: "sess-ops-1", Text: "检测到 order-svc CPU 80%", Platform: "slack", CreatedAt: time.Unix(2, 0)},
				{ID: "msg-3", SessionID: "sess-ops-1", Text: "怎么处理", Platform: "slack", CreatedAt: time.Unix(3, 0)},
			}, nil
		},
	}
	h := newOpsQAHandler(svc)

	c, w := makeChatOpsCtx(http.MethodGet, "/chatops/sessions/:id/messages", nil,
		map[string]string{"id": "sess-ops-1"},
		map[string]string{"limit": "20"},
	)
	h.GetSessionMessages(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetSessionMessages status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

// --- Test: TR-11 Dashboard Stats ---

func TestHandler_TR11_DashboardStats_OpsOverview(t *testing.T) {
	svc := &mockSvc{
		getDashboardStatsFn: func(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			return &models.DashboardStatsResult{
				TotalCommands:   5,
				TotalExecutions: 128,
				SuccessRate:     0.98,
				ActiveUsers:     7,
			}, nil
		},
	}
	h := newOpsQAHandler(svc)

	c, w := makeChatOpsCtx(http.MethodGet, "/chatops/dashboard/stats", nil, nil, nil)
	h.GetDashboardStats(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetDashboardStats status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data := resp["data"].(map[string]interface{})
	totalCmds := int64(data["total_commands"].(float64))
	if totalCmds != 5 {
		t.Errorf("total_commands = %d, want 5", totalCmds)
	}
}

// --- Test: TR-11 Health Check ---

func TestHandler_TR11_HealthCheck(t *testing.T) {
	svc := &mockSvc{
		healthCheckFn: func(ctx context.Context) (*models.HealthCheckResult, error) {
			return &models.HealthCheckResult{Success: true, EventBus: map[string]interface{}{"status": "ok"}, SSE: map[string]interface{}{"status": "ok"}}, nil
		},
	}
	h := newOpsQAHandler(svc)

	c, w := makeChatOpsCtx(http.MethodGet, "/chatops/health", nil, nil, nil)
	h.HealthCheck(c)

	if w.Code != http.StatusOK {
		t.Fatalf("HealthCheck status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}
