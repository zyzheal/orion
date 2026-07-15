package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"
)

// Execution represents a single orchestration run context.
type Execution struct {
	ID        string            // run ID
	TenantID  string
	StageMap     map[string]string // stage name -> stage ID
	Dependencies map[string][]string // stage name -> [dependency stage names]
	Variables map[string]string // key-value variable context
	Completed []string          // completed stage names
	Failed    []string          // failed stage names
	mu        sync.Mutex
}

// StageCallbacks defines optional callbacks for orchestration events.
type StageCallbacks struct {
	OnStageStart func(stage *models.Stage)
	OnStageEnd   func(stage *models.Stage, err error)
	OnStageSkip  func(stage *models.Stage)
}

// StageOrchestrator manages parallel/serial stage execution with dependency resolution.
type StageOrchestrator struct {
	repo       *repository.Repository
	executor   *StageExecutor
	checkpoint *CheckpointManager
}

// NewStageOrchestrator creates a new StageOrchestrator.
func NewStageOrchestrator(repo *repository.Repository) *StageOrchestrator {
	return &StageOrchestrator{
		repo:       repo,
		checkpoint: NewCheckpointManager(repo),
	}
}

// SetExecutor sets the StageExecutor dependency.
func (o *StageOrchestrator) SetExecutor(exec *StageExecutor) {
	o.executor = exec
}

// Execute runs all stages in an execution context.
// Returns true if any stage failed.
func (o *StageOrchestrator) Execute(ctx context.Context, run *models.PipelineRun, stageMap map[string]string, variables map[string]string) bool {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[pipeline-engine] StageOrchestrator.Execute recovered from panic: %v\n", r)
		}
	}()
	execution := &Execution{
		ID:        run.ID,
		TenantID:  run.TenantID,
		StageMap:  stageMap,
		Variables: variables,
		Completed: []string{},
		Failed:    []string{},
	}

	callbacks := &StageCallbacks{}

	// Recover from checkpoint if available
	if o.recoverFromCheckpoint(ctx, execution) {
		// Continue with existing state
	}

	return o.ExecutePendingStages(ctx, execution, callbacks)
}

// ExecutePendingStages dispatches all pending stages respecting dependencies.
func (o *StageOrchestrator) ExecutePendingStages(ctx context.Context, execution *Execution, cb *StageCallbacks) bool {
	for {
		ready, failed, _ := o.CheckNextStages(ctx, execution)
		if len(ready) == 0 && len(failed) > 0 {
			o.FailDependentStages(ctx, execution)
			break
		}
		if len(ready) == 0 {
			break
		}

		// Execute ready stages in parallel
		var wg sync.WaitGroup
		for _, stageName := range ready {
			wg.Add(1)
			stageID := execution.StageMap[stageName]
			go func(name string, sid string) {
				defer wg.Done()
				o.ExecuteStage(ctx, execution, name, sid, cb)
			}(stageName, stageID)
		}
		wg.Wait()
	}

	// Check if any stage failed
	execution.mu.Lock()
	defer execution.mu.Unlock()
	return len(execution.Failed) > 0
}

// CheckNextStages identifies ready stages (all deps met), failed stages, and done.
func (o *StageOrchestrator) CheckNextStages(ctx context.Context, execution *Execution) (ready []string, failed []string, done bool) {
	stageStatus, err := o.repo.GetStageStatusByRun(ctx, execution.TenantID, execution.ID)
	if err != nil {
		return nil, nil, false
	}

	var pendingStages []string

	for name := range execution.StageMap {
		status, ok := stageStatus[name]
		if !ok {
			continue
		}
		if status == string(models.TaskStatusPending) {
			pendingStages = append(pendingStages, name)
		}
	}

	var readyStages []string
	for _, name := range pendingStages {
		if o.allDependenciesMet(name, execution.Completed, execution.Dependencies) {
			readyStages = append(readyStages, name)
		}
	}

	// Get failed stages
	var failedStages []string
	for name := range execution.StageMap {
		status := stageStatus[name]
		if status == string(models.TaskStatusFailed) {
			already := false
			for _, f := range execution.Failed {
				if f == name {
					already = true
					break
				}
			}
			if !already {
				failedStages = append(failedStages, name)
			}
		}
	}

	done = len(readyStages) == 0 && len(failedStages) == 0 && len(pendingStages) == 0

	return readyStages, failedStages, done
}

