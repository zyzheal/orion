package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sla-engine/events"
	"orion/platform-svc-go/internal/sla-engine/models"
	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

// ComplianceReport calculates SLA compliance for a tenant over the given period.
func (c *SLACalculator) ComplianceReport(ctx context.Context, tenantID string,
	startDate, endDate time.Time, severity models.SeverityLevel) (*models.SlaComplianceReport, error) {

	trackerQuery := models.TrackerListQuery{Limit: 10000}
	allTrackers, err := c.repo.ListTrackers(ctx, tenantID, trackerQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to list trackers: %w", sentinel.Internal)
	}

	var total, met, violationCount, respBreach, resBreach int
	for _, t := range allTrackers {
		if t.CreatedAt.Before(startDate) || t.CreatedAt.After(endDate) {
			continue
		}
		if severity != "" && !severity.IsValid() {
			continue
		}
		total++

		status := t.Status
		if status == "resolved" {
			met++
		} else if status == "breached" {
			violationCount++
		}
	}

	compliancePct := 0.0
	if total > 0 {
		compliancePct = float64(met) / float64(total) * 100
	}

	report := &models.SlaComplianceReport{
		ReportID:         uuid.New().String(),
		TenantID:         tenantID,
		StartDate:        startDate,
		EndDate:          endDate,
		Severity:         severity,
		TotalEvents:      total,
		MetCount:         met,
		ViolationCount:   violationCount,
		CompliancePct:    compliancePct,
		ResponseBreach:   respBreach,
		ResolutionBreach: resBreach,
		GeneratedAt:      time.Now().UTC(),
	}
	return report, nil
}

// ScanBreaches inspects all open (active/responded) trackers for a tenant and
// marks overdue ones as breached, creating violation records and alert events.
func (c *SLACalculator) ScanBreaches(ctx context.Context, tenantID string) ([]events.ViolationAlert, error) {
	now := time.Now().UTC()
	openQuery := models.TrackerListQuery{Status: "active", Limit: 10000}
	activeTrackers, err := c.repo.ListTrackers(ctx, tenantID, openQuery)
	if err != nil {
		return nil, err
	}
	openQuery2 := models.TrackerListQuery{Status: "responded", Limit: 10000}
	respondedTrackers, err := c.repo.ListTrackers(ctx, tenantID, openQuery2)
	if err != nil {
		return nil, err
	}
	allTrackers := append(activeTrackers, respondedTrackers...)

	var alerts []events.ViolationAlert
	for _, t := range allTrackers {
		if t.ResponseDeadline.Before(now) && t.Status == "active" {
			v, err := c.repo.MarkViolated(ctx, tenantID, t.ID, "response",
				fmt.Sprintf("Response SLA exceeded by %dms", int64(now.Sub(t.ResponseDeadline).Milliseconds())))
			if err != nil {
				c.logger().Warn("marking violation failed", "tracker_id", t.ID, "err", err.Error())
				// tracker may have been marked breached by concurrent scan; skip
				continue
			}
			if v != nil {
				alerts = append(alerts, *events.NewViolationAlert(v, t.TargetID, t.TargetType))
			}
		}
		if t.ResolutionDeadline.Before(now) && (t.Status == "active" || t.Status == "responded") {
			v, err := c.repo.MarkViolated(ctx, tenantID, t.ID, "resolution",
				fmt.Sprintf("Resolution SLA exceeded by %dms", int64(now.Sub(t.ResolutionDeadline).Milliseconds())))
			if err != nil {
				c.logger().Warn("marking violation failed", "tracker_id", t.ID, "err", err.Error())
				continue
			}
			if v != nil {
				alerts = append(alerts, *events.NewViolationAlert(v, t.TargetID, t.TargetType))
			}
		}
	}
	return alerts, nil
}

// GetViolationsByTracker returns all violations for a given tracker.
func (c *SLACalculator) GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error) {
	return c.repo.GetViolationsByTracker(ctx, trackerID)
}

// GetViolationStatistics returns violation counts for a tenant.
func (c *SLACalculator) GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error) {
	return c.repo.GetViolationStatistics(ctx, tenantID)
}

// MarkViolated directly records a violation for an existing tracker (used by handlers).
func (c *SLACalculator) MarkViolated(ctx context.Context, tenantID, trackerID string,
	violationType, details string) (*models.SLAViolation, error) {
	return c.repo.MarkViolated(ctx, tenantID, trackerID, violationType, details)
}

// logger returns a structured logger for SLA operations.
func (c *SLACalculator) logger() Logger {
	return &defaultLogger{}
}

// Logger is a minimal structured logger interface.
type Logger interface {
	Warn(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
}

type defaultLogger struct{}

func (l *defaultLogger) Warn(msg string, keysAndValues ...interface{}) {
	// Default no-op logger; callers can inject a real zap logger via Logger field if desired.
}

func (l *defaultLogger) Error(msg string, keysAndValues ...interface{}) {
}
