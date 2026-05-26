package service

import (
	"context"

	"orion-cmdb-svc-go/internal/models"
	"orion-cmdb-svc-go/internal/otel"
	"orion-cmdb-svc-go/internal/repository"

	"github.com/google/uuid"
)

type CIService struct {
	ciRepo      *repository.CIRepository
	relRepo     *repository.CIRelationRepository
	auditRepo   *repository.CIAuditRepository
}

func NewCIService(
	ciRepo *repository.CIRepository,
	relRepo *repository.CIRelationRepository,
	auditRepo *repository.CIAuditRepository,
) *CIService {
	return &CIService{ciRepo: ciRepo, relRepo: relRepo, auditRepo: auditRepo}
}

func (s *CIService) Create(ctx context.Context, tenantID string, req *models.CreateCIRequest, actor string) (*models.CIItem, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.Create")
	defer span.End()

	if req.Status == "" {
		req.Status = "active"
	}

	item := &models.CIItem{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		CIType:     req.CIType,
		Status:     req.Status,
		Owner:      req.Owner,
		Attributes: req.Attributes,
	}

	if err := s.ciRepo.Create(item); err != nil {
		return nil, err
	}

	// Audit log
	s.auditRepo.Create(&models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     item.ID,
		Action:   "create",
		Actor:    actor,
		NewValue: models.JSONB{"name": item.Name, "ci_type": item.CIType},
	})

	return item, nil
}

func (s *CIService) GetByID(ctx context.Context, id, tenantID string) (*models.CIItem, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.GetByID")
	defer span.End()

	return s.ciRepo.GetByID(id, tenantID)
}

func (s *CIService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.CIItem, int, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.List")
	defer span.End()

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	return s.ciRepo.List(tenantID, q)
}

func (s *CIService) Update(ctx context.Context, tenantID string, id string, req *models.UpdateCIRequest, actor string) (*models.CIItem, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.Update")
	defer span.End()

	item, err := s.ciRepo.GetByID(id, tenantID)
	if err != nil {
		return nil, err
	}

	oldState := models.JSONB{
		"name":       item.Name,
		"ci_type":    item.CIType,
		"status":     item.Status,
		"owner":      item.Owner,
		"attributes": item.Attributes,
	}

	if req.Name != nil {
		item.Name = *req.Name
	}
	if req.CIType != nil {
		item.CIType = *req.CIType
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if req.Owner != nil {
		item.Owner = *req.Owner
	}
	if req.Attributes != nil {
		item.Attributes = *req.Attributes
	}

	if err := s.ciRepo.Update(item); err != nil {
		return nil, err
	}

	s.auditRepo.Create(&models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     item.ID,
		Action:   "update",
		Actor:    actor,
		OldValue: oldState,
		NewValue: models.JSONB{"name": item.Name, "ci_type": item.CIType, "status": item.Status},
	})

	return item, nil
}

func (s *CIService) Delete(ctx context.Context, tenantID, id, actor string) error {
	_, span := otel.Tracer().Start(ctx, "CIService.Delete")
	defer span.End()

	// Delete relations first
	_ = s.relRepo.DeleteByCI(tenantID, id)

	s.auditRepo.Create(&models.CIAuditLog{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		CIID:     id,
		Action:   "delete",
		Actor:    actor,
	})

	return s.ciRepo.Delete(id, tenantID)
}

func (s *CIService) GetTopology(ctx context.Context, tenantID, ciID string) (*models.TopologyNode, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.GetTopology")
	defer span.End()

	item, err := s.ciRepo.GetByID(ciID, tenantID)
	if err != nil {
		return nil, err
	}

	rels, err := s.relRepo.ListByCI(tenantID, ciID)
	if err != nil {
		return nil, err
	}

	var edges []models.TopologyEdge
	for _, r := range rels {
		edges = append(edges, models.TopologyEdge{
			ID:           r.ID,
			TargetCIID:   r.TargetCIID,
			RelationType: r.RelationType,
		})
	}

	return &models.TopologyNode{
		CIItem:    *item,
		Relations: edges,
	}, nil
}

func (s *CIService) CreateRelation(ctx context.Context, tenantID string, req *models.CreateRelationRequest, actor string) (*models.CIRelation, error) {
	_, span := otel.Tracer().Start(ctx, "CIService.CreateRelation")
	defer span.End()

	// Verify source and target exist
	if _, err := s.ciRepo.GetByID(req.SourceCIID, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.ciRepo.GetByID(req.TargetCIID, tenantID); err != nil {
		return nil, err
	}

	rel := &models.CIRelation{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		SourceCIID:   req.SourceCIID,
		TargetCIID:   req.TargetCIID,
		RelationType: req.RelationType,
	}

	if err := s.relRepo.Create(rel); err != nil {
		return nil, err
	}

	return rel, nil
}

func (s *CIService) DeleteRelation(ctx context.Context, tenantID, id string, actor string) error {
	_, span := otel.Tracer().Start(ctx, "CIService.DeleteRelation")
	defer span.End()

	return s.relRepo.Delete(id, tenantID)
}
