package aireview

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists ReviewRecord to the dba_ai_reviews table.
type Repository struct {
	db *sqlx.DB
}

// NewRepository wires a Repository against an existing *sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Insert persists a review record. If rec.ID is empty it is assigned a new
// UUID before insertion.
func (r *Repository) Insert(ctx context.Context, rec *ReviewRecord) error {
	if r.db == nil {
		return fmt.Errorf("aireview: repository has nil *sqlx.DB")
	}
	if rec.ID == "" {
		rec.ID = uuid.New().String()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dba_ai_reviews
		    (id, tenant_id, sql_text, db_type, local_audit, ai_suggestions, verdict, score, model_used, duration_ms, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		rec.ID, rec.TenantID, rec.SQL, rec.DBType,
		defaultJSON(rec.LocalAudit), defaultJSON(rec.AISuggestions),
		rec.Verdict, rec.Score, rec.ModelUsed, rec.DurationMs, rec.CreatedAt,
	)
	return err
}

// Get fetches a single review record by ID.
func (r *Repository) Get(ctx context.Context, id string) (*ReviewRecord, error) {
	if r.db == nil {
		return nil, sentinel.NotFound
	}
	var rec ReviewRecord
	err := r.db.GetContext(ctx, &rec,
		`SELECT id, tenant_id, sql_text, db_type, local_audit, ai_suggestions, verdict, score, model_used, duration_ms, created_at
		   FROM dba_ai_reviews WHERE id = $1`,
		id,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &rec, nil
}

// ListByTenant returns the most recent reviews for a tenant, newest first.
func (r *Repository) ListByTenant(ctx context.Context, tenantID string, limit int) ([]ReviewRecord, error) {
	if r.db == nil {
		return []ReviewRecord{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.db.QueryxContext(ctx,
		`SELECT id, tenant_id, sql_text, db_type, local_audit, ai_suggestions, verdict, score, model_used, duration_ms, created_at
		   FROM dba_ai_reviews WHERE tenant_id = $1
		  ORDER BY created_at DESC
		  LIMIT $2`,
		tenantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ReviewRecord
	for rows.Next() {
		var rec ReviewRecord
		if err := rows.StructScan(&rec); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	if out == nil {
		out = []ReviewRecord{}
	}
	return out, nil
}

// defaultJSON returns "{}" for an empty or nil value so INSERT statements
// do not violate the NOT NULL / non-empty JSONB contract.
func defaultJSON(s string) string {
	if s == "" {
		return "{}"
	}
	return s
}

// Compile-time interface assertion.
var _ ReviewRepository = (*Repository)(nil)
