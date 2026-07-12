package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/project-member/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetProjectMembers fetches all members for a given project within a tenant.
func (r *Repository) GetProjectMembers(ctx context.Context, tenantID, projectID string) ([]models.ProjectMember, error) {
	var members []models.ProjectMember
	err := r.db.SelectContext(ctx, &members,
		`SELECT id, tenant_id, project_id, user_id, role, created_at, updated_at FROM project_members WHERE tenant_id = $1 AND project_id = $2 ORDER BY created_at DESC`,
		tenantID, projectID)
	if err != nil {
		return nil, err
	}
	return members, nil
}

// AddProjectMember inserts a member record. Returns (created bool, err).
// created = true means the row was inserted; false means a relationship already existed.
func (r *Repository) AddProjectMember(ctx context.Context, tenantID, projectID, userID, role string) (bool, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO project_members (id, tenant_id, project_id, user_id, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, tenantID, projectID, userID, role, now, now)
	if err != nil {
		// Treat duplicate-key / uniqueness violation as "already a member"
		if isDuplicateError(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to add project member: %w", err)
	}
	return true, nil
}

// IsProjectMember checks whether a user is a member of a project.
func (r *Repository) IsProjectMember(ctx context.Context, tenantID, projectID, userID string) (bool, error) {
	var count sql.NullInt64
	err := r.db.QueryRowxContext(ctx,
		`SELECT COUNT(*) FROM project_members WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3`,
		tenantID, projectID, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count.Valid && count.Int64 > 0, nil
}

// RemoveProjectMember deletes the member relationship.
func (r *Repository) RemoveProjectMember(ctx context.Context, tenantID, projectID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM project_members WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3`,
		tenantID, projectID, userID)
	return err
}

// isDuplicateError detects duplicate-key / uniqueness violation errors.
func isDuplicateError(err error) bool {
	msg := err.Error()
	return contains(msg, "unique") || contains(msg, "duplicate") || contains(msg, "conflict")
}

func contains(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
