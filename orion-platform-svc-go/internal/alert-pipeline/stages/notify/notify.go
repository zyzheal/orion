// Package notify implements the notification stage of the alert pipeline.  It
// dispatches alerts to matched channels via registered NotificationChannel
// plugins (email, slack, webhook, pagerduty, etc.).
package notify

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// ChannelRegistry maps channel names to NotificationChannel plugins.
type ChannelRegistry map[string]models.NotificationChannel

// Stage delivers alerts through matched notification channels.
type Stage struct {
	logger   *zap.Logger
	channels ChannelRegistry
	// dryRun disables actual delivery (useful for testing / staging).
	dryRun bool
}

// NewStage creates a notify stage.
func NewStage(logger *zap.Logger, dryRun bool) *Stage {
	return &Stage{
		logger:   logger,
		channels: make(ChannelRegistry),
		dryRun:   dryRun,
	}
}

// RegisterChannel registers a notification channel plugin.
func (s *Stage) RegisterChannel(ch models.NotificationChannel) {
	s.channels[ch.Name()] = ch
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "notify"
}

// Process iterates over the matched routes in AlertContext and dispatches
// the alert to each available notification channel.  Delivery failures are
// logged but do not stop the pipeline.
func (s *Stage) Process(_ context.Context, alertCtx *models.AlertContext) error {
	s.logger.Info("notifying channels",
		zap.String("alert_id", alertCtx.AlertID),
		zap.Strings("routes", alertCtx.Routes))

	sent := 0
	failed := 0

	for _, route := range alertCtx.Routes {
		// Look up by exact channel name first, then by channel type.
		ch := s.channels[route]
		if ch == nil {
			// fallback: first channel matching the route type
			for _, candidate := range s.channels {
				if candidate.ChannelType() == route {
					ch = candidate
					break
				}
			}
		}
		if ch == nil {
			s.logger.Warn("no notification channel for route",
				zap.String("route", route))
			failed++
			continue
		}

		if s.dryRun {
			s.logger.Info("dry-run notify",
				zap.String("channel", ch.Name()),
				zap.String("type", ch.ChannelType()))
			sent++
			continue
		}

		if err := ch.Send(alertCtx); err != nil {
			s.logger.Error("notification failed",
				zap.String("channel", ch.Name()),
				zap.Error(err))
			failed++
		} else {
			sent++
		}
	}

	alertCtx.Enrichments["notification"] = map[string]interface{}{
		"sent":   sent,
		"failed": failed,
		"time":   time.Now().UTC().Format(time.RFC3339),
	}

	s.logger.Info("notify complete",
		zap.Int("sent", sent),
		zap.Int("failed", failed))

	return nil
}

// Stats returns registered channel names.
func (s *Stage) Stats() map[string]string {
	out := make(map[string]string, len(s.channels))
	for n, ch := range s.channels {
		out[n] = ch.ChannelType()
	}
	return out
}
