package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/artifact-version/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository is the sqlx-backed persistence layer for artifact-version.
//
// All methods scope writes by tenant_id so cross-tenant leakage is impossible.
// Deletes are soft (sets deleted_at) to preserve audit history.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// recordRow is the DB-facing shape. JSONB columns are scanned as []byte by
// sqlx+pgx, so we unmarshal them into a map before returning models.Record.
type recordRow struct {
	ID        string     `db:"id"`
	TenantID  string     `db:"tenant_id"`
	Name      string     `db:"name"`
	Status    string     `db:"status"`
	Metadata  []byte     `db:"metadata"`
	CreatedAt time.Time  `db:"created_at"`
	UpdatedAt time.Time  `db:"updated_at"`
	DeletedAt *time.Time `db:"deleted_at"`
}

func (r recordRow) toModel() *models.Record {
	out := &models.Record{
		ID:        r.ID,
		TenantID:  r.TenantID,
		Name:      r.Name,
		Status:    r.Status,
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
		DeletedAt: r.DeletedAt,
	}
	if len(r.Metadata) > 0 {
		_ = json.Unmarshal(r.Metadata, &out.Metadata)
	}
	return out
}

// ---- Records CRUD ----

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var rows []recordRow
	err := r.db.SelectContext(ctx, &rows,
		`SELECT * FROM artifact_version_records
		 WHERE tenant_id=$1 AND deleted_at IS NULL
		 ORDER BY created_at DESC`,
		tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]models.Record, len(rows))
	for i, row := range rows {
		out[i] = *row.toModel()
	}
	return out, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var row recordRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM artifact_version_records
		 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return row.toModel(), nil
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	id := uuid.New().String()
	status := req.Status
	if status == "" {
		status = models.StatusActive
	}
	now := time.Now().UTC()
	meta, err := marshalMeta(req.Config)
	if err != nil {
		return nil, err
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO artifact_version_records
			(id, tenant_id, name, status, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		id, tenantID, req.Name, status, meta, now)
	if err != nil {
		return nil, err
	}
	return &models.Record{
		ID:        id,
		TenantID:  tenantID,
		Name:      req.Name,
		Status:    status,
		Metadata:  req.Config,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	if req.Status == "" {
		req.Status = models.StatusActive
	}
	meta, err := marshalMeta(req.Config)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		`UPDATE artifact_version_records
		 SET name=$3, status=$4, metadata=$5, updated_at=$6
		 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		id, tenantID, req.Name, req.Status, meta, now)
	if err != nil {
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete soft-deletes the record. Repeating the call returns NotFound.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		`UPDATE artifact_version_records
		 SET deleted_at=$3
		 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,
		id, tenantID, now)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sentinel.NotFound
	}
	return nil
}

// ---- Tags CRUD ----

func (r *Repository) ListTags(ctx context.Context, tenantID, recordID string) ([]models.Tag, error) {
	var tags []models.Tag
	err := r.db.SelectContext(ctx, &tags,
		`SELECT * FROM artifact_version_tags
		 WHERE tenant_id=$1 AND record_id=$2
		 ORDER BY created_at ASC, tag ASC`,
		tenantID, recordID)
	return tags, err
}

func (r *Repository) AddTag(ctx context.Context, tenantID, recordID, tag string) (*models.Tag, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO artifact_version_tags (id, tenant_id, record_id, tag, created_at)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tenant_id, record_id, tag) DO UPDATE SET created_at=EXCLUDED.created_at`,
		id, tenantID, recordID, tag, now)
	if err != nil {
		return nil, err
	}
	var t models.Tag
	if err := r.db.GetContext(ctx, &t,
		`SELECT * FROM artifact_version_tags WHERE tenant_id=$1 AND record_id=$2 AND tag=$3`,
		tenantID, recordID, tag); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) DeleteTag(ctx context.Context, tenantID, recordID, tag string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM artifact_version_tags WHERE tenant_id=$1 AND record_id=$2 AND tag=$3`,
		tenantID, recordID, tag)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sentinel.NotFound
	}
	return nil
}

// ---- Helpers ----

// marshalMeta converts a metadata map to JSONB bytes. Empty maps still yield
// "{}" so the column is never NULL (matches the DEFAULT '{}' in the migration).
func marshalMeta(m map[string]interface{}) ([]byte, error) {
	if m == nil {
		m = map[string]interface{}{}
	}
	return json.Marshal(m)
}
