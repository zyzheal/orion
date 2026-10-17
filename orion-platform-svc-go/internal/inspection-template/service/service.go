package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inspection-template/models"
	"orion/platform-svc-go/internal/inspection-template/repository"
	"orion/platform-svc-go/internal/eventpublisher"
	"orion/platform-svc-go/internal/auditlogger"
	baserepo "orion/platform-svc-go/internal/repository"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
	events eventpublisher.EventPublisher
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

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateTemplateRequest) (*models.InspectionTemplate, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Category == "" {
		req.Category = "system"
	}
	if req.TargetType == "" {
		req.TargetType = "host"
	}
	if req.CreatedBy == "" {
		req.CreatedBy = "system"
	}
	if req.Rules == nil {
		req.Rules = []models.Rule{}
	}

	now := time.Now().UTC()
	template := &models.InspectionTemplate{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		Description: req.Description,
		Category:   req.Category,
		TargetType: req.TargetType,
		Rules:      req.Rules,
		Enabled:    req.Enabled,
		Version:    1,
		CreatedBy:  req.CreatedBy,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.repo.Create(ctx, template); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	s.logger.Info("inspection template created", zap.String("id", template.ID), zap.String("name", template.Name))
	if s.events != nil {
		_ = s.events.Publish(ctx, "inspection.template.created", tenantID, map[string]any{"id": template.ID, "name": template.Name})
	}
	if s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "create", TenantID: tenantID, ResourceType: "inspection.template", ResourceID: template.ID, Details: map[string]any{"name": template.Name}})
	}
	return template, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.InspectionTemplate, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q *baserepo.ListQuery) ([]models.InspectionTemplate, int, error) {
	if q == nil {
		q = baserepo.NewListQuery()
	}
	q.Normalize()
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest, expectedVersion int) (*models.InspectionTemplate, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.TargetType != nil {
		updates["target_type"] = *req.TargetType
	}
	if req.Rules != nil {
		updates["rules"] = req.Rules
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	var result *models.InspectionTemplate
	if err := s.repo.WithTx(ctx, func(rtx *repository.Repository) error {
		if err := rtx.Update(ctx, tenantID, id, updates, expectedVersion); err != nil {
			return err
		}
		item, err := rtx.GetByID(ctx, tenantID, id)
		if err != nil {
			return err
		}
		result = item
		if expectedVersion > 0 && item.Version == expectedVersion {
			return baserepo.ErrVersionMismatch
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "update", TenantID: tenantID, ResourceType: "inspection.template", ResourceID: id, Details: map[string]any{"fields": updates}})
	}
	return result, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok && s.events != nil {
		_ = s.events.Publish(ctx, "inspection.template.deleted", tenantID, map[string]any{"id": id})
	}
	if ok && s.auditor != nil {
		_ = s.auditor.Log(ctx, auditlogger.AuditEntry{Action: "delete", TenantID: tenantID, ResourceType: "inspection.template", ResourceID: id})
	}
	return ok, nil
}
