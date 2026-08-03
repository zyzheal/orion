package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/release-management/models"
	"orion/platform-svc-go/internal/release-management/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateReleaseRequest) (*models.Release, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Version == "" {
		return nil, fmt.Errorf("version is required")
	}
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Release, error) {
	return s.repo.Get(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListReleasesQuery) (*models.ReleaseListResponse, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateReleaseRequest) (*models.Release, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Approve(ctx context.Context, tenantID, id, approvedBy, comment string) (*models.ReleaseApproval, error) {
	release, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if release.Status != models.ReleaseStatusDraft {
		return nil, fmt.Errorf("release %s is not in draft status", id)
	}
	return s.repo.Approve(ctx, id, approvedBy, comment)
}

func (s *Service) Deploy(ctx context.Context, tenantID, id, deployedBy string) (*models.Release, error) {
	release, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if release.Status != models.ReleaseStatusApproved {
		return nil, fmt.Errorf("release %s is not approved", id)
	}
	_ = time.Now()
	status := models.ReleaseStatusDeployed
	return s.repo.Update(ctx, tenantID, id, &models.UpdateReleaseRequest{
		Status: &status,
	})
}

func (s *Service) Rollback(ctx context.Context, tenantID, id, reason, performedBy string) (*models.Release, error) {
	release, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if release.Status != models.ReleaseStatusDeployed {
		return nil, fmt.Errorf("release %s is not deployed", id)
	}
	if err := s.repo.RecordRollback(ctx, id, reason, performedBy); err != nil {
		return nil, err
	}
	return s.repo.Get(ctx, tenantID, id)
}