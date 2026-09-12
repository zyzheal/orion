package main

import (
	"context"
	"errors"
	"fmt"

	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	ae_engine "orion/platform-svc-go/internal/auto-exec/engine"
	auto_exec_factory "orion/platform-svc-go/internal/auto-exec/factory"
	auto_exec_handler "orion/platform-svc-go/internal/auto-exec/handler"
	auto_exec_plugins "orion/platform-svc-go/internal/auto-exec/plugins"
	auto_exec_repo "orion/platform-svc-go/internal/auto-exec/repository"
	auto_exec_service "orion/platform-svc-go/internal/auto-exec/service"
	pe_models "orion/platform-svc-go/internal/pipeline-engine/models"
	pe_repo "orion/platform-svc-go/internal/pipeline-engine/repository"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"
)

var autoExecH *auto_exec_handler.Handler

// autoExecEng is exposed for the wiring regression tests, which need to prove
// that the engine's plugin registry is actually populated at startup. The
// engine is not reachable from autoExecH: the service holds it in an
// unexported field.
var autoExecEng *ae_engine.AutoExecEngine

func wireAutoExec(db *database.DB, logger *zap.Logger) {
	repo := auto_exec_repo.NewRepository(db.DB)
	eng := ae_engine.NewAutoExecEngine(repo, logger)
	autoExecEng = eng

	// AutoExecEngine starts with an empty plugin registry. The factory's
	// init() populated a separate registry that nothing ever read, so every
	// task run failed with "plugin not registered" and CreateTask rejected
	// every plugin name. Register the bundled plugins here, plus the
	// pipeline-trigger plugin with a runner backed by the real pipeline engine.
	runner := &pipelineEngineRunner{engine: pe_service.NewPipelineEngine(pe_repo.NewRepository(db.DB))}
	auto_exec_plugins.SetTriggerPipelineRunner(runner)

	for _, p := range auto_exec_factory.Factory().All() {
		eng.RegisterExecutorPlugin(p)
	}
	eng.RegisterExecutorPlugin(auto_exec_plugins.NewPipelinePlugin(runner))

	svc := auto_exec_service.NewService(eng, repo)
	autoExecH = auto_exec_handler.NewHandler(svc)
}

// pipelineEngineRunner adapts the pipeline-engine service to the auto-exec
// PipelineRunner interface.
//
// It drives the child pipeline to completion and reports a non-success final
// status as an error, so a red child pipeline fails the auto-exec task instead
// of being recorded as completed with status "FAILED" in its output.
type pipelineEngineRunner struct {
	engine *pe_service.PipelineEngine
}

func (r *pipelineEngineRunner) RunPipeline(ctx context.Context, tenantID, pipelineID string, inputs map[string]interface{}) (*auto_exec_plugins.PipelineRunResult, error) {
	run, err := r.engine.Execute(ctx, tenantID, pe_models.TriggerRequest{
		PipelineID:  pipelineID,
		TriggerType: string(pe_models.TriggerManual),
		TriggerBy:   "auto-exec",
		Context:     inputs,
	})
	if err != nil {
		return nil, fmt.Errorf("pipeline %s did not start: %w", pipelineID, err)
	}
	if run == nil {
		return nil, fmt.Errorf("pipeline %s returned no run", pipelineID)
	}

	res := &auto_exec_plugins.PipelineRunResult{
		ExecutionID: run.ID,
		PipelineID:  pipelineID,
		Status:      string(run.Status),
	}
	if run.DurationMs != nil {
		res.DurationMs = *run.DurationMs
	}

	if stages, serr := r.engine.GetStages(ctx, tenantID, run.ID); serr == nil {
		res.StepsRun = len(stages)
		for _, s := range stages {
			if s.Status != pe_models.TaskStatusSuccess {
				res.StepsFailed++
			}
		}
	}

	if run.Status != pe_models.RunStatusSuccess {
		msg := fmt.Sprintf("pipeline %s ended with status %s (run %s)", pipelineID, run.Status, run.ID)
		res.Error = msg
		return res, errors.New(msg)
	}
	return res, nil
}
