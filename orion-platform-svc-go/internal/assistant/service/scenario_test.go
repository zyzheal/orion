package service

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/assistant/models"
)

// ============================================================
// P2 场景化：TR-09 研发流程 Agent / TR-11 Ops 问答助手
//
// 场景描述：
//   - TR-09: 用户通过 Assistant 触发研发流程 Agent Run
//   - TR-11: 用户通过 Assistant 查询 Runbook 获取可执行命令
// ============================================================

// --- Mock triggerer for PipelineExecutor ---

type mockPipelineTriggerer struct {
	runs []PipelineRunRef
	fn   func(ctx context.Context, tenantID string, agentProfileID string, totalSteps int, payload map[string]interface{}) (*PipelineRunRef, error)
}

func (m *mockPipelineTriggerer) TriggerRun(ctx context.Context, tenantID string, agentProfileID string, totalSteps int, payload map[string]interface{}) (*PipelineRunRef, error) {
	if m.fn != nil {
		return m.fn(ctx, tenantID, agentProfileID, totalSteps, payload)
	}
	ref := &PipelineRunRef{ID: "run-mock-1", Name: "mock-run"}
	m.runs = append(m.runs, *ref)
	return ref, nil
}

// --- Mock querier for OpsCommandExecutor ---

type mockRunbookQuerier struct {
	refs []RunbookRef
	err  error
}

func (m *mockRunbookQuerier) Search(ctx context.Context, tenantID string, query string, limit int) ([]RunbookRef, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.refs, nil
}

// ============================================================
// TR-09: 研发流程 Agent
// ============================================================

