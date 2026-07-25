// Package receive implements the first pipeline stage: accepting raw alert
// payloads from registered AlertSource adapters and normalizing them into an
// AlertContext for downstream processing.
package receive

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Stage parses raw payloads via a registry of AlertSource adapters.
type Stage struct {
	logger  *zap.Logger
	sources map[string]models.AlertSource // keyed by name
}

// NewStage creates a receive stage with the given logger.
func NewStage(logger *zap.Logger) *Stage {
	return &Stage{
		logger:  logger,
		sources: make(map[string]models.AlertSource),
	}
}

// RegisterSource adds a source adapter.
func (s *Stage) RegisterSource(src models.AlertSource) {
	s.sources[src.Name()] = src
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "receive"
}

// ParsePayload is the external entry point: given raw bytes, finds a source
// that claims the content type, parses, and returns a ready AlertContext.
func (s *Stage) ParsePayload(payload []byte, contentType string) (*models.AlertContext, error) {
	src, err := s.findSource(contentType)
	if err != nil {
		return nil, err
	}
	e, err := src.Parse(payload)
	if err != nil {
		return nil, fmt.Errorf("%s parse: %w", src.Name(), err)
	}
	// Serialize AlertEvent into the map-backed AlertContext so downstream
	// stages (which only know map[string]interface{}) can inspect it.
	return models.NewAlertContext(
		e.TenantID,
		e.ID,
		e.SourceType,
		map[string]interface{}{
			"alert":         e,
			"name":          e.Name,
			"severity":      e.Severity,
			"status":        e.Status,
			"fingerprint":   e.Fingerprint,
			"sourceType":    e.SourceType,
			"sourceId":      e.SourceID,
			"sourceName":    e.SourceName,
			"labels":        e.Labels,
			"annotations":   e.Annotations,
			"value":         e.Value,
			"threshold":     e.Threshold,
			"metric":        e.Metric,
			"receivedAt":    time.Now().UTC(),
		},
	), nil
}

// Process normalizes the payload already placed in AlertContext.Alert.
func (s *Stage) Process(_ context.Context, alertCtx *models.AlertContext) error {
	if alertCtx.Alert == nil {
		return fmt.Errorf("receive: no alert payload in context")
	}
	now := time.Now().UTC()
	alertCtx.Enrichments["receivedAt"] = now.Format(time.RFC3339)

	// Pull source info from the payload map.
	if src, ok := alertCtx.Alert["sourceType"]; ok {
		alertCtx.Enrichments["source"] = fmt.Sprint(src)
	}

	s.logger.Debug("receive stage complete",
		zap.String("alert_id", alertCtx.AlertID),
		zap.String("tenant", alertCtx.TenantID),
		zap.String("source", alertCtx.Source))
	return nil
}

func (s *Stage) findSource(contentType string) (models.AlertSource, error) {
	for _, src := range s.sources {
		if src.Supports(contentType) {
			return src, nil
		}
	}
	for _, src := range s.sources {
		if src.Supports("application/json") {
			return src, nil
		}
	}
	return nil, fmt.Errorf("no alert source registered for content type %q", contentType)
}
