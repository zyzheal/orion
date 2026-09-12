package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"
)

// defaultMaxSubPipelineDepth bounds how deeply a pipeline may trigger child
// pipelines. It exists to stop a pipeline that (transitively) triggers itself
// from running forever; the limit is deep enough that any legitimate
// build-test-deploy chain fits.
const defaultMaxSubPipelineDepth = 5

// subPipelineDepthKey carries the sub-pipeline nesting level in the request
// context. Depth is threaded through the context rather than stored on the
// executor because StageOrchestrator runs sibling stages in parallel goroutines
// on a single shared *StageExecutor, so a struct field would race.
type subPipelineDepthKey struct{}

func subPipelineDepth(ctx context.Context) int {
	if n, ok := ctx.Value(subPipelineDepthKey{}).(int); ok {
		return n
	}
	return 0
}

// StageExecutor executes tasks within a stage.
type StageExecutor struct {
	repo    *repository.Repository
	timeout time.Duration
	// engine, when non-nil, is what "sub-pipeline" tasks call to trigger a real
	// child pipeline run. Wired by NewPipelineEngine. When nil a sub-pipeline
	// task fails loudly instead of reporting success.
	engine EngineInterface
	// maxSubPipelineDepth overrides defaultMaxSubPipelineDepth when > 0.
	maxSubPipelineDepth int
}

// NewStageExecutor creates a new StageExecutor.
func NewStageExecutor(repo *repository.Repository) *StageExecutor {
	return &StageExecutor{
		repo:    repo,
		timeout: 3600 * time.Second, // default 1h
	}
}

// WithEngine attaches the engine that executes "sub-pipeline" tasks. Chainable.
func (s *StageExecutor) WithEngine(e EngineInterface) *StageExecutor {
	s.engine = e
	return s
}

// WithMaxSubPipelineDepth overrides the sub-pipeline nesting limit. Values <= 0
// keep the default.
func (s *StageExecutor) WithMaxSubPipelineDepth(n int) *StageExecutor {
	if n > 0 {
		s.maxSubPipelineDepth = n
	}
	return s
}

func (s *StageExecutor) subPipelineDepthLimit() int {
	if s.maxSubPipelineDepth > 0 {
		return s.maxSubPipelineDepth
	}
	return defaultMaxSubPipelineDepth
}

// SetTimeout sets the task execution timeout.
func (s *StageExecutor) SetTimeout(d time.Duration) {
	if d > 0 {
		s.timeout = d
	}
}

// ExecuteResult is the result of a task execution.
type ExecuteResult struct {
	Success bool
	Error   string
	Outputs map[string]string
}

