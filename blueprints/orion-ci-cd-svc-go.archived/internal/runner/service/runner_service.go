package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"orion/ci-cd-svc-go/internal/runner/models"
	"orion/ci-cd-svc-go/internal/runner/repository"

	"github.com/google/uuid"
)

var (
	ErrRunnerNotFound    = errors.New("runner not found")
	ErrRunNotFound       = errors.New("pipeline run not found")
	ErrStageNotFound     = errors.New("stage execution not found")
	ErrTaskNotFound      = errors.New("task execution not found")
	ErrJobNotFound       = errors.New("runner job not found")
	ErrInvalidTransition = errors.New("invalid status transition")
	ErrNoCapacity        = errors.New("no available runners with capacity")
)

// Service implements the runner-svc business logic.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Runner Lifecycle ====================

// Create registers a new runner.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateRunnerRequest) (*models.Runner, error) {
	now := time.Now()
	runner := &models.Runner{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		Type:          req.Type,
		Status:        "online",
		Endpoint:      req.Endpoint,
		Capacity:      1,
		MaxConcurrent: req.MaxConcurrent,
		CurrentJobs:   0,
		Labels:        req.Labels,
		Metadata:      models.JSONB(req.Metadata),
		LastHeartbeat: &now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if runner.MaxConcurrent <= 0 {
		runner.MaxConcurrent = 1
	}
	if runner.Labels == nil {
		runner.Labels = models.JSONArray{}
	}
	if runner.Metadata == nil {
		runner.Metadata = models.JSONB{}
	}
	return runner, s.repo.Create(ctx, runner)
}

// List returns runners for a tenant with pagination.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Runner, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetByID returns a runner by ID, scoped to a tenant.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Runner, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// Delete removes a runner.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of runners for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update modifies a runner's mutable fields.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateRunnerRequest) (*models.Runner, error) {
	// Verify runner exists and belongs to tenant
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRunnerNotFound
	}
	return s.repo.Update(ctx, id, req)
}

// Heartbeat refreshes the runner's last heartbeat timestamp.
func (s *Service) Heartbeat(ctx context.Context, id string) (*models.Runner, error) {
	runner, err := s.repo.UpdateHeartbeat(ctx, id)
	if err != nil {
		return nil, ErrRunnerNotFound
	}
	return runner, nil
}

// ==================== Runner Selection (Label Routing) ====================

// SelectRunner finds the best available runner for a task based on required labels.
//
// Selection logic:
// 1. Find all runners matching ALL required labels for this tenant
// 2. Filter to 'online' status with available capacity
// 3. Pick the one with lowest utilization (most capacity remaining)
func (s *Service) SelectRunner(ctx context.Context, tenantID string, requiredLabels []string) (*models.Runner, error) {
	candidates, err := s.repo.FindByLabels(ctx, tenantID, requiredLabels)
	if err != nil {
		return nil, err
	}

	// Filter to available runners
	var available []models.Runner
	for _, r := range candidates {
		if r.Status == "online" && r.CurrentJobs < r.MaxConcurrent {
			available = append(available, r)
		}
	}

	if len(available) == 0 {
		return nil, ErrNoCapacity
	}

	// Pick runner with lowest utilization
	best := available[0]
	bestUtil := float64(best.CurrentJobs) / float64(best.MaxConcurrent)
	for _, r := range available[1:] {
		util := float64(r.CurrentJobs) / float64(r.MaxConcurrent)
		if util < bestUtil {
			best = r
			bestUtil = util
		}
	}

	return &best, nil
}

// GetStaleRunners returns runners whose heartbeat exceeds the timeout.
func (s *Service) GetStaleRunners(ctx context.Context, timeoutMinutes int) ([]models.Runner, error) {
	if timeoutMinutes <= 0 {
		timeoutMinutes = 5
	}

	// Get all online and busy runners
	online, err := s.repo.FindByStatus(ctx, "online")
	if err != nil {
		return nil, err
	}
	busy, err := s.repo.FindByStatus(ctx, "busy")
	if err != nil {
		return nil, err
	}

	all := append(online, busy...)
	cutoff := time.Now().Add(-time.Duration(timeoutMinutes) * time.Minute)

	var stale []models.Runner
	for _, r := range all {
		if r.LastHeartbeat != nil && r.LastHeartbeat.Before(cutoff) {
			stale = append(stale, r)
		}
	}
	return stale, nil
}

// MarkStaleRunnersOffline marks runners with expired heartbeats as offline.
func (s *Service) MarkStaleRunnersOffline(ctx context.Context, timeoutMinutes int) (int, error) {
	stale, err := s.GetStaleRunners(ctx, timeoutMinutes)
	if err != nil {
		return 0, err
	}

	offline := "offline"
	count := 0
	for _, r := range stale {
		_, err := s.repo.Update(ctx, r.ID, &models.UpdateRunnerRequest{Status: &offline})
		if err != nil {
			log.Printf("warning: failed to mark runner %s offline: %v", r.ID, err)
			continue
		}
		count++
	}
	return count, nil
}

