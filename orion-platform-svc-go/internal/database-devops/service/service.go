package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/database-devops/models"
	"orion/platform-svc-go/internal/database-devops/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// repoInterface is the subset of repository.Repository the service calls. Keeping
// it package-private means only a test inside this package can substitute a fake
// for it; production always gets the sqlx-backed Repository, so the shape of the
// call graph is unchanged.
type repoInterface interface {
	Get(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error)
	List(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error)
	Create(ctx context.Context, item *models.DatabaseDevopsItem) error
	Update(ctx context.Context, item *models.DatabaseDevopsItem) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
	UpdateResult(ctx context.Context, tenantID, id, result string) error
	Delete(ctx context.Context, tenantID, id string) error
}

// Service implements database DevOps business logic. Data source management was
// removed in ARCH-0.11b — the service now only handles backup/restore
// operations; data source CRUD lives in internal/datasource.
type Service struct {
	repo repoInterface
}

// NewService creates a new database DevOps service.
func NewService(db *sqlx.DB) *Service {
	return &Service{repo: repository.NewRepository(db)}
}

// newServiceWithRepo wires a service against an explicit repository. It exists so
// the status-lifecycle and tenant-scoping tests can drive the service against an
// in-memory fake instead of a live sqlx.DB.
func newServiceWithRepo(repo repoInterface) *Service {
	return &Service{repo: repo}
}

// ListOperations returns all operations for a tenant
func (s *Service) ListOperations(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error) {
	return s.repo.List(ctx, tenantID)
}

// GetOperation returns a single operation by ID
func (s *Service) GetOperation(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error) {
	return s.repo.Get(ctx, tenantID, id)
}

// CreateOperation creates a new database DevOps operation
func (s *Service) CreateOperation(ctx context.Context, tenantID string, req *models.CreateDatabaseDevopsRequest) (*models.DatabaseDevopsItem, error) {
	item := &models.DatabaseDevopsItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Status:      "pending",
		DatabaseID:  req.DatabaseID,
		Config:      req.Config,
		Enabled:     req.Enabled,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create operation: %w", err)
	}
	return item, nil
}

// UpdateOperation updates an existing operation
func (s *Service) UpdateOperation(ctx context.Context, tenantID, id string, req *models.UpdateDatabaseDevopsRequest) (*models.DatabaseDevopsItem, error) {
	item, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get operation: %w", err)
	}
	if item == nil {
		return nil, fmt.Errorf("operation not found")
	}

	if req.Name != nil {
		item.Name = *req.Name
	}
	if req.Description != nil {
		item.Description = *req.Description
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if req.Config != nil {
		item.Config = *req.Config
	}
	if req.Result != nil {
		item.Result = *req.Result
	}
	if req.Enabled != nil {
		item.Enabled = *req.Enabled
	}
	item.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, item); err != nil {
		return nil, fmt.Errorf("update operation: %w", err)
	}
	return item, nil
}

// DeleteOperation deletes an operation
func (s *Service) DeleteOperation(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ExecuteBackup executes a backup operation
func (s *Service) ExecuteBackup(ctx context.Context, tenantID, opID string) (*models.BackupResult, error) {
	op, err := s.repo.Get(ctx, tenantID, opID)
	if err != nil || op == nil {
		return nil, fmt.Errorf("operation not found")
	}

	// Parse backup config
	var cfg models.BackupConfig
	if op.Config != "" {
		if err := json.Unmarshal([]byte(op.Config), &cfg); err != nil {
			return nil, fmt.Errorf("parse backup config: %w", err)
		}
	}

	// Update status to running
	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "running")

	startedAt := time.Now().UTC()

	// TODO: Execute actual backup based on cfg.BackupType
	// For now, return a placeholder result
	result := &models.BackupResult{
		BackupID:   uuid.New().String(),
		Status:     "completed",
		StartedAt:  startedAt.Format(time.RFC3339),
		FinishedAt: time.Now().UTC().Format(time.RFC3339),
		Message:    fmt.Sprintf("Backup %s for database %s", cfg.BackupType, op.DatabaseID),
	}

	// Store result
	resultJSON, _ := json.Marshal(result)
	_ = s.repo.UpdateResult(ctx, tenantID, opID, string(resultJSON))
	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "completed")

	return result, nil
}

// ExecuteRestore executes a restore operation
func (s *Service) ExecuteRestore(ctx context.Context, tenantID, opID string) error {
	op, err := s.repo.Get(ctx, tenantID, opID)
	if err != nil || op == nil {
		return fmt.Errorf("operation not found")
	}

	var cfg models.RestoreConfig
	if op.Config != "" {
		if err := json.Unmarshal([]byte(op.Config), &cfg); err != nil {
			return fmt.Errorf("parse restore config: %w", err)
		}
	}

	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "running")

	// TODO: Execute actual restore based on cfg
	// For now, mark as completed
	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "completed")

	return nil
}
