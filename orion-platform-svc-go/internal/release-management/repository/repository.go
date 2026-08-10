package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/release-management/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
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
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, req *models.CreateReleaseRequest) (*models.Release, error) {
	now := time.Now().UTC()
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
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO releases (id, tenant_id, name, version, description, status, artifact_id, pipeline_id, release_notes, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :version, :description, :status, :artifact_id, :pipeline_id, :release_notes, :created_at, :updated_at)`,
		release)
	return release, err
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.Release, error) {
	var release models.Release
	err := r.db.GetContext(ctx, &release, `SELECT * FROM releases WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &release, err
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListReleasesQuery) (*models.ReleaseListResponse, error) {
	var total int
	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM releases WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	var items []models.Release
	offset := (page - 1) * pageSize

	switch {
	case q.Status != nil && q.PipelineID != "":
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM releases WHERE tenant_id=$1 AND status=$2 AND pipeline_id=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`, tenantID, string(*q.Status), q.PipelineID, pageSize, offset)
	case q.Status != nil:
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM releases WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, string(*q.Status), pageSize, offset)
	case q.PipelineID != "":
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM releases WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, q.PipelineID, pageSize, offset)
	default:
		err = r.db.SelectContext(ctx, &items, `SELECT * FROM releases WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, pageSize, offset)
	}
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.Release{}
	}

	return &models.ReleaseListResponse{
		Items:    items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateReleaseRequest) (*models.Release, error) {
	sets, args := []string{}, []interface{}{}
	i := 1

	if req.Name != nil {
		sets = append(sets, fmt.Sprintf("name=$%d", i))
		args = append(args, *req.Name)
		i++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description=$%d", i))
		args = append(args, *req.Description)
		i++
	}
	if req.ReleaseNotes != nil {
		sets = append(sets, fmt.Sprintf("release_notes=$%d", i))
		args = append(args, *req.ReleaseNotes)
		i++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status=$%d", i))
		args = append(args, string(*req.Status))
		i++
	}
	if len(sets) == 0 {
		return r.Get(ctx, tenantID, id)
	}

	args = append(args, time.Now().UTC(), id, tenantID)
	query := fmt.Sprintf("UPDATE releases SET %s, updated_at=$%d WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(sets, ", "), i, i+1, i+2)

	var release models.Release
	err := r.db.GetContext(ctx, &release, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &release, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM releases WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) Approve(ctx context.Context, releaseID, approvedBy, comment string) (*models.ReleaseApproval, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE releases SET status=$1, approved_by=$2, updated_at=$3 WHERE id=$4`,
		string(models.ReleaseStatusApproved), approvedBy, time.Now().UTC(), releaseID)
	if err != nil {
		return nil, err
	}
	return &models.ReleaseApproval{
		ID:         uuid.New().String(),
		ReleaseID:  releaseID,
		ApprovedBy: approvedBy,
		Comment:    comment,
		CreatedAt:  time.Now().UTC(),
	}, nil
}

func (r *Repository) RecordRollback(ctx context.Context, releaseID, reason, performedBy string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE releases SET status=$1, rollback_id=$2, deployed_by=$3, updated_at=$4 WHERE id=$5`,
		string(models.ReleaseStatusRolledBack), uuid.New().String(), performedBy, time.Now().UTC(), releaseID)
	return err
}