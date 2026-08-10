package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/roweditor"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists RowEditor specifications in PostgreSQL.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type rowSpecRow struct {
	ID        string    `db:"id"`
	TenantID  string    `db:"tenant_id"`
	Key       string    `db:"key"`
	Value     string    `db:"value"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

func (r *Repository) Save(ctx context.Context, name string, spec roweditor.RowSpec) error {
	specJSON, _ := json.Marshal(spec)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO row_editor (id, tenant_id, key, value, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
		uuid.New().String(), "global", name, string(specJSON))
	return err
}

func (r *Repository) Get(ctx context.Context, name string) (roweditor.RowSpec, error) {
	var row rowSpecRow
	var spec roweditor.RowSpec
	err := r.db.GetContext(ctx, &row, `SELECT * FROM row_editor WHERE key=$1`, name)
	if errors.Is(err, sql.ErrNoRows) {
		return spec, nil
	}
	if err != nil {
		return spec, err
	}
	err = json.Unmarshal([]byte(row.Value), &spec)
	return spec, err
}

func (r *Repository) List(ctx context.Context) map[string]roweditor.RowSpec {
	var rows []rowSpecRow
	err := r.db.SelectContext(ctx, &rows, `SELECT * FROM row_editor ORDER BY key`)
	if err != nil {
		return map[string]roweditor.RowSpec{}
	}
	result := make(map[string]roweditor.RowSpec, len(rows))
	for _, row := range rows {
		var spec roweditor.RowSpec
		_ = json.Unmarshal([]byte(row.Value), &spec)
		result[row.Key] = spec
	}
	return result
}

func (r *Repository) Delete(ctx context.Context, name string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM row_editor WHERE key=$1`, name)
	return err
}

func (r *Repository) Exists(ctx context.Context, name string) bool {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM row_editor WHERE key=$1)`, name)
	if err != nil {
		return false
	}
	return exists
}