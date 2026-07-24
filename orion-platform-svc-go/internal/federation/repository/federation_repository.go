package repository

import (
	"context"
	"database/sql"
	"errors"
	"orion/platform-svc-go/internal/federation/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// Federation Config
// ---------------------------------------------------------------------------

func (r *Repository) CreateFederationConfig(ctx context.Context, c *models.FederationConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO federation_configs (id, tenant_id, name, description, clusters, strategy, status, metadata, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
		c.ID, c.TenantID, c.Name, c.Description, c.Clusters, c.Strategy, c.Status, c.Metadata,
	)
	return err
}

func (r *Repository) GetFederationConfig(ctx context.Context, tenantID, id string) (*models.FederationConfig, error) {
	var c models.FederationConfig
	err := r.db.GetContext(ctx, &c, `SELECT * FROM federation_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListFederationConfigs(ctx context.Context, tenantID string) ([]models.FederationConfig, error) {
	var items []models.FederationConfig
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM federation_configs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateFederationConfig(ctx context.Context, c *models.FederationConfig) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE federation_configs SET name=$3, description=$4, clusters=$5, strategy=$6, status=$7, metadata=$8, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		c.ID, c.TenantID, c.Name, c.Description, c.Clusters, c.Strategy, c.Status, c.Metadata,
	)
	return err
}

func (r *Repository) DeleteFederationConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM federation_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

func (r *Repository) CreateExecutor(ctx context.Context, e *models.Executor) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO executors (id, tenant_id, cluster_id, name, region, status, cpu_capacity, memory_capacity_mb, cpu_used, memory_used_mb, running_jobs, max_concurrent_jobs, last_heartbeat, registered_at, labels) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)`,
		e.ID, e.TenantID, e.ClusterID, e.Name, e.Region, e.Status,
		e.CPUCapacity, e.MemoryCapacityMB, e.CPUUsed, e.MemoryUsedMB,
		e.RunningJobs, e.MaxConcurrentJobs, e.LastHeartbeat, e.Labels,
	)
	return err
}

func (r *Repository) GetExecutor(ctx context.Context, tenantID, id string) (*models.Executor, error) {
	var e models.Executor
	err := r.db.GetContext(ctx, &e, `SELECT * FROM executors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) GetExecutorWithHealth(ctx context.Context, tenantID, id string) (*models.Executor, *models.ExecutorHealth, error) {
	var e models.Executor
	err := r.db.GetContext(ctx, &e, `SELECT * FROM executors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, nil, err
	}
	var h models.ExecutorHealth
	err = r.db.GetContext(ctx, &h, `SELECT * FROM executor_health WHERE executor_id=$1 ORDER BY last_heartbeat DESC LIMIT 1`, id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return &e, nil, err
	}
	return &e, &h, nil
}

var nullExec = (*models.Executor)(nil)

func (r *Repository) ListExecutors(ctx context.Context, tenantID string, offset, limit int) ([]models.Executor, error) {
	var items []models.Executor
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM executors WHERE tenant_id=$1 ORDER BY registered_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) ListActiveExecutors(ctx context.Context, tenantID string) ([]models.Executor, error) {
	var items []models.Executor
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM executors WHERE tenant_id=$1 AND status='online' ORDER BY registered_at DESC`,
		tenantID)
	return items, err
}

func (r *Repository) UpdateExecutor(ctx context.Context, e *models.Executor) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE executors SET name=$3, region=$4, status=$5, cpu_capacity=$6, memory_capacity_mb=$7, cpu_used=$8, memory_used_mb=$9, running_jobs=$10, last_heartbeat=NOW() WHERE id=$1 AND tenant_id=$2`,
		e.ID, e.TenantID, e.Name, e.Region, e.Status,
		e.CPUCapacity, e.MemoryCapacityMB, e.CPUUsed, e.MemoryUsedMB, e.RunningJobs,
	)
	return err
}

func (r *Repository) UpdateExecutorHeartbeat(ctx context.Context, id, tenantID string, cpuUsed, memUsedMB float64, runningJobs, responseTimeMs int) (*models.Executor, error) {
	var e models.Executor
	err := r.db.GetContext(ctx, &e, `SELECT * FROM executors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	e.CPUUsed = cpuUsed
	e.MemoryUsedMB = memUsedMB
	e.RunningJobs = runningJobs
	_, err = r.db.ExecContext(ctx,
		`UPDATE executors SET cpu_used=$3, memory_used_mb=$4, running_jobs=$5, last_heartbeat=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID, cpuUsed, memUsedMB, runningJobs,
	)
	return &e, err
}

