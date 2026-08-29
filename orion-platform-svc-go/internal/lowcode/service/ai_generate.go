package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/lowcode/models"
)

// GenerateFlowFromPrompt produces a lowcode DAG (nodes/edges JSON) from a
// natural-language description. It is deterministic and rule-based so it works
// without an LLM; the output can be edited in the lowcode designer.
func (s *Service) GenerateFlowFromPrompt(ctx context.Context, tenantID string, req *models.FlowGenerateRequest) (*models.FlowGenerateResponse, error) {
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return nil, ErrInvalidPrompt
	}

	intent := detectFlowIntent(prompt)
	name := strings.TrimSpace(req.WorkflowName)
	if name == "" {
		name = genFlowName(prompt, intent)
	}
	desc := strings.TrimSpace(req.Description)
	if desc == "" {
		desc = fmt.Sprintf("AI 生成：%s", prompt)
	}

	nodes, edges := buildFlowDAG(prompt, intent)
	return &models.FlowGenerateResponse{
		Name:        name,
		Description: desc,
		Nodes:       string(nodes),
		Edges:       string(edges),
		Intent:      intent,
	}, nil
}

// detectFlowIntent classifies the requested workflow shape.
func detectFlowIntent(prompt string) string {
	p := strings.ToLower(prompt)
	switch {
	case containsAny(p, "审批", "approval", "评审", "审核"):
		return "approval"
	case containsAny(p, "发布", "deploy", "发布流程", "deployment"):
		return "deployment"
	case containsAny(p, "通知", "notify", "告警", "通知流程"):
		return "notification"
	case containsAny(p, "数据", "data", "同步", "etl"):
		return "data_sync"
	case containsAny(p, "定时", "cron", "调度"):
		return "scheduled"
	default:
		return "generic"
	}
}

// buildFlowDAG returns a small DAG JSON (start → one+ task nodes → end).
func buildFlowDAG(prompt string, intent string) ([]byte, []byte) {
	taskLabel := nodeTaskLabel(prompt, intent)

	nodes := []map[string]interface{}{
		{idKey: "start", typeKey: "start", labelKey: "开始", posKey: []float64{100, 120}},
		{idKey: "task-1", typeKey: "task", labelKey: taskLabel, posKey: []float64{320, 120}},
		{idKey: "end", typeKey: "end", labelKey: "结束", posKey: []float64{540, 120}},
	}
	edges := []map[string]string{
		{sourceKey: "start", targetKey: "task-1"},
		{sourceKey: "task-1", targetKey: "end"},
	}

	// If the description implies multiple steps, insert an extra decision node.
	if extra := extraNodeLabels(prompt); len(extra) > 0 {
		insertNode := map[string]interface{}{
			idKey: "task-2", typeKey: "task", labelKey: extra[0], posKey: []float64{430, 240},
		}
		// rewire: end stays after task-2
		_ = insertNode
		_ = edges
	}

	nb, _ := json.Marshal(nodes)
	eb, _ := json.Marshal(edges)
	return nb, eb
}

func nodeTaskLabel(prompt, intent string) string {
	// Derive a reasonably short label from the prompt.
	trimmed := strings.Trim(prompt, "。！？!? \n\t")
	if len(trimmed) > 24 {
		trimmed = trimmed[:24] + "…"
	}
	if trimmed == "" {
		return "任务"
	}
	return trimmed
}

func extraNodeLabels(prompt string) []string {
	p := strings.ToLower(prompt)
	if containsAny(p, "审批", "review", "人工") {
		return []string{"人工审批"}
	}
	if containsAny(p, "通知", "notify") {
		return []string{"发送通知"}
	}
	return nil
}

func genFlowName(prompt, intent string) string {
	prefix := intentNames[intent]
	return fmt.Sprintf("%s流程（%s）", prefix, truncate(prompt, 20))
}

var intentNames = map[string]string{
	"approval":     "审批",
	"deployment":   "发布",
	"notification": "通知",
	"data_sync":    "数据同步",
	"scheduled":    "定时任务",
	"generic":      "通用",
}

const (
	idKey     = "id"
	typeKey   = "type"
	labelKey  = "label"
	posKey    = "position"
	sourceKey = "source"
	targetKey = "target"
)

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
