package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/infra-ops-svc-go/internal/dr/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ─── DR Plans ────────────────────────────────────────────────────────────────

func (r *Repository) CreatePlan(ctx context.Context, p *models.DRPlan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dr_plans (id, tenant_id, name, plan_type, rpo, rto, status, priority, failover_strategy, backup_regions, services, config, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		p.ID, p.TenantID, p.Name, p.PlanType, p.RPO, p.RTO, p.Status, p.Priority,
		p.FailoverStrategy, p.BackupRegions, p.Services, p.Config, p.CreatedBy,
		p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *Repository) GetPlanByID(ctx context.Context, tenantID, id string) (*models.DRPlan, error) {
	var p models.DRPlan
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM dr_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPlan, error) {
	var items []models.DRPlan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_plans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) UpdatePlan(ctx context.Context, tenantID, id string, req *models.UpdateDRPlanRequest) (*models.DRPlan, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.PlanType != nil {
		setClauses = append(setClauses, fmt.Sprintf("plan_type=$%d", idx))
		args = append(args, *req.PlanType)
		idx++
	}
	if req.RPO != nil {
		setClauses = append(setClauses, fmt.Sprintf("rpo=$%d", idx))
		args = append(args, *req.RPO)
		idx++
	}
	if req.RTO != nil {
		setClauses = append(setClauses, fmt.Sprintf("rto=$%d", idx))
		args = append(args, *req.RTO)
		idx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx))
		args = append(args, *req.Status)
		idx++
	}
	if req.Priority != nil {
		setClauses = append(setClauses, fmt.Sprintf("priority=$%d", idx))
		args = append(args, *req.Priority)
		idx++
	}
	if req.FailoverStrategy != nil {
		setClauses = append(setClauses, fmt.Sprintf("failover_strategy=$%d", idx))
		args = append(args, *req.FailoverStrategy)
		idx++
	}
	if req.BackupRegions != nil {
		regionsJSON, _ := json.Marshal(req.BackupRegions)
		setClauses = append(setClauses, fmt.Sprintf("backup_regions=$%d", idx))
		args = append(args, regionsJSON)
		idx++
	}
	if req.Services != nil {
		servicesJSON, _ := json.Marshal(req.Services)
		setClauses = append(setClauses, fmt.Sprintf("services=$%d", idx))
		args = append(args, servicesJSON)
		idx++
	}
	if req.Config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config=$%d", idx))
		args = append(args, req.Config)
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetPlanByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE dr_plans SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)
	args = append(args, id, tenantID)

	var p models.DRPlan
	err := r.db.GetContext(ctx, &p, query, args...)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) UpdatePlanStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dr_plans SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, time.Now(), id, tenantID)
	return err
}

func (r *Repository) UpdatePlanLastTested(ctx context.Context, tenantID, id string, testedAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE dr_plans SET last_tested=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		testedAt, time.Now(), id, tenantID)
	return err
}

