package service

import (
	"context"
	"encoding/json"
	"fmt"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/repository"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// AuditLogService manages pipeline audit log operations.
type AuditLogService struct {
	auditLogRepo *repository.AuditLogRepository
}

func NewAuditLogService(auditLogRepo *repository.AuditLogRepository) *AuditLogService {
	return &AuditLogService{auditLogRepo: auditLogRepo}
}

// Record creates a single audit log entry.
func (s *AuditLogService) Record(ctx context.Context, tenantID string, req models.RecordAuditRequest) (*models.AuditLog, error) {
	ctx, span := tracer.Start(ctx, "AuditLogService.Record",
		trace.WithAttributes(
			attribute.String("tenant.id", tenantID),
			attribute.String("audit.action", req.Action),
			attribute.String("audit.actor", req.Actor),
		))
	defer span.End()

	detailsJSON := "{}"
	if req.Details != nil {
		b, err := json.Marshal(req.Details)
		if err == nil {
			detailsJSON = string(b)
		}
	}

	log := &models.AuditLog{
		TenantID:   tenantID,
		PipelineID: req.PipelineID,
		RunID:      req.RunID,
		Action:     req.Action,
		Actor:      req.Actor,
		Target:     req.Target,
		TargetType: req.TargetType,
		Details:    detailsJSON,
		IPAddress:  req.IPAddress,
		UserAgent:  req.UserAgent,
	}

	if err := s.auditLogRepo.Create(ctx, log); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to record audit log: %w", err)
	}

	span.SetAttributes(attribute.String("audit.log.id", log.ID))
	return log, nil
}

// BatchRecord creates multiple audit log entries.
func (s *AuditLogService) BatchRecord(ctx context.Context, tenantID string, reqs []models.RecordAuditRequest) (int, error) {
	ctx, span := tracer.Start(ctx, "AuditLogService.BatchRecord",
		trace.WithAttributes(attribute.Int("audit.batch.size", len(reqs))))
	defer span.End()

	logs := make([]models.AuditLog, 0, len(reqs))
	for _, r := range reqs {
		detailsJSON := "{}"
		if r.Details != nil {
			b, err := json.Marshal(r.Details)
			if err == nil {
				detailsJSON = string(b)
			}
		}
		logs = append(logs, models.AuditLog{
			TenantID:   tenantID,
			PipelineID: r.PipelineID,
			RunID:      r.RunID,
			Action:     r.Action,
			Actor:      r.Actor,
			Target:     r.Target,
			TargetType: r.TargetType,
			Details:    detailsJSON,
			IPAddress:  r.IPAddress,
			UserAgent:  r.UserAgent,
		})
	}

	if err := s.auditLogRepo.BatchCreate(ctx, logs); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return 0, fmt.Errorf("failed to batch record audit logs: %w", err)
	}

	return len(logs), nil
}

// List returns audit logs matching the given filter.
func (s *AuditLogService) List(ctx context.Context, tenantID string, filter models.AuditLogFilter) ([]models.AuditLog, int, error) {
	ctx, span := tracer.Start(ctx, "AuditLogService.List",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	filter.TenantID = tenantID
	logs, total, err := s.auditLogRepo.List(ctx, filter)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, 0, fmt.Errorf("failed to list audit logs: %w", err)
	}

	// Unmarshal details for each log for clean display
	for i := range logs {
		logs[i].Details = string(mustMarshal(repository.UnmarshalDetails(logs[i].Details)))
	}

	return logs, total, nil
}

// GetTrail returns audit trail with enriched context.
func (s *AuditLogService) GetTrail(ctx context.Context, tenantID, pipelineID, runID string, limit, offset int) ([]models.AuditTrailEntry, int, error) {
	ctx, span := tracer.Start(ctx, "AuditLogService.GetTrail",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	entries, total, err := s.auditLogRepo.GetTrail(ctx, tenantID, pipelineID, runID, limit, offset)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, 0, fmt.Errorf("failed to get audit trail: %w", err)
	}

	return entries, total, nil
}

// Cleanup deletes audit logs older than the specified timestamp.
func (s *AuditLogService) Cleanup(ctx context.Context, tenantID, before string) (int64, error) {
	ctx, span := tracer.Start(ctx, "AuditLogService.Cleanup",
		trace.WithAttributes(
			attribute.String("tenant.id", tenantID),
			attribute.String("audit.before", before),
		))
	defer span.End()

	count, err := s.auditLogRepo.Cleanup(ctx, tenantID, before)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return 0, fmt.Errorf("failed to cleanup audit logs: %w", err)
	}

	span.SetAttributes(attribute.Int64("audit.deleted.count", count))
	return count, nil
}

func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}