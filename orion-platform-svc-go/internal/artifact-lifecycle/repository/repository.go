package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, lc *models.ArtifactLifecycle) error {
	lc.ID = uuid.New().String()
	lc.CreatedAt = time.Now().UTC()
	lc.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO artifact_lifecycles (id, tenant_id, artifact_id, stage, stage_status, created_at, updated_at)
		VALUES (:id, :tenant_id, :artifact_id, :stage, :stage_status, :created_at, :updated_at)`, lc)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	var lc models.ArtifactLifecycle
	err := r.db.GetContext(ctx, &lc,
		`SELECT * FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		// The service checks errors.Is(err, sentinel.NotFound) on the result of
		// this call, but sqlx returns sql.ErrNoRows, which is not that sentinel:
		// every such check was dead, so a no-row read looked like a driver error.
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &lc, nil
}

func (r *Repository) GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error) {
	var lc models.ArtifactLifecycle
	err := r.db.GetContext(ctx, &lc,
		`SELECT * FROM artifact_lifecycles WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, artifactID, tenantID)
	if err != nil {
		// Create calls this to detect a duplicate and tests the error against
		// sentinel.NotFound. With sql.ErrNoRows that test was always false, so a
		// fresh artifact_id fell into the "some other error" arm and POST
		// /artifact-lifecycle answered 500 with "sql: no rows in result set"
		// instead of creating the row.
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &lc, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.ArtifactLifecycle, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.ArtifactLifecycle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_lifecycles WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM artifact_lifecycles WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	// Column names come from the literal in this map, never from the caller, so no
	// input value can inject an identifier. id and tenant_id are deliberately not
	// keys here: they scope the WHERE clause and must not be settable through the
	// same statement that names the row.
	columns := map[string]string{
		"stage":        "stage",
		"stage_status": "stage_status",
		"updated_at":   "updated_at",
	}
	fields := []string{}
	for key := range updates {
		col, ok := columns[key]
		if !ok {
			continue
		}
		fields = append(fields, fmt.Sprintf("%s=:%s", col, col))
	}
	if len(fields) == 0 {
		return nil
	}
	// The pre-fix statement set stage_status unconditionally. AdvanceStageRequest
	// has no status field, so updates["stage_status"] was a missing key, bound as
	// nil, and Postgres rejected every advance with a not-null violation on a
	// NOT NULL column. Setting only what the caller sent lets a stage move on
	// its own without inventing a status for it.
	if !containsField(fields, "updated_at=:updated_at") {
		fields = append(fields, "updated_at=:updated_at")
	}
	// Map iteration is unordered; sorting keeps the compiled statement stable so
	// an expectation written against it does not depend on the scheduler.
	sort.Strings(fields)
	// The pre-fix statement mixed named placeholders in the SET clause with
	// literal $1/$2 in the WHERE clause. sqlx renumbers the named ones to
	// $1..$3 in appearance order, so id=$1 picked up the stage value and
	// tenant_id=$2 picked up the stage_status value: the WHERE clause never
	// named the row and never scoped the tenant.
	bind := map[string]interface{}{"id": id, "tenant_id": tenantID}
	for key, col := range columns {
		if v, ok := updates[key]; ok {
			bind[col] = v
		}
	}
	bind["updated_at"] = time.Now().UTC()
	query := fmt.Sprintf("UPDATE artifact_lifecycles SET %s WHERE id=:id AND tenant_id=:tenant_id",
		strings.Join(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, query, bind)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM artifact_lifecycles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetStageHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactLifecycle, error) {
	var items []models.ArtifactLifecycle
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM artifact_lifecycles WHERE artifact_id=$1 AND tenant_id=$2 ORDER BY created_at ASC`, id, tenantID)
	return items, err
}

func (r *Repository) Archive(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifact_lifecycles SET stage='archived', stage_status='archived', updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func containsField(fields []string, want string) bool {
	for _, f := range fields {
		if f == want {
			return true
		}
	}
	return false
}