func (r *Repository) DeletePlan(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dr_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountPlans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dr_plans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ─── Failover Tests ──────────────────────────────────────────────────────────

func (r *Repository) CreateFailoverTest(ctx context.Context, t *models.FailoverTest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dr_failover_tests (id, tenant_id, plan_id, test_name, test_type, started_at, result, affected_services, created_by, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		t.ID, t.TenantID, t.PlanID, t.TestName, t.TestType, t.StartedAt,
		t.Result, t.AffectedServices, t.CreatedBy, t.CreatedAt,
	)
	return err
}

func (r *Repository) GetFailoverTestByID(ctx context.Context, tenantID, id string) (*models.FailoverTest, error) {
	var t models.FailoverTest
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM dr_failover_tests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListFailoverTests(ctx context.Context, tenantID string, planID *string) ([]models.FailoverTest, error) {
	var items []models.FailoverTest
	if planID != nil {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM dr_failover_tests WHERE tenant_id=$1 AND plan_id=$2 ORDER BY created_at DESC`,
			tenantID, *planID)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_failover_tests WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID)
	return items, err
}

func (r *Repository) CompleteFailoverTest(ctx context.Context, tenantID, id string, req *models.CompleteFailoverTestRequest) (*models.FailoverTest, error) {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE dr_failover_tests SET completed_at=$1, actual_rto=$2, actual_rpo=$3, result=$4, findings=$5
		 WHERE id=$6 AND tenant_id=$7`,
		now, req.ActualRTO, req.ActualRPO, req.Result, req.Findings, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetFailoverTestByID(ctx, tenantID, id)
}

// ─── Backup Configs ──────────────────────────────────────────────────────────

func (r *Repository) CreateBackupConfig(ctx context.Context, b *models.BackupConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dr_backup_configs (id, tenant_id, source_type, source_id, backup_schedule, retention_days, storage_location, encryption, compression, enabled, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		b.ID, b.TenantID, b.SourceType, b.SourceID, b.BackupSchedule, b.RetentionDays,
		b.StorageLocation, b.Encryption, b.Compression, b.Enabled, b.CreatedBy,
		b.CreatedAt, b.UpdatedAt,
	)
	return err
}

func (r *Repository) GetBackupConfigByID(ctx context.Context, tenantID, id string) (*models.BackupConfig, error) {
	var b models.BackupConfig
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM dr_backup_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListBackupConfigs(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupConfig, error) {
	var items []models.BackupConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_backup_configs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) CountBackupConfigs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dr_backup_configs WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdateBackupConfig(ctx context.Context, tenantID, id string, req *models.UpdateBackupConfigRequest) (*models.BackupConfig, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.BackupSchedule != nil {
		setClauses = append(setClauses, fmt.Sprintf("backup_schedule=$%d", idx))
		args = append(args, *req.BackupSchedule)
		idx++
	}
	if req.RetentionDays != nil {
		setClauses = append(setClauses, fmt.Sprintf("retention_days=$%d", idx))
		args = append(args, *req.RetentionDays)
		idx++
	}
	if req.StorageLocation != nil {
		setClauses = append(setClauses, fmt.Sprintf("storage_location=$%d", idx))
		args = append(args, *req.StorageLocation)
		idx++
	}
	if req.Encryption != nil {
		setClauses = append(setClauses, fmt.Sprintf("encryption=$%d", idx))
		args = append(args, *req.Encryption)
		idx++
	}
	if req.Compression != nil {
		setClauses = append(setClauses, fmt.Sprintf("compression=$%d", idx))
		args = append(args, *req.Compression)
		idx++
	}
	if req.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled=$%d", idx))
		args = append(args, *req.Enabled)
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetBackupConfigByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE dr_backup_configs SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)
	args = append(args, id, tenantID)

	var b models.BackupConfig
	err := r.db.GetContext(ctx, &b, query, args...)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) DeleteBackupConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dr_backup_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ─── DR Policies ─────────────────────────────────────────────────────────────

func (r *Repository) CreatePolicy(ctx context.Context, p *models.DRPolicy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dr_policies (id, tenant_id, name, description, services, strategy, rpo, rto, priority, status, project_id, config, created_by, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Services, p.Strategy,
		p.RPO, p.RTO, p.Priority, p.Status, p.ProjectID, p.Config,
		p.CreatedBy, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *Repository) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.DRPolicy, error) {
	var p models.DRPolicy
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM dr_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPolicy, error) {
	var items []models.DRPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_policies WHERE tenant_id=$1 ORDER BY priority, created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) ListPoliciesByStrategy(ctx context.Context, tenantID, strategy string) ([]models.DRPolicy, error) {
	var items []models.DRPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_policies WHERE tenant_id=$1 AND strategy=$2 ORDER BY priority`,
		tenantID, strategy)
	return items, err
}

func (r *Repository) ListPoliciesByStatus(ctx context.Context, tenantID, status string) ([]models.DRPolicy, error) {
	var items []models.DRPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM dr_policies WHERE tenant_id=$1 AND status=$2 ORDER BY priority`,
		tenantID, status)
	return items, err
}

func (r *Repository) CountPolicies(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dr_policies WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.DRPolicy, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.Services != nil {
		servicesJSON, _ := json.Marshal(req.Services)
		setClauses = append(setClauses, fmt.Sprintf("services=$%d", idx))
		args = append(args, servicesJSON)
		idx++
	}
	if req.Strategy != nil {
		setClauses = append(setClauses, fmt.Sprintf("strategy=$%d", idx))
		args = append(args, *req.Strategy)
		idx++
	}
	if req.RPO != nil {
		setClauses = append(setClauses, fmt.Sprintf("rpo=$%d", idx))
		args = append(args, *req.RPO)
		idx++
	}
	if req.RTO != nil {
		setClauses = append(setClauses, fmt.Sprintf("rto=$%d", idx))
		args = append(args, *req.RTO)
		idx++
	}
	if req.Priority != nil {
		setClauses = append(setClauses, fmt.Sprintf("priority=$%d", idx))
		args = append(args, *req.Priority)
		idx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx))
		args = append(args, *req.Status)
		idx++
	}
	if req.Config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config=$%d", idx))
		args = append(args, models.JSONB(req.Config))
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetPolicyByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at=$%d", idx))
	args = append(args, time.Now())
	idx++

	query := fmt.Sprintf("UPDATE dr_policies SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)
	args = append(args, id, tenantID)

	var p models.DRPolicy
	err := r.db.GetContext(ctx, &p, query, args...)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM dr_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
