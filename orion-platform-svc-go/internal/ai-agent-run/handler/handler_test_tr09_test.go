package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai-agent-run/models"
	"orion/platform-svc-go/internal/ai-agent-run/service"

	"github.com/gin-gonic/gin"
)

// ============================================================
// TR-09: 研发流程 Agent 场景测试
//
// 场景描述：研发流程 Agent 通过 ai-agent-run 模块提供生命周期管理
//   - 成功触发 Agent Run (POST /agent-runs)
//   - 获取 Run 详情 (GET /agent-runs/:id)
//   - 执行 Step (POST /agent-runs/:id/step)
//   - 取消运行中的 Run (POST /agent-runs/:id/cancel)
//   - 重试失败的 Run (POST /agent-runs/:id/retry)
//   - 缺少必填字段返回 400
//   - 获取不存在的 Run 返回 404
// ============================================================

// fakeAgentRunRepo implements RepositoryInterface for handler tests.
type fakeAgentRunRepo struct {
	runs      map[string]*models.AgentRun
	decisions []models.AgentDecision
	nextRunID int
	nextDecID int
}

func newFakeAgentRunRepo() *fakeAgentRunRepo {
	return &fakeAgentRunRepo{runs: make(map[string]*models.AgentRun)}
}

func (f *fakeAgentRunRepo) CreateRun(ctx context.Context, run *models.AgentRun) error {
	f.nextRunID++
	run.ID = "run-" + string(rune('0'+f.nextRunID))
	f.runs[run.ID] = run
	return nil
}

func (f *fakeAgentRunRepo) GetByTenant(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	run, ok := f.runs[id]
	if !ok || run.TenantID != tenantID {
		return nil, service.ErrRunNotFound
	}
	return run, nil
}

func (f *fakeAgentRunRepo) GetByID(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	return f.GetByTenant(ctx, id, tenantID)
}

func (f *fakeAgentRunRepo) UpdateStatus(ctx context.Context, id string, tenantID string, status models.AgentRunStatus, completedAt *int64) (*models.AgentRun, error) {
	run, ok := f.runs[id]
	if !ok || run.TenantID != tenantID {
		return nil, service.ErrRunNotFound
	}
	run.Status = status
	if completedAt != nil {
		run.CompletedAt.Int64 = *completedAt
		run.CompletedAt.Valid = true
	}
	return run, nil
}

func (f *fakeAgentRunRepo) UpdateStep(ctx context.Context, id string, tenantID string, step int) error {
	run, ok := f.runs[id]
	if !ok || run.TenantID != tenantID {
		return service.ErrRunNotFound
	}
	run.CurrentStep = step
	return nil
}

func (f *fakeAgentRunRepo) CreateDecision(ctx context.Context, d *models.AgentDecision) error {
	f.nextDecID++
	d.ID = "dec-" + string(rune('0'+f.nextDecID))
	f.decisions = append(f.decisions, *d)
	return nil
}

func (f *fakeAgentRunRepo) GetDecisionsByRunID(ctx context.Context, runID string, tenantID string) ([]models.AgentDecision, error) {
	var result []models.AgentDecision
	for _, d := range f.decisions {
		if d.RunID == runID {
			result = append(result, d)
		}
	}
	return result, nil
}

func (f *fakeAgentRunRepo) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AgentRun, error) {
	var items []models.AgentRun
	for _, r := range f.runs {
		if r.TenantID == tenantID {
			items = append(items, *r)
		}
	}
	return items, nil
}

func (f *fakeAgentRunRepo) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int64, error) {
	c := 0
	for _, r := range f.runs {
		if r.TenantID == tenantID {
			c++
		}
	}
	return int64(c), nil
}

func (f *fakeAgentRunRepo) GetStats(ctx context.Context, tenantID string) (*models.AgentRunStats, error) {
	return &models.AgentRunStats{Total: 2, Running: 1, Completed: 1}, nil
}

func (f *fakeAgentRunRepo) CancelRun(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	return nil, nil
}

