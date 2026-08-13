package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/lowcode/models"
	"orion/platform-svc-go/internal/lowcode/service"

	"github.com/gin-gonic/gin"
)

// ============================================================
// TR-10: LowCode AI 生成场景测试
//
// 场景描述：用户通过自然语言描述生成 LowCode 流程图 DAG
//   - 成功生成审批流程 (含意图识别)
//   - 成功生成发布流程
//   - 缺少 prompt 返回 400
//   - 生成流程包含完整节点与边结构
// ============================================================

type mockSvcLowcode struct {
	generateFlowFn func(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error)
}

func (m *mockSvcLowcode) GenerateFlowFromPrompt(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error) {
	if m.generateFlowFn != nil {
		return m.generateFlowFn(ctx, tenantID, req)
	}
	return nil, service.ErrInvalidPrompt
}
func (m *mockSvcLowcode) ListFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters, page, pageSize int) ([]models.LowcodeFlow, int, error) { return nil, 0, nil }
func (m *mockSvcLowcode) GetFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) { return nil, service.ErrFlowNotFound }
func (m *mockSvcLowcode) CreateFlow(ctx context.Context, tenantID, userID string, req *models.CreateFlowRequest) (*models.LowcodeFlow, error) { return nil, nil }
func (m *mockSvcLowcode) UpdateFlow(ctx context.Context, tenantID, id string, req *models.UpdateFlowRequest) (*models.LowcodeFlow, error) { return nil, nil }
func (m *mockSvcLowcode) DeleteFlow(ctx context.Context, tenantID, id string) error { return nil }
func (m *mockSvcLowcode) PublishFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) { return nil, nil }
func (m *mockSvcLowcode) ExecuteFlow(ctx context.Context, tenantID, userID, flowID string, input string) (*models.LowcodeInstance, error) { return nil, nil }
func (m *mockSvcLowcode) CreateVersion(ctx context.Context, tenantID, userID, workflowID string) (*models.VersionSnapshot, error) { return nil, nil }
func (m *mockSvcLowcode) ListVersions(ctx context.Context, tenantID, workflowID string) ([]models.VersionSnapshot, error) { return nil, nil }
func (m *mockSvcLowcode) ImportWorkflow(ctx context.Context, tenantID, userID string, req *models.ImportWorkflowRequest) (*models.LowcodeFlow, error) { return nil, nil }
func (m *mockSvcLowcode) ExportWorkflow(ctx context.Context, tenantID, id string) (*models.ExportResponse, error) { return nil, nil }
func (m *mockSvcLowcode) ListTemplates(ctx context.Context) ([]models.LowcodeTemplate, error) { return nil, nil }
func (m *mockSvcLowcode) CreateTemplate(ctx context.Context, userID string, req *models.CreateTemplateRequest) (*models.LowcodeTemplate, error) { return nil, nil }
func (m *mockSvcLowcode) ApplyTemplate(ctx context.Context, tenantID, userID, templateID string, req *models.ApplyTemplateRequest) (*models.LowcodeFlow, error) { return nil, nil }

func makeLowcodeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
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

func TestHandler_TR10_GenerateFlow_ApprovalIntent(t *testing.T) {
	svc := &mockSvcLowcode{
		generateFlowFn: func(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			if req.Prompt != "创建一个审批流程，包含提交、审批、通知节点" {
				t.Errorf("Prompt = %q, want 审批流程 prompt", req.Prompt)
			}
			return &models.FlowGenerateResponse{
				Name:        "审批流程（创建一个审批流程，包含提交…）",
				Description: "AI 生成：创建一个审批流程，包含提交、审批、通知节点",
				Nodes:       `[{"id":"start","type":"start","label":"开始","position":[100,120]},{"id":"task-1","type":"task","label":"任务","position":[320,120]},{"id":"end","type":"end","label":"结束","position":[540,120]}]`,
				Edges:       `[{"source":"start","target":"task-1"},{"source":"task-1","target":"end"}]`,
				Intent:      "approval",
			}, nil
		},
	}
	h := NewHandler(svc)

	body := map[string]interface{}{
		"prompt": "创建一个审批流程，包含提交、审批、通知节点",
	}
	c, w := makeLowcodeCtx(http.MethodPost, "/lowcode/generate", body)
	h.GenerateFlow(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("GenerateFlow status = %d, want 201; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing data field")
	}
	if data["intent"] != "approval" {
		t.Errorf("intent = %v, want approval", data["intent"])
	}
	if _, ok := data["nodes"]; !ok {
		t.Error("response missing nodes")
	}
	if _, ok := data["edges"]; !ok {
		t.Error("response missing edges")
	}
}

func TestHandler_TR10_GenerateFlow_DeploymentIntent(t *testing.T) {
	svc := &mockSvcLowcode{
		generateFlowFn: func(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error) {
			return &models.FlowGenerateResponse{
				Name:        "发布流程",
				Description: "AI 生成：发布服务到生产",
				Nodes:       `[{"id":"start","type":"start","label":"开始","position":[100,120]},{"id":"task-1","type":"task","label":"部署","position":[320,120]},{"id":"end","type":"end","label":"结束","position":[540,120]}]`,
				Edges:       `[{"source":"start","target":"task-1"},{"source":"task-1","target":"end"}]`,
				Intent:      "deployment",
			}, nil
		},
	}
	h := NewHandler(svc)

	body := map[string]interface{}{
		"prompt": "发布服务到生产环境",
	}
	c, w := makeLowcodeCtx(http.MethodPost, "/lowcode/generate", body)
	h.GenerateFlow(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("GenerateFlow status = %d, want 201; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["intent"] != "deployment" {
		t.Errorf("intent = %v, want deployment", data["intent"])
	}
}

func TestHandler_TR10_GenerateFlow_MissingPrompt_400(t *testing.T) {
	svc := &mockSvcLowcode{}
	h := NewHandler(svc)

	// Omit the "prompt" field — binding:"required" should trigger 400
	body := map[string]interface{}{
		"name": "empty-flow",
	}
	c, w := makeLowcodeCtx(http.MethodPost, "/lowcode/generate", body)
	h.GenerateFlow(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("GenerateFlow status = %d, want 400 (missing prompt); body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"] != "BAD_REQUEST" {
		t.Errorf("code = %v, want BAD_REQUEST", resp["code"])
	}
}

func TestHandler_TR10_GenerateFlow_ServiceError_500(t *testing.T) {
	svc := &mockSvcLowcode{
		generateFlowFn: func(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error) {
			return nil, service.ErrInvalidPrompt
		},
	}
	h := NewHandler(svc)

	body := map[string]interface{}{
		"prompt": "some prompt",
	}
	c, w := makeLowcodeCtx(http.MethodPost, "/lowcode/generate", body)
	h.GenerateFlow(c)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("GenerateFlow status = %d, want 500; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"] != "INTERNAL_ERROR" {
		t.Errorf("code = %v, want INTERNAL_ERROR", resp["code"])
	}
}