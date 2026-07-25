// Package validate implements the second pipeline stage: schema and semantic
// validation of alert events before they enter deduplication and routing.
package validate

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// SeverityRank returns a numeric rank for known severity levels.
var SeverityRank = map[string]int{
	"critical": 3,
	"warning":  2,
	"info":     1,
}

// ValidStatuses lists allowed alert statuses.
var ValidStatuses = map[string]bool{
	"firing":     true,
	"resolved":   true,
	"suppressed": true,
}

// Stage performs validation on an alert payload.
type Stage struct {
	logger        *zap.Logger
	requireSource bool
	maxLabels     int
}

// NewStage creates a validate stage.
func NewStage(logger *zap.Logger) *Stage {
	return &Stage{
		logger:        logger,
		requireSource: true,
		maxLabels:     50,
	}
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "validate"
}

// Process validates the alert context and records validation errors.
func (s *Stage) Process(_ context.Context, alertCtx *models.AlertContext) error {
	if alertCtx.Alert == nil {
		return fmt.Errorf("validate: empty alert payload")
	}

	m := alertCtx.Alert

	// Read fields from the map payload.
	name, _ := m["name"]
	severity, _ := m["severity"]
	status, _ := m["status"]
	sourceID, _ := m["sourceId"]
	labels, _ := m["labels"]

	if name == nil || fmt.Sprint(name) == "" {
		return fmt.Errorf("validate: missing required field name")
	}
	if s.requireSource && (sourceID == nil || fmt.Sprint(sourceID) == "") {
		return fmt.Errorf("validate: missing required field sourceId")
	}
	if statusStr := fmt.Sprint(status); statusStr != "" && !ValidStatuses[statusStr] {
		return fmt.Errorf("validate: unknown status %q", statusStr)
	}
	severityStr := fmt.Sprint(severity)
	if severityStr != "" && SeverityRank[severityStr] == 0 {
		return fmt.Errorf("validate: unknown severity %q", severityStr)
	}
	// Count labels.
	var labelCount int
	switch l := labels.(type) {
	case map[string]string:
		labelCount = len(l)
	case map[string]interface{}:
		labelCount = len(l)
	}
	if labelCount > s.maxLabels {
		return fmt.Errorf("validate: labels exceed max (%d > %d)", labelCount, s.maxLabels)
	}

	// Record validation metadata.
	alertCtx.Enrichments["severityRank"] = SeverityRank[severityStr]
	alertCtx.Enrichments["validatedAt"] = time.Now().UTC().Format(time.RFC3339)

	s.logger.Debug("validate stage complete",
		zap.String("alert_id", alertCtx.AlertID),
		zap.String("severity", severityStr))

	return nil
}
