// Package track implements the final pipeline stage: persisting the alert's
// processing trail and publishing lifecycle events to the event bus for
// timeline correlation and replay.
package track

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/event"
	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Stage publishes alert lifecycle events and tracks processing history.
type Stage struct {
	bus    *event.Bus
	logger *zap.Logger
}

// NewStage creates a track stage.
func NewStage(bus *event.Bus, logger *zap.Logger) *Stage {
	return &Stage{
		bus:    bus,
		logger: logger,
	}
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "track"
}

// Process records the alert's full stage history and publishes a lifecycle
// event to the bus.  It is always the last stage so failures here do not
// invalidate upstream work.
func (s *Stage) Process(ctx context.Context, alertCtx *models.AlertContext) error {
	if s.bus == nil {
		return nil
	}

	now := time.Now().UTC()

	// Build a summary of the pipeline run.
	result := s.buildResult(alertCtx)

	// Publish an alert event to the bus for timeline correlation.
	ae := &event.AlertEvent{
		BaseEvent: event.BaseEvent{
			EventID:   event.GenerateEventID(),
			EventType: event.EventTypeAlert,
			TenantID:  alertCtx.TenantID,
			AlertID:   alertCtx.AlertID,
			GroupID:   alertCtx.GroupID,
			Timestamp: now,
			Source:    alertCtx.Source,
			Metadata:  map[string]interface{}{
				"result": result,
			},
		},
		Name:        alertCtx.AlertID,
		Fingerprint: alertCtx.GroupID,
	}
	if err := s.bus.Publish(ctx, ae); err != nil {
		s.logger.Error("failed to publish alert event",
			zap.Error(err),
			zap.String("alert_id", alertCtx.AlertID))
		// Non-fatal — pipeline completion still recorded.
	}

	// Store the result back into the context for downstream consumers.
	alertCtx.Enrichments["trackResult"] = result
	alertCtx.Enrichments["trackedAt"] = now.Format(time.RFC3339)

	s.logger.Info("alert tracking complete",
		zap.String("alert_id", alertCtx.AlertID),
		zap.Int("stages", result.StageCount),
		zap.Strings("stages", result.Stages))

	return nil
}

// Timeline queries the event bus for events belonging to this alert or group.
func (s *Stage) Timeline(ctx context.Context, tenantID, groupID, alertID string, since time.Time) ([]event.BaseEvent, error) {
	if s.bus == nil {
		return nil, nil
	}
	return s.bus.Timeline(ctx, tenantID, groupID, alertID, since)
}

func (s *Stage) buildResult(ctx *models.AlertContext) *models.PipelineResult {
	stages := make([]string, 0, len(ctx.History)+1)
	for _, h := range ctx.History {
		status := h.ExitCode
		if status == "" {
			status = "ok"
		}
		stages = append(stages, h.Stage+":"+status)
	}
	// Include current stage if it has one.
	if ctx.Stage.Stage != "" {
		code := ctx.Stage.ExitCode
		if code == "" {
			code = "ok"
		}
		stages = append(stages, ctx.Stage.Stage+":"+code)
	}

	status := "success"
	if ctx.Error != "" {
		status = "error"
	}
	errors := []string{}
	if ctx.Error != "" {
		errors = append(errors, ctx.Error)
	}

	return &models.PipelineResult{
		AlertID:    ctx.AlertID,
		Status:     status,
		Stages:     stages,
		StageCount: len(stages),
		Errors:     errors,
	}
}
