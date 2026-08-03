package repository

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/release-management/models"
)

type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req *models.CreateReleaseRequest) (*models.Release, error)
	Get(ctx context.Context, tenantID, id string) (*models.Release, error)
	List(ctx context.Context, tenantID string, q models.ListReleasesQuery) (*models.ReleaseListResponse, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateReleaseRequest) (*models.Release, error)
	Delete(ctx context.Context, tenantID, id string) error
	Approve(ctx context.Context, releaseID, approvedBy, comment string) (*models.ReleaseApproval, error)
	RecordRollback(ctx context.Context, releaseID, reason, performedBy string) error
}

type Repository struct {
	mu    sync.RWMutex
	store map[string]*models.Release
}

func NewRepository() *Repository {
	return &Repository{
		store: make(map[string]*models.Release),
	}
}

func (r *Repository) Create(ctx context.Context, tenantID string, req *models.CreateReleaseRequest) (*models.Release, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	release := &models.Release{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Version:      req.Version,
		Description:  req.Description,
		Status:       models.ReleaseStatusDraft,
		ArtifactID:   req.ArtifactID,
		PipelineID:   req.PipelineID,
		ReleaseNotes: req.ReleaseNotes,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	r.store[release.ID] = release
	return release, nil
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.Release, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	release, ok := r.store[id]
	if !ok || release.TenantID != tenantID {
		return nil, fmt.Errorf("release not found: %s", id)
	}
	return release, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListReleasesQuery) (*models.ReleaseListResponse, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var items []models.Release
	for _, release := range r.store {
		if release.TenantID != tenantID {
			continue
		}
		if q.Status != nil && release.Status != *q.Status {
			continue
		}
		if q.PipelineID != "" && release.PipelineID != q.PipelineID {
			continue
		}
		items = append(items, *release)
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	if start > len(items) {
		start = len(items)
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}

	return &models.ReleaseListResponse{
		Items:    items[start:end],
		Total:    len(items),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateReleaseRequest) (*models.Release, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	release, ok := r.store[id]
	if !ok || release.TenantID != tenantID {
		return nil, fmt.Errorf("release not found: %s", id)
	}

	if req.Name != nil {
		release.Name = *req.Name
	}
	if req.Description != nil {
		release.Description = *req.Description
	}
	if req.ReleaseNotes != nil {
		release.ReleaseNotes = *req.ReleaseNotes
	}
	if req.Status != nil {
		release.Status = *req.Status
	}
	release.UpdatedAt = time.Now()
	return release, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	release, ok := r.store[id]
	if !ok || release.TenantID != tenantID {
		return fmt.Errorf("release not found: %s", id)
	}
	delete(r.store, id)
	return nil
}

func (r *Repository) Approve(ctx context.Context, releaseID, approvedBy, comment string) (*models.ReleaseApproval, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	release, ok := r.store[releaseID]
	if !ok {
		return nil, fmt.Errorf("release not found: %s", releaseID)
	}

	release.Status = models.ReleaseStatusApproved
	release.ApprovedBy = approvedBy
	release.UpdatedAt = time.Now()

	return &models.ReleaseApproval{
		ID:         uuid.New().String(),
		ReleaseID:  releaseID,
		ApprovedBy: approvedBy,
		Comment:    comment,
		CreatedAt:  time.Now(),
	}, nil
}

func (r *Repository) RecordRollback(ctx context.Context, releaseID, reason, performedBy string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	release, ok := r.store[releaseID]
	if !ok {
		return fmt.Errorf("release not found: %s", releaseID)
	}

	release.Status = models.ReleaseStatusRolledBack
	release.RollbackID = uuid.New().String()
	release.UpdatedAt = time.Now()
	return nil
}