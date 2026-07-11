package repository

import (
	"context"

	"orion-deploy-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// ReleaseNotesRepository handles release notes CRUD.
type ReleaseNotesRepository struct {
	db *database.DB
}

func NewReleaseNotesRepository(db *database.DB) *ReleaseNotesRepository {
	return &ReleaseNotesRepository{db: db}
}

// Create inserts a new release note.
func (r *ReleaseNotesRepository) Create(ctx context.Context, tenantID string, rn *models.ReleaseNote) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO release_notes
			(id, tenant_id, deployment_id, content, generated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
		rn.ID, tenantID, rn.DeploymentID, rn.Content, rn.GeneratedBy,
	)
	return err
}

// GetByDeployment returns the release note for a deployment.
func (r *ReleaseNotesRepository) GetByDeployment(ctx context.Context, tenantID, deploymentID string) (*models.ReleaseNote, error) {
	var rn models.ReleaseNote
	err := r.db.GetContext(ctx, &rn,
		`SELECT * FROM release_notes
		 WHERE tenant_id = $1 AND deployment_id = $2`, tenantID, deploymentID)
	if err != nil {
		return nil, err
	}
	return &rn, nil
}

// Update updates the content of an existing release note.
func (r *ReleaseNotesRepository) Update(ctx context.Context, tenantID, deploymentID, content string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE release_notes SET content = $1, updated_at = NOW()
		 WHERE tenant_id = $2 AND deployment_id = $3`, content, tenantID, deploymentID)
	return err
}

// GetByTenant returns all release notes for a tenant.
func (r *ReleaseNotesRepository) GetByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error) {
	var notes []models.ReleaseNote
	err := r.db.SelectContext(ctx, &notes,
		`SELECT * FROM release_notes
		 WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return notes, err
}

// Delete removes a release note by ID.
func (r *ReleaseNotesRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM release_notes WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	return err
}
