package service

import (
	"context"
	"fmt"
	"time"

	"orion-audit-svc-go/internal/models"
	"orion-audit-svc-go/internal/repository"
)

type AuditService struct {
	repo *repository.AuditRepository
}

func NewAuditService(repo *repository.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

// LogEvent records an audit event.
func (s *AuditService) LogEvent(ctx context.Context, tenantID string, req *models.LogEventRequest, actor string) (*models.AuditLog, error) {
	log := &models.AuditLog{
		Actor:      actor,
		Action:     req.Action,
		TargetType: req.TargetType,
		TargetID:   req.TargetID,
		Detail:     models.JSONB(req.Detail),
		RequestID:  req.RequestID,
	}
	if err := s.repo.Create(ctx, tenantID, log); err != nil {
		return nil, fmt.Errorf("failed to log event: %w", err)
	}
	return log, nil
}

// GetLog returns an audit log by ID.
func (s *AuditService) GetLog(ctx context.Context, tenantID, id string) (*models.AuditLog, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListLogs returns paginated audit logs.
func (s *AuditService) ListLogs(ctx context.Context, tenantID string, page, pageSize int, actor, action, targetType, targetID string) ([]models.AuditLog, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListByTenant(ctx, tenantID, page, pageSize, actor, action, targetType, targetID)
}

// ListEvents returns paginated audit events (alias for ListLogs with different params).
func (s *AuditService) ListEvents(ctx context.Context, tenantID string, page, pageSize int, action, kind string) ([]models.AuditLog, int, error) {
	return s.repo.ListByTenant(ctx, tenantID, page, pageSize, "", action, kind, "")
}

// GetEventsByDeployment returns audit logs for a deployment.
func (s *AuditService) GetEventsByDeployment(ctx context.Context, tenantID, deploymentID string) ([]models.AuditLog, error) {
	return s.repo.GetByDeployment(ctx, tenantID, deploymentID)
}

// GetSummary returns aggregate audit metrics.
func (s *AuditService) GetSummary(ctx context.Context, tenantID string) (*models.AuditSummary, error) {
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get audit summary: %w", err)
	}

	byAction, _ := s.repo.CountByAction(ctx, tenantID)

	return &models.AuditSummary{
		TotalAuditLogs: total,
		ByAction:       byAction,
		LastActivity:   time.Now().UTC(),
	}, nil
}

// CreateComplianceReport generates a compliance report.
func (s *AuditService) CreateComplianceReport(ctx context.Context, tenantID, actor string) (*models.ComplianceReport, error) {
	report := &models.ComplianceReport{
		Title:       "Compliance Report",
		Status:      "generated",
		GeneratedBy: actor,
		Summary:     models.JSONB{},
	}
	if err := s.repo.CreateComplianceReport(ctx, tenantID, report); err != nil {
		return nil, fmt.Errorf("failed to create compliance report: %w", err)
	}
	return report, nil
}

// ListComplianceReports returns paginated compliance reports.
func (s *AuditService) ListComplianceReports(ctx context.Context, tenantID string, page, pageSize int) ([]models.ComplianceReport, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListComplianceReports(ctx, tenantID, page, pageSize)
}

// GetComplianceReport returns a report by ID.
func (s *AuditService) GetComplianceReport(ctx context.Context, tenantID, id string) (*models.ComplianceReport, error) {
	return s.repo.GetComplianceReport(ctx, tenantID, id)
}

// DeleteBatch deletes audit logs by IDs.
func (s *AuditService) DeleteBatch(ctx context.Context, tenantID string, ids []string) error {
	return s.repo.DeleteBatch(ctx, tenantID, ids)
}

// Export exports audit logs and returns an export ID.
func (s *AuditService) Export(ctx context.Context, tenantID, actor, actorName string) (string, error) {
	// TODO: Implement actual export logic
	return fmt.Sprintf("export-%d", time.Now().UnixNano()), nil
}
