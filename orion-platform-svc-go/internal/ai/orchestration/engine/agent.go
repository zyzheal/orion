package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/ai/llm-provider"
)

// agentExecutor is responsible for executing a single AgentNode within a DAG.
type agentExecutor struct {
	registry *llmprovider.ProviderRegistry
	logger   *zap.Logger
	// toolRegistry maps tool names to callable functions.
	tools map[string]ToolFn
}

// ToolFn is the signature for a callable tool function.
type ToolFn func(ctx context.Context, args map[string]interface{}) (string, error)

// NewAgentExecutor creates an executor wired to the LLM ProviderRegistry.
func NewAgentExecutor(
	registry *llmprovider.ProviderRegistry,
	logger *zap.Logger,
) *agentExecutor {
	return &agentExecutor{
		registry: registry,
		logger:   logger,
		tools:    make(map[string]ToolFn),
	}
}

// RegisterTool registers a tool that LLM nodes can request to be invoked.
func (e *agentExecutor) RegisterTool(name string, fn ToolFn) {
	e.tools[name] = fn
}

// RegisteredTools returns the set of registered tool names.
func (e *agentExecutor) RegisteredTools() []string {
	names := make([]string, 0, len(e.tools))
	for n := range e.tools {
		names = append(names, n)
	}
	return names
}

// Execute runs a single AgentNode and returns its result.
func (e *agentExecutor) Execute(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
	defaultTemperature float64,
) *NodeResult {
	e.logger.Info("executing agent node",
		zap.String("nodeId", node.ID),
		zap.String("nodeType", string(node.Type)),
		zap.String("runId", execCtx.RunID),
	)

	// Handle grouping nodes by delegating to the orchestrator.
	if groupNodeKind(node.Type) == NodeKindGrouping {
		return e.executeGroupingNode(ctx, node, execCtx)
	}

	// Handle HUMAN_REVIEW (currently returns a pass-through; the UI layer
	// would integrate async approval, but the engine treats it as a leaf node).
	if node.Type == AgentTypeHumanReview {
		return e.executeHumanReview(ctx, node, execCtx)
	}

	// SUPERVISOR: runs the node's prompt, then dispatches to child nodes based
	// on the LLM response.
	if node.Type == AgentTypeSupervisor {
		return e.executeSupervisor(ctx, node, execCtx, model, defaultTemperature)
	}

	// CRITIC: evaluates the input provided via context and returns a score.
	if node.Type == AgentTypeCritic {
		return e.executeCritic(ctx, node, execCtx, model, defaultTemperature)
	}

	// Default: LLM_CHAT or TOOL_CALL leaf node.
	return e.executeLLMNode(ctx, node, execCtx, model, defaultTemperature)
}

// executeLLMNode sends a chat request to the provider registry.
func (e *agentExecutor) executeLLMNode(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
	defaultTemperature float64,
) *NodeResult {
	result := &NodeResult{
		NodeID:   node.ID,
		NodeType: node.Type,
		Success:  false,
	}

	// Build messages.
	messages := e.buildMessages(node, execCtx, model)

	// Resolve provider.
	temperature := node.Temperature
	if temperature == 0 {
		temperature = defaultTemperature
	}
	if temperature == 0 {
		temperature = 0.3
	}

	req := &llmprovider.ChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   node.MaxTokens,
	}

	// Timeout handling per node.
	if node.TimeoutSec > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(node.TimeoutSec)*time.Second)
		defer cancel()
	}

	if e.registry == nil {
		result.Error = "LLM provider registry not available (dry-run)"
		result.Output = fmt.Sprintf("[dry-run] would call LLM with model=%s for node=%s", model, node.ID)
		result.Success = true
		result.Structured = map[string]interface{}{"dry_run": true, "prompt_length": len(messages)}
		return result
	}

	resp, err := e.registry.Call(ctx, req)
	if err != nil {
		// Classify the error for retry eligibility.
		retriable := isRetriable(err)
		result.Error = fmt.Sprintf("LLM call failed: %s (retriable=%t)", err.Error(), retriable)
		if node.MaxRetries > 0 && retriable {
			result.Error += " (retry available)"
		}
		return result
	}

	result.Output = resp.Content
	result.Success = true
	result.Structured = map[string]interface{}{
		"provider": string(resp.Provider),
		"model":    resp.Model,
		"tokens":   resp.TotalTokens,
	}

	// Parse structured output if the response looks like JSON.
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(resp.Content), &parsed); err == nil {
		result.Structured = parsed
	}

	// Attempt tool calls: if the LLM response contains tool call markers and
	// tools are registered, invoke them iteratively.
	result.ToolsUsed = e.attemptToolCalls(ctx, node, execCtx, resp.Content, model)

	// Publish outputs to context.
	e.publishOutputs(node, execCtx, result)

	return result
}

