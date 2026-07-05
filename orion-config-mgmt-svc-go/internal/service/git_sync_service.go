package service

import (
	"context"
	"fmt"
	"time"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/repository"

	"github.com/google/uuid"
)

// GitSyncService manages GitOps configuration synchronization.
type GitSyncService struct {
	repo *repository.Repository
}

func NewGitSyncService(repo *repository.Repository) *GitSyncService {
	return &GitSyncService{repo: repo}
}

func (s *GitSyncService) Create(ctx context.Context, tenantID string, req models.CreateGitSyncRequest) (*models.GitSyncConfig, error) {
	branch := req.Branch
	if branch == "" {
		branch = "main"
	}
	syncInterval := req.SyncIntervalSec
	if syncInterval <= 0 {
		syncInterval = 300 // 5 minutes default
	}
	autoSync := true
	if req.AutoSync != nil {
		autoSync = *req.AutoSync
	}

	g := &models.GitSyncConfig{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            req.Name,
		RepoURL:         req.RepoURL,
		Branch:          branch,
		Path:            req.Path,
		Environment:     req.Environment,
		AutoSync:        autoSync,
		SyncIntervalSec: syncInterval,
		Enabled:         true,
	}
	if err := s.repo.CreateGitSync(ctx, g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *GitSyncService) Get(ctx context.Context, tenantID, id string) (*models.GitSyncConfig, error) {
	return s.repo.GetGitSync(ctx, tenantID, id)
}

func (s *GitSyncService) List(ctx context.Context, tenantID string) ([]models.GitSyncConfig, error) {
	return s.repo.ListGitSyncs(ctx, tenantID)
}

func (s *GitSyncService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteGitSync(ctx, tenantID, id)
}

// SyncNow triggers an immediate sync for a GitSyncConfig.
// In a real implementation this would clone/fetch the repo and apply configs.
func (s *GitSyncService) SyncNow(ctx context.Context, tenantID, id string) (*models.SyncResult, error) {
	g, err := s.repo.GetGitSync(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("git sync config not found: %w", err)
	}

	// Simulate sync: in production, this would:
	// 1. git clone/fetch the repo
	// 2. Parse config files from the path
	// 3. Diff against current configs
	// 4. Apply changes (upsert configs)
	result := &models.SyncResult{
		Success:     true,
		SyncedAt:    time.Now(),
		ItemsSynced: 0,
		ItemsAdded:  0,
		ItemsUpdated: 0,
		ItemsRemoved: 0,
	}

	if err := s.repo.UpdateGitSyncStatus(ctx, tenantID, g.ID, "success"); err != nil {
		return nil, err
	}

	return result, nil
}
