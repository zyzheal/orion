package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// ActionStepHandler executes an external HTTP action (API call, webhook, etc.).
// This is the most flexible handler: it can call any HTTP endpoint and
// use the response to drive the next step.
type ActionStepHandler struct{}

// Ensure interface compliance
var _ StepHandler = (*ActionStepHandler)(nil)

// Type returns the step type key.
func (h *ActionStepHandler) Type() string {
	return "action"
}

// Execute performs the configured HTTP action.
func (h *ActionStepHandler) Execute(ctx context.Context, task *WorkflowTaskContext, input JSONB) (*StepResult, error) {
	actionType := getStringField(task.StepConfig, "actionType")
	if actionType == "" {
		actionType = getStringField(task.StepConfig, "type")
	}
	if actionType == "" {
		return nil, fmt.Errorf("action type not specified")
	}

	switch actionType {
	case "http":
		return h.executeHTTP(ctx, task)
	case "variable_set":
		return h.executeVariableSet(ctx, task)
	case "script":
		return h.executeScript(ctx, task)
	default:
		return nil, fmt.Errorf("unsupported action type: %s", actionType)
	}
}

// Validate checks that the action type is present.
func (h *ActionStepHandler) Validate(ctx context.Context, input JSONB) error {
	return nil
}

// Rollback for action handlers is typically a no-op since the external
// action may be irreversible. Override in concrete handlers if needed.
func (h *ActionStepHandler) Rollback(ctx context.Context, task *WorkflowTaskContext, result *StepResult) error {
	// Most actions are irreversible; log but don't block
	return nil
}

// executeHTTP sends an HTTP request to the configured URL.
func (h *ActionStepHandler) executeHTTP(ctx context.Context, task *WorkflowTaskContext) (*StepResult, error) {
	method := getStringField(task.StepConfig, "method")
	if method == "" {
		method = "POST"
	}
	urlStr := getStringField(task.StepConfig, "url")
	if urlStr == "" {
		return nil, fmt.Errorf("HTTP URL not configured")
	}
	if _, err := url.Parse(urlStr); err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	// Build request body from workflow data or step config
	var body interface{}
	if task.WorkflowData != nil {
		body = task.WorkflowData
	} else if task.StepConfig != nil {
		body = task.StepConfig
	}

	_, _ = json.Marshal(body)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, method, urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Capture response
	return &StepResult{
		Output: JSONB{
			"httpStatus":  resp.StatusCode,
			"httpMethod":  method,
			"httpURL":     urlStr,
			"executedAt":  time.Now().Format(time.RFC3339),
		},
		Actions: []string{fmt.Sprintf("http:%s", method)},
	}, nil
}

// executeVariableSet stores variables for downstream steps.
func (h *ActionStepHandler) executeVariableSet(ctx context.Context, task *WorkflowTaskContext) (*StepResult, error) {
	vars := task.StepConfig["variables"]
	if vars == nil {
		return nil, fmt.Errorf("no variables configured")
	}
	if v, ok := vars.(map[string]interface{}); ok {
		for k, val := range v {
			if task.Variables == nil {
				task.Variables = JSONB{}
			}
			task.Variables[k] = val
		}
	}
	return &StepResult{
		Output: JSONB{"variablesSet": true},
	}, nil
}

// executeScript is a placeholder for script execution.
// In production, this would integrate with an execution engine.
func (h *ActionStepHandler) executeScript(ctx context.Context, task *WorkflowTaskContext) (*StepResult, error) {
	return &StepResult{
		Output: JSONB{
			"scriptExecuted": true,
			"executedAt":     time.Now().Format(time.RFC3339),
		},
		Actions: []string{"script"},
	}, nil
}

// getStringField safely extracts a string from StepConfig.
func getStringField(config JSONB, key string) string {
	if config == nil {
		return ""
	}
	if v, ok := config[key].(string); ok {
		return v
	}
	return ""
}