// ExecuteStage executes a single stage via the executor.
func (o *StageOrchestrator) ExecuteStage(ctx context.Context, execution *Execution, stageName string, stageID string, cb *StageCallbacks) {
	stage, err := o.repo.GetStage(ctx, execution.TenantID, stageID)
	if err != nil {
		o.recordFailed(execution, stageName, fmt.Errorf("stage not found: %w", err))
		return
	}

	// Evaluate condition if present
	if stage.Condition != nil {
		ok := o.EvaluateCondition(*stage.Condition, execution.Variables)
		if !ok {
			if cb != nil && cb.OnStageSkip != nil {
				cb.OnStageSkip(stage)
			}
			o.recordSkipped(ctx, execution, stage)
			return
		}
	}

	// Notify callbacks
	if cb != nil && cb.OnStageStart != nil {
		cb.OnStageStart(stage)
	}

	// Execute tasks in this stage
	tasks, err := o.repo.GetTasksByStage(ctx, execution.TenantID, stageID)
	if err != nil {
		o.recordFailed(execution, stageName, fmt.Errorf("get tasks: %w", err))
		return
	}

	// Execute each task
	taskFailed := false
	taskOutputs := make(map[string]map[string]string)
	for _, task := range tasks {
		if taskFailed {
			_ = o.repo.UpdateTaskStatus(ctx, execution.TenantID, task.ID, models.TaskStatusSkipped, nil, nil, nil, nil)
			continue
		}
		taskName, taskResult := o.executor.ExecuteTask(ctx, execution.TenantID, stageID, &task, execution.Variables)
		taskOutputs[taskName] = taskResult.Outputs

		// Save checkpoint after each task
		o.checkpoint.Save(ctx, execution.ID, stageName, taskName, execution.Variables)

		if !taskResult.Success {
			taskFailed = true
		}

		// Pass upstream artifacts on success
		if !taskFailed && stage.DependsOn != "" {
			o.executor.PassUpstreamArtifacts(ctx, execution.TenantID, execution.ID, []string{}, stageID)
		}
	}

	// Update stage status
	completedTime := nowInt64()
	if taskFailed {
		errMsg := "stage failed"
		_ = o.repo.UpdateStageStatus(ctx, execution.TenantID, stageID, string(models.TaskStatusFailed), &completedTime, nil, &errMsg)
		o.recordFailed(execution, stageName, fmt.Errorf("stage failed"))
		if cb != nil && cb.OnStageEnd != nil {
			cb.OnStageEnd(stage, fmt.Errorf("stage failed"))
		}
	} else {
		_ = o.repo.UpdateStageStatus(ctx, execution.TenantID, stageID, string(models.TaskStatusSuccess), &completedTime, nil, nil)
		o.recordCompleted(execution, stageName)

		// Flatten task outputs into execution variables
		for taskName, outputs := range taskOutputs {
			for k, v := range outputs {
				execution.Variables[fmt.Sprintf("tasks.%s.%s", taskName, k)] = v
			}
		}
		if cb != nil && cb.OnStageEnd != nil {
			cb.OnStageEnd(stage, nil)
		}
	}
}

