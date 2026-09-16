// Package stages defines the processing stages in the alert event pipeline.
//
// Pipeline flow: receive -> validate -> dedup -> enrich -> route -> notify -> track
//
// Each stage implements the Stage interface and operates on a shared
// AlertContext, enriching it and moving it along the pipeline.
package stages

import (
	"context"
	"time"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Stage is the contract for any pipeline processing stage.
type Stage interface {
	Name() string
	Process(ctx context.Context, alertCtx *models.AlertContext) error
}

// Chain executes stages sequentially, stopping on first non-retryable error.
type Chain struct {
	stages  []Stage
	logger  *zap.Logger
	options ChainOptions
}

// ChainOptions configures the pipeline chain.
type ChainOptions struct {
	// SkipStage returns true if the named stage should be skipped.
	SkipStage func(name string) bool
}

// ChainOption applies configuration to a Chain.
type ChainOption func(*ChainOptions)

// NewChain creates a processing chain from the given stages.
func NewChain(stages []Stage, opts ...ChainOption) *Chain {
	options := ChainOptions{SkipStage: func(name string) bool { return false }}
	for _, opt := range opts {
		opt(&options)
	}
	return &Chain{
		stages:  stages,
		logger:  zap.NewNop(),
		options: options,
	}
}

// WithSkipStage configures a stage skip predicate.
func WithSkipStage(f func(name string) bool) ChainOption {
	return func(o *ChainOptions) { o.SkipStage = f }
}

// Execute runs all stages in order. OTEL tracing wraps the entire pipeline.
func (c *Chain) Execute(ctx context.Context, alertCtx *models.AlertContext) *models.AlertContext {
	_, span := otel.Tracer("orion-alert-pipeline").Start(ctx, "alert-pipeline.Chain.Execute")
	defer span.End()

	span.SetAttributes()
	for i, st := range c.stages {
		name := st.Name()

		// Record the stage that just finished, except before the first one runs.
		//
		// NewAlertContext seeds ctx.Stage with "receive" as a placeholder, so an
		// unconditional Snapshot here captured that placeholder as if it had
		// completed. Every successful run then reported [receive, receive, ...]
		// and StageCount was one higher than the number of stages configured --
		// a 6-stage pipeline reported 7 stages, with the first one twice. The
		// track stage, which reports History plus the current stage, inherited
		// the same off-by-one.
		if i > 0 {
			alertCtx.Snapshot(alertCtx.Stage.ExitCode, alertCtx.Stage.ExitMsg)
		}
		alertCtx.Stage = models.AlertStage{
			Stage:   name,
			Entered: time.Now().UTC(),
		}

		// Skip?
		if c.options.SkipStage != nil && c.options.SkipStage(name) {
			alertCtx.Stage.ExitCode = "skipped"
			c.logger.Debug("stage skipped", zap.String("stage", name))
			continue
		}

		// Process
		if err := st.Process(ctx, alertCtx); err != nil {
			alertCtx.Stage.ExitCode = "error"
			alertCtx.Stage.ExitMsg = err.Error()
			// ctx.Error is the pipeline-wide error channel: both
			// PipelineService.Execute and the track stage read it to decide the
			// result status. Recording the failure only on alertCtx.Stage made
			// every aborted run report status "success" -- the chain stops here,
			// the remaining stages never run, and nothing downstream could tell
			// that the pipeline had been truncated.
			alertCtx.Error = err.Error()
			span.RecordError(err)
			c.logger.Error("stage failed",
				zap.String("stage", name),
				zap.Error(err),
				zap.String("alert_id", alertCtx.AlertID))
			return alertCtx
		}

		alertCtx.Stage.ExitCode = "ok"
	}
	alertCtx.Snapshot(alertCtx.Stage.ExitCode, alertCtx.Stage.ExitMsg)
	return alertCtx
}
