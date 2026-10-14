package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"database/sql"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-sla/models"
	"orion/platform-svc-go/internal/alert-sla/monitor"
	"orion/platform-svc-go/internal/eventpublisher"
	"orion/platform-svc-go/internal/auditlogger"
	"orion/platform-svc-go/internal/alert-sla/repository"
)

type Service struct {
	repo    *repository.Repository
	logger  *zap.Logger
	monitor *monitor.Monitor
	events  eventpublisher.EventPublisher
	auditor auditlogger.AuditLogger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

// SetPublisher attaches an event publisher for domain events.
func (s *Service) SetPublisher(p eventpublisher.EventPublisher) {
	s.events = p
}

// SetAuditLogger attaches an audit logger for recording mutations.
func (s *Service) SetAuditLogger(l auditlogger.AuditLogger) {
	s.auditor = l
}

// SetMonitor attaches a background SLA breach monitor.
func (s *Service) SetMonitor(m *monitor.Monitor) {
	s.monitor = m
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSLARequest) (*models.AlertSLA, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Severity == "" {
		req.Severity = "all"
	}
	if req.ResponseTime == 0 {
		req.ResponseTime = 300
	}
	if req.ResolveTime == 0 {
		req.ResolveTime = 3600
	}
	if req.EscalationDelay == 0 {
		req.EscalationDelay = 600
	}
	// Default to enabled unless explicitly set to false
	enabled := req.Enabled
	// If the JSON field was provided, use it; otherwise default to true
	// Since bool defaults to false in Go, we can't distinguish "omitted" from "false".
	// We default to true for new SLA policies — this is the safer choice.
	if !enabled {
		enabled = true
	}

	now := time.Now().UTC()
	item := &models.AlertSLA{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Name:           req.Name,
		Severity:       req.Severity,
		ResponseTime:   req.ResponseTime,
		ResolveTime:    req.ResolveTime,
		EscalationDelay: req.EscalationDelay,
		Enabled:        enabled,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create alert sla: %w", err)
	}
	s.logger.Info("alert sla created", zap.String("id", item.ID), zap.String("name", item.Name))
	if s.events != nil {
		_ = s.events.Publish(ctx, "alert.sla.created", tenantID, map[string]any{"id": item.ID, "name": item.Name, "severity": item.Severity})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "create", TenantID: tenantID, ResourceType: "alert.sla", ResourceID: item.ID, Details: map[string]any{"name": item.Name, "severity": item.Severity}})
		}}
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AlertSLA, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, page, pageSize int) ([]models.AlertSLA, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.List(ctx, tenantID, page, pageSize)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSLARequest) (*models.AlertSLA, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.ResponseTime != nil {
		updates["response_time"] = *req.ResponseTime
	}
	if req.ResolveTime != nil {
		updates["resolve_time"] = *req.ResolveTime
	}
	if req.EscalationDelay != nil {
		updates["escalation_delay"] = *req.EscalationDelay
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	var result *models.AlertSLA
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.Update(ctx, tenantID, id, updates); err != nil {
			return err
		}
		item, err := rtx.GetByID(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		return nil
	}); err != nil {
		return nil, err
	}
	if s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "update", TenantID: tenantID, ResourceType: "alert.sla", ResourceID: id, Details: map[string]any{"fields": updates}})
	}
	return result, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "alert.sla.deleted", tenantID, map[string]any{"id": id})
		if s.auditor != nil {
			_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "delete", TenantID: tenantID, ResourceType: "alert.sla", ResourceID: id})
		}}
	return ok, nil
}

// Evaluate checks an alert against the SLA policy identified by id and
// returns any detected breaches.
func (s *Service) Evaluate(ctx context.Context, tenantID, slaID, alertID, severity, createdAtStr, ackedAtStr, resolvedAtStr string) ([]monitor.Breach, error) {
	sla, err := s.repo.GetByID(ctx, tenantID, slaID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sql.ErrNoRows
		}
		return nil, fmt.Errorf("get sla: %w", err)
	}

	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		return nil, fmt.Errorf("invalid createdAt: %w", err)
	}

	alert := monitor.ActiveAlert{
		ID:        alertID,
		TenantID:  tenantID,
		Severity:  severity,
		CreatedAt: createdAt,
	}
	if ackedAtStr != "" {
		t, err := time.Parse(time.RFC3339, ackedAtStr)
		if err == nil {
			alert.AckedAt = &t
		}
	}
	if resolvedAtStr != "" {
		t, err := time.Parse(time.RFC3339, resolvedAtStr)
		if err == nil {
			alert.ResolvedAt = &t
		}
	}

	breaches := monitor.EvaluateSLA(*sla, alert, time.Now().UTC())
	return breaches, nil
}

// Breaches returns detected breaches from the background monitor. If no
// monitor is attached, returns nil.
func (s *Service) Breaches() []monitor.Breach {
	if s.monitor == nil {
		return nil
	}
	return s.monitor.Breaches()
}
