package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
)

// PluginTypePipeline is the pipeline executor plugin type.
const PluginTypePipeline = "pipeline-trigger"

// ---------------------------------------------------------------------------
// PipelineRunner — interface that decouples the auto-exec plugin from the
// concrete PipelineExecutor service.  This allows the plugin to be tested in
// isolation and the real implementation to be wired at startup.
// ---------------------------------------------------------------------------

// PipelineRunResult is returned by PipelineRunner.RunPipeline.
type PipelineRunResult struct {
	ExecutionID string `json:"execution_id"`
	PipelineID  string `json:"pipeline_id"`
	Status      string `json:"status"`
	StepsRun    int    `json:"steps_run"`
	StepsFailed int    `json:"steps_failed"`
	Error       string `json:"error,omitempty"`
	DurationMs  int64  `json:"duration_ms"`
}

// PipelineRunner abstracts the act of triggering a pipeline execution.
// The default implementation delegates to the pipeline-executor service;
// tests inject a mock implementation.
type PipelineRunner interface {
	RunPipeline(ctx context.Context, tenantID, pipelineID string, inputs map[string]interface{}) (*PipelineRunResult, error)
}

// ---------------------------------------------------------------------------
// PipelineExecutorPlugin
// ---------------------------------------------------------------------------

// PipelineExecutorPlugin triggers a pipeline run via a PipelineRunner.
//
// Parameters (passed via params map[string]interface{}):
//   - "pipeline_id" (string, required) — the pipeline ID to execute
//   - "tenant_id" (string, optional) — overrides the tenant from context
//   - "inputs" (map[string]interface{}, optional) — runtime inputs forwarded to the pipeline
//   - "timeout_seconds" (int, optional) — per-execution timeout override
type PipelineExecutorPlugin struct {
	runner PipelineRunner
}

// NewPipelinePlugin creates a PipelineExecutorPlugin that delegates to the
// given PipelineRunner.
func NewPipelinePlugin(runner PipelineRunner) *PipelineExecutorPlugin {
	return &PipelineExecutorPlugin{runner: runner}
}

func (p *PipelineExecutorPlugin) Name() string           { return PluginTypePipeline }
func (p *PipelineExecutorPlugin) Description() string    { return "Trigger a pipeline execution" }
func (p *PipelineExecutorPlugin) DefaultTimeout() time.Duration { return 5 * time.Minute }

// Validate ensures the params contain a non-empty pipeline_id.
func (p *PipelineExecutorPlugin) Validate(params map[string]interface{}) error {
	if p.runner == nil {
		return fmt.Errorf("%w: pipeline runner not configured", interfaces.ErrInvalidParams)
	}
	pipelineID, ok := params["pipeline_id"].(string)
	if !ok || pipelineID == "" {
		return fmt.Errorf("%w: pipeline_id is required", interfaces.ErrInvalidParams)
	}
	return nil
}

// Execute triggers the pipeline via the runner and wraps the result.
func (p *PipelineExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	if p.runner == nil {
		return nil, fmt.Errorf("pipeline runner not configured")
	}

	tenantID, _ := params["tenant_id"].(string)
	if tenantID == "" {
		tenantID = "system"
	}

	pipelineID, _ := params["pipeline_id"].(string)

	// Extract inputs from params; fall back to nested map if present
	inputs, _ := params["inputs"].(map[string]interface{})
	if inputs == nil {
		inputs = make(map[string]interface{})
	}

	start := time.Now()

	result, err := p.runner.RunPipeline(ctx, tenantID, pipelineID, inputs)

	durationMs := time.Since(start).Milliseconds()

	res := &models.Result{
		ExitCode:   0,
		DurationMs: durationMs,
	}

	if err != nil {
		res.ExitCode = 1
		res.ErrorMessage = err.Error()
		return res, err
	}

	// Build structured output from the runner result
	outputData := map[string]interface{}{
		"execution_id": result.ExecutionID,
		"pipeline_id":  result.PipelineID,
		"status":       result.Status,
		"steps_run":    result.StepsRun,
		"steps_failed": result.StepsFailed,
		"duration_ms":  result.DurationMs,
	}
	if result.Error != "" {
		outputData["error"] = result.Error
	}
	res.OutputData = outputData

	// Serialize result for stdout
	outBytes, jerr := json.Marshal(result)
	if jerr == nil {
		res.Stdout = string(outBytes)
	}

	return res, nil
}

// ---------------------------------------------------------------------------
// TriggerPipeline — helper exported for the engine/service layer.
//
// TriggerPipeline wraps RunPipeline with the global factory lookup, so
// callers that do not hold a PipelineRunner can still trigger a pipeline.
// In normal operation the plugin's injected runner is used; this function
// exists for engine-level convenience (e.g. service-layer TriggerPipeline).
// ---------------------------------------------------------------------------

// TriggerPipeline invokes the pipeline executor via the plugin's runner.
// It is a package-level convenience for the engine/service integration.
var triggerPipelineRunner PipelineRunner

// SetTriggerPipelineRunner allows the engine layer to inject a runner at
// startup (called from cmd/server or a dependency-injection wire file).
func SetTriggerPipelineRunner(r PipelineRunner) {
	triggerPipelineRunner = r
}

// ---------------------------------------------------------------------------
// DefaultPipelineRunner — a no-op runner used as the factory default.
// It records that a pipeline was "triggered" without actually executing it,
// returning a stub result.  Production code MUST replace it via
// SetTriggerPipelineRunner or by constructing the plugin with a real runner.
// ---------------------------------------------------------------------------

// DefaultPipelineRunner implements PipelineRunner as a stub.
type DefaultPipelineRunner struct{}

func (r *DefaultPipelineRunner) RunPipeline(ctx context.Context, tenantID, pipelineID string, inputs map[string]interface{}) (*PipelineRunResult, error) {
	return &PipelineRunResult{
		ExecutionID: "stub",
		PipelineID:  pipelineID,
		Status:      "stubbed",
	}, nil
}

// NewDefaultPipelineRunner returns a new DefaultPipelineRunner instance.
func NewDefaultPipelineRunner() PipelineRunner {
	return &DefaultPipelineRunner{}
}

// GetTriggerPipelineRunner returns the currently configured runner, or nil.
func GetTriggerPipelineRunner() PipelineRunner {
	return triggerPipelineRunner
}

// TriggerPipeline calls the configured runner.  Returns an error if no runner
// is configured.
func TriggerPipeline(ctx context.Context, pipelineID string, params map[string]interface{}) (*PipelineRunResult, error) {
	if triggerPipelineRunner == nil {
		return nil, fmt.Errorf("pipeline runner not configured")
	}
	tenantID, _ := params["tenant_id"].(string)
	if tenantID == "" {
		tenantID = "system"
	}
	inputs, _ := params["inputs"].(map[string]interface{})
	if inputs == nil {
		inputs = make(map[string]interface{})
	}
	return triggerPipelineRunner.RunPipeline(ctx, tenantID, pipelineID, inputs)
}