// ExecuteTask executes a single task within a stage.
// It runs the task, records timing, and updates status.
//
// Supported task types:
//   - "shell": execute a shell command via LocalSpawnExecutor
//   - "docker": run a command inside a Docker container
//   - "sub-pipeline": trigger a child pipeline run through the wired engine
//     (needs pipeline_id / pipeline_version params; fails loudly when no engine
//     is wired or the nesting limit is exceeded)
//   - any other: treated as shell with default echo
//
// Variables are injected into both environment variables and command strings.
// Task parameters provide task-specific configuration (command, args, image, etc.).
func (s *StageExecutor) ExecuteTask(
	ctx context.Context,
	tenantID, stageID string,
	task *models.Task,
	variables map[string]string,
) (string, *ExecuteResult) {
	// Update task to RUNNING
	runningTask := *task
	runningTask.Status = models.TaskStatusRunning
	runningTask.StartedAt = nowUnix()
	runningTask.UpdatedAt = *runningTask.StartedAt
	if err := s.repo.UpdateTaskStatus(ctx, tenantID, runningTask.ID, models.TaskStatusRunning, runningTask.StartedAt, nil, nil, nil); err != nil {
		return task.Name, &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("failed to mark task as running: %v", err),
		}
	}

	// Resolve task parameters and inject variables
	resolvedParams, err := s.resolveTaskParameters(task.Parameters, variables)
	if err != nil {
		return task.Name, s.markTaskFailed(ctx, tenantID, &runningTask, fmt.Sprintf("failed to resolve parameters: %v", err))
	}

	// Determine timeout (from task config or executor default)
	timeout := s.timeout
	if task.TimeoutSeconds > 0 {
		timeout = time.Duration(task.TimeoutSeconds) * time.Second
	}

	// Check for context cancellation before execution
	select {
	case <-ctx.Done():
		cancelMsg := fmt.Sprintf("context cancelled: %v", ctx.Err())
		return task.Name, s.markTaskFailed(ctx, tenantID, &runningTask, cancelMsg)
	default:
	}

	// Execute based on task type
	taskType := strings.ToLower(task.Type)
	var result *ExecuteResult
	switch taskType {
	case "shell":
		result = s.executeShellTask(ctx, resolvedParams, variables, timeout)
	case "docker":
		result = s.executeDockerTask(ctx, resolvedParams, variables, timeout)
	case "sub-pipeline":
		result = s.executeSubPipelineTask(ctx, tenantID, stageID, resolvedParams, variables, timeout)
	default:
		// Treat unknown types as shell with a default echo command
		result = s.executeShellTask(ctx, map[string]interface{}{
			"command": fmt.Sprintf("echo 'Task %s completed'", task.Name),
		}, variables, timeout)
	}

	// Record result and update task status
	completedAt := nowUnix()
	duration := time.Since(time.Unix(*runningTask.StartedAt, 0)).Milliseconds()
	_ = duration

	outputs := make(map[string]string)
	if result.Outputs != nil {
		for k, v := range result.Outputs {
			outputs[k] = v
		}
	}

	if result.Success {
		// Mark task as SUCCESS
		completedTask := runningTask
		completedTask.Status = models.TaskStatusSuccess
		completedTask.CompletedAt = completedAt
		completedTask.DurationMs = &duration
		completedTask.UpdatedAt = *completedTask.CompletedAt
		_ = s.repo.UpdateTaskStatus(ctx, tenantID, completedTask.ID, models.TaskStatusSuccess, completedTask.CompletedAt, completedTask.DurationMs, nil, nil)

		result.Outputs = outputs
		return task.Name, result
	}

	// Mark task as FAILED
	return task.Name, s.markTaskFailed(ctx, tenantID, &runningTask, result.Error)
}

// executeShellTask executes a shell command using the LocalSpawnExecutor.
func (s *StageExecutor) executeShellTask(ctx context.Context, params map[string]interface{}, variables map[string]string, timeout time.Duration) *ExecuteResult {
	executor := &LocalSpawnExecutor{}

	command := getStringParam(params, "command")
	if command == "" {
		command = "echo 'no command specified'"
	}

	args := getStringSliceParam(params, "args")
	if len(args) == 0 {
		args = []string{"-c", command}
	} else {
		args = []string{args[0]}
	}

	// Build environment from variables + explicit env params
	env := make(map[string]string)
	for k, v := range variables {
		env["PIPELINE_"+strings.ToUpper(k)] = v
	}
	explicitEnv := getStringMapParam(params, "env")
	for k, v := range explicitEnv {
		env[k] = v
	}

	spec := ContainerSpec{
		Env:       env,
		Workdir:   getStringPtrParam(params, "workdir"),
		Resources: s.parseResourceLimit(params),
	}

	containerResult, err := executor.Execute(ctx, spec, "sh", args, timeout)
	if err != nil {
		return &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("shell execution failed: %v", err),
			Outputs: map[string]string{"stdout": "", "stderr": err.Error()},
		}
	}

	result := &ExecuteResult{
		Success: containerResult.ExitCode == 0,
		Outputs: map[string]string{
			"stdout":      containerResult.Stdout,
			"stderr":      containerResult.Stderr,
			"exit_code":   fmt.Sprintf("%d", containerResult.ExitCode),
			"duration_ms": fmt.Sprintf("%d", containerResult.DurationMs),
		},
	}
	if !result.Success {
		_ = containerResult
		result.Error = fmt.Sprintf("shell command failed with exit code %d: %s", containerResult.ExitCode, containerResult.Stderr)
	}

	return result
}

