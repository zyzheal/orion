package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/assistant/models"
)

// ActionExecutor executes a single workflow action on behalf of the assistant.
// Implementations are wired in main via closures over the real services.
type ActionExecutor interface {
	// Kind returns the action kind this executor handles.
	Kind() models.ActionKind
	// Execute performs the action described by req.
	Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error)
}

// Service extends Generation with executable actions (TR-09).
func (s *Service) ExecuteAction(ctx context.Context, tenantID string, req *models.ActionRequest, userID string) (*models.ActionResult, error) {
	kind := resolveActionKind(req)
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)

	if req.Title == "" {
		// Fall back to a heuristic title derived from the prompt.
		title, ok := inferTitle(req.Prompt, kind)
		if !ok {
			return nil, fmt.Errorf("无法从请求中识别标题，请补充明确的操作对象")
		}
		req.Title = title
	}

	for _, ex := range s.executors {
		if ex.Kind() == kind {
			res, err := ex.Execute(ctx, tenantID, req)
			if err != nil {
				return &models.ActionResult{
					Kind:       kind,
					Status:     "executed",
					Summary:    fmt.Sprintf("操作执行失败：%s", err.Error()),
					Steps:      []string{fmt.Sprintf("尝试 %s 失败", kind)},
					Error:      err.Error(),
					ExecutedAt: nowUTC(),
				}, nil
			}
			return res, nil
		}
	}
	return &models.ActionResult{
		Kind:       kind,
		Status:     "unsupported",
		Summary:    "当前环境未注册该动作执行器",
		ExecutedAt: nowUTC(),
	}, nil
}

// resolveActionKind maps a request to an executable action kind.
// TR-10 (flow generation) keywords must be checked before TR-09 (pipeline) because
// "发布流程" contains "发布" which pipeline also matches. The more specific
// "流程" suffixed keywords take priority.
func resolveActionKind(req *models.ActionRequest) models.ActionKind {
	if req.Kind != "" && req.Kind != "auto" {
		switch models.ActionKind(req.Kind) {
		case models.ActionCreateTicket, models.ActionTriggerPipeline, models.ActionCreateChange, models.ActionSuggestCommand, models.ActionGenerateFlow:
			return models.ActionKind(req.Kind)
		}
	}
	p := strings.ToLower(req.Prompt)
	switch {
	case containsAny(p, "流程生成", "审批流程", "发布流程", "数据同步", "ETL", "定时任务", "cron", "lowcode", "低代码"):
		return models.ActionGenerateFlow
	case strings.Contains(p, "流程") && containsAny(p, "创建", "生成", "设计", "搭建", "数据", "审批", "发布", "同步"):
		return models.ActionGenerateFlow
	case containsAny(p, "流水线", "pipeline", "构建", "部署", "发布", "ci", "研发流程", "agent run"):
		return models.ActionTriggerPipeline
	case containsAny(p, "ops", "运维", "runbook", "操作手册", "执行命令", "建议命令", "建议什么"):
		return models.ActionSuggestCommand
	case containsAny(p, "变更", "change", "上线", "变更申请"):
		return models.ActionCreateChange
	case containsAny(p, "工单", "ticket", "申请", "抱怨", "bug", "缺陷"):
		return models.ActionCreateTicket
	default:
		return models.ActionCreateTicket
	}
}

// inferTitle derives a short title from the prompt.
func inferTitle(prompt string, kind models.ActionKind) (string, bool) {
	p := strings.TrimSpace(prompt)
	if p == "" {
		return "", false
	}
	cut := []string{"帮我", "请", "需要", "请帮我", "做", "办"}
	for _, c := range cut {
		p = strings.TrimPrefix(p, c)
	}
	p = strings.TrimSpace(strings.Trim(p, "，。！？ "))
	if p == "" {
		return "", false
	}
	if len(p) > 60 {
		p = p[:60] + "…"
	}
	return p, true
}

// AddExecutor registers an action executor on the service.
func (s *Service) AddExecutor(ex ActionExecutor) {
	if s.executors == nil {
		s.executors = map[models.ActionKind]ActionExecutor{}
	}
	s.executors[ex.Kind()] = ex
}

func nowUTC() time.Time { return time.Now().UTC() }