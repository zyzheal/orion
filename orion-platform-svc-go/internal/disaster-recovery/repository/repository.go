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
	"orion/platform-svc-go/internal/disaster-recovery/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- DisasterPlan ---

func (r *Repository) CreatePlan(ctx context.Context, p *models.DisasterPlan) error {
	p.ID = uuid.New().String()
	p.CreatedAt = time.Now().UTC()
	p.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO disaster_plans (id, tenant_id, name, description, steps, status, last_run, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :steps, :status, :last_run, :created_at, :updated_at)`, p)
	return err
}

func (r *Repository) GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error) {
	var p models.DisasterPlan
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM disaster_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		// The service decides missing-vs-broken by testing the result against
		// sentinel.NotFound, but sqlx returns sql.ErrNoRows, which is a
		// different error: every such check was dead, and a no-row read looked
		// like a driver error.
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.DisasterPlan, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.DisasterPlan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM disaster_plans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) CountPlans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM disaster_plans WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdatePlan(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	// Column names come from the literal in this map, never from the caller, so
	// no input value can inject an identifier. id and tenant_id are
	// deliberately not keys here: they scope the WHERE clause and must not be
	// settable through the statement that names the row.
	columns := map[string]string{
		"name":        "name",
		"description": "description",
		"steps":       "steps",
		"status":      "status",
		"updated_at":  "updated_at",
	}
	fields := []string{}
	for key := range updates {
		// A nil value means "the caller did not send this field". Binding it
		// would write NULL into name, description, steps or status, which 124
		// declares NOT NULL, and reject the whole update. Skip it instead of
		// inventing a replacement value.
		if updates[key] == nil {
			continue
		}
		col, ok := columns[key]
		if !ok {
			continue
		}
		fields = append(fields, fmt.Sprintf("%s=:%s", col, col))
	}
	if len(fields) == 0 {
		return nil
	}
	// The pre-fix statement set all four columns unconditionally. The service
	// only puts a key in the map when the caller sent it, so an omitted key
	// was a missing map lookup, which binds as nil: every partial update wrote
	// NULL into name, description, steps and status, all of which 124 declares
	// NOT NULL. Setting only what the caller sent lets a two-field update
	// move without inventing values for the fields it did not receive.
	if !containsField(fields, "updated_at=:updated_at") {
		fields = append(fields, "updated_at=:updated_at")
	}
	// Map iteration is unordered; sorting keeps the compiled statement stable so
	// an expectation written against it does not depend on the scheduler.
	sort.Strings(fields)
	// The pre-fix statement mixed named placeholders in the SET clause with
	// literal $1/$2 in the WHERE clause. sqlx renumbers the named ones to
	// $1..$5 in appearance order and leaves a literal $N untouched, so id=$1
	// picked up the name value and tenant_id=$2 picked up the description
	// value: the WHERE clause never named the row and never scoped the tenant.
	// The bind map is built from the same keys the SET clause was, so the two
	// can never disagree: a named placeholder with no bound value is a hard
	// error from sqlx, and a bound value no placeholder names is dropped.
	bind := map[string]interface{}{"id": id, "tenant_id": tenantID}
	for key := range updates {
		if col, ok := columns[key]; ok && updates[key] != nil {
			bind[col] = updates[key]
		}
	}
	bind["updated_at"] = time.Now().UTC()
	query := fmt.Sprintf("UPDATE disaster_plans SET %s WHERE id=:id AND tenant_id=:tenant_id",
		strings.Join(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, query, bind)
	return err
}

func (r *Repository) UpdatePlanLastRun(ctx context.Context, tenantID, id string, lastRun time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE disaster_plans SET last_run=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, lastRun, time.Now().UTC(), id, tenantID)
	return err
}

// --- RecoveryRun ---

func (r *Repository) CreateRun(ctx context.Context, run *models.RecoveryRun) error {
	run.ID = uuid.New().String()
	run.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO recovery_run (id, plan_id, status, started_at, created_at)
		VALUES (:id, :plan_id, :status, :started_at, :created_at)`, run)
	return err
}

// UpdateRun records the outcome of a run that CreateRun already started. It is
// a second INSERT only in the pre-fix code: CreateRun assigns a fresh id on
// every call, so re-inserting the same run left the original row at
// status='running' forever and appended a duplicate row for one execution.
func (r *Repository) UpdateRun(ctx context.Context, tenantID string, run *models.RecoveryRun) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE recovery_run r SET status=$1, ended_at=$2, error_message=$3
		FROM disaster_plans p
		WHERE r.id=$4 AND r.plan_id=$5 AND p.id=r.plan_id AND p.tenant_id=$6`,
		run.Status, run.EndedAt, run.ErrorMessage, run.ID, run.PlanID, tenantID)
	return err
}

func (r *Repository) ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error) {
	var items []models.RecoveryRun
	err := r.db.SelectContext(ctx, &items,
		`SELECT r.* FROM recovery_run r
		JOIN disaster_plans p ON r.plan_id = p.id
		WHERE r.plan_id=$1 AND p.tenant_id=$2 ORDER BY r.started_at DESC`, planID, tenantID)
	return items, err
}

func (r *Repository) GetRun(ctx context.Context, tenantID, planID, runID string) (*models.RecoveryRun, error) {
	var run models.RecoveryRun
	err := r.db.GetContext(ctx, &run,
		`SELECT r.* FROM recovery_run r
		JOIN disaster_plans p ON r.plan_id = p.id
		WHERE r.id=$1 AND r.plan_id=$2 AND p.tenant_id=$3`, runID, planID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &run, nil
}

func containsField(fields []string, want string) bool {
	for _, f := range fields {
		if f == want {
			return true
		}
	}
	return false
}
