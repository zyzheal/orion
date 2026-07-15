package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"

	"gopkg.in/yaml.v3"
)

var (
	ErrPipelineNotFound = errors.New("pipeline not found")
	ErrInvalidSpec      = errors.New("invalid pipeline spec")
)

// PipelineEngine is the top-level orchestrator for pipeline runs.
type PipelineEngine struct {
	repo         *repository.Repository
	orchestrator *StageOrchestrator
	executor     *StageExecutor
	// specStore holds pipeline YAML specs by "pipelineID@version".
	specStore map[string]string
}

// NewPipelineEngine creates a new PipelineEngine instance.
func NewPipelineEngine(repo *repository.Repository) *PipelineEngine {
	orch := NewStageOrchestrator(repo)
	exec := NewStageExecutor(repo)
	orch.SetExecutor(exec)
	return &PipelineEngine{
		repo:         repo,
		orchestrator: orch,
		executor:     exec,
		specStore:    make(map[string]string),
	}
}

// RegisterSpec registers an inline YAML spec for a pipeline.
func (e *PipelineEngine) RegisterSpec(pipelineID, version, yamlSpec string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[pipeline-engine] RegisterSpec recovered from panic: %v\n", r)
		}
	}()
	e.specStore[fmt.Sprintf("%s@%s", pipelineID, version)] = yamlSpec
}

// ParseSpec parses a YAML spec string into a PipelineSpec.
func (e *PipelineEngine) ParseSpec(yamlSpec string) (*models.PipelineSpec, error) {
	var spec models.PipelineSpec
	if err := yaml.Unmarshal([]byte(yamlSpec), &spec); err != nil {
		return nil, fmt.Errorf("parse yaml: %w", ErrInvalidSpec)
	}
	if len(spec.Stages) == 0 {
		return nil, fmt.Errorf("no stages defined: %w", ErrInvalidSpec)
	}
	return &spec, nil
}

// fetchSpec retrieves and parses the YAML spec for a pipeline.
func (e *PipelineEngine) fetchSpec(ctx context.Context, pipelineID, version string) (*models.PipelineSpec, error) {
	key := fmt.Sprintf("%s@%s", pipelineID, version)
	specYAML, ok := e.specStore[key]
	if !ok {
		return nil, fmt.Errorf("spec not registered for %s: %w", key, ErrPipelineNotFound)
	}
	return e.ParseSpec(specYAML)
}

// createStageWithTasks creates a stage and its tasks in the repository.
func (e *PipelineEngine) createStageWithTasks(ctx context.Context, runID string, tenantID string, seq int, s models.StageSpec) (*models.Stage, error) {
	dependsOnJSON, _ := json.Marshal(s.DependsOn)

	stage := &models.Stage{
		RunID:          runID,
		Name:           s.Name,
		Sequence:       seq,
		Status:         models.TaskStatusPending,
		TimeoutSeconds: 3600,
		MaxRetries:     s.MaxRetries,
		TenantID:       tenantID,
		Condition:      s.Condition,
		DependsOn:      string(dependsOnJSON),
	}
	if s.TimeoutSeconds > 0 {
		stage.TimeoutSeconds = s.TimeoutSeconds
	}

	if err := e.repo.CreateStage(ctx, stage); err != nil {
		return nil, err
	}

	for taskSeq, t := range s.Tasks {
		config, _ := json.Marshal(t.Config)
		params, _ := json.Marshal(t.Parameters)
		task := &models.Task{
			StageID:        stage.ID,
			Name:           t.Name,
			Type:           t.Type,
			Sequence:       taskSeq + 1,
			Status:         models.TaskStatusPending,
			Config:         string(config),
			Parameters:     string(params),
			MaxRetries:     t.MaxRetries,
			TimeoutSeconds: 3600,
			TenantID:       tenantID,
		}
		if t.TimeoutSeconds > 0 {
			task.TimeoutSeconds = t.TimeoutSeconds
		}
		if err := e.repo.CreateTask(ctx, task); err != nil {
			return nil, err
		}
	}

	return stage, nil
}