// executeSupervisor handles the SUPERVISOR agent type: the supervisor prompts
// the LLM, and the response determines which child node to run next. The
// supervisor stores its decision in the context under "supervisor_decision".
func (e *agentExecutor) executeSupervisor(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
	defaultTemperature float64,
) *NodeResult {
	result := &NodeResult{
		NodeID:   node.ID,
		NodeType: AgentTypeSupervisor,
		Success:  false,
	}

	messages := e.buildMessages(node, execCtx, model)

	// Prepend a system instruction that shapes the supervisor behavior.
	supervisorSystem := `You are a supervisor agent. Your job is to coordinate sub-agents.
For each turn, analyze the current state and decide what action to take next.
Respond in JSON format: {"action": "<child_node_id_or_DONE>", "reason": "..."}
If no further action is needed, use "DONE" as the action value.`
	if node.SystemPrompt != "" {
		supervisorSystem = node.SystemPrompt + "\n\n" + supervisorSystem
	}
	messages = append([]llmprovider.Message{
		{Role: "system", Content: supervisorSystem},
	}, messages...)

	req := &llmprovider.ChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.1,
		MaxTokens:   node.MaxTokens,
	}

	if e.registry == nil {
		result.Output = fmt.Sprintf("[dry-run] supervisor node %s", node.ID)
		result.Success = true
		result.Structured = map[string]interface{}{
			"dry_run": true,
			"supervisor_decision": "DONE",
		}
		execCtx.Set("supervisor_decision", "DONE")
		return result
	}

	resp, err := e.registry.Call(ctx, req)
	if err != nil {
		result.Error = fmt.Sprintf("supervisor LLM call failed: %s", err.Error())
		return result
	}

	result.Output = resp.Content
	result.Success = true

	// Parse supervisor decision.
	var decision struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal([]byte(resp.Content), &decision); err != nil {
		decision.Action = "DONE"
		decision.Reason = resp.Content
	}
	result.Structured = map[string]interface{}{
		"supervisor_decision": decision.Action,
		"reason":              decision.Reason,
	}
	execCtx.Set("supervisor_decision", decision.Action)

	return result
}