func TestScenario_TR09_TriggerPipeline_Success(t *testing.T) {
	triggerer := &mockPipelineTriggerer{
		fn: func(ctx context.Context, tenantID string, agentProfileID string, totalSteps int, payload map[string]interface{}) (*PipelineRunRef, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			if agentProfileID != "dev-agent" {
				t.Errorf("agentProfileID = %q, want dev-agent", agentProfileID)
			}
			if totalSteps != 3 {
				t.Errorf("totalSteps = %d, want 3", totalSteps)
			}
			if payload["task"] != "帮我触发研发流程 Agent 实现登录接口" {
				t.Errorf("payload.task = %v, want full prompt", payload["task"])
			}
			return &PipelineRunRef{ID: "run-001", Name: "实现登录接口"}, nil
		},
	}

	svc := NewService(nil)
	ex := NewPipelineExecutor(triggerer)
	svc.AddExecutor(ex)

	req := &models.ActionRequest{
		Prompt: "帮我触发研发流程 Agent 实现登录接口",
		Kind:   "auto",
		Metadata: map[string]interface{}{
			"agentProfileId": "dev-agent",
			"totalSteps":     3,
		},
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Kind != models.ActionTriggerPipeline {
		t.Errorf("Kind = %v, want trigger_pipeline", res.Kind)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v, want executed", res.Status)
	}
	if res.EntityID != "run-001" {
		t.Errorf("EntityID = %v, want run-001", res.EntityID)
	}
	if res.EntityName != "实现登录接口" {
		t.Errorf("EntityName = %v, want 实现登录接口", res.EntityName)
	}
	if len(res.Steps) < 3 {
		t.Errorf("Steps = %v, want >= 3", res.Steps)
	}
}

func TestScenario_TR09_TriggerPipeline_CustomProfile(t *testing.T) {
	triggerer := &mockPipelineTriggerer{}
	svc := NewService(nil)
	svc.AddExecutor(NewPipelineExecutor(triggerer))

	req := &models.ActionRequest{
		Prompt: "触发研发流程 Agent 执行代码评审",
		Metadata: map[string]interface{}{
			"agentProfileId": "code-review-agent",
			"totalSteps":     5,
		},
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Kind != models.ActionTriggerPipeline {
		t.Errorf("Kind = %v", res.Kind)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v", res.Status)
	}
}

func TestScenario_TR09_TriggerPipeline_MissingTriggerer(t *testing.T) {
	svc := NewService(nil)
	svc.AddExecutor(NewPipelineExecutor(nil))

	req := &models.ActionRequest{
		Prompt: "触发研发流程",
		Kind:   "trigger_pipeline",
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Status != "unsupported" {
		t.Errorf("Status = %v, want unsupported", res.Status)
	}
}

func TestScenario_TR09_TriggerPipeline_ErrorHandling(t *testing.T) {
	triggerer := &mockPipelineTriggerer{
		fn: func(ctx context.Context, tenantID string, agentProfileID string, totalSteps int, payload map[string]interface{}) (*PipelineRunRef, error) {
			return nil, fmt.Errorf("upstream error: db timeout")
		},
	}
	svc := NewService(nil)
	svc.AddExecutor(NewPipelineExecutor(triggerer))

	req := &models.ActionRequest{
		Prompt: "触发研发流程 Agent",
		Metadata: map[string]interface{}{
			"agentProfileId": "dev-agent",
		},
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v, want executed (error embedded in result)", res.Status)
	}
	if res.Error == "" {
		t.Error("Error should contain upstream error message")
	}
}

func TestScenario_TR09_ResolveActionKind(t *testing.T) {
	tests := []struct {
		prompt string
		want   models.ActionKind
	}{
		{"帮我触发研发流程 Agent", models.ActionTriggerPipeline},
		{"创建流水线构建代码", models.ActionTriggerPipeline},
		{"agent run 执行任务", models.ActionTriggerPipeline},
		{"帮我创建工单", models.ActionCreateTicket},
	}
	for _, tt := range tests {
		kind := resolveActionKind(&models.ActionRequest{Prompt: tt.prompt})
		if kind != tt.want {
			t.Errorf("resolveActionKind(%q) = %v, want %v", tt.prompt, kind, tt.want)
		}
	}
}

// ============================================================
// TR-11: Ops 问答助手
// ============================================================

func TestScenario_TR11_OpsCommand_Success(t *testing.T) {
	querier := &mockRunbookQuerier{
		refs: []RunbookRef{
			{
				ID:       "rb-1",
				Title:    "CPU 高负载排查",
				Category: "performance",
				Commands: []string{"top -b -n 1", "vmstat 1 5", "iostat -x 1 5"},
			},
			{
				ID:       "rb-2",
				Title:    "磁盘满排查",
				Category: "storage",
				Commands: []string{"df -h", "du -sh /var/log/*"},
			},
		},
	}

	svc := NewService(nil)
	ex := NewOpsCommandExecutor(querier)
	svc.AddExecutor(ex)

	req := &models.ActionRequest{
		Prompt: "服务器 CPU 使用率飙升，建议什么命令排查",
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-ops-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Kind != models.ActionSuggestCommand {
		t.Errorf("Kind = %v, want suggest_command", res.Kind)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v, want executed", res.Status)
	}
	if res.Metadata == nil {
		t.Fatal("Metadata should not be nil when commands exist")
	}
	cmds, ok := res.Metadata["suggestedCommands"].(string)
	if !ok {
		t.Fatalf("Metadata.suggestedCommands = %v (type %T), want string",
			res.Metadata["suggestedCommands"], res.Metadata["suggestedCommands"])
	}
	var parsed []string
	if err := json.Unmarshal([]byte(cmds), &parsed); err != nil {
		t.Fatalf("suggestedCommands unmarshal: %v", err)
	}
	if len(parsed) < 4 {
		t.Errorf("suggestedCommands count = %d, want >= 4", len(parsed))
	}
}

func TestScenario_TR11_OpsCommand_NoRunbooks(t *testing.T) {
	querier := &mockRunbookQuerier{refs: nil}
	svc := NewService(nil)
	svc.AddExecutor(NewOpsCommandExecutor(querier))

	req := &models.ActionRequest{
		Prompt: "ops 服务器异常排查",
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-ops-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v, want executed", res.Status)
	}
	if res.Metadata != nil {
		t.Error("Metadata should be nil when no runbooks found")
	}
}

func TestScenario_TR11_OpsCommand_QuerierError(t *testing.T) {
	querier := &mockRunbookQuerier{err: fmt.Errorf("db connection refused")}
	svc := NewService(nil)
	svc.AddExecutor(NewOpsCommandExecutor(querier))

	req := &models.ActionRequest{
		Prompt: "查询 ops runbook",
	}
	res, err := svc.ExecuteAction(context.Background(), "tenant-1", req, "user-ops-1")
	if err != nil {
		t.Fatalf("ExecuteAction error: %v", err)
	}
	if res.Status != "executed" {
		t.Errorf("Status = %v, want executed", res.Status)
	}
	if res.Error == "" {
		t.Error("Error should contain db error message")
	}
}

func TestScenario_TR11_ResolveActionKind(t *testing.T) {
	tests := []struct {
		prompt string
		want   models.ActionKind
	}{
		{"ops 服务器 CPU 高", models.ActionSuggestCommand},
		{"运维 runbook 排查", models.ActionSuggestCommand},
		{"查询操作手册", models.ActionSuggestCommand},
		{"建议命令排查网络", models.ActionSuggestCommand},
		{"帮我创建工单", models.ActionCreateTicket},
	}
	for _, tt := range tests {
		kind := resolveActionKind(&models.ActionRequest{Prompt: tt.prompt})
		if kind != tt.want {
			t.Errorf("resolveActionKind(%q) = %v, want %v", tt.prompt, kind, tt.want)
		}
	}
}

// ============================================================
// DetectIntent 新增意图验证
// ============================================================

func TestScenario_DetectIntent_NewIntents(t *testing.T) {
	svc := NewService(nil)
	tests := []struct {
		question string
		want     string
	}{
		{"帮我触发研发流程 Agent", "dev-agent"},
		{"agent run 执行代码生成", "dev-agent"},
		{"ops 服务器异常怎么办", "ops"},
		{"查询操作手册", "ops"},
		{"流水线构建失败", "pipeline"},
	}
	for _, tt := range tests {
		req := models.QueryRequest{Question: tt.question}
		intent := svc.detectIntent(req)
		if intent != tt.want {
			t.Errorf("detectIntent(%q) = %q, want %q", tt.question, intent, tt.want)
		}
	}
}