// Execute triggers a pipeline run and executes it.
func (e *PipelineEngine) Execute(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.PipelineRun, error) {
	var run *models.PipelineRun
	var err error
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("pipeline engine panic: %v", r)
		}
	}()
	run, err = e.execute(ctx, tenantID, req)
	return run, err
}

func (e *PipelineEngine) execute(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.PipelineRun, error) {
	// Parse or retrieve spec
	var spec *models.PipelineSpec
	var err error
	if req.SpecYAML != nil {
		spec, err = e.ParseSpec(*req.SpecYAML)
	} else {
		spec, err = e.fetchSpec(ctx, req.PipelineID, req.PipelineVersion)
	}
	if err != nil {
		return nil, err
	}

	// Topological sort
	order := e.topologicalSort(spec.Stages)
	if len(order) != len(spec.Stages) {
		return nil, fmt.Errorf("cycle detected in stage dependencies: %w", ErrInvalidSpec)
	}

	// Create run
	startTime := time.Now().UTC()
	startUnix := startTime.Unix()

	contextJSON := "{}"
	if req.Context != nil {
		if b, err := json.Marshal(req.Context); err == nil {
			contextJSON = string(b)
		}
	}

	run := &models.PipelineRun{
		PipelineID:      req.PipelineID,
		PipelineVersion: req.PipelineVersion,
		TriggerType:     models.TriggerType(req.TriggerType),
		TriggerBy:       &req.TriggerBy,
		Status:          models.RunStatusPending,
		Environment:     &req.Environment,
		StartedAt:       &startUnix,
		Context:         contextJSON,
		TenantID:        tenantID,
	}
	if err := e.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}

	// Create stages and tasks in topological order
	for seqIdx, s := range order {
		_, err := e.createStageWithTasks(ctx, run.ID, tenantID, seqIdx+1, s)
		if err != nil {
			return nil, err
		}
	}

	// Set status to RUNNING
	if err := e.repo.UpdateRunStatus(ctx, tenantID, run.ID, models.RunStatusRunning, nil, nil); err != nil {
		return nil, err
	}

	// Build stage name -> stage ID mapping
	stageMap, err := e.buildStageMap(ctx, tenantID, run.ID)
	if err != nil {
		return nil, err
	}

	// Build execution context (variables from spec)
	variables := make(map[string]string)
	for k, v := range spec.Variables {
		variables[k] = v
	}

	// Execute stages via orchestrator
	failed := e.orchestrator.Execute(ctx, run, stageMap, variables)

	// Finalize run
	completedTime := time.Now().UTC()
	completedUnix := completedTime.Unix()
	durationMs := int64(completedTime.Sub(startTime).Milliseconds())

	finalStatus := models.RunStatusSuccess
	if failed {
		finalStatus = models.RunStatusFailed
	}
	if err := e.repo.UpdateRunStatus(ctx, tenantID, run.ID, finalStatus, &completedUnix, &durationMs); err != nil {
		return nil, err
	}

	// Return final run state
	return e.repo.GetRun(ctx, tenantID, run.ID)
}

// buildStageMap returns stage name -> stage ID for a run.
func (e *PipelineEngine) buildStageMap(ctx context.Context, tenantID, runID string) (map[string]string, error) {
	stages, err := e.repo.GetStagesByRun(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string)
	for _, s := range stages {
		m[s.Name] = s.ID
	}
	return m, err
}

// topologicalSort returns stages in dependency order using Kahn's algorithm.
func (e *PipelineEngine) topologicalSort(stages []models.StageSpec) []models.StageSpec {
	inDegree := make(map[string]int)
	successors := make(map[string][]string)
	nameToStage := make(map[string]models.StageSpec)

	for _, s := range stages {
		nameToStage[s.Name] = s
		if s.DependsOn == nil {
			s.DependsOn = []string{}
		}
		for _, dep := range s.DependsOn {
			successors[dep] = append(successors[dep], s.Name)
		}
	}

	for name := range nameToStage {
		if _, ok := inDegree[name]; !ok {
			// Count dependencies
			s := nameToStage[name]
			inDegree[name] = len(s.DependsOn)
		}
	}

	var queue []string
	for name, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, name)
		}
	}
	sort.Strings(queue)

	result := make([]models.StageSpec, 0)
	visited := make(map[string]bool)
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if visited[current] {
			continue
		}
		visited[current] = true
		result = append(result, nameToStage[current])

		for _, succ := range successors[current] {
			inDegree[succ]--
			if inDegree[succ] == 0 {
				queue = append(queue, succ)
			}
		}
	}
	sort.Strings(queue)
	_ = queue
	return result
}

