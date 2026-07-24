package engine

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/repository"

	"go.uber.org/zap"
)

var (
	// ErrRunNotFound is returned when a pipeline run does not exist.
	ErrRunNotFound = fmt.Errorf("run not found")
	// ErrPipelineNotFound is returned when a pipeline does not exist.
	ErrPipelineNotFound = fmt.Errorf("pipeline not found")
	// ErrEngineNotInitialized is returned when the engine has not been initialized.
	ErrEngineNotInitialized = fmt.Errorf("engine not initialized: call Initialize first")
)

// TaskResult holds the outcome of executing a single task.
type TaskResult struct {
	Status  models.TaskStatus
	Output  string
	Error   string
	ExitCode int
}

// PipelineEngine is the facade for pipeline execution.
// It coordinates stage/task execution via the StageOrchestrator.
type PipelineEngine struct {
	pipelineRepo *repository.PipelineRepository
	runRepo      *repository.RunRepository
	stageRepo    *repository.StageRepository
	taskRepo     *repository.TaskRepository
	logger       *zap.Logger

	orchestrator *StageOrchestrator

	// mu guards executions
	mu          sync.Mutex
	executions  map[string]*Execution
}

// Execution tracks the in-memory state of a running pipeline execution.
type Execution struct {
	Run      *models.PipelineRun
	Stages   map[string]*models.Stage // keyed by stage ID
	Cancel   context.CancelFunc
	StartedAt time.Time
}

// EngineDeps holds the dependencies required to build a PipelineEngine.
type EngineDeps struct {
	PipelineRepo *repository.PipelineRepository
	RunRepo      *repository.RunRepository
	StageRepo    *repository.StageRepository
	TaskRepo     *repository.TaskRepository
	Logger       *zap.Logger
}

// NewPipelineEngine creates a new PipelineEngine instance.
func NewPipelineEngine(deps EngineDeps) *PipelineEngine {
	engine := &PipelineEngine{
		pipelineRepo: deps.PipelineRepo,
		runRepo:      deps.RunRepo,
		stageRepo:    deps.StageRepo,
		taskRepo:     deps.TaskRepo,
		logger:       deps.Logger,
		executions:   make(map[string]*Execution),
	}
	engine.orchestrator = NewStageOrchestrator(OrchestratorDeps{
		StageRepo: deps.StageRepo,
		TaskRepo:  deps.TaskRepo,
		RunRepo:   deps.RunRepo,
		Logger:    deps.Logger,
	})
	return engine
}

