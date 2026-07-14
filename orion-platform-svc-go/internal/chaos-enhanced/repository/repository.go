package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/chaos-enhanced/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Experiments ---

func (r *Repository) CreateExperiment(ctx context.Context, e *models.Experiment) error {
	e.ID = uuid.New().String()
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now
	if e.Status == "" {
		e.Status = "planned"
	}
	if e.CreatedBy == "" {
		e.CreatedBy = "system"
	}
	if e.FaultSpec == "" {
		e.FaultSpec = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO chaos_experiments (id, tenant_id, name, description, environment_id,
		     status, fault_spec, target_id, recovery_info, created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :environmentId,
		     :status, :faultSpec, :targetId, :recoveryInfo, :createdBy, :createdAt, :updatedAt)`,
		e)
	return err
}

func (r *Repository) GetExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	var e models.Experiment
	err := r.db.GetContext(ctx, &e,
		`SELECT * FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) ListExperiments(ctx context.Context, tenantID string, status *string, environmentID *string) ([]models.Experiment, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if environmentID != nil && *environmentID != "" {
		where += fmt.Sprintf(" AND environment_id = $%d", argIdx)
		args = append(args, *environmentID)
		argIdx++
	}
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
	}
	var experiments []models.Experiment
	err := r.db.SelectContext(ctx, &experiments,
		fmt.Sprintf(`SELECT * FROM chaos_experiments %s ORDER BY created_at DESC`, where), args...)
	return experiments, err
}

func (r *Repository) UpdateExperiment(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Experiment, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		// Skip pointer fields when they are nil
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE chaos_experiments SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.GetExperiment(ctx, id, tenantID)
}

// --- Fault Injections ---

func (r *Repository) CreateFaultInjection(ctx context.Context, fi *models.FaultInjection) error {
	fi.ID = uuid.New().String()
	fi.InjectedAt = time.Now().UTC()
	if fi.Status == "" {
		fi.Status = "injected"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO fault_injections (id, experiment_id, tenant_id, fault_type, fault_config, status, injected_at)
		 VALUES (:id, :experimentId, :tenantId, :faultType, :faultConfig, :status, :injectedAt)`,
		fi)
	return err
}

// IsNotFound returns true for database not-found errors.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows || errors.Is(err, ErrNotFound)
}
