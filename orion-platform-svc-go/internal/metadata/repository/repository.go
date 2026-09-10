package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/metadata/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository is the sqlx-backed persistence layer for the metadata module.
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

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var rows []recordRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT * FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC",
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
		"SELECT * FROM metadata_records WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL", id, tenantID)
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
		"INSERT INTO metadata_records (id, tenant_id, name, status, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)",
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
		"UPDATE metadata_records SET name=$3, status=$4, metadata=$5, updated_at=$6 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL",
		id, tenantID, req.Name, req.Status, meta, now)
	if err != nil {
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, tenantID, id)
}

// Delete soft-deletes the record. Repeating the call returns sentinel.NotFound.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		"UPDATE metadata_records SET deleted_at=$3 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL",
		id, tenantID, now)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sentinel.NotFound
	}
	return nil
}

func marshalMeta(m map[string]interface{}) ([]byte, error) {
	if m == nil {
		m = map[string]interface{}{}
	}
	return json.Marshal(m)
}

// BatchCreate inserts multiple records in a single call.
func (r *Repository) BatchCreate(ctx context.Context, tenantID string, items []models.CreateRequest) ([]models.Record, error) {
	out := make([]models.Record, 0, len(items))
	now := time.Now().UTC()
	for _, req := range items {
		id := uuid.New().String()
		status := req.Status
		if status == "" {
			status = models.StatusActive
		}
		meta, err := marshalMeta(req.Config)
		if err != nil {
			return nil, err
		}
		_, err = r.db.ExecContext(ctx,
			"INSERT INTO metadata_records (id, tenant_id, name, status, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)",
			id, tenantID, req.Name, status, meta, now)
		if err != nil {
			return nil, err
		}
		out = append(out, models.Record{
			ID:        id,
			TenantID:  tenantID,
			Name:      req.Name,
			Status:    status,
			Metadata:  req.Config,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	return out, nil
}

// Search returns records matching the query (name LIKE and/or status filter).
func (r *Repository) Search(ctx context.Context, tenantID string, q models.SearchQuery) ([]models.Record, error) {
	var rows []recordRow
	switch {
	case q.Query != "" && q.Status != "":
		err := r.db.SelectContext(ctx, &rows,
			"SELECT * FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL AND name ILIKE $2 AND status=$3 ORDER BY created_at DESC",
			tenantID, "%"+q.Query+"%", q.Status)
		if err != nil {
			return nil, err
		}
	case q.Query != "":
		err := r.db.SelectContext(ctx, &rows,
			"SELECT * FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL AND name ILIKE $2 ORDER BY created_at DESC",
			tenantID, "%"+q.Query+"%")
		if err != nil {
			return nil, err
		}
	case q.Status != "":
		err := r.db.SelectContext(ctx, &rows,
			"SELECT * FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL AND status=$2 ORDER BY created_at DESC",
			tenantID, q.Status)
		if err != nil {
			return nil, err
		}
	default:
		err := r.db.SelectContext(ctx, &rows,
			"SELECT * FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC",
			tenantID)
		if err != nil {
			return nil, err
		}
	}
	out := make([]models.Record, len(rows))
	for i, row := range rows {
		out[i] = *row.toModel()
	}
	return out, nil
}

// GetStats returns aggregate counts grouped by status.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.Stats, error) {
	var total, active, pending int
	err := r.db.GetContext(ctx, &total,
		"SELECT COUNT(*) FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL",
		tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &active,
		"SELECT COUNT(*) FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL AND status='active'",
		tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &pending,
		"SELECT COUNT(*) FROM metadata_records WHERE tenant_id=$1 AND deleted_at IS NULL AND status='pending'",
		tenantID)
	if err != nil {
		return nil, err
	}
	return &models.Stats{
		Total:        total,
		ActiveCount:  active,
		PendingCount: pending,
	}, nil
}