// makeAgentRunCtx creates a gin context for agent-run handler tests.
func makeAgentRunCtx(method, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")
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
	return c, w
}

// newAgentRunHandler creates a handler with a fake repository.
func newAgentRunHandler(repo *fakeAgentRunRepo) *Handler {
	svc := service.NewService(repo)
	return NewHandler(svc)
}

// --- Tests ---

func TestHandler_TR09_TriggerRun_Success(t *testing.T) {
	repo := newFakeAgentRunRepo()
	h := newAgentRunHandler(repo)

	totalSteps := 3
	body := map[string]interface{}{
		"agentProfileId": "dev-agent",
		"triggerPayload": map[string]interface{}{"task": "implement-login"},
		"totalSteps":     totalSteps,
	}
	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs", body, nil)
	h.TriggerRun(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("TriggerRun status = %d, want 201; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data := resp["data"].(map[string]interface{})
	if data["status"] != "running" {
		t.Errorf("status = %v, want running", data["status"])
	}
	if data["agentProfileId"] != "dev-agent" {
		t.Errorf("agentProfileId = %v, want dev-agent", data["agentProfileId"])
	}

	// Verify exactly one run was created
	if len(repo.runs) != 1 {
		t.Errorf("repo.runs = %d, want 1", len(repo.runs))
	}
}

func TestHandler_TR09_TriggerRun_MissingAgentProfileID_400(t *testing.T) {
	repo := newFakeAgentRunRepo()
	h := newAgentRunHandler(repo)

	body := map[string]interface{}{
		"triggerPayload": map[string]interface{}{},
	}
	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs", body, nil)
	h.TriggerRun(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("TriggerRun status = %d, want 400 (missing agentProfileId)", w.Code)
	}
}

func TestHandler_TR09_TriggerRun_WithTimeoutSec(t *testing.T) {
	repo := newFakeAgentRunRepo()
	h := newAgentRunHandler(repo)

	timeoutSec := int64(1800)
	body := map[string]interface{}{
		"agentProfileId": "code-review-agent",
		"timeoutSec":     timeoutSec,
	}
	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs", body, nil)
	h.TriggerRun(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("TriggerRun status = %d, want 201", w.Code)
	}
}

func TestHandler_TR09_GetByID_Success(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:             "run-1",
		TenantID:       "tenant-1",
		AgentProfileID: "dev-agent",
		Status:         models.AgentRunStatusRunning,
		TotalSteps:     5,
		CurrentStep:    2,
	}
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodGet, "/agent-runs/:id", nil, map[string]string{"id": "run-1"})
	h.GetByID(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetByID status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["id"] != "run-1" {
		t.Errorf("id = %v, want run-1", data["id"])
	}
	if data["status"] != "running" {
		t.Errorf("status = %v, want running", data["status"])
	}
}

func TestHandler_TR09_GetByID_NotFound(t *testing.T) {
	repo := newFakeAgentRunRepo()
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodGet, "/agent-runs/:id", nil, map[string]string{"id": "ghost"})
	h.GetByID(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("GetByID status = %d, want 404", w.Code)
	}
}

func TestHandler_TR09_ExecuteStep_Success(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:             "run-1",
		TenantID:       "tenant-1",
		AgentProfileID: "dev-agent",
		Status:         models.AgentRunStatusRunning,
		CurrentStep:    0,
		TotalSteps:     3,
	}
	h := newAgentRunHandler(repo)

	body := map[string]interface{}{
		"action":  "write_code",
		"agentId": "dev-agent",
		"actionInput": map[string]interface{}{
			"file": "src/login.go",
			"code": "func Login(){}",
		},
	}
	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs/:id/step", body, map[string]string{"id": "run-1"})
	h.ExecuteStep(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ExecuteStep status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	// Verify step advanced
	if repo.runs["run-1"].CurrentStep != 1 {
		t.Errorf("CurrentStep = %d, want 1", repo.runs["run-1"].CurrentStep)
	}
	if len(repo.decisions) != 1 {
		t.Errorf("decisions = %d, want 1", len(repo.decisions))
	}
	if repo.decisions[0].Action != models.AgentActionWriteCode {
		t.Errorf("decision action = %v, want write_code", repo.decisions[0].Action)
	}
}