// Execute starts a pipeline run asynchronously.
//
// Flow:
//  1. Validate pipeline exists.
//  2. Parse stages from pipeline YAML config.
//  3. Mark the run as started.
//  4. Launch the orchestrator in a background goroutine.
//
// The run is expected to already be created (by PipelineService.RunPipeline)
// with its initial stages persisted. This method finds the existing stages
// for the run and begins execution.
func (e *PipelineEngine) Execute(ctx context.Context, tenantID, pipelineID, runID string) error {
	e.logger.Info("starting pipeline execution",
		zap.String("pipeline_id", pipelineID),
		zap.String("run_id", runID),
	)

	// Step 1: Validate pipeline exists.
	pipeline, err := e.pipelineRepo.GetByID(ctx, tenantID, pipelineID)
	if err != nil {
		e.logger.Error("pipeline not found", zap.String("pipeline_id", pipelineID), zap.Error(err))
		return fmt.Errorf("%w: %s", ErrPipelineNotFound, pipelineID)
	}

	// Step 2: Load the run.
	run, err := e.runRepo.GetByID(ctx, runID)
	if err != nil {
		e.logger.Error("run not found", zap.String("run_id", runID), zap.Error(err))
		return fmt.Errorf("%w: %s", ErrRunNotFound, runID)
	}

	// Step 3: Mark run as started (if not already).
	if run.Status == models.StatusPending {
		if err := e.runRepo.MarkStarted(ctx, runID); err != nil {
			e.logger.Warn("failed to mark run as started", zap.String("run_id", runID), zap.Error(err))
		}
	}

	// Step 4: Load existing stages for this run.
	stages, err := e.stageRepo.GetByRunID(ctx, runID)
	if err != nil {
		e.logger.Error("failed to load stages", zap.String("run_id", runID), zap.Error(err))
		return fmt.Errorf("failed to load stages: %w", err)
	}
	if len(stages) == 0 {
		// Parse stages from YAML and create them.
		stageNames := parseStagesFromYAML(pipeline.YAMLConfig)
		stages = make([]models.Stage, 0, len(stageNames))
		for i, name := range stageNames {
			stage := &models.Stage{
				RunID:    runID,
				Name:     name,
				Sequence: i + 1,
				Status:   models.StagePending,
			}
			if err := e.stageRepo.Create(ctx, stage); err != nil {
				e.logger.Warn("failed to create stage",
					zap.String("run_id", runID), zap.String("stage", name), zap.Error(err))
				continue
			}
			stages = append(stages, *stage)
		}
	}

	// Step 5: Build stage lookup maps.
	stageMap := make(map[string]*models.Stage)
	for i := range stages {
		stageMap[stages[i].ID] = &stages[i]
	}

	// Step 6: Create cancellable context for this execution.
	execCtx, cancel := context.WithCancel(ctx)

	// Step 7: Register execution.
	execution := &Execution{
		Run:      run,
		Stages:   stageMap,
		Cancel:   cancel,
		StartedAt: time.Now(),
	}
	e.mu.Lock()
	e.executions[runID] = execution
	e.mu.Unlock()

	// Step 8: Launch orchestrator in background.
	go func() {
		defer func() {
			// Cleanup execution state after completion.
			e.mu.Lock()
			delete(e.executions, runID)
			e.mu.Unlock()
			cancel()
		}()

		if err := e.orchestrator.Execute(execCtx, execution); err != nil {
			e.logger.Error("pipeline execution failed",
				zap.String("run_id", runID),
				zap.Error(err))
		}
	}()

	return nil
}

// CancelRun cancels a running pipeline execution by its run ID.
func (e *PipelineEngine) CancelRun(runID string) {
	e.mu.Lock()
	exec, ok := e.executions[runID]
	e.mu.Unlock()

	if !ok {
		e.logger.Warn("no active execution found for cancellation", zap.String("run_id", runID))
		return
	}

	exec.Cancel()
	e.logger.Info("cancellation signal sent to pipeline execution", zap.String("run_id", runID))
}

// ExecutionCount returns the number of currently running executions.
func (e *PipelineEngine) ExecutionCount() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return len(e.executions)
}

// parseStagesFromYAML extracts stage names from a pipeline YAML config.
// Supports structured YAML with a stages array. Falls back to
// ["build", "test", "deploy"] when parsing yields no stages.
func parseStagesFromYAML(yamlConfig string) []string {
	if yamlConfig == "" {
		return []string{"build", "test", "deploy"}
	}

	lines := strings.Split(yamlConfig, "\n")
	var stages []string
	inStages := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "stages:") {
			inStages = true
			continue
		}

		if inStages {
			if strings.HasPrefix(trimmed, "- name:") {
				name := strings.TrimSpace(strings.TrimPrefix(trimmed, "- name:"))
				name = strings.Trim(name, "\"'")
				if name != "" {
					stages = append(stages, name)
				}
			} else if strings.HasPrefix(trimmed, "- ") && !strings.Contains(trimmed, ":") {
				name := strings.TrimSpace(strings.TrimPrefix(trimmed, "- "))
				name = strings.Trim(name, "\"'")
				if name != "" {
					stages = append(stages, name)
				}
			} else if !strings.HasPrefix(trimmed, "-") && !strings.HasPrefix(trimmed, "#") && trimmed != "" {
				inStages = false
			}
		}
	}

	if len(stages) == 0 {
		return []string{"build", "test", "deploy"}
	}
	return stages
}