// executeDockerTask executes a command inside a Docker container.
func (s *StageExecutor) executeDockerTask(ctx context.Context, params map[string]interface{}, variables map[string]string, timeout time.Duration) *ExecuteResult {
	executor := NewDockerExecutor()

	if !executor.IsAvailable(ctx) {
		return &ExecuteResult{
			Success: false,
			Error:   "Docker is not available, cannot execute docker task",
			Outputs: map[string]string{},
		}
	}

	image := getStringParam(params, "image")
	if image == "" {
		return &ExecuteResult{
			Success: false,
			Error:   "docker task requires 'image' parameter",
			Outputs: map[string]string{},
		}
	}

	command := getStringParam(params, "command")
	args := getStringSliceParam(params, "args")

	env := make(map[string]string)
	for k, v := range variables {
		env["PIPELINE_"+strings.ToUpper(k)] = v
	}
	explicitEnv := getStringMapParam(params, "env")
	for k, v := range explicitEnv {
		env[k] = v
	}

	spec := ContainerSpec{
		Image:     image,
		Workdir:   getStringPtrParam(params, "workdir"),
		Env:       env,
		Resources: s.parseResourceLimit(params),
		Command:   args,
	}

	containerResult, err := executor.Execute(ctx, spec, command, args, timeout)
	if err != nil {
		return &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("docker execution failed: %v", err),
			Outputs: map[string]string{"stdout": "", "stderr": err.Error()},
		}
	}

	result := &ExecuteResult{
		Success: containerResult.ExitCode == 0,
		Outputs: map[string]string{
			"stdout":      containerResult.Stdout,
			"stderr":      containerResult.Stderr,
			"exit_code":   fmt.Sprintf("%d", containerResult.ExitCode),
			"duration_ms": fmt.Sprintf("%d", containerResult.DurationMs),
		},
	}
	if !result.Success {
		result.Error = fmt.Sprintf("docker command failed with exit code %d: %s", containerResult.ExitCode, containerResult.Stderr)
	}

	return result
}