// ==================== PipelineRun CRUD ====================

// CreateRun creates a new pipeline run.
func (s *Service) CreateRun(ctx context.Context, tenantID string, req *models.CreatePipelineRunRequest) (*models.PipelineRun, error) {
	now := time.Now()
	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = "manual"
	}
	status := "pending"

	var triggerBy *string
	if req.TriggerBy != "" {
		triggerBy = &req.TriggerBy
	}
	var envName *string
	if req.EnvironmentName != "" {
		envName = &req.EnvironmentName
	}

	run := &models.PipelineRun{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		PipelineID:      req.PipelineID,
		TriggerType:     triggerType,
		TriggerBy:       triggerBy,
		Status:          status,
		EnvironmentName: envName,
		ConfigSnapshot:  models.JSONB(req.ConfigSnapshot),
		CreatedAt:       now,
	}
	if run.ConfigSnapshot == nil {
		run.ConfigSnapshot = models.JSONB{}
	}

	return run, s.repo.CreateRun(ctx, run)
}

// GetRun returns a pipeline run by ID.
func (s *Service) GetRun(ctx context.Context, id string) (*models.PipelineRun, error) {
	return s.repo.GetRunByID(ctx, id)
}

// ListRuns returns pipeline runs with optional filters.
func (s *Service) ListRuns(ctx context.Context, tenantID string, filter *models.RunListFilter) ([]models.PipelineRun, error) {
	return s.repo.ListRuns(ctx, tenantID, filter)
}

// StartRun transitions a run from pending to running.
func (s *Service) StartRun(ctx context.Context, runID string) (*models.PipelineRun, error) {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if run.Status != "pending" {
		return nil, ErrInvalidTransition
	}

	now := time.Now()
	return s.repo.UpdateRunStatus(ctx, runID, "running", &now, nil, nil)
}

// CompleteRun transitions a run to success or failed.
func (s *Service) CompleteRun(ctx context.Context, runID, status string, errorMsg *string) (*models.PipelineRun, error) {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if run.Status != "running" {
		return nil, ErrInvalidTransition
	}

	now := time.Now()
	started := run.StartedAt
	if started == nil {
		started = &run.CreatedAt
	}
	return s.repo.UpdateRunStatus(ctx, runID, status, started, &now, errorMsg)
}

// CancelRun transitions a run to cancelled.
func (s *Service) CancelRun(ctx context.Context, runID string) (*models.PipelineRun, error) {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, ErrRunNotFound
	}
	if run.Status != "running" && run.Status != "pending" {
		return nil, ErrInvalidTransition
	}

	now := time.Now()
	started := run.StartedAt
	if started == nil {
		started = &run.CreatedAt
	}
	cancelled := "cancelled by user"
	return s.repo.UpdateRunStatus(ctx, runID, "cancelled", started, &now, &cancelled)
}

// DeleteRun removes a pipeline run.
func (s *Service) DeleteRun(ctx context.Context, runID string) error {
	return s.repo.DeleteRun(ctx, runID)
}

// ==================== Stage Execution ====================