// executeCritic handles the CRITIC agent type: evaluates the artifact in the
// context and returns a score.
func (e *agentExecutor) executeCritic(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
	defaultTemperature float64,
) *NodeResult {
	result := &NodeResult{
		NodeID:   node.ID,
		NodeType: AgentTypeCritic,
		Success:  false,
	}

	// Determine what to critique: use the most recent node result or explicit artifact.
	artifact := execCtx.GetString("artifact")
	if artifact == "" {
		// Use the last completed node's output.
		for _, nr := range execCtx.NodeResults {
			if nr.Success && nr.Output != "" {
				artifact = nr.Output
			}
		}
		if artifact == "" {
			artifact = "[no artifact available]"
		}
	}

	criteria := node.CriticCriteria
	if criteria == "" {
		criteria = "overall quality, correctness, completeness"
	}

	criticPrompt := fmt.Sprintf(
		`You are a critic/reviewer. Evaluate the following artifact against these criteria:
Criteria: %s

Artifact:
%s

Respond in JSON format:
{"score": <0-100>, "passed": <true/false>, "feedback": "<string>", "suggestions": ["<string>", ...]}`,
		criteria, artifact,
	)

	messages := []llmprovider.Message{
		{Role: "system", Content: "You are a critical reviewer. Be honest and specific."},
		{Role: "user", Content: criticPrompt},
	}

	req := &llmprovider.ChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.1,
		MaxTokens:   node.MaxTokens,
	}

	if e.registry == nil {
		result.Output = fmt.Sprintf("[dry-run] critic node %s evaluating artifact", node.ID)
		result.Success = true
		result.CriticScore = 80
		result.CriticPassed = true
		result.Structured = map[string]interface{}{
			"dry_run":       true,
			"critic_score":  80,
			"critic_passed": true,
		}
		return result
	}

	resp, err := e.registry.Call(ctx, req)
	if err != nil {
		result.Error = fmt.Sprintf("critic LLM call failed: %s", err.Error())
		return result
	}

	result.Output = resp.Content
	result.Success = true

	var eval struct {
		Score      int      `json:"score"`
		Passed     bool     `json:"passed"`
		Feedback   string   `json:"feedback"`
		Suggestions []string `json:"suggestions"`
	}
	if err := json.Unmarshal([]byte(resp.Content), &eval); err != nil {
		eval.Score = 70
		eval.Passed = node.MinScore <= 70
	}

	result.CriticScore = eval.Score
	result.CriticPassed = eval.Passed
	result.Structured = map[string]interface{}{
		"critic_score":    eval.Score,
		"critic_passed":   eval.Passed,
		"feedback":        eval.Feedback,
		"suggestions":     eval.Suggestions,
	}

	// If MinScore is set, override the LLM's passed verdict.
	if node.MinScore > 0 {
		result.CriticPassed = eval.Score >= node.MinScore
		result.Structured["min_score"] = node.MinScore
	}

	// Store critique in context for downstream nodes.
	execCtx.Set("critic_score", eval.Score)
	execCtx.Set("critic_passed", result.CriticPassed)
	execCtx.Set("critic_feedback", eval.Feedback)

	return result
}

// executeGroupingNode handles PARALLEL and SEQUENTIAL grouping nodes. The
// actual orchestration logic is delegated back to the orchestrator via
// context signals, since grouping nodes span multiple children.
func (e *agentExecutor) executeGroupingNode(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
) *NodeResult {
	result := &NodeResult{
		NodeID:   node.ID,
		NodeType: node.Type,
		Success:  true,
	}
	result.Output = fmt.Sprintf("[%s] grouping node %s with children: %v", node.Type, node.ID, node.Children)
	result.Structured = map[string]interface{}{
		"grouping_type": string(node.Type),
		"children":      node.Children,
	}

	if node.Type == AgentTypeParallel {
		result.Output += " (parallel execution delegated to orchestrator)"
	} else {
		result.Output += " (sequential execution delegated to orchestrator)"
	}

	// Signal to the orchestrator that this is a grouping node.
	execCtx.Set("grouping_node", node.ID)
	execCtx.Set("grouping_children", node.Children)

	return result
}

// executeHumanReview returns a pass-through result. The engine treats
// human review as a leaf node; the surrounding application layer would
// provide the async approval workflow.
func (e *agentExecutor) executeHumanReview(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
) *NodeResult {
	result := &NodeResult{
		NodeID:   node.ID,
		NodeType: AgentTypeHumanReview,
		Success:  true,
	}
	result.Output = "[HUMAN_REVIEW] Node requires human approval — execution deferred to async workflow"
	result.Structured = map[string]interface{}{
		"review_required": true,
		"node_id":         node.ID,
		"review_criteria": node.Prompt,
	}
	return result
}

// buildMessages constructs LLM messages from the node configuration and
// the execution context.
func (e *agentExecutor) buildMessages(
	node *AgentNode,
	execCtx *ExecutionContext,
	model string,
) []llmprovider.Message {
	var messages []llmprovider.Message

	// System prompt.
	sys := node.SystemPrompt
	if sys == "" {
		sys = fmt.Sprintf("You are an AI assistant working in the Orion orchestration engine. Model: %s.", model)
	}
	messages = append(messages, llmprovider.Message{Role: "system", Content: sys})

	// User prompt with context variable substitution.
	prompt := node.Prompt
	if prompt == "" {
		prompt = "Process the input."
	}

	// Merge inputs from node config and execution context.
	inputParts := []string{
		"## Static Inputs\n```json\n" + safeJSONString(node.Inputs) + "\n```",
		"## Runtime Context\n```json\n" + safeJSONString(execCtx.Values) + "\n```",
	}
	prompt = fmt.Sprintf("%s\n\n%s", prompt, "\n\n---\n\n" + joinStr(inputParts))

	messages = append(messages, llmprovider.Message{Role: "user", Content: prompt})

	return messages
}