func TestHandler_TR09_ExecuteStep_InvalidAction_400(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:       "run-1",
		TenantID: "tenant-1",
		Status:   models.AgentRunStatusRunning,
	}
	h := newAgentRunHandler(repo)

	body := map[string]interface{}{
		"action": "unsupported_action",
	}
	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs/:id/step", body, map[string]string{"id": "run-1"})
	h.ExecuteStep(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("ExecuteStep status = %d, want 400 (invalid action)", w.Code)
	}
}

func TestHandler_TR09_Cancel_Success(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:             "run-1",
		TenantID:       "tenant-1",
		AgentProfileID: "dev-agent",
		Status:         models.AgentRunStatusRunning,
	}
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs/:id/cancel", nil, map[string]string{"id": "run-1"})
	h.Cancel(c)

	if w.Code != http.StatusOK {
		t.Fatalf("Cancel status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if repo.runs["run-1"].Status != models.AgentRunStatusCancelled {
		t.Errorf("status = %v, want cancelled", repo.runs["run-1"].Status)
	}
}

func TestHandler_TR09_Retry_Success(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.nextRunID = 9 // Avoid collision: new run will be "run-10", not "run-1"
	repo.runs["run-1"] = &models.AgentRun{
		ID:             "run-1",
		TenantID:       "tenant-1",
		AgentProfileID: "dev-agent",
		TriggerPayload: "{}",
		Status:         models.AgentRunStatusFailed,
		TotalSteps:     5,
	}
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodPost, "/agent-runs/:id/retry", nil, map[string]string{"id": "run-1"})
	h.Retry(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("Retry status = %d, want 201; body=%s", w.Code, w.Body.String())
	}
	// Original run + new retry run = 2
	if len(repo.runs) != 2 {
		t.Errorf("repo.runs = %d, want 2 (original + retry)", len(repo.runs))
	}
}

func TestHandler_TR09_GetStats(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:       "run-1",
		TenantID: "tenant-1",
		Status:   models.AgentRunStatusRunning,
	}
	repo.runs["run-2"] = &models.AgentRun{
		ID:       "run-2",
		TenantID: "tenant-1",
		Status:   models.AgentRunStatusCompleted,
	}
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodGet, "/agent-runs/stats", nil, nil)
	h.GetStats(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetStats status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	// The response should contain totalRuns
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing data field")
	}
	total := int64(data["total"].(float64))
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
}

func TestHandler_TR09_GetDecisions(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:       "run-1",
		TenantID: "tenant-1",
		Status:   models.AgentRunStatusRunning,
	}
	repo.decisions = append(repo.decisions, models.AgentDecision{
		ID:         "dec-1",
		RunID:      "run-1",
		AgentID:    "dev-agent",
		StepNumber: 1,
		Action:     models.AgentActionReadFile,
		Reasoning:  "reading source file",
		CreatedAt:  1,
	})
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodGet, "/agent-runs/:id/decisions", nil, map[string]string{"id": "run-1"})
	h.GetDecisions(c)

	if w.Code != http.StatusOK {
		t.Fatalf("GetDecisions status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if total := data["total"].(float64); total != 1 {
		t.Errorf("total = %.0f, want 1", total)
	}
}

func TestHandler_TR09_List(t *testing.T) {
	repo := newFakeAgentRunRepo()
	repo.runs["run-1"] = &models.AgentRun{
		ID:       "run-1",
		TenantID: "tenant-1",
		Status:   models.AgentRunStatusRunning,
	}
	h := newAgentRunHandler(repo)

	c, w := makeAgentRunCtx(http.MethodGet, "/agent-runs", nil, nil)
	h.List(c)

	if w.Code != http.StatusOK {
		t.Fatalf("List status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}
