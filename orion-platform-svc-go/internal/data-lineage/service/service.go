package service

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/data-lineage/models"
	"orion/platform-svc-go/internal/data-lineage/repository"
)

var (
	ErrNotFound = errors.New("not found")
	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

// --- Lineage ---

func (s *Service) ListLineages(ctx context.Context, tenantID string, status *string) ([]models.Lineage, error) {
	return s.repo.ListLineages(ctx, tenantID, status)
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (*models.Lineage, error) {
	l, err := s.repo.GetLineageByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return l, nil
}

func (s *Service) CreateLineage(ctx context.Context, tenantID string, req *models.CreateLineageRequest) (*models.Lineage, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, ErrBadRequest
	}
	lineage := &models.Lineage{
		TenantID:  tenantID,
		Name:      req.Name,
		Description: req.Description,
	}
	if err := s.repo.CreateLineage(ctx, lineage); err != nil {
		return nil, err
	}
	return lineage, nil
}

func (s *Service) UpdateLineage(ctx context.Context, tenantID, id string, req *models.UpdateLineageRequest) (*models.Lineage, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		status := *req.Status
		if status != "active" && status != "archived" {
			return nil, ErrBadRequest
		}
		updates["status"] = status
	}
	updated, err := s.repo.UpdateLineage(ctx, tenantID, id, updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteLineage(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteLineage(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// --- Node ---

func (s *Service) CreateNode(ctx context.Context, tenantID string, lineageID string, req *models.CreateNodeRequest) (*models.Node, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Type) == "" {
		return nil, ErrBadRequest
	}
	_, err := s.GetLineage(ctx, tenantID, lineageID)
	if err != nil {
		return nil, ErrNotFound
	}
	node := &models.Node{
		LineageID: lineageID,
		Name:      req.Name,
		Type:      req.Type,
		Properties: req.Properties,
	}
	if err := s.repo.CreateNode(ctx, node); err != nil {
		return nil, err
	}
	return node, nil
}

func (s *Service) ListNodes(ctx context.Context, tenantID, lineageID string) ([]models.Node, error) {
	return s.repo.ListNodesByLineage(ctx, tenantID, lineageID)
}

// --- Relationship ---

func (s *Service) CreateRelationship(ctx context.Context, tenantID string, lineageID string, req *models.CreateRelationshipRequest) (*models.Relationship, error) {
	if req == nil || strings.TrimSpace(req.SourceNodeID) == "" || strings.TrimSpace(req.TargetNodeID) == "" {
		return nil, ErrBadRequest
	}
	_, err := s.GetLineage(ctx, tenantID, lineageID)
	if err != nil {
		return nil, ErrNotFound
	}
	rel := &models.Relationship{
		LineageID: lineageID,
		SourceNodeID: req.SourceNodeID,
		TargetNodeID: req.TargetNodeID,
		Type:      req.Type,
		Description: req.Description,
	}
	if err := s.repo.CreateRelationship(ctx, rel); err != nil {
		return nil, err
	}
	return rel, nil
}

func (s *Service) ListRelationships(ctx context.Context, tenantID, lineageID string) ([]models.Relationship, error) {
	return s.repo.ListRelationshipsByLineage(ctx, tenantID, lineageID)
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.LineageStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