// CancelRun cancels a running pipeline.
func (e *PipelineEngine) CancelRun(ctx context.Context, tenantID, runID, triggerBy string) (*models.PipelineRun, error) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[pipeline-engine] CancelRun recovered from panic: %v\n", r)
		}
	}()
	run, err := e.repo.GetRun(ctx, tenantID, runID)
	if err != nil {
		return nil, err
	}
	if run.Status == models.RunStatusSuccess || run.Status == models.RunStatusFailed || run.Status == models.RunStatusCancelled {
		return run, nil
	}

	completedTime := time.Now().UTC()
	completedUnix := completedTime.Unix()
	cancelMsg := fmt.Sprintf("cancelled by %s", triggerBy)

	// Cancel run
	if err := e.repo.UpdateRunStatus(ctx, tenantID, runID, models.RunStatusCancelled, &completedUnix, nil); err != nil {
		return nil, err
	}

	// Cancel stages and tasks
	stages, _ := e.repo.GetStagesByRun(ctx, tenantID, runID)
	for _, stage := range stages {
		if stage.Status == models.TaskStatusRunning {
			_ = e.repo.UpdateStageStatus(ctx, tenantID, stage.ID, string(models.TaskStatusFailed), &completedUnix, nil, &cancelMsg)
			tasks, _ := e.repo.GetTasksByStage(ctx, tenantID, stage.ID)
			for _, task := range tasks {
				if task.Status == models.TaskStatusRunning {
					_ = e.repo.UpdateTaskStatus(ctx, tenantID, task.ID, models.TaskStatusFailed, &completedUnix, nil, &cancelMsg, nil)
				} else if task.Status == models.TaskStatusPending {
					_ = e.repo.UpdateTaskStatus(ctx, tenantID, task.ID, models.TaskStatusSkipped, nil, nil, nil, nil)
				}
			}
		} else if stage.Status == models.TaskStatusPending {
			_ = e.repo.UpdateStageStatus(ctx, tenantID, stage.ID, string(models.TaskStatusSkipped), nil, nil, nil)
			tasks, _ := e.repo.GetTasksByStage(ctx, tenantID, stage.ID)
			for _, task := range tasks {
				if task.Status == models.TaskStatusPending {
					_ = e.repo.UpdateTaskStatus(ctx, tenantID, task.ID, models.TaskStatusSkipped, nil, nil, nil, nil)
				}
			}
		}
	}

	return e.repo.GetRun(ctx, tenantID, runID)
}

// GetRun returns the run by ID.
func (e *PipelineEngine) GetRun(ctx context.Context, tenantID, runID string) (*models.PipelineRun, error) {
	return e.repo.GetRun(ctx, tenantID, runID)
}

// ListRuns lists runs for a pipeline.
func (e *PipelineEngine) ListRuns(ctx context.Context, tenantID, pipelineID string, q models.ListRunsQuery) (*models.RunListResponse, error) {
	runs, err := e.repo.ListRuns(ctx, tenantID, pipelineID, q)
	if err != nil {
		return nil, err
	}
	total, err := e.repo.CountRuns(ctx, tenantID, pipelineID, q.Status)
	if err != nil {
		return nil, err
	}
	return &models.RunListResponse{Runs: runs, Total: total}, nil
}

// GetStages returns all stages for a run.
func (e *PipelineEngine) GetStages(ctx context.Context, tenantID, runID string) ([]models.Stage, error) {
	return e.repo.GetStagesByRun(ctx, tenantID, runID)
}

// GetTasks returns all tasks for a stage.
func (e *PipelineEngine) GetTasks(ctx context.Context, tenantID, stageID string) ([]models.Task, error) {
	return e.repo.GetTasksByStage(ctx, tenantID, stageID)
}