func (r *Repository) DeleteExecutor(ctx context.Context, tenantID, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM executors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// ExecutorHealth
func (r *Repository) UpsertExecutorHealth(ctx context.Context, h *models.ExecutorHealth) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO executor_health (executor_id, status, cpu_usage_pct, memory_usage_pct, running_jobs, queue_depth, last_heartbeat, response_time_ms, errors_last_hour) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (executor_id) DO UPDATE SET status=$2, cpu_usage_pct=$3, memory_usage_pct=$4, running_jobs=$5, queue_depth=$6, last_heartbeat=$7, response_time_ms=$8, errors_last_hour=$9`,
		h.ExecutorID, h.Status, h.CPUUsagePct, h.MemoryUsagePct, h.RunningJobs, h.QueueDepth, h.LastHeartbeat, h.ResponseTimeMs, h.ErrorsLastHour,
	)
	return err
}

func (r *Repository) ListExecutorHealth(ctx context.Context, tenantID string) ([]models.ExecutorHealth, error) {
	var items []models.ExecutorHealth
	err := r.db.SelectContext(ctx, &items,
		`SELECT eh.* FROM executor_health eh JOIN executors ex ON eh.executor_id=ex.id WHERE ex.tenant_id=$1`,
		tenantID)
	return items, err
}

// ---------------------------------------------------------------------------
// Scheduling Policy
// ---------------------------------------------------------------------------

func (r *Repository) CreateSchedulingPolicy(ctx context.Context, p *models.SchedulingPolicy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO scheduling_policies (id, tenant_id, name, description, strategy, rules, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
		p.ID, p.TenantID, p.Name, p.Description, p.Strategy, p.Rules, p.Status,
	)
	return err
}

func (r *Repository) ListSchedulingPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error) {
	var items []models.SchedulingPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM scheduling_policies WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID)
	return items, err
}

// ---------------------------------------------------------------------------
// Cross-Cluster Job
// ---------------------------------------------------------------------------

func (r *Repository) CreateCrossClusterJob(ctx context.Context, j *models.CrossClusterJob) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cross_cluster_jobs (id, tenant_id, name, spec, target_clusters, status, scheduled_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		j.ID, j.TenantID, j.Name, j.Spec, j.TargetClusters, j.Status, j.ScheduledAt, j.CompletedAt,
	)
	return err
}

// ---------------------------------------------------------------------------
// Resource Pool
// ---------------------------------------------------------------------------

func (r *Repository) CreateResourcePool(ctx context.Context, p *models.ResourcePool) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO resource_pools (id, tenant_id, name, description, cluster_id, cpu, memory, used_cpu, used_memory, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
		p.ID, p.TenantID, p.Name, p.Description, p.ClusterID, p.CPU, p.Memory, p.UsedCPU, p.UsedMemory, p.Status,
	)
	return err
}

func (r *Repository) GetResourcePool(ctx context.Context, tenantID, id string) (*models.ResourcePool, error) {
	var p models.ResourcePool
	err := r.db.GetContext(ctx, &p, `SELECT * FROM resource_pools WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) Create(ctx context.Context, d *models.FederatedCluster) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO federated_clusters (id, tenant_id, name, peer_url, protocol, status, config, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
		d.ID, d.TenantID, d.Name, d.PeerURL, d.Protocol, d.Status, d.Config,
	)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) {
	var items []models.FederatedCluster
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM federated_clusters WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) {
	var d models.FederatedCluster
	err := r.db.GetContext(ctx, &d, `SELECT * FROM federated_clusters WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM federated_clusters WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM federated_clusters WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) Update(ctx context.Context, d *models.FederatedCluster) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE federated_clusters SET name=$3, peer_url=$4, protocol=$5, status=$6, config=$7, last_sync=NOW() WHERE id=$1 AND tenant_id=$2`,
		d.ID, d.TenantID, d.Name, d.PeerURL, d.Protocol, d.Status, d.Config,
	)
	return err
}
