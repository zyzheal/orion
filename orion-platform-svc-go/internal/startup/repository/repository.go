package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/startup/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed persistence for startup modules and dependencies.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// -------------------------------------------------------
// Startup Modules
// -------------------------------------------------------

// CreateModule inserts a new startup module row.
// SQL Call #1
func (r *Repository) CreateModule(ctx context.Context, m *models.StartupModule) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO startup_modules (
			id, tenant_id, name, type, priority, description, config,
			status, error, duration_ms, initialized_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		m.ID, m.TenantID, m.Name, m.Type, m.Priority, m.Description, m.Config,
		m.Status, m.Error, m.DurationMs, m.InitializedAt, m.CreatedAt, m.UpdatedAt,
	)
	return err
}

// GetModuleByID retrieves a single startup module by id and tenant_id.
// SQL Call #2
func (r *Repository) GetModuleByID(ctx context.Context, tenantID, id string) (*models.StartupModule, error) {
	var m models.StartupModule
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM startup_modules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetModuleByName retrieves a single startup module by name and tenant_id.
// SQL Call #3
func (r *Repository) GetModuleByName(ctx context.Context, tenantID, name string) (*models.StartupModule, error) {
	var m models.StartupModule
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM startup_modules WHERE name=$1 AND tenant_id=$2`, name, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListModules retrieves startup modules for a tenant, ordered by priority descending.
// SQL Call #4
func (r *Repository) ListModules(ctx context.Context, tenantID string, offset, limit int) ([]models.StartupModule, error) {
	var items []models.StartupModule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM startup_modules WHERE tenant_id=$1 ORDER BY priority DESC, name OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// ListModulesByStatus retrieves startup modules filtered by status.
// SQL Call #5
func (r *Repository) ListModulesByStatus(ctx context.Context, tenantID string, status models.ModuleStatus) ([]models.StartupModule, error) {
	var items []models.StartupModule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM startup_modules WHERE tenant_id=$1 AND status=$2 ORDER BY priority DESC, name`,
		tenantID, status)
	return items, err
}

// UpdateModule modifies an existing startup module row.
// SQL Call #6
func (r *Repository) UpdateModule(ctx context.Context, m *models.StartupModule) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE startup_modules SET
			type=$1, priority=$2, description=$3, config=$4,
			status=$5, error=$6, duration_ms=$7, initialized_at=$8, updated_at=NOW()
		WHERE id=$9 AND tenant_id=$10`,
		m.Type, m.Priority, m.Description, m.Config,
		m.Status, m.Error, m.DurationMs, m.InitializedAt, m.ID, m.TenantID,
	)
	return err
}

// UpdateModuleStatus updates only the status, error, and duration for a module.
// SQL Call #7
func (r *Repository) UpdateModuleStatus(ctx context.Context, id, tenantID, status, errStr string, durationMs int64, initializedAt interface{}) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE startup_modules SET
			status=$1, error=$2, duration_ms=$3, initialized_at=$4, updated_at=NOW()
		WHERE id=$5 AND tenant_id=$6`,
		status, errStr, durationMs, initializedAt, id, tenantID,
	)
	return err
}

// DeleteModule removes a startup module by id and tenant_id.
// SQL Call #8
func (r *Repository) DeleteModule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM startup_modules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// CountModules returns the total number of startup modules for a tenant.
// SQL Call #9
func (r *Repository) CountModules(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM startup_modules WHERE tenant_id=$1`, tenantID)
	return count, err
}

// -------------------------------------------------------
// Startup Dependencies
// -------------------------------------------------------

// CreateDependency inserts a new startup dependency row.
// SQL Call #10
func (r *Repository) CreateDependency(ctx context.Context, d *models.StartupDependency) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO startup_dependencies (id, tenant_id, module_id, depends_on, created_at)
		VALUES ($1,$2,$3,$4,$5)`,
		d.ID, d.TenantID, d.ModuleID, d.DependsOn, d.CreatedAt,
	)
	return err
}

// ListDependencies retrieves all dependencies for a given module.
// SQL Call #11
func (r *Repository) ListDependencies(ctx context.Context, tenantID, moduleID string) ([]models.StartupDependency, error) {
	var items []models.StartupDependency
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM startup_dependencies WHERE tenant_id=$1 AND module_id=$2`, tenantID, moduleID)
	return items, err
}

// DeleteDependency removes a startup dependency by id and tenant_id.
// SQL Call #12
func (r *Repository) DeleteDependency(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM startup_dependencies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// HasDependency checks whether a module depends on a given module name.
// SQL Call #13
func (r *Repository) HasDependency(ctx context.Context, tenantID, moduleID, dependsOn string) bool {
	var exists bool
	err := r.db.GetContext(ctx, &exists, fmt.Sprintf(`
		SELECT EXISTS(SELECT 1 FROM startup_dependencies WHERE tenant_id=$1 AND module_id=$2 AND depends_on=$3)`,
	), tenantID, moduleID, dependsOn)
	return err == nil && exists
}
