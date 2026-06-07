package service

import (
	"context"
	"fmt"

	"orion/pipeline-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RBACService manages pipeline role-based access control
type RBACService struct {
	db *sqlx.DB
}

func NewRBACService(db *sqlx.DB) *RBACService {
	return &RBACService{db: db}
}

// Grant grants a role to a user on a pipeline
func (s *RBACService) Grant(ctx context.Context, tenantID, pipelineID, userID, role string) error {
	if !isValidRole(role) {
		return fmt.Errorf("invalid role: %s", role)
	}

	query := `INSERT INTO pipeline_rbac (id, pipeline_id, tenant_id, user_id, role)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (pipeline_id, user_id) DO UPDATE SET role = $5`
	_, err := s.db.ExecContext(ctx, query, uuid.New().String(), pipelineID, tenantID, userID, role)
	return err
}

// Revoke removes a user's access to a pipeline
func (s *RBACService) Revoke(ctx context.Context, pipelineID, userID string) error {
	_, err := s.db.ExecContext(ctx,
		"DELETE FROM pipeline_rbac WHERE pipeline_id = $1 AND user_id = $2", pipelineID, userID)
	return err
}

// List returns all RBAC entries for a pipeline
func (s *RBACService) List(ctx context.Context, pipelineID string) ([]models.PipelineRBAC, error) {
	var entries []models.PipelineRBAC
	err := s.db.SelectContext(ctx, &entries,
		"SELECT * FROM pipeline_rbac WHERE pipeline_id = $1 ORDER BY created_at DESC", pipelineID)
	return entries, err
}

// Check checks if a user has a specific role or higher on a pipeline
func (s *RBACService) Check(ctx context.Context, pipelineID, userID, requiredRole string) (bool, error) {
	var role string
	err := s.db.GetContext(ctx, &role,
		"SELECT role FROM pipeline_rbac WHERE pipeline_id = $1 AND user_id = $2", pipelineID, userID)
	if err != nil {
		return false, nil // No entry means no access
	}
	return roleLevel(role) >= roleLevel(requiredRole), nil
}

// GetUserRole returns a user's role on a pipeline
func (s *RBACService) GetUserRole(ctx context.Context, pipelineID, userID string) (string, error) {
	var role string
	err := s.db.GetContext(ctx, &role,
		"SELECT role FROM pipeline_rbac WHERE pipeline_id = $1 AND user_id = $2", pipelineID, userID)
	if err != nil {
		return "", nil
	}
	return role, nil
}

func isValidRole(role string) bool {
	switch role {
	case models.RoleViewer, models.RoleEditor, models.RoleExecutor, models.RoleAdmin:
		return true
	}
	return false
}

func roleLevel(role string) int {
	switch role {
	case models.RoleViewer:
		return 1
	case models.RoleEditor:
		return 2
	case models.RoleExecutor:
		return 3
	case models.RoleAdmin:
		return 4
	default:
		return 0
	}
}
