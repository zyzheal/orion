package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/assistant/models"
	"orion/platform-svc-go/internal/assistant/service"

	"github.com/gin-gonic/gin"
)

// ============================================================
// P6 E2E: POST /assistant/action — TR-09/10/11 三路由全链路
//
// Tests verify the full handler→service→executor chain for:
//   - TR-09 研发流程 Agent (trigger_pipeline)
//   - TR-10 LowCode AI 生成 (generate_flow)
//   - TR-11 Ops 问答助手 (suggest_command)
//   - Missing prompt → 400
//   - Invalid JSON → 400
//   - Unsupported action kind → 200 with "unsupported"
// ============================================================

type fakeActionExecutor struct {
	kind     models.ActionKind
	resultFn func(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error)
}

func (f *fakeActionExecutor) Kind() models.ActionKind {
	return f.kind
}

func (f *fakeActionExecutor) Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
	if f.resultFn != nil {
		return f.resultFn(ctx, tenantID, req)
	}
	return &models.ActionResult{
		Kind:       f.kind,
		Status:     "executed",
		Summary:    "ok",
		ExecutedAt: time.Now().UTC(),
	}, nil
}

func newTestAssistantSvc() *service.Service {
	svc := service.NewService(nil)
	svc.AddExecutor(&fakeActionExecutor{
		kind: models.ActionTriggerPipeline,
		resultFn: func(_ context.Context, _ string, _ *models.ActionRequest) (*models.ActionResult, error) {
			return &models.ActionResult{
				Kind:       models.ActionTriggerPipeline,
				Status:     "executed",
				Summary:    "已创建研发流程 Run: run-dev-agent",
				EntityID:   "run-1",
				EntityName: "run-dev-agent",
				Steps:      []string{"识别意图：触发研发流程 Agent", "Agent Profile: dev-agent", "创建 Run: run-1 (totalSteps=3)"},
				ExecutedAt: time.Now().UTC(),
			}, nil
		},
	})
	svc.AddExecutor(&fakeActionExecutor{
		kind: models.ActionGenerateFlow,
		resultFn: func(_ context.Context, _ string, _ *models.ActionRequest) (*models.ActionResult, error) {
			return &models.ActionResult{
				Kind:       models.ActionGenerateFlow,
				Status:     "executed",
				Summary:    "已生成流程：审批流程 (意图=approval)",
				EntityName: "审批流程",
				Steps:      []string{"识别意图：AI 生成流程", "流程名称: 审批流程", "意图分类: approval"},
				Metadata:   map[string]interface{}{"intent": "approval"},
				ExecutedAt: time.Now().UTC(),
			}, nil
		},
	})
	svc.AddExecutor(&fakeActionExecutor{
		kind: models.ActionSuggestCommand,
		resultFn: func(_ context.Context, _ string, _ *models.ActionRequest) (*models.ActionResult, error) {
			return &models.ActionResult{
				Kind:    models.ActionSuggestCommand,
				Status:  "executed",
				Summary: "找到 2 个相关 Runbook",
				Steps:   []string{"在 Runbook 中检索到 2 个匹配项", "[rb-1] CPU 高排查 (category=ops)", "[rb-2] 内存泄漏排查 (category=ops)"},
				Metadata: map[string]interface{}{
					"suggestedCommands": "[\"top -bn1\",\"free -m\"]",
					"runbookCount":      2,
				},
				ExecutedAt: time.Now().UTC(),
			}, nil
		},
	})
	return svc
}

func makeActionCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func assertActionResponse(t *testing.T, w *httptest.ResponseRecorder, wantKind, wantStatus, wantSummarySubstr string) {
	t.Helper()
	if w.Code != http.StatusCreated {
		t.Fatalf("Action status = %d, want 201; body=%s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing data")
	}
	kind, _ := data["kind"].(string)
	if kind != wantKind {
		t.Errorf("kind = %q, want %q", kind, wantKind)
	}
	status, _ := data["status"].(string)
	if status != wantStatus {
		t.Errorf("status = %q, want %q", status, wantStatus)
	}
	if wantSummarySubstr != "" {
		summary, _ := data["summary"].(string)
		if !strings.Contains(summary, wantSummarySubstr) {
			t.Errorf("summary = %q, should contain %q", summary, wantSummarySubstr)
		}
	}
}

func TestHandler_Action_TR09_TriggerPipeline(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"prompt": "帮我触发研发流程 Agent 实现登录接口",
		"kind":   "trigger_pipeline",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	assertActionResponse(t, w, "trigger_pipeline", "executed", "研发流程 Run")
}

func TestHandler_Action_TR10_GenerateFlow(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"prompt": "创建一个审批流程，包含提交、审批、通知节点",
		"kind":   "generate_flow",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	assertActionResponse(t, w, "generate_flow", "executed", "生成流程")
}

func TestHandler_Action_TR11_SuggestCommand(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"prompt": "ops 服务器 CPU 使用率飙升建议什么命令排查",
		"kind":   "suggest_command",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	assertActionResponse(t, w, "suggest_command", "executed", "Runbook")
}

func TestHandler_Action_AutoDetect_TR10(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"prompt": "创建一个审批流程",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	assertActionResponse(t, w, "generate_flow", "executed", "生成流程")
}

func TestHandler_Action_MissingPrompt_400(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"kind": "trigger_pipeline",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Action status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"] != "BAD_REQUEST" {
		t.Errorf("code = %v, want BAD_REQUEST", resp["code"])
	}
}

func TestHandler_Action_InvalidJSON_400(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/assistant/action", bytes.NewReader([]byte("{invalid")))
	c.Request.Header.Set("Content-Type", "application/json")
	h.Action(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Action status = %d, want 400 (invalid JSON); body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_Action_UnsupportedKind(t *testing.T) {
	h := NewHandler(newTestAssistantSvc())
	body := map[string]interface{}{
		"prompt": "帮我创建工单",
		"kind":   "create_ticket",
	}
	c, w := makeActionCtx(http.MethodPost, "/assistant/action", body)
	h.Action(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("Action status = %d, want 201; body=%s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	status, _ := data["status"].(string)
	if status != "unsupported" {
		t.Errorf("status = %q, want unsupported (no create_ticket executor)", status)
	}
}