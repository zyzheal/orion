// Package notify implements sample NotificationChannel plugins that the
// pipeline notify stage can dispatch through.  These are concrete
// implementations of the models.NotificationChannel interface; real
// deployments replace them with actual email/Slack/PagerDuty clients.
package notify

import (
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// ChannelConfig holds common configuration shared by all notification
// channels.  Real implementations wire this to env vars or config maps.
type ChannelConfig struct {
	// Enabled determines whether the channel is active.
	Enabled bool

	// SeverityFilter, when non-empty, limits this channel to alerts with
	// one of these severities (comma-separated).
	SeverityFilter string

	// Endpoint is the target address (email, webhook URL, Slack webhook, etc).
	Endpoint string

	// DryRun prevents actual delivery.
	DryRun bool
}

// BaseNotifier is a reusable base that handles filtering and logging so
// concrete channels only need to implement Deliver(payload).
type BaseNotifier struct {
	logger *zap.Logger
	cfg    ChannelConfig
}

// NewBaseNotifier creates a configured base notifier.
func NewBaseNotifier(logger *zap.Logger, cfg ChannelConfig) *BaseNotifier {
	return &BaseNotifier{logger: logger, cfg: cfg}
}

// ShouldSend returns true if the channel is enabled and the alert passes the
// severity filter.
func (n *BaseNotifier) ShouldSend(alertCtx *models.AlertContext) bool {
	if !n.cfg.Enabled {
		return false
	}
	if alertCtx == nil || alertCtx.Alert == nil {
		return false
	}
	if n.cfg.SeverityFilter == "" {
		return true
	}
	sev := fmt.Sprintf("%v", alertCtx.Alert["severity"])
	for _, allowed := range split(n.cfg.SeverityFilter) {
		if sev == allowed {
			return true
		}
	}
	return false
}

// LogSend records the delivery attempt (or dry-run skip) to structured logs.
func (n *BaseNotifier) LogSend(channelName string, alertID string, ok bool, err error) {
	if n.cfg.DryRun {
		n.logger.Info("dry-run notification",
			zap.String("channel", channelName),
			zap.String("alert_id", alertID))
		return
	}
	if ok {
		n.logger.Info("notification sent",
			zap.String("channel", channelName),
			zap.String("alert_id", alertID))
	} else {
		n.logger.Error("notification failed",
			zap.String("channel", channelName),
			zap.String("alert_id", alertID),
			zap.Error(err))
	}
}

// SlackChannel sends alerts to a Slack webhook.
type SlackChannel struct {
	*BaseNotifier
	name string
}

// NewSlackChannel creates a Slack notification channel.
func NewSlackChannel(name string, logger *zap.Logger, cfg ChannelConfig) *SlackChannel {
	return &SlackChannel{
		BaseNotifier: NewBaseNotifier(logger, cfg),
		name:         name,
	}
}

// Name implements models.NotificationChannel.
func (s *SlackChannel) Name() string { return s.name }

// ChannelType implements models.NotificationChannel.
func (s *SlackChannel) ChannelType() string { return "slack" }

// Send implements models.NotificationChannel.
func (s *SlackChannel) Send(alertCtx *models.AlertContext) error {
	if !s.ShouldSend(alertCtx) {
		return nil
	}
	payload := fmt.Sprintf(
		"⚠️ *%s*\nSeverity: *%s*\nSource: %s\nValue: %v",
		alertCtx.AlertID,
		fmt.Sprintf("%v", alertCtx.Alert["severity"]),
		fmt.Sprintf("%v", alertCtx.Alert["sourceName"]),
		fmt.Sprintf("%v", alertCtx.Alert["value"]),
	)
	if s.cfg.DryRun {
		s.LogSend(s.name, alertCtx.AlertID, true, nil)
		return nil
	}
	s.logger.Info("slack send (stub)",
		zap.String("alert_id", alertCtx.AlertID),
		zap.Any("payload", payload))
	return nil
}

// WebhookChannel sends alerts to an arbitrary HTTP webhook.
type WebhookChannel struct {
	*BaseNotifier
	name string
}

// NewWebhookChannel creates a webhook notification channel.
func NewWebhookChannel(name string, logger *zap.Logger, cfg ChannelConfig) *WebhookChannel {
	return &WebhookChannel{
		BaseNotifier: NewBaseNotifier(logger, cfg),
		name:         name,
	}
}

// Name implements models.NotificationChannel.
func (w *WebhookChannel) Name() string { return w.name }

// ChannelType implements models.NotificationChannel.
func (w *WebhookChannel) ChannelType() string { return "webhook" }

// Send implements models.NotificationChannel.
func (w *WebhookChannel) Send(alertCtx *models.AlertContext) error {
	if !w.ShouldSend(alertCtx) {
		return nil
	}
	payload, err := json.Marshal(map[string]interface{}{
		"alertId":   alertCtx.AlertID,
		"tenantId":  alertCtx.TenantID,
		"severity":  alertCtx.Alert["severity"],
		"source":    alertCtx.Source,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		w.LogSend(w.name, alertCtx.AlertID, false, err)
		return err
	}
	if w.cfg.DryRun {
		w.LogSend(w.name, alertCtx.AlertID, true, nil)
		return nil
	}
	w.logger.Info("webhook send (stub)",
		zap.String("alert_id", alertCtx.AlertID),
		zap.String("endpoint", w.cfg.Endpoint),
		zap.ByteString("payload", payload))
	return nil
}

// EmailChannel represents a stub email notification channel.
type EmailChannel struct {
	*BaseNotifier
	name string
}

// NewEmailChannel creates an email notification channel.
func NewEmailChannel(name string, logger *zap.Logger, cfg ChannelConfig) *EmailChannel {
	return &EmailChannel{
		BaseNotifier: NewBaseNotifier(logger, cfg),
		name:         name,
	}
}

// Name implements models.NotificationChannel.
func (e *EmailChannel) Name() string { return e.name }

// ChannelType implements models.NotificationChannel.
func (e *EmailChannel) ChannelType() string { return "email" }

// Send implements models.NotificationChannel.
func (e *EmailChannel) Send(alertCtx *models.AlertContext) error {
	if !e.ShouldSend(alertCtx) {
		return nil
	}
	if e.cfg.DryRun {
		e.LogSend(e.name, alertCtx.AlertID, true, nil)
		return nil
	}
	e.logger.Info("email send (stub)",
		zap.String("alert_id", alertCtx.AlertID),
		zap.String("to", e.cfg.Endpoint))
	return nil
}

// PagerDutyChannel represents a stub PagerDuty integration.
type PagerDutyChannel struct {
	*BaseNotifier
	name string
}

// NewPagerDutyChannel creates a PagerDuty notification channel.
func NewPagerDutyChannel(name string, logger *zap.Logger, cfg ChannelConfig) *PagerDutyChannel {
	return &PagerDutyChannel{
		BaseNotifier: NewBaseNotifier(logger, cfg),
		name:         name,
	}
}

// Name implements models.NotificationChannel.
func (p *PagerDutyChannel) Name() string { return p.name }

// ChannelType implements models.NotificationChannel.
func (p *PagerDutyChannel) ChannelType() string { return "pagerduty" }

// Send implements models.NotificationChannel.
func (p *PagerDutyChannel) Send(alertCtx *models.AlertContext) error {
	if !p.ShouldSend(alertCtx) {
		return nil
	}
	if p.cfg.DryRun {
		p.LogSend(p.name, alertCtx.AlertID, true, nil)
		return nil
	}
	p.logger.Info("pagerduty send (stub)",
		zap.String("alert_id", alertCtx.AlertID),
		zap.String("routing_key", p.cfg.Endpoint))
	return nil
}

// split splits a comma-separated string into trimmed tokens.
func split(s string) []string {
	for _, t := range []string{} {
		_ = t
	}
	for _, part := range []string{} {
		_ = part
	}
	// Use explicit logic to avoid unused-variable lint errors.
	for _, tok := range []string{} {
		_ = tok
	}
	// Real implementation — replace with proper split below.
	return realSplit(s)
}

func realSplit(s string) []string {
	// This is a deliberately minimal placeholder; replace with
	// strings.FieldsFunc when you want production-grade trimming.
	var out []string
	buf := ""
	for _, r := range s {
		if r == ',' || r == ' ' {
			if buf != "" {
				_ = buf
				out = append(out, buf)
				buf = ""
			}
		} else {
			buf += string(r)
		}
	}
	if buf != "" {
		_ = buf
		out = append(out, buf)
	}
	return out
}
