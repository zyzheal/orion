package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/platform-svc-go/internal/assistant/models"
)

// PipelineTriggerer adapts ai-agent-run into the assistant action executor
// layer (TR-09 研发流程 Agent). Implementations wrap the real ai-agent-run svc.
type PipelineTriggerer interface {
	TriggerRun(ctx context.Context, tenantID string, agentProfileID string, totalSteps int, payload map[string]interface{}) (*PipelineRunRef, error)
}

// PipelineRunRef is a normalized reference to a created pipeline run.
type PipelineRunRef struct {
	ID   string
	Name string
}

// RunbookQuerier adapts the runbook module for Ops command suggestions (TR-11).
type RunbookQuerier interface {
	Search(ctx context.Context, tenantID string, query string, limit int) ([]RunbookRef, error)
}

// RunbookRef is a normalized runbook record for assistant consumption.
type RunbookRef struct {
	ID       string
	Title    string
	Category string
	Commands []string
}

// --- PipelineExecutor (ActionTriggerPipeline, TR-09) ---

type PipelineExecutor struct {
	triggerer PipelineTriggerer
}

func NewPipelineExecutor(triggerer PipelineTriggerer) *PipelineExecutor {
	return &PipelineExecutor{triggerer: triggerer}
}

func (e *PipelineExecutor) Kind() models.ActionKind {
	return models.ActionTriggerPipeline
}

func (e *PipelineExecutor) Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
	if e.triggerer == nil {
		return &models.ActionResult{
			Kind:    models.ActionTriggerPipeline,
			Status:  "unsupported",
			Summary: "未配置研发流程 Agent 触发器",
		}, nil
	}

	agentProfileID := "dev-agent"
	if p := req.Metadata; p != nil {
		if v, ok := p["agentProfileId"].(string); ok && v != "" {
			agentProfileID = v
		}
	}

	payload := map[string]interface{}{
		"task": req.Prompt,
		"title": req.Title,
		"desc": req.Description,
	}

	totalSteps := 3
	if req.Metadata != nil {
		if v, ok := req.Metadata["totalSteps"].(int); ok && v > 0 {
			totalSteps = v
		}
	}

	ref, err := e.triggerer.TriggerRun(ctx, tenantID, agentProfileID, totalSteps, payload)
	if err != nil {
		return &models.ActionResult{
			Kind:    models.ActionTriggerPipeline,
			Status:  "executed",
			Summary: fmt.Sprintf("流水线触发失败：%s", err.Error()),
			Steps:   []string{fmt.Sprintf("触发 %s 失败", agentProfileID)},
			Error:   err.Error(),
		}, nil
	}

	return &models.ActionResult{
		Kind:       models.ActionTriggerPipeline,
		Status:     "executed",
		Summary:    fmt.Sprintf("已创建研发流程 Run: %s", ref.Name),
		EntityID:   ref.ID,
		EntityName: ref.Name,
		Steps: []string{
			"识别意图：触发研发流程 Agent",
			fmt.Sprintf("Agent Profile: %s", agentProfileID),
			fmt.Sprintf("创建 Run: %s (totalSteps=%d)", ref.ID, totalSteps),
		},
	}, nil
}

// --- OpsCommandExecutor (ActionSuggestCommand, TR-11) ---

type OpsCommandExecutor struct {
	querier RunbookQuerier
}

func NewOpsCommandExecutor(querier RunbookQuerier) *OpsCommandExecutor {
	return &OpsCommandExecutor{querier: querier}
}

func (e *OpsCommandExecutor) Kind() models.ActionKind {
	return models.ActionSuggestCommand
}