// executeSubPipelineTask triggers a child pipeline run for a "sub-pipeline"
// task and reports the child run's outcome.
//
// It used to return Success: true with "status: skipped", which marked the task
// — and therefore the whole parent run — as green while no child pipeline ever
// executed. A silent pass on a CI gate is worse than a loud failure, so a
// missing engine or a missing child spec now fails the task.
func (s *StageExecutor) executeSubPipelineTask(ctx context.Context, tenantID, stageID string, params map[string]interface{}, variables map[string]string, timeout time.Duration) *ExecuteResult {
	_ = stageID

	pipelineID := getStringParam(params, "pipeline_id")
	pipelineVersion := getStringParam(params, "pipeline_version")

	if pipelineID == "" {
		return &ExecuteResult{
			Success: false,
			Error:   "sub-pipeline task requires 'pipeline_id' parameter",
			Outputs: map[string]string{},
		}
	}
	if s.engine == nil {
		return &ExecuteResult{
			Success: false,
			Error: fmt.Sprintf("sub-pipeline %s@%s not executed: this StageExecutor has no pipeline engine wired", pipelineID, pipelineVersion),
			Outputs: map[string]string{
				"sub_pipeline": pipelineID,
				"version":      pipelineVersion,
				"status":       "failed",
			},
		}
	}

	// Guard against a pipeline triggering itself, directly or through a cycle.
	depth := subPipelineDepth(ctx)
	if depth+1 > s.subPipelineDepthLimit() {
		return &ExecuteResult{
			Success: false,
			Error: fmt.Sprintf("sub-pipeline nesting limit exceeded: %s@%s would be depth %d, max %d",
				pipelineID, pipelineVersion, depth+1, s.subPipelineDepthLimit()),
			Outputs: map[string]string{
				"sub_pipeline": pipelineID,
				"version":      pipelineVersion,
				"status":       "failed",
			},
		}
	}

	req := models.TriggerRequest{
		PipelineID:      pipelineID,
		PipelineVersion: pipelineVersion,
		TriggerType:     string(models.TriggerSubPipeline),
		TriggerBy:       subPipelineTriggerBy(params, pipelineID),
		Environment:     getStringParam(params, "environment"),
	}
	if variables != nil {
		req.Context = make(map[string]interface{}, len(variables))
		for k, v := range variables {
			req.Context[k] = v
		}
	}

	childCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		childCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	childCtx = context.WithValue(childCtx, subPipelineDepthKey{}, depth+1)

	run, err := s.engine.Execute(childCtx, tenantID, req)
	if err != nil {
		return &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("sub-pipeline %s@%s failed to start: %v", pipelineID, pipelineVersion, err),
			Outputs: map[string]string{
				"sub_pipeline": pipelineID,
				"version":      pipelineVersion,
				"status":       "failed",
			},
		}
	}
	if run == nil {
		return &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("sub-pipeline %s@%s returned no run", pipelineID, pipelineVersion),
			Outputs: map[string]string{
				"sub_pipeline": pipelineID,
				"version":      pipelineVersion,
				"status":       "failed",
			},
		}
	}

	outputs := map[string]string{
		"sub_pipeline":     pipelineID,
		"version":          pipelineVersion,
		"sub_pipeline_run": run.ID,
		"status":           string(run.Status),
	}
	if run.DurationMs != nil {
		outputs["duration_ms"] = fmt.Sprintf("%d", *run.DurationMs)
	}

	if run.Status != models.RunStatusSuccess {
		// An empty Error would mark the parent task FAILED with no explanation,
		// leaving an operator to open every child run to find out what broke.
		return &ExecuteResult{
			Success: false,
			Error: fmt.Sprintf("sub-pipeline %s@%s ended with status %s (run %s)",
				pipelineID, pipelineVersion, run.Status, run.ID),
			Outputs: outputs,
		}
	}

	return &ExecuteResult{
		// The child run already reached its final state: Execute only returns
		// after every stage of the child has been executed and the run status
		// has been finalised, so the child's own status decides the outcome.
		Success: true,
		Error:   "",
		Outputs: outputs,
	}
}

// subPipelineTriggerBy names the child run's initiator. A pipeline triggering a
// child is an anonymous actor, so attribute it to the child's own identity
// unless the task supplies an explicit trigger_by.
func subPipelineTriggerBy(params map[string]interface{}, pipelineID string) string {
	if tb := getStringParam(params, "trigger_by"); tb != "" {
		return tb
	}
	return "sub-pipeline:" + pipelineID
}

// markTaskFailed updates a task's status to FAILED and returns the result.
func (s *StageExecutor) markTaskFailed(ctx context.Context, tenantID string, task *models.Task, errMsg string) *ExecuteResult {
	completedAt := nowUnix()
	duration := time.Since(time.Unix(*task.StartedAt, 0)).Milliseconds()
	task.Status = models.TaskStatusFailed
	task.CompletedAt = completedAt
	task.DurationMs = &duration
	task.UpdatedAt = *task.CompletedAt
	_ = s.repo.UpdateTaskStatus(ctx, tenantID, task.ID, models.TaskStatusFailed, task.CompletedAt, task.DurationMs, &errMsg, nil)
	return &ExecuteResult{
		Success: false,
		Error:   errMsg,
		Outputs: make(map[string]string),
	}
}

