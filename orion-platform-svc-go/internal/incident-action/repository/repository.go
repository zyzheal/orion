package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/incident-action/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrIncidentActionNotFound  = errors.New("incident action not found")
	ErrIncidentActionDuplicate = errors.New("incident action already exists")
)

// Repository handles incident action DB operations.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, tenantID string, e *models.IncidentAction) (*models.IncidentAction, error) {
	e.ID = uuid.New().String()
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now
	e.TenantID = tenantID

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO incident_actions (id, tenant_id, name, value, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :value, :enabled, :created_at, :updated_at)`, e)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.IncidentAction, error) {
	var e models.IncidentAction
	err := r.db.GetContext(ctx, &e,
		"SELECT * FROM incident_actions WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrIncidentActionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.IncidentAction, error) {
	var entities []models.IncidentAction
	err := r.db.SelectContext(ctx, &entities,
		"SELECT * FROM incident_actions WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

// allowedUpdateCols is models.UpdateableColumns as a lookup set.
func allowedUpdateCols() map[string]bool {
	m := make(map[string]bool, len(models.UpdateableColumns))
	for _, c := range models.UpdateableColumns {
		m[c] = true
	}
	return m
}

// Update writes only the columns listed in models.UpdateableColumns. The map
// keys arrive from a JSON body, so they must never be interpolated into the SET
// clause as-is: an unfiltered key such as "tenant_id" would relocate the row
// into another tenant, and an arbitrary key would be parsed as SQL. The SET
// clause is built from the whitelist in a fixed order so the positional
// argument numbering is deterministic; id and tenant_id are bound last.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.IncidentAction, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	allowed := allowedUpdateCols()
	keys := make([]string, 0, len(updates))
	for k := range updates {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if !allowed[k] {
			return nil, fmt.Errorf("%w: %q", models.ErrUnknownUpdateField, k)
		}
	}

	setParts := make([]string, 0, len(models.UpdateableColumns)+1)
	args := make([]interface{}, 0, len(models.UpdateableColumns)+3)
	idx := 1
	for _, col := range models.UpdateableColumns {
		v, ok := updates[col]
		if !ok {
			continue
		}
		setParts = append(setParts, col+" = $"+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}
	setParts = append(setParts, "updated_at = $"+strconv.Itoa(idx))
	args = append(args, time.Now().UTC())
	idx++
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		"UPDATE incident_actions SET "+strings.Join(setParts, ", ")+
			" WHERE id = $"+strconv.Itoa(idx)+" AND tenant_id = $"+strconv.Itoa(idx+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM incident_actions WHERE id = $1 AND tenant_id = $2", id, tenantID)
	return err
}