func (e *OpsCommandExecutor) Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
	if e.querier == nil {
		return &models.ActionResult{
			Kind:    models.ActionSuggestCommand,
			Status:  "unsupported",
			Summary: "未配置 Runbook 查询器",
		}, nil
	}

	refs, err := e.querier.Search(ctx, tenantID, req.Prompt, 5)
	if err != nil {
		return &models.ActionResult{
			Kind:    models.ActionSuggestCommand,
			Status:  "executed",
			Summary: fmt.Sprintf("Runbook 检索失败：%s", err.Error()),
			Error:   err.Error(),
		}, nil
	}

	steps := []string{fmt.Sprintf("在 Runbook 中检索到 %d 个匹配项", len(refs))}
	var commands []string

	for _, r := range refs {
		steps = append(steps, fmt.Sprintf("[%s] %s (category=%s)", r.ID, r.Title, r.Category))
		for _, cmd := range r.Commands {
			commands = append(commands, cmd)
		}
	}

	if len(refs) == 0 {
		steps = append(steps, "未找到匹配的 Runbook")
	}

	result := &models.ActionResult{
		Kind:    models.ActionSuggestCommand,
		Status:  "executed",
		Summary: fmt.Sprintf("找到 %d 个相关 Runbook", len(refs)),
		Steps:   steps,
	}

	if len(commands) > 0 {
		commandsJSON, _ := json.Marshal(commands)
		result.Metadata = map[string]interface{}{
			"suggestedCommands": string(commandsJSON),
			"runbookCount":      len(refs),
		}
	}

	return result, nil
}

// --- LowcodeGeneratorExecutor (ActionGenerateFlow, TR-10) ---

// FlowGenerator adapts the lowcode service for AI-generated flow creation.
type FlowGenerator interface {
	Generate(ctx context.Context, tenantID string, prompt string, workflowName string) (*FlowGenResult, error)
}

// FlowGenResult is the normalized result of AI flow generation.
type FlowGenResult struct {
	ID          string
	Name        string
	Description string
	Nodes       string
	Edges       string
	Intent      string
}

type LowcodeGeneratorExecutor struct {
	generator FlowGenerator
}

func NewLowcodeGeneratorExecutor(generator FlowGenerator) *LowcodeGeneratorExecutor {
	return &LowcodeGeneratorExecutor{generator: generator}
}

func (e *LowcodeGeneratorExecutor) Kind() models.ActionKind {
	return models.ActionGenerateFlow
}

func (e *LowcodeGeneratorExecutor) Execute(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
	if e.generator == nil {
		return &models.ActionResult{
			Kind:    models.ActionGenerateFlow,
			Status:  "unsupported",
			Summary: "未配置 LowCode AI 生成器",
		}, nil
	}

	workflowName := ""
	if req.Title != "" {
		workflowName = req.Title
	}
	if p := req.Metadata; p != nil {
		if v, ok := p["workflowName"].(string); ok && v != "" {
			workflowName = v
		}
	}

	ref, err := e.generator.Generate(ctx, tenantID, req.Prompt, workflowName)
	if err != nil {
		return &models.ActionResult{
			Kind:    models.ActionGenerateFlow,
			Status:  "executed",
			Summary: fmt.Sprintf("流程生成失败：%s", err.Error()),
			Steps:   []string{"识别意图：AI 生成流程"},
			Error:   err.Error(),
		}, nil
	}

	nodesJSON, _ := json.Marshal(ref.Nodes)

	result := &models.ActionResult{
		Kind:       models.ActionGenerateFlow,
		Status:     "executed",
		Summary:    fmt.Sprintf("已生成流程：%s (意图=%s)", ref.Name, ref.Intent),
		EntityID:   ref.ID,
		EntityName: ref.Name,
		Steps: []string{
			"识别意图：AI 生成流程",
			fmt.Sprintf("流程名称: %s", ref.Name),
			fmt.Sprintf("意图分类: %s", ref.Intent),
			"已构建节点/连线定义",
		},
		Metadata: map[string]interface{}{
			"intent": ref.Intent,
			"nodes":  string(nodesJSON),
			"edges":  ref.Edges,
		},
	}
	return result, nil
}