// allDependenciesMet checks if all dependencies of a stage are completed.
func (o *StageOrchestrator) allDependenciesMet(stageName string, completed []string, deps map[string][]string) bool {
	stageDeps, ok := deps[stageName]
	if !ok || len(stageDeps) == 0 {
		return true // no dependencies means always ready
	}
	for _, dep := range stageDeps {
		found := false
		for _, c := range completed {
			if c == dep {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// FailDependentStages marks all stages that depend on failed stages as failed.
func (o *StageOrchestrator) FailDependentStages(ctx context.Context, execution *Execution) {
	stageStatus, _ := o.repo.GetStageStatusByRun(ctx, execution.TenantID, execution.ID)
	for name := range execution.StageMap {
		status := stageStatus[name]
		if status != string(models.TaskStatusPending) {
			_continue := true
			_ = status
			_ = _continue
			continue
		}
		if o.dependsOnFailedStage(name, execution.Completed, execution.Failed, execution.Dependencies, stageStatus) {
			errMsg := "dependency failed"
			_ = o.repo.UpdateStageStatus(ctx, execution.TenantID, execution.StageMap[name], string(models.TaskStatusFailed), nil, nil, &errMsg)
			execution.mu.Lock()
			execution.Failed = append(execution.Failed, name)
			execution.mu.Unlock()
		}
	}
}

// dependsOnFailedStage checks if a stage depends on any failed stage.
func (o *StageOrchestrator) dependsOnFailedStage(stageName string, completed, failed []string, deps map[string][]string, status map[string]string) bool {
	_ = status
	_ = completed
	stageDeps, ok := deps[stageName]
	if !ok {
		return false
	}
	for _, dep := range stageDeps {
		for _, f := range failed {
			if f == dep {
				return true
			}
		}
	}
	return false
}

// EvaluateCondition evaluates a simple condition expression.
// Supported expressions: "true", "false", "${var_name}==value", "${var_name}!=value"
func (o *StageOrchestrator) EvaluateCondition(condition string, variables map[string]string) bool {
	condition = strings.TrimSpace(condition)

	// Expand variables
	for k, v := range variables {
		condition = strings.ReplaceAll(condition, "${"+k+"}", v)
		condition = strings.ReplaceAll(condition, "{{"+k+"}}", v)
	}

	// Handle equality checks
	if strings.Contains(condition, "==") {
		parts := strings.Split(condition, "==")
		if len(parts) == 2 {
			return strings.TrimSpace(parts[0]) == strings.TrimSpace(parts[1])
		}
	}

	if strings.Contains(condition, "!=") {
		parts := strings.Split(condition, "!=")
		if len(parts) == 2 {
			return strings.TrimSpace(parts[0]) != strings.TrimSpace(parts[1])
		}
	}

	// Handle boolean-like
	if condition == "true" {
		return true
	}
	if condition == "false" {
		return false
	}

	// Default to true for unknown conditions
	return true
}

// recoverFromCheckpoint restores state from a checkpoint.
func (o *StageOrchestrator) recoverFromCheckpoint(ctx context.Context, execution *Execution) bool {
	cp, err := o.repo.GetCheckpoint(ctx, execution.TenantID, execution.ID)
	if err != nil || cp == nil {
		return false
	}
	var state models.EngineState
	if err := json.Unmarshal([]byte(cp.State), &state); err != nil {
		return false
	}
	execution.Completed = state.CompletedStages
	execution.Failed = state.FailedStages
	// Flatten task outputs into execution variables
	if execution.Variables == nil {
		execution.Variables = make(map[string]string)
	}
	for taskName, outputs := range state.TaskOutputs {
		for k, v := range outputs {
			execution.Variables[fmt.Sprintf("tasks.%s.%s", taskName, k)] = v
		}
	}
	return true
}

// recordCompleted adds a stage to completed list.
func (o *StageOrchestrator) recordCompleted(execution *Execution, name string) {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	execution.Completed = append(execution.Completed, name)
}

// recordFailed adds a stage to failed list.
func (o *StageOrchestrator) recordFailed(execution *Execution, name string, err error) {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	execution.Failed = append(execution.Failed, name)
	_ = err
}

// recordSkipped marks stage as skipped.
func (o *StageOrchestrator) recordSkipped(ctx context.Context, execution *Execution, stage *models.Stage) {
	_ = o.repo.UpdateStageStatus(ctx, execution.TenantID, stage.ID, string(models.TaskStatusSkipped), nil, nil, nil)
	tasks, _ := o.repo.GetTasksByStage(ctx, execution.TenantID, stage.ID)
	for _, t := range tasks {
		_ = o.repo.UpdateTaskStatus(ctx, execution.TenantID, t.ID, models.TaskStatusSkipped, nil, nil, nil, nil)
	}
	o.recordCompleted(execution, stage.Name)
}

// CheckpointManager handles checkpoint persistence.
type CheckpointManager struct {
	repo *repository.Repository
}

// NewCheckpointManager creates a new CheckpointManager.
func NewCheckpointManager(repo *repository.Repository) *CheckpointManager {
	return &CheckpointManager{repo: repo}
}

// Save writes a checkpoint for the current state.
func (c *CheckpointManager) Save(ctx context.Context, runID string, stageName string, taskName string, variables map[string]string) {
	// Convert flat variables to task outputs map for EngineState
	taskOutputs := make(map[string]map[string]string)
	for k, v := range variables {
		// Parse tasks.<taskName>.<key> into nested map
		parts := strings.Split(strings.TrimPrefix(k, "tasks."), ".")
		if len(parts) == 2 {
			tname, key := parts[0], parts[1]
			if taskOutputs[tname] == nil {
				taskOutputs[tname] = make(map[string]string)
			}
			taskOutputs[tname][key] = v
		}
	}
	state := models.EngineState{
		CompletedStages: []string{},
		FailedStages:    []string{},
		TaskOutputs:     taskOutputs,
	}
	b, _ := json.Marshal(state)
	cp := &models.Checkpoint{
		RunID:     runID,
		StageName: stageName,
		TaskName:  &taskName,
		State:     string(b),
	}
	_ = c.repo.CreateCheckpoint(ctx, cp)
}

// SaveCheckpoint serializes expanded run state and upserts a checkpoint.
func (c *CheckpointManager) SaveCheckpoint(ctx context.Context, runID string, pipelineID string, stageState map[string]string, variables map[string]string, lastStage string, lastTask string) error {
	taskOutputs := make(map[string]map[string]string)
	for k, v := range variables {
		parts := strings.Split(strings.TrimPrefix(k, "tasks."), ".")
		if len(parts) == 2 {
			if taskOutputs[parts[0]] == nil {
				taskOutputs[parts[0]] = make(map[string]string)
			}
			taskOutputs[parts[0]][parts[1]] = v
		}
	}
	state := models.EngineState{
		TaskOutputs: taskOutputs,
	}
	stateJSON, err := json.Marshal(state)
	if err != nil {
		return err
	}
	cp := &models.Checkpoint{
		RunID:     runID,
		StageName: lastStage,
		TaskName:  stringPtr(lastTask),
		State:     string(stateJSON),
	}
	// Best effort: keep old insert path if upsert table/index is absent.
	if err := c.repo.SaveCheckpoint(ctx, cp); err != nil {
		_ = c.repo.CreateCheckpoint(ctx, cp)
	}
	return nil
}

// LoadCheckpoint deserializes the latest checkpoint for a run.
func (c *CheckpointManager) LoadCheckpoint(ctx context.Context, runID string) (*models.EngineState, error) {
	cp, err := c.repo.GetCheckpoint(ctx, "", runID)
	if err != nil {
		return nil, err
	}
	var state models.EngineState
	if err := json.Unmarshal([]byte(cp.State), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// CleanupCompleted deletes a run's checkpoint after completion/cancellation.
func (c *CheckpointManager) CleanupCompleted(ctx context.Context, runID string) error {
	if _, err := c.repo.DeleteCheckpointByRunID(ctx, runID); err != nil {
		return err
	}
	return nil
}

// FindRunningCheckpoints returns checkpoints in running state for startup recovery.
func (c *CheckpointManager) FindRunningCheckpoints(ctx context.Context) ([]models.Checkpoint, error) {
	// Use repo best-effort query. If unavailable, falls back to getting latest checkpoint per run.
	cps, err := c.repo.FindCheckpointsByStatus(ctx, "running")
	if err == nil {
		return cps, nil
	}
	return nil, err
}

// RecoveryResult summarizes startup orphaned-run recovery.
type RecoveryResult struct {
	Recovered    int
	MarkedFailed int
	Restored     int
	Errors       []string
}

// RecoverOrphanedRuns evaluates RUNNING checkpoints and either restores or marks stale runs.
func (c *CheckpointManager) RecoverOrphanedRuns(ctx context.Context, tenantID string, engine *PipelineEngine, markFailedIfStale bool) *RecoveryResult {
	result := &RecoveryResult{}
	cps, err := c.FindRunningCheckpoints(ctx)
	if err != nil {
		result.Errors = append(result.Errors, err.Error())
		return result
	}
	result.Recovered = len(cps)
	for _, cp := range cps {
		run, runErr := c.repo.GetRun(ctx, tenantID, cp.RunID)
		if runErr != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("run %s not found: %v", cp.RunID, runErr))
			continue
		}
		if run.Status == models.RunStatusRunning && markFailedIfStale {
			if _, err := engine.CancelRun(ctx, tenantID, cp.RunID, "orphan recovery"); err != nil {
				result.Errors = append(result.Errors, err.Error())
			}
			result.MarkedFailed++
		}
		_ = c.CleanupCompleted(ctx, cp.RunID)
	}
	return result
}

// stringPtr returns a pointer to a string (nil for empty).
func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
// nowInt64 returns current unix timestamp as int64.
func nowInt64() int64 {
	return nowTime().Unix()
}

// nowTime returns current UTC time.
func nowTime() time.Time {
	return time.Now().UTC()
}
