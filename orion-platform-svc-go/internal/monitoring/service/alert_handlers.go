package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
)

// --- Alerts ---------------------------------------------------------

func (s *Service) GetAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	return s.repo.ListAlerts(ctx, tenantID, limit, offset)
}

func (s *Service) GetActiveAlerts(ctx context.Context, tenantID string, limit, offset int) ([]models.Alert, error) {
	return s.repo.ListActiveAlerts(ctx, tenantID, limit, offset)
}

func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	return s.repo.GetAlert(ctx, tenantID, id)
}

func (s *Service) AcknowledgeAlert(ctx context.Context, tenantID, id, ackBy string, comment string) (*models.Alert, error) {
	if err := s.repo.AcknowledgeAlert(ctx, tenantID, id, ackBy, comment); err != nil {
		return nil, err
	}
	return s.repo.GetAlert(ctx, tenantID, id)
}

func (s *Service) ResolveAlert(ctx context.Context, tenantID, id string, comment string) (*models.Alert, error) {
	if err := s.repo.ResolveAlert(ctx, tenantID, id, comment); err != nil {
		return nil, err
	}
	return s.repo.GetAlert(ctx, tenantID, id)
}

// EscalateAlert escalates a firing or acknowledged alert.
//
// Escalation steps:
//  1. Upgrade severity (info -> warning -> critical).
//  2. Reset the alert to "firing" so it re-notifies the on-call.
//  3. Persist a notification record carrying the escalation comment for audit.
//
// Returns the updated alert.
func (s *Service) EscalateAlert(ctx context.Context, tenantID, id string, comment string) (*models.Alert, error) {
	alert, err := s.repo.GetAlert(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if alert.Status == "resolved" {
		return nil, fmt.Errorf("cannot escalate a resolved alert: %s", id)
	}

	// Upgrade severity to the next level.
	newSeverity := escalateSeverity(alert.Severity)

	// Atomically bump severity and re-fire the alert.
	if err := s.repo.UpdateAlertStatus(ctx, tenantID, id, newSeverity, "firing"); err != nil {
		return nil, fmt.Errorf("escalate alert: %w", err)
	}

	// Persist escalation comment as a notification record for the audit trail.
	now := time.Now().UTC()
	nr := &models.NotificationRecord{
		TenantID:  tenantID,
		AlertID:   id,
		Status:    "sent",
		Message:   fmt.Sprintf("escalated to %s: %s", newSeverity, comment),
		SentAt:    now,
		CreatedAt: now,
	}
	if err := s.repo.CreateNotificationRecord(ctx, nr); err != nil {
		// Non-fatal: escalation succeeds even if audit record fails.
		_ = err
	}

	return s.repo.GetAlert(ctx, tenantID, id)
}