// AddStage creates a stage execution record for a run.
func (s *Service) AddStage(ctx context.Context, runID, stageName string, stageID *string) (*models.StageExecution, error) {
	se := &models.StageExecution{
		ID:        uuid.New().String(),
		RunID:     runID,
		StageID:   stageID,
		StageName: stageName,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	return se, s.repo.CreateStageExecution(ctx, se)
}

// GetStages returns all stage executions for a run.
func (s *Service) GetStages(ctx context.Context, runID string) ([]models.StageExecution, error) {
	return s.repo.ListStageExecutionsByRun(ctx, runID)
}

// GetStage returns a stage execution by ID.
func (s *Service) GetStage(ctx context.Context, stageID string) (*models.StageExecution, error) {
	return s.repo.GetStageExecutionByID(ctx, stageID)
}

// UpdateStageStatus updates a stage execution's status and timestamps.
func (s *Service) UpdateStageStatus(ctx context.Context, stageID, status string, startedAt, completedAt *time.Time, errorMsg, logs *string) (*models.StageExecution, error) {
	return s.repo.UpdateStageExecutionStatus(ctx, stageID, status, startedAt, completedAt, errorMsg, logs)
}

// ==================== Task Execution ====================

// AddTask creates a task execution record for a stage.
func (s *Service) AddTask(ctx context.Context, stageID, taskName, taskType string, input map[string]interface{}) (*models.TaskExecution, error) {
	te := &models.TaskExecution{
		ID:          uuid.New().String(),
		ExecutionID: stageID,
		TaskName:    taskName,
		TaskType:    taskType,
		Status:      "pending",
		Input:       models.JSONB(input),
		CreatedAt:   time.Now(),
	}
	if te.Input == nil {
		te.Input = models.JSONB{}
	}
	return te, s.repo.CreateTaskExecution(ctx, te)
}

// GetTasks returns all task executions for a stage.
func (s *Service) GetTasks(ctx context.Context, stageID string) ([]models.TaskExecution, error) {
	return s.repo.ListTaskExecutionsByStage(ctx, stageID)
}

// GetTask returns a task execution by ID.
func (s *Service) GetTask(ctx context.Context, taskID string) (*models.TaskExecution, error) {
	return s.repo.GetTaskExecutionByID(ctx, taskID)
}

// StartTask transitions a task to running.
func (s *Service) StartTask(ctx context.Context, taskID string) (*models.TaskExecution, error) {
	now := time.Now()
	return s.repo.UpdateTaskExecutionStatus(ctx, taskID, map[string]interface{}{
		"status":     "running",
		"started_at": now,
	})
}

// CompleteTask transitions a task to success with output.
func (s *Service) CompleteTask(ctx context.Context, taskID string, output map[string]interface{}) (*models.TaskExecution, error) {
	now := time.Now()
	// Calculate duration from started_at
	task, err := s.repo.GetTaskExecutionByID(ctx, taskID)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	var durationMs *int64
	if task.StartedAt != nil {
		ms := now.Sub(*task.StartedAt).Milliseconds()
		durationMs = &ms
	}

	updates := map[string]interface{}{
		"status":       "success",
		"output":       output,
		"completed_at": now,
	}
	if durationMs != nil {
		updates["duration_ms"] = *durationMs
	}
	return s.repo.UpdateTaskExecutionStatus(ctx, taskID, updates)
}

// FailTask transitions a task to failed with an error message.
func (s *Service) FailTask(ctx context.Context, taskID, errorMsg string) (*models.TaskExecution, error) {
	now := time.Now()
	task, err := s.repo.GetTaskExecutionByID(ctx, taskID)
	if err != nil {
		return nil, ErrTaskNotFound
	}
	var durationMs *int64
	if task.StartedAt != nil {
		ms := now.Sub(*task.StartedAt).Milliseconds()
		durationMs = &ms
	}

	updates := map[string]interface{}{
		"status":        "failed",
		"error_message": errorMsg,
		"completed_at":  now,
	}
	if durationMs != nil {
		updates["duration_ms"] = *durationMs
	}
	return s.repo.UpdateTaskExecutionStatus(ctx, taskID, updates)
}

// AppendTaskLogs appends log content to a task execution.
func (s *Service) AppendTaskLogs(ctx context.Context, taskID, logContent string) error {
	task, err := s.repo.GetTaskExecutionByID(ctx, taskID)
	if err != nil {
		return ErrTaskNotFound
	}
	existing := ""
	if task.Logs != nil {
		existing = *task.Logs
	}
	newLogs := existing + logContent
	_, err = s.repo.UpdateTaskExecutionStatus(ctx, taskID, map[string]interface{}{
		"logs": newLogs,
	})
	return err
}

// ==================== Run Detail & Completion ====================

// GetRunDetail returns a pipeline run with its stages and tasks.
func (s *Service) GetRunDetail(ctx context.Context, runID string) (*models.PipelineRun, []models.StageExecution, []models.TaskExecution, error) {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, nil, nil, ErrRunNotFound
	}

	stages, err := s.repo.ListStageExecutionsByRun(ctx, runID)
	if err != nil {
		return run, nil, nil, err
	}

	var allTasks []models.TaskExecution
	for _, stage := range stages {
		tasks, err := s.repo.ListTaskExecutionsByStage(ctx, stage.ID)
		if err != nil {
			return run, stages, nil, err
		}
		allTasks = append(allTasks, tasks...)
	}

	return run, stages, allTasks, nil
}

// CheckRunCompletion checks if all stages of a run are complete.
func (s *Service) CheckRunCompletion(ctx context.Context, runID string) (*models.RunCompletionResult, error) {
	stages, err := s.repo.ListStageExecutionsByRun(ctx, runID)
	if err != nil {
		return nil, err
	}
	if len(stages) == 0 {
		return &models.RunCompletionResult{IsComplete: true, AllSuccess: true}, nil
	}

	allComplete := true
	hasFailed := false
	for _, s := range stages {
		switch s.Status {
		case "success", "skipped":
			// terminal states
		case "failed":
			hasFailed = true
		default:
			allComplete = false
		}
	}

	return &models.RunCompletionResult{
		IsComplete: allComplete,
		AllSuccess: !hasFailed,
	}, nil
}

