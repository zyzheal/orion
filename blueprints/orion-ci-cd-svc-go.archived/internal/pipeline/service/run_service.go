package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var runServiceTracer = otel.Tracer("orion-pipeline-svc-run")

// RunService provides comprehensive run operations: detail view, history trends,
// and environment variable resolution. Mirrors the Node.js PipelineRunService.
type RunService struct {
	db         *sqlx.DB
	runRepo    *repository.RunRepository
	stageRepo  *repository.StageRepository
	taskRepo   *repository.TaskRepository
}

func NewRunService(db *sqlx.DB, runRepo *repository.RunRepository, stageRepo *repository.StageRepository, taskRepo *repository.TaskRepository) *RunService {
	return &RunService{
		db:        db,
		runRepo:   runRepo,
		stageRepo: stageRepo,
		taskRepo:  taskRepo,
	}
}

// RunDetail is the unified response for GetRunDetail (run + stages + tasks).
type RunDetail struct {
	Run    *models.PipelineRun
	Stages []models.Stage
	Tasks  []models.Task
}

// RunHistoryTrend represents aggregated run history for a time period.
type RunHistoryTrend struct {
	Period         string        `json:"period"`
	PeriodStart    time.Time     `json:"period_start"`
	PeriodEnd      time.Time     `json:"period_end"`
	TotalRuns      int           `json:"total_runs"`
	SuccessRuns    int           `json:"success_runs"`
	FailedRuns     int           `json:"failed_runs"`
	RunningRuns    int           `json:"running_runs"`
	SuccessRate    float64       `json:"success_rate"`
	AvgDurationMs  int64         `json:"avg_duration_ms"`
	FailureReasons []FailureReason `json:"failure_reasons"`
}

// FailureReason represents a failure reason and its count.
type FailureReason struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

// RunHistoryFilter is used for filtering run history queries.
type RunHistoryFilter struct {
	PipelineID string
	Period     string // "day", "week", "month"
	Status     string
}

// ============================================
// Run CRUD & Detail
// ============================================

// GetRunDetail returns a complete run with its stages and tasks in one call.
func (s *RunService) GetRunDetail(ctx context.Context, runID string) (*RunDetail, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.GetRunDetail",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	// Fetch run
	run, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	// Fetch stages
	stages, err := s.stageRepo.GetByRunID(ctx, runID)
	if err != nil {
		span.AddEvent("failed_to_load_stages", trace.WithAttributes(
			attribute.String("error", err.Error()),
		))
		stages = []models.Stage{}
	}

	// Fetch all tasks for all stages
	tasks := []models.Task{}
	for _, stage := range stages {
		stageTasks, err := s.taskRepo.GetByStageID(ctx, stage.ID)
		if err != nil {
			span.AddEvent("failed_to_load_tasks_for_stage", trace.WithAttributes(
				attribute.String("stage.id", stage.ID),
				attribute.String("error", err.Error()),
			))
			continue
		}
		tasks = append(tasks, stageTasks...)
	}

	return &RunDetail{
		Run:    run,
		Stages: stages,
		Tasks:  tasks,
	}, nil
}

// CreateRun creates a new pipeline run (mirrors Node.js createRun).
func (s *RunService) CreateRun(ctx context.Context, input CreateRunInput) (*models.PipelineRun, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.CreateRun",
		trace.WithAttributes(
			attribute.String("pipeline.id", input.PipelineID),
			attribute.String("trigger.type", string(input.TriggerType)),
		))
	defer span.End()

	contextJSON := "{}"
	if input.Context != nil {
		if b, err := json.Marshal(input.Context); err == nil {
			contextJSON = string(b)
		}
	}

	run := &models.PipelineRun{
		ID:              uuid.New().String(),
		PipelineID:      input.PipelineID,
		TenantID:        input.TenantID,
		PipelineVersion: input.PipelineVersion,
		TriggerType:     input.TriggerType,
		TriggerBy:       input.TriggerBy,
		Environment:     input.Environment,
		Status:          models.StatusPending,
		Context:         contextJSON,
	}

	if err := s.runRepo.Create(ctx, run); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to create run: %w", err)
	}
	span.SetAttributes(attribute.String("run.id", run.ID))
	return run, nil
}

// StartRun marks a run as running (mirrors Node.js startRun).
func (s *RunService) StartRun(ctx context.Context, runID string) (*models.PipelineRun, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.StartRun",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	// Verify run exists
	_, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	if err := s.runRepo.MarkStarted(ctx, runID); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to start run: %w", err)
	}

	return s.runRepo.GetByID(ctx, runID)
}

// CompleteRun marks a run as completed or failed (mirrors Node.js completeRun).
func (s *RunService) CompleteRun(ctx context.Context, runID string, status models.PipelineRunStatus) (*models.PipelineRun, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.CompleteRun",
		trace.WithAttributes(
			attribute.String("run.id", runID),
			attribute.String("status", string(status)),
		))
	defer span.End()

	// Verify run exists
	_, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	completedAt := time.Now()
	_ = completedAt
	if err := s.runRepo.FinalizeRun(ctx, runID, string(status), time.Now().UnixMilli()-time.Now().UnixMilli()); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to complete run: %w", err)
	}

	return s.runRepo.GetByID(ctx, runID)
}

