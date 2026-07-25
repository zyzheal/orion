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

// WithLogger sets the logger used by the chain.
func (c *Chain) WithLogger(logger *zap.Logger) {
	c.logger = logger
}

// Execute runs every stage in order, tracking progression in the AlertContext.
// It returns the final AlertContext regardless of outcome.
func (c *Chain) Execute(ctx context.Context, alertCtx *models.AlertContext) *models.AlertContext {
	for _, st := range c.stages {
		name := st.Name()

		// Record entry
		alertCtx.Snapshot(alertCtx.Stage.ExitCode, alertCtx.Stage.ExitMsg)
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
