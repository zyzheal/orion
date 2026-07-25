package engine

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Engine orchestrates execution of a Pipeline's stages.  It dispatches stages
// through a Scheduler, executes each stage's tasks with retry/timeout support,
// and aggregates results into a RunResult.
type Engine struct {
	handlers  map[TaskAction]TaskHandler
	mu        sync.RWMutex
	callbacks *EngineCallbacks
	rollback  Rollback
	logger    Logger
}

// Logger is the minimal structured logger interface the Engine needs.
type Logger interface {
	Debug(msg string, keysAndValues ...interface{})
	Info(msg string, keysAndValues ...interface{})
	Warn(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
}

// NewEngine creates an Engine with the given logger.
func NewEngine(logger Logger) *Engine {
	return &Engine{
		handlers:  make(map[TaskAction]TaskHandler),
		callbacks: &EngineCallbacks{},
		logger:    logger,
	}
}

// SetCallbacks registers observability callbacks.
func (e *Engine) SetCallbacks(cb *EngineCallbacks) {
	if cb != nil {
		e.callbacks = cb
	}
}

// SetRollback registers the rollback hook called on pipeline failure.
func (e *Engine) SetRollback(fn Rollback) {
	e.rollback = fn
}

// RegisterHandler binds a TaskHandler to its action type.
func (e *Engine) RegisterHandler(h TaskHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.handlers[h.Type()] = h
}

// Handler returns the handler for the given action.
func (e *Engine) Handler(action TaskAction) (TaskHandler, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	h, ok := e.handlers[action]
	return h, ok
}

// Execute runs the Pipeline and returns a RunResult.
//
// The runID is used for logging and result identification; the Engine does not
// persist the result itself — callers are responsible for persistence.
func (e *Engine) Execute(ctx context.Context, runID string, p *Pipeline) (*RunResult, error) {
	started := time.Now().UTC()
	if p == nil || len(p.Stages) == 0 {
		result := &RunResult{Status: RunStatusFailed, Error: "no stages defined"}
		return result, ErrNoStages
	}

	if e.logger != nil {
		e.logger.Info("engine: run started",
			"run_id", runID, "pipeline_id", p.ID, "stages", len(p.Stages))
	}

	result := e.newRunResult(runID, p, started)
	if e.callbacks.OnRunStart != nil {
		e.callbacks.OnRunStart(result)
	}

	scheduler, err := NewScheduler(p.Stages, p.Config)
	if err != nil {
		e.recordFailure(result, started, err)
		return result, err
	}

	failed := e.runStages(ctx, result.RunID, p, scheduler, result)

	finished := time.Now().UTC()
	result.FinishedAt = finished
	result.DurationMs = finished.Sub(started).Milliseconds()

	if failed {
		result.Status = RunStatusFailed
		e.executeRollback(ctx, result)
	} else {
		result.Status = RunStatusCompleted
	}

	if e.callbacks.OnRunEnd != nil {
		e.callbacks.OnRunEnd(result)
	}

	if e.logger != nil {
		e.logger.Info("engine: run finished",
			"run_id", runID, "status", string(result.Status),
			"duration_ms", result.DurationMs)
	}
	return result, nil
}

// newRunResult builds the initial RunResult snapshot.
func (e *Engine) newRunResult(runID string, p *Pipeline, started time.Time) *RunResult {
	result := &RunResult{
		PipelineID: p.ID,
		TenantID:   p.TenantID,
		RunID:      runID,
		Status:     RunStatusRunning,
		Stages:     make(map[string]*StageState, len(p.Stages)),
		StartedAt:  started,
	}
	for _, s := range p.Stages {
		result.Stages[s.Name] = &StageState{
			Name:   s.Name,
			Status: StageStatusPending,
			Tasks:  make(map[string]*TaskState, len(s.Tasks)),
		}
		for _, t := range s.Tasks {
			result.Stages[s.Name].Tasks[t.Name] = &TaskState{
				Name:   t.Name,
				Action: t.Action,
				Status: TaskStatusPending,
			}
		}
	}
	return result
}

// runStages drives the scheduler and returns whether any stage failed.
func (e *Engine) runStages(ctx context.Context, runID string, p *Pipeline,
	s *Scheduler, result *RunResult) bool {
	vars := make(map[string]string)
	var failed bool

	s.ExecuteCtx(ctx, func(ctx context.Context, stageName string) *Result {
		stage := s.graph.Stage(stageName)
		result.Stages[stageName] = &StageState{Status: StageStatusRunning}
		st := result.Stages[stageName]
		st.StartedAt = time.Now().UTC()

		if e.callbacks.OnStageStart != nil {
			e.callbacks.OnStageStart(result.RunID, stageName)
		}

		ctx = WithTimeout(stage.Timeout)(ctx)
		tasksFailed := e.runTasks(ctx, runID, p, stage, st, vars)

		st.FinishedAt = time.Now().UTC()
		if tasksFailed {
			st.Status = StageStatusFailed
			st.Error = "one or more tasks failed"
			failed = true
		} else {
			st.Status = StageStatusSuccess
		}

		if e.callbacks.OnStageEnd != nil {
			e.callbacks.OnStageEnd(result.RunID, stageName, st.Status, nil)
		}

		return &Result{
			Name:   stageName,
			Status: st.Status,
			Error:  st.Error,
		}
	})

	return failed
}

// runTasks executes the tasks in a stage sequentially.
func (e *Engine) runTasks(ctx context.Context, runID string, p *Pipeline,
	stage *Stage, st *StageState, vars map[string]string) bool {
	tasksFailed := false
	for _, task := range stage.Tasks {
		ts := st.Tasks[task.Name]
		ts.Status = TaskStatusRunning

		if e.callbacks.OnTaskStart != nil {
			e.callbacks.OnTaskStart(runID, stage.Name, task.Name)
		}

		taskCtx := WithTimeout(p.Config.ResolveTimeout(task.Timeout))(ctx)
		attempts, taskErr := Retry(taskCtx, RetryConfig{
			MaxAttempts: p.Config.ResolveMaxRetries(task.MaxRetries) + 1,
			BaseDelay:   p.Config.BackoffBase,
			MaxDelay:    10 * time.Second,
		}, func() error {
			ts.Attempts++
			return e.executeTask(taskCtx, task, vars)
		})

		if taskErr != nil {
			ts.Status = TaskStatusFailed
			ts.Error = taskErr.Error()
			if e.logger != nil {
				e.logger.Error("engine: task failed",
					"run_id", runID,
					"stage", stage.Name, "task", task.Name,
					"attempts", attempts, "error", taskErr)
			}
			if !task.ContinueOnError {
				tasksFailed = true
			}
		} else {
			ts.Status = TaskStatusSuccess
			if ts.Output != nil && ts.Output.Outputs != nil {
				for k, v := range ts.Output.Outputs {
					vars[fmt.Sprintf("tasks.%s.%s", task.Name, k)] = v
				}
			}
			if e.logger != nil {
				e.logger.Debug("engine: task success",
					"run_id", runID,
					"stage", stage.Name, "task", task.Name,
					"attempts", attempts)
			}
		}

		if e.callbacks.OnTaskEnd != nil {
			e.callbacks.OnTaskEnd(runID, stage.Name, task.Name, ts.Status, nil)
		}

		if tasksFailed {
			for _, r := range stage.Tasks {
				if rt := st.Tasks[r.Name]; rt.Status == TaskStatusPending {
					rt.Status = TaskStatusSkipped
				}
			}
			break
		}
	}
	return tasksFailed
}

// executeTask runs one Task through its registered handler.
func (e *Engine) executeTask(ctx context.Context, task Task, vars map[string]string) error {
	h, ok := e.Handler(task.Action)
	if !ok {
		return fmt.Errorf("no handler registered for action %q", task.Action)
	}
	params := make(map[string]interface{}, len(task.Parameters)+len(vars))
	for k, v := range task.Parameters {
		params[k] = v
	}
	for k, v := range vars {
		params["vars."+k] = v
	}
	res := &TaskResult{Success: true}
	if err := h.Execute(ctx, params, res); err != nil {
		return err
	}
	return nil
}

// executeRollback runs the registered Rollback on every successful stage,
// in reverse execution order.
func (e *Engine) executeRollback(ctx context.Context, result *RunResult) {
	if e.rollback == nil {
		return
	}
	if e.logger != nil {
		e.logger.Info("engine: starting rollback", "run_id", result.RunID)
	}
	var names []string
	for name, st := range result.Stages {
		if st.Status == StageStatusSuccess {
			names = append(names, name)
		}
	}
	for i := len(names) - 1; i >= 0; i-- {
		name := names[i]
		if err := e.rollback(ctx, name, result.Stages[name]); err != nil {
			if e.logger != nil {
				e.logger.Error("engine: rollback failed",
					"run_id", result.RunID, "stage", name, "error", err)
			}
		}
	}
}

// recordFailure finalises the result as failed with the given error.
func (e *Engine) recordFailure(result *RunResult, started time.Time, err error) {
	finished := time.Now().UTC()
	result.Status = RunStatusFailed
	result.FinishedAt = finished
	result.DurationMs = finished.Sub(started).Milliseconds()
	result.Error = err.Error()
}

// WithTimeout returns a context modifier that applies a timeout.
func WithTimeout(d time.Duration) func(ctx context.Context) context.Context {
	return func(ctx context.Context) context.Context {
		if d > 0 {
			der, cancel := context.WithTimeout(ctx, d)
			go func() {
				<-ctx.Done()
				cancel()
			}()
			return der
		}
		return ctx
	}
}