// CancelRun cancels a running run (mirrors Node.js cancelRun).
func (s *RunService) CancelRun(ctx context.Context, runID string) (*models.PipelineRun, error) {
	if err := s.runRepo.CancelRun(ctx, runID); err != nil {
		return nil, fmt.Errorf("failed to cancel run: %w", err)
	}
	return s.runRepo.GetByID(ctx, runID)
}

// ============================================
// Stage & Task Management
// ============================================

// AddStage adds a stage to a run (mirrors Node.js addStage).
func (s *RunService) AddStage(ctx context.Context, runID string, name string, sequence int) (*models.Stage, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.AddStage",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	stage := &models.Stage{
		ID:       uuid.New().String(),
		RunID:    runID,
		Name:     name,
		Sequence: sequence,
		Status:   models.StagePending,
	}

	if err := s.stageRepo.Create(ctx, stage); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to add stage: %w", err)
	}
	span.SetAttributes(attribute.String("stage.id", stage.ID))
	return stage, nil
}

// GetStages returns all stages for a run.
func (s *RunService) GetStages(ctx context.Context, runID string) ([]models.Stage, error) {
	return s.stageRepo.GetByRunID(ctx, runID)
}

// GetStage returns a stage by ID.
func (s *RunService) GetStage(ctx context.Context, stageID string) (*models.Stage, error) {
	return s.stageRepo.GetByID(ctx, stageID)
}

// AddTask adds a task to a stage (mirrors Node.js addTask).
func (s *RunService) AddTask(ctx context.Context, stageID string, name, taskType string, config string, sequence int) (*models.Task, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.AddTask",
		trace.WithAttributes(attribute.String("stage.id", stageID)))
	defer span.End()

	task := &models.Task{
		ID:       uuid.New().String(),
		StageID:  stageID,
		Name:     name,
		Type:     taskType,
		Status:   models.TaskPending,
		Config:   config,
		Sequence: sequence,
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to add task: %w", err)
	}
	span.SetAttributes(attribute.String("task.id", task.ID))
	return task, nil
}

// GetTasks returns all tasks for a stage.
func (s *RunService) GetTasks(ctx context.Context, stageID string) ([]models.Task, error) {
	return s.taskRepo.GetByStageID(ctx, stageID)
}

// ============================================
// Run History & Trends
// ============================================

// GetRunHistory returns run history aggregated by time period.
// Mirrors Node.js PipelineRunService.getRunHistory().
func (s *RunService) GetRunHistory(ctx context.Context, pipelineID string, period string) ([]RunHistoryTrend, error) {
	ctx, span := runServiceTracer.Start(ctx, "RunService.GetRunHistory",
		trace.WithAttributes(
			attribute.String("pipeline.id", pipelineID),
			attribute.String("period", period),
		))
	defer span.End()

	// Determine date truncation and period count
	var dateTrunc string
	var periods int

	switch strings.ToLower(period) {
	case "week":
		dateTrunc = "week"
		periods = 12
	case "month":
		dateTrunc = "month"
		periods = 12
	case "day":
	default:
		dateTrunc = "day"
		periods = 30
	}

	// Fetch aggregated stats by period
	statsRows, err := s.db.QueryxContext(ctx, fmt.Sprintf(`
		SELECT
			DATE_TRUNC(%[1]s, created_at) AS period_start,
			COUNT(*)::int AS total_runs,
			COUNT(CASE WHEN status = 'success' THEN 1 END)::int AS success_runs,
			COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed_runs,
			COUNT(CASE WHEN status = 'running' OR status = 'pending' THEN 1 END)::int AS running_runs,
			COALESCE(AVG(CASE WHEN duration_ms IS NOT NULL AND duration_ms > 0 THEN duration_ms END), 0)::int AS avg_duration_ms
		FROM pipeline_runs
		WHERE pipeline_id = $1
		  AND created_at >= DATE_TRUNC(%[1]s, NOW()) - (%[2]d || ' %[1]s')::interval
		GROUP BY period_start
		ORDER BY period_start ASC
	`, dateTrunc, periods), pipelineID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to query run history: %w", err)
	}
	defer statsRows.Close()

	// Build period map
	periodMap := make(map[string]*RunHistoryTrend)
	for statsRows.Next() {
		var t RunHistoryTrend
		if err := statsRows.StructScan(&t); err != nil {
			continue
		}
		if t.TotalRuns > 0 {
			t.SuccessRate = float64(t.SuccessRuns) / float64(t.TotalRuns) * 100
		}
		periodMap[t.PeriodStart.Format(time.RFC3339)] = &t
	}

	// Fetch failure reasons
	failuresRows, err := s.db.QueryxContext(ctx, fmt.Sprintf(`
		SELECT
			DATE_TRUNC(%[1]s, created_at) AS period_start,
			COALESCE(error_message, 'unknown') AS failure_reason,
			COUNT(*)::int AS failure_count
		FROM pipeline_runs
		WHERE pipeline_id = $1
		  AND status = 'failed'
		  AND created_at >= DATE_TRUNC(%[1]s, NOW()) - (%[2]d || ' %[1]s')::interval
		GROUP BY period_start, failure_reason
		ORDER BY period_start ASC, failure_count DESC
	`, dateTrunc, periods), pipelineID)
	if err != nil {
		// Log but don't fail — failure reasons are optional
		span.AddEvent("failed_to_query_failure_reasons", trace.WithAttributes(
			attribute.String("error", err.Error()),
		))
	} else {
		defer failuresRows.Close()
		for failuresRows.Next() {
			var periodStart sql.NullString
			var reason string
			var count int
			if err := failuresRows.Scan(&periodStart, &reason, &count); err != nil {
				continue
			}
			if !periodStart.Valid {
				continue
			}
			t, ok := periodMap[periodStart.String]
			if ok {
				t.FailureReasons = append(t.FailureReasons, FailureReason{Reason: reason, Count: count})
			}
		}
	}

	// Build filled result with zero-fill for missing periods
	result := s.buildFilledResult(periodMap, periods, period)
	return result, nil
}

