package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/worker-dispatcher/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the data access contract for the worker-dispatcher module.
type RepositoryInterface interface {
	// --- WorkerPolicy ---
	CreatePolicy(ctx context.Context, m *models.WorkerPolicy) error
	GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error)
	ListPolicies(ctx context.Context, tenantID string, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error)
	UpdatePolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeletePolicy(ctx context.Context, tenantID, id string) error
	GetEnabledPolicies(ctx context.Context, tenantID, policyType string) ([]models.WorkerPolicy, error)

	// --- WorkerAssignment ---
	CreateAssignment(ctx context.Context, m *models.WorkerAssignment) error
	GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error)
	GetAssignmentByID(ctx context.Context, tenantID, id string) (*models.WorkerAssignment, error)
	UpdateAssignmentStatus(ctx context.Context, tenantID, id string, status string, completedAt interface{}) error
	ListAssignmentsByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerAssignment, error)
	GetActiveAssignments(ctx context.Context, tenantID, workerID string) int

	// --- WorkerCapability ---
	CreateCapability(ctx context.Context, m *models.WorkerCapability) error
	GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error)
	GetCapabilitiesByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerCapability, error)
	DeleteCapability(ctx context.Context, tenantID, workerID, skill string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- WorkerPolicy ---

func (r *Repository) CreatePolicy(ctx context.Context, m *models.WorkerPolicy) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if !m.Enabled {
		m.Enabled = true
	}
	query := `INSERT INTO worker_policies (id, tenant_id, name, type, config, priority, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :type, :config, :priority, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error) {
	var m models.WorkerPolicy
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM worker_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error) {
	if limit <= 0 {
		limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if policyType != "" {
		conds = append(conds, fmt.Sprintf("type=$%d", idx))
		args = append(args, policyType)
		idx++
	}
	if enabled != "" {
		boolVal := enabled == "true"
		conds = append(conds, fmt.Sprintf("enabled=$%d", idx))
		args = append(args, boolVal)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	sql := fmt.Sprintf("SELECT * FROM worker_policies WHERE %s ORDER BY priority DESC, created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, limit, offset)
	var items []models.WorkerPolicy
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_ = updates
	_, err := r.db.ExecContext(ctx,
		`UPDATE worker_policies SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM worker_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) GetEnabledPolicies(ctx context.Context, tenantID, policyType string) ([]models.WorkerPolicy, error) {
	var items []models.WorkerPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM worker_policies WHERE tenant_id=$1 AND enabled=$2 AND type=$3 ORDER BY priority DESC`,
		tenantID, true, policyType)
	return items, err
}

// --- WorkerAssignment ---

func (r *Repository) CreateAssignment(ctx context.Context, m *models.WorkerAssignment) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.AssignedAt = now
	query := `INSERT INTO worker_assignments (id, tenant_id, policy_id, target_type, target_id,
		worker_id, worker_type, status, assigned_at, completed_at, created_at)
		VALUES (:id, :tenant_id, :policy_id, :target_type, :target_id, :worker_id, :worker_type,
		:status, :assigned_at, :completed_at, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error) {
	var m models.WorkerAssignment
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM worker_assignments WHERE target_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`,
		targetID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetAssignmentByID(ctx context.Context, tenantID, id string) (*models.WorkerAssignment, error) {
	var m models.WorkerAssignment
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM worker_assignments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateAssignmentStatus(ctx context.Context, tenantID, id string, status string, completedAt interface{}) error {
	if completedAt != nil {
		_, err := r.db.ExecContext(ctx,
			`UPDATE worker_assignments SET status=$1, completed_at=$2 WHERE id=$3 AND tenant_id=$4`,
			status, completedAt, id, tenantID)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE worker_assignments SET status=$1 WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) ListAssignmentsByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerAssignment, error) {
	var items []models.WorkerAssignment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM worker_assignments WHERE worker_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`,
		workerID, tenantID)
	return items, err
}

func (r *Repository) GetActiveAssignments(ctx context.Context, tenantID, workerID string) int {
	var count int
	_ = r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM worker_assignments WHERE worker_id=$1 AND tenant_id=$2 AND status IN ($3, $4)`,
		workerID, tenantID, "assigned", "in_progress")
	return count
}

// --- WorkerCapability ---

func (r *Repository) CreateCapability(ctx context.Context, m *models.WorkerCapability) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	if m.Level == 0 {
		m.Level = 1
	}
	if m.Weight == 0 {
		m.Weight = 50
	}
	if m.MaxLoad == 0 {
		m.MaxLoad = 10
	}
	m.Enabled = true
	query := `INSERT INTO worker_capabilities (id, tenant_id, worker_id, worker_type, skill, level, weight, max_load, enabled, created_at)
		VALUES (:id, :tenant_id, :worker_id, :worker_type, :skill, :level, :weight, :max_load, :enabled, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error) {
	var items []models.WorkerCapability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM worker_capabilities WHERE tenant_id=$1 AND enabled=$2 ORDER BY worker_id, skill`,
		tenantID, true)
	return items, err
}

func (r *Repository) GetCapabilitiesByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerCapability, error) {
	var items []models.WorkerCapability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM worker_capabilities WHERE tenant_id=$1 AND worker_id=$2 AND enabled=$3 ORDER BY weight DESC`,
		tenantID, workerID, true)
	return items, err
}

func (r *Repository) DeleteCapability(ctx context.Context, tenantID, workerID, skill string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM worker_capabilities WHERE tenant_id=$1 AND worker_id=$2 AND skill=$3`,
		tenantID, workerID, skill)
	return err
}
