package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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

func (r *Repository) Save(ctx context.Context, tenantID, name string, spec roweditor.RowSpec) error {
	specJSON, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("roweditor repository: marshal spec for %q: %w", name, err)
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO row_editor (id, tenant_id, key, value, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
		uuid.New().String(), tenantID, name, string(specJSON))
	return err
}

// Get loads one editor spec for one tenant. nil is returned when the tenant has
// not registered an editor under that name.
//
// Save upserts on the (tenant_id, key) unique index, so a bare key lookup could
// have returned another tenant's spec — and with it, the name of a table that
// tenant is allowed to write. These four readers are the load side of Save; they
// were unscoped while Save was scoped, which is exactly how an editor
// registration leaks across tenants.
//
// The nil return distinguishes "not registered" from "registered but
// malformed", so a corrupt row can no longer masquerade as a fresh editor.
func (r *Repository) Get(ctx context.Context, tenantID, name string) (*roweditor.RowSpec, error) {
	var row rowSpecRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM row_editor WHERE tenant_id=$1 AND key=$2`, tenantID, name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var spec roweditor.RowSpec
	if err := json.Unmarshal([]byte(row.Value), &spec); err != nil {
		return nil, fmt.Errorf("roweditor repository: corrupt spec for %q: %w", name, err)
	}
	return &spec, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) map[string]roweditor.RowSpec {
	var rows []rowSpecRow
	err := r.db.SelectContext(ctx, &rows, `SELECT * FROM row_editor WHERE tenant_id=$1 ORDER BY key`, tenantID)
	if err != nil {
		return map[string]roweditor.RowSpec{}
	}
	result := make(map[string]roweditor.RowSpec, len(rows))
	for _, row := range rows {
		var spec roweditor.RowSpec
		// A row that fails to unmarshal is skipped rather than inserted as an
		// empty spec; an empty spec would look like a registered editor that
		// points at no table.
		if err := json.Unmarshal([]byte(row.Value), &spec); err != nil {
			continue
		}
		result[row.Key] = spec
	}
	return result
}

func (r *Repository) Delete(ctx context.Context, tenantID, name string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM row_editor WHERE tenant_id=$1 AND key=$2`, tenantID, name)
	return err
}

func (r *Repository) Exists(ctx context.Context, tenantID, name string) bool {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM row_editor WHERE tenant_id=$1 AND key=$2)`, tenantID, name)
	if err != nil {
		return false
	}
	return exists
}