// buildFilledResult fills in missing time periods with zero values.
func (s *RunService) buildFilledResult(periodMap map[string]*RunHistoryTrend, periods int, period string) []RunHistoryTrend {
	now := time.Now()
	result := make([]RunHistoryTrend, 0, periods)

	for i := periods - 1; i >= 0; i-- {
		var periodStart time.Time

		switch period {
		case "week":
			periodStart = now.AddDate(0, 0, -(i*7))
			periodStart = periodStart.Truncate(7 * 24 * time.Hour) // Sunday midnight
		case "month":
			periodStart = time.Date(now.Year(), now.AddDate(0, -i, 0).Month(), 1, 0, 0, 0, 0, time.UTC)
		default: // day
			periodStart = now.AddDate(0, 0, -i)
			periodStart = time.Date(periodStart.Year(), periodStart.Month(), periodStart.Day(), 0, 0, 0, 0, periodStart.Location())
		}

		key := periodStart.Format(time.RFC3339)
		existing, ok := periodMap[key]
		if ok {
			result = append(result, *existing)
			continue
		}

		// Zero-fill
		var periodEnd time.Time
		switch period {
		case "week":
			periodEnd = periodStart.Add(7 * 24 * time.Hour)
		case "month":
			periodEnd = periodStart.AddDate(0, 1, 0)
		default:
			periodEnd = periodStart.Add(24 * time.Hour)
		}

		result = append(result, RunHistoryTrend{
			Period:         period,
			PeriodStart:    periodStart,
			PeriodEnd:      periodEnd,
			TotalRuns:      0,
			SuccessRuns:    0,
			FailedRuns:     0,
			RunningRuns:    0,
			SuccessRate:    0,
			AvgDurationMs:  0,
			FailureReasons: []FailureReason{},
		})
	}

	return result
}

// ============================================
// Run Completion Check
// ============================================

// CheckRunCompletion checks if all stages in a run are done.
// Mirrors Node.js PipelineRunService.checkRunCompletion().
func (s *RunService) CheckRunCompletion(ctx context.Context, runID string) (*CompletionResult, error) {
	_, span := runServiceTracer.Start(ctx, "RunService.CheckRunCompletion",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	// Verify run exists
	_, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	stages, err := s.stageRepo.GetByRunID(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to check run completion: %w", err)
	}

	if len(stages) == 0 {
		return &CompletionResult{IsComplete: true, AllSuccess: true}, nil
	}

	hasFailed := false
	allComplete := true
	for _, stage := range stages {
		if stage.Status == models.StageFailed {
			hasFailed = true
		}
		if stage.Status != models.StageSuccess && stage.Status != models.StageFailed && stage.Status != models.StageSkipped {
			allComplete = false
		}
	}

	return &CompletionResult{
		IsComplete: allComplete,
		AllSuccess: !hasFailed,
	}, nil
}

// CompletionResult holds the result of a run completion check.
type CompletionResult struct {
	IsComplete bool `json:"is_complete"`
	AllSuccess bool `json:"all_success"`
}

// ============================================
// CreateRunInput
// ============================================

// CreateRunInput is the input for creating a run.
type CreateRunInput struct {
	TenantID        string
	PipelineID      string
	PipelineVersion string
	TriggerType     models.TriggerType
	TriggerBy       string
	Environment     string
	Context         map[string]string
}

// GetRunsByStatus finds runs by status.
func (s *RunService) GetRunsByStatus(ctx context.Context, status string) ([]models.PipelineRun, error) {
	return s.runRepo.FindByStatus(ctx, status)
}

// ListRuns lists runs with filtering.
func (s *RunService) ListRuns(ctx context.Context, filter models.PipelineRunFilter) (*models.RunListResponse, error) {
	runs, total, err := s.runRepo.ListWithFilter(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list runs: %w", err)
	}
	return &models.RunListResponse{
		Data:  runs,
		Total: total,
	}, nil
}