// ==================== Runner Job (Remote Task Dispatch) ====================

// CreateRunnerJob creates a new runner job for remote task dispatch.
func (s *Service) CreateRunnerJob(ctx context.Context, tenantID string, req *models.CreateRunnerJobRequest) (*models.RunnerJob, error) {
	var stageID, runID *string
	if req.StageID != "" {
		stageID = &req.StageID
	}
	if req.RunID != "" {
		runID = &req.RunID
	}

	job := &models.RunnerJob{
		ID:        uuid.New().String(),
		RunnerID:  req.RunnerID,
		TaskID:    req.TaskID,
		StageID:   stageID,
		RunID:     runID,
		TenantID:  tenantID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	return job, s.repo.CreateRunnerJob(ctx, job)
}

// GetRunnerJob returns a runner job by ID.
func (s *Service) GetRunnerJob(ctx context.Context, id string) (*models.RunnerJob, error) {
	return s.repo.GetRunnerJobByID(ctx, id)
}

// ListRunnerJobs returns all jobs for a runner.
func (s *Service) ListRunnerJobs(ctx context.Context, runnerID string) ([]models.RunnerJob, error) {
	return s.repo.ListRunnerJobsByRunner(ctx, runnerID)
}

// MarkJobStarted marks a runner job as running and increments the runner's job count.
func (s *Service) MarkJobStarted(ctx context.Context, jobID string) (*models.RunnerJob, error) {
	job, err := s.repo.MarkRunnerJobStarted(ctx, jobID)
	if err != nil {
		return nil, ErrJobNotFound
	}
	// Increment runner's current_jobs
	if err := s.repo.IncrementJobs(ctx, job.RunnerID); err != nil {
		log.Printf("warning: failed to increment jobs for runner %s: %v", job.RunnerID, err)
	}
	return job, nil
}

// MarkJobComplete marks a runner job as completed and releases the runner.
func (s *Service) MarkJobComplete(ctx context.Context, jobID string, result map[string]interface{}) (*models.RunnerJob, error) {
	job, err := s.repo.MarkRunnerJobComplete(ctx, jobID, result)
	if err != nil {
		return nil, ErrJobNotFound
	}
	// Release runner capacity
	if err := s.repo.DecrementJobs(ctx, job.RunnerID); err != nil {
		log.Printf("warning: failed to decrement jobs for runner %s: %v", job.RunnerID, err)
	}
	return job, nil
}

// MarkJobFailed marks a runner job as failed and releases the runner.
func (s *Service) MarkJobFailed(ctx context.Context, jobID, errMsg string) (*models.RunnerJob, error) {
	job, err := s.repo.MarkRunnerJobFailed(ctx, jobID, errMsg)
	if err != nil {
		return nil, ErrJobNotFound
	}
	// Release runner capacity
	if err := s.repo.DecrementJobs(ctx, job.RunnerID); err != nil {
		log.Printf("warning: failed to decrement jobs for runner %s: %v", job.RunnerID, err)
	}
	return job, nil
}

// ==================== ExecuteOnRunner (full dispatch flow) ====================

// ExecuteOnRunner dispatches a task to a remote runner via HTTP POST.
// This mirrors the Node.js RunnerPoolService.executeOnRunner logic.
func (s *Service) ExecuteOnRunner(ctx context.Context, runnerID, runnerEndpoint, tenantID string, taskPayload map[string]interface{}) (*models.RunnerJob, error) {
	// 1. Create job record
	job := &models.RunnerJob{
		ID:        uuid.New().String(),
		RunnerID:  runnerID,
		TaskID:    fmt.Sprintf("%v", taskPayload["id"]),
		TenantID:  tenantID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	if stageID, ok := taskPayload["stageId"].(string); ok && stageID != "" {
		job.StageID = &stageID
	}
	if runID, ok := taskPayload["runId"].(string); ok && runID != "" {
		job.RunID = &runID
	}

	if err := s.repo.CreateRunnerJob(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create runner job: %w", err)
	}

	// 2. Mark job as started (increment runner's current_jobs)
	started, err := s.MarkJobStarted(ctx, job.ID)
	if err != nil {
		log.Printf("warning: failed to mark job started: %v", err)
	} else {
		job = started
	}

	// 3. Note: actual HTTP dispatch to runnerEndpoint/execute happens at the
	//    handler/gateway layer. This service layer manages the job lifecycle.
	//    The caller (handler) is responsible for the HTTP call and updating
	//    job status via MarkJobComplete/MarkJobFailed.

	return job, nil
}

// ReleaseRunner decrements a runner's job count (called after task completion).
func (s *Service) ReleaseRunner(ctx context.Context, runnerID string) error {
	return s.repo.DecrementJobs(ctx, runnerID)
}
