package service

import (
	"context"

	"orion/platform-svc-go/internal/notification/chatops/models"
	"orion/platform-svc-go/internal/notification/chatops/repository"

	"github.com/google/uuid"
)

// AuditService manages audit logging for all ChatOps operations.
type AuditService struct {
	repo *repository.Repository
}

func NewAuditService(repo *repository.Repository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) Log(ctx context.Context, tenantID, traceID, actor, action, result string, contextData map[string]interface{}) error {
	log := &models.ChatOpsAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		TraceID:  traceID,
		Actor:    models.JSONB{"user_id": actor},
		Action:   models.JSONB{"command": action},
		Result:   result,
	}
	if contextData != nil {
		log.Context = models.JSONB(contextData)
	}
	return s.repo.CreateAuditLog(ctx, log)
}

func (s *AuditService) Create(ctx context.Context, tenantID string, req models.CreateAuditLogRequest) (*models.ChatOpsAuditLog, error) {
	log := &models.ChatOpsAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		TraceID:  req.TraceID,
		Actor:    req.Actor,
		Action:   req.Action,
		Result:   req.Result,
		Context:  req.Context,
	}
	if err := s.repo.CreateAuditLog(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

func (s *AuditService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatOpsAuditLog, error) {
	return s.repo.ListAuditLogs(ctx, tenantID, offset, limit)
}

func (s *AuditService) ListByTraceID(ctx context.Context, tenantID, traceID string) ([]models.ChatOpsAuditLog, error) {
	return s.repo.ListAuditLogsByTraceID(ctx, tenantID, traceID)
}

func (s *AuditService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountAuditLogs(ctx, tenantID)
}

func (s *AuditService) CountByResult(ctx context.Context, tenantID, result string) (int, error) {
	return s.repo.CountAuditLogsByResult(ctx, tenantID, result)
}