// resolveTaskParameters expands variable references in task parameters.
// Supports ${VAR} and {{VAR}} syntax.
func (s *StageExecutor) resolveTaskParameters(paramJSON string, variables map[string]string) (map[string]interface{}, error) {
	if paramJSON == "" || paramJSON == "{}" {
		return map[string]interface{}{}, nil
	}

	// Expand variable references in the JSON string
	expanded := paramJSON
	for k, v := range variables {
		expanded = strings.ReplaceAll(expanded, "${"+k+"}", v)
		expanded = strings.ReplaceAll(expanded, "{{"+k+"}}", v)
	}

	var params map[string]interface{}
	if err := json.Unmarshal([]byte(expanded), &params); err != nil {
		return nil, err
	}
	return params, nil
}

// parseResourceLimit extracts resource limits from task parameters.
func (s *StageExecutor) parseResourceLimit(params map[string]interface{}) *ResourceLimit {
	if _, ok := params["resources"]; !ok {
		return nil
	}
	resources, ok := params["resources"].(map[string]interface{})
	if !ok {
		return nil
	}

	rl := &ResourceLimit{}
	cpu, ok := resources["cpu"].(string)
	if ok {
		rl.CPU = cpu
	}
	memory, ok := resources["memory"].(string)
	if ok {
		rl.Memory = memory
	}
	return rl
}

// Note on upstream artifacts: this executor deliberately does not expose a
// "pass upstream artifacts" hook. It would have been a no-op that returned nil,
// which reads as "the handoff happened" when nothing was ever transferred, so
// the hook was removed rather than shipped as a placeholder. Upstream task
// outputs are not yet propagated to dependent stages: a stage's variables come
// from the pipeline spec's `variables` block plus that stage's own task
// outputs, flattened as tasks.<task>.<key>. Closing the gap needs task outputs
// persisted to pipeline_tasks.result and loaded per dependency, which is
// separate work from execution itself.

// --- helpers ---

func nowUnix() *int64 {
	t := time.Now().Unix()
	return &t
}

func nowUnixPtr() *int64 {
	return nowUnix()
}

func durationMs(started *int64) *int64 {
	if started == nil {
		return nil
	}
	d := time.Since(time.Unix(*started, 0)).Milliseconds()
	return &d
}

// getStringParam returns a string value from a parameter map.
func getStringParam(params map[string]interface{}, key string) string {
	if v, ok := params[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		if f, ok := v.(float64); ok {
			return fmt.Sprintf("%g", f)
		}
		if b, ok := v.(bool); ok {
			return fmt.Sprintf("%v", b)
		}
	}
	return ""
}

// getStringSliceParam returns a string slice from a parameter map.
func getStringSliceParam(params map[string]interface{}, key string) []string {
	if v, ok := params[key]; ok {
		switch slice := v.(type) {
		case []string:
			return slice
		case []interface{}:
			result := make([]string, 0, len(slice))
			for _, item := range slice {
				if s, ok := item.(string); ok {
					result = append(result, s)
				} else {
					result = append(result, fmt.Sprintf("%v", item))
				}
			}
			return result
		case string:
			// Single string treated as a slice with one element
			return []string{slice}
		}
	}
	return nil
}

// getStringMapParam returns a string map from a parameter map.
func getStringMapParam(params map[string]interface{}, key string) map[string]string {
	if v, ok := params[key]; ok {
		if m, ok := v.(map[string]string); ok {
			return m
		}
		if m, ok := v.(map[string]interface{}); ok {
			result := make(map[string]string, len(m))
			for k, val := range m {
				result[k] = fmt.Sprintf("%v", val)
			}
			return result
		}
	}
	return nil
}

// getStringPtrParam returns a *string from a parameter map.
func getStringPtrParam(params map[string]interface{}, key string) *string {
	if v, ok := params[key]; ok {
		if s, ok := v.(string); ok {
			return &s
		}
	}
	return nil
}

// serializeParams serializes a map to JSONB-compatible string.
func serializeParams(params map[string]interface{}) (string, error) {
	if params == nil {
		return "{}", nil
	}
	b, err := json.Marshal(params)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