// attemptToolCalls inspects the LLM response for tool call patterns and
// invokes registered tools.
func (e *agentExecutor) attemptToolCalls(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	content string,
	model string,
) []ToolCall {
	// If no tools are registered for this node, skip.
	if len(node.Tools) == 0 || len(e.tools) == 0 {
		return nil
	}

	var toolCalls []ToolCall
	// Check for JSON tool call pattern: {"tool": "...", "args": {...}}
	var tc struct {
		Tool  string                 `json:"tool"`
		Args  map[string]interface{} `json:"args"`
	}
	if err := json.Unmarshal([]byte(content), &tc); err == nil && tc.Tool != "" {
		if fn, ok := e.tools[tc.Tool]; ok {
			result, err := fn(ctx, tc.Args)
			tcl := ToolCall{
				Name:      tc.Tool,
				Arguments: tc.Args,
				Result:    result,
			}
			if err != nil {
				tcl.Result = fmt.Sprintf("tool error: %s", err.Error())
			}
			toolCalls = append(toolCalls, tcl)
			// After a successful tool call, continue the LLM conversation.
			if err == nil {
				// Re-prompt the LLM with tool result to get final response.
				followUp, followErr := e.callWithToolResult(ctx, node, execCtx, content, tcl, model)
				if followErr == nil && followUp != nil {
					// Merge tool call metadata; content stays as the final response.
				}
			}
		}
	}
	return toolCalls
}

// callWithToolResult re-prompts the LLM after a tool invocation.
func (e *agentExecutor) callWithToolResult(
	ctx context.Context,
	node *AgentNode,
	execCtx *ExecutionContext,
	toolCallOutput string,
	tc ToolCall,
	model string,
) (*string, error) {
	messages := e.buildMessages(node, execCtx, model)
	// Append the tool result as an assistant message followed by a follow-up.
	messages = append(messages,
		llmprovider.Message{Role: "assistant", Content: toolCallOutput},
		llmprovider.Message{Role: "user", Content: fmt.Sprintf("Tool %q returned: %s. Now produce your final response based on this tool output.", tc.Name, tc.Result)},
	)

	req := &llmprovider.ChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: node.Temperature,
		MaxTokens:   node.MaxTokens,
	}

	resp, err := e.registry.Call(ctx, req)
	if err != nil {
		return nil, err
	}
	s := resp.Content
	return &s, nil
}

// publishOutputs writes the node's structured output into the execution context
// under the keys declared in node.Outputs.
func (e *agentExecutor) publishOutputs(node *AgentNode, execCtx *ExecutionContext, result *NodeResult) {
	if len(node.Outputs) == 0 {
		// Default: publish under "node:<ID>:output".
		execCtx.Set(fmt.Sprintf("node:%s:output", node.ID), result.Output)
		return
	}
	for _, key := range node.Outputs {
		if val, ok := result.Structured[key]; ok {
			execCtx.Set(key, val)
		}
	}
	// Also always store the raw output.
	execCtx.Set(fmt.Sprintf("node:%s:output", node.ID), result.Output)
	// Store structured data.
	execCtx.Set(fmt.Sprintf("node:%s:structured", node.ID), result.Structured)
}

// isRetriable checks whether an error is transient and should trigger a retry.
func isRetriable(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return true
	case errors.Is(err, context.Canceled):
		return false
	case errors.Is(err, llmprovider.ErrRateLimited):
		return true
	case errors.Is(err, llmprovider.ErrTokenPoolExhausted):
		return true
	}
	if msg == "" {
		return false
	}
	// Keyword-based heuristic for transient network/provider errors.
	for _, kw := range []string{"rate", "rate_limit", "429", "timeout", "retry", "too many requests"} {
		if containsLower(msg, kw) {
			return true
		}
	}
	return false
}

func containsLower(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}

// safeJSONString returns a JSON-formatted string for any value, or "{}" on failure.
func safeJSONString(v interface{}) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// joinStr joins a slice of strings with the given separator.
func joinStr(ss []string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += "\n\n"
		}
		result += s
	}
	return result
}
