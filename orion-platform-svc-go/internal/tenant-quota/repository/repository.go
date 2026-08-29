package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/tenant-quota/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreatePlan(ctx context.Context, p *models.QuotaPlan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tenant_quota_plan (id, tenant_id, name, description, status, api_rate_limit_per_min, api_rate_limit_per_hour, max_cis, max_users, max_storages_mb, max_pipelines, max_concurrent_jobs, max_alerts_per_day, sla_tier, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Status, p.APIRateLimitPerMin, p.APIRateLimitPerHour,
		p.MaxCIs, p.MaxUsers, p.MaxStorageMB, p.MaxPipelines, p.MaxConcurrentJobs, p.MaxAlertsPerDay, p.SLATier, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *Repository) GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error) {
	var p models.QuotaPlan
	err := r.db.GetContext(ctx, &p, `SELECT * FROM tenant_quota_plan WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error) {
	var items []models.QuotaPlan
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM tenant_quota_plan WHERE tenant_id=? ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdatePlan(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.QuotaPlan, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE tenant_quota_plan SET %s WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetPlan(ctx, id, tenantID)
}

func (r *Repository) DeletePlan(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM tenant_quota_plan WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error) {
	var u models.QuotaUsage
	err := r.db.GetContext(ctx, &u, `SELECT * FROM tenant_quota_usage WHERE tenant_id=? AND metric=? ORDER BY window_start DESC LIMIT 1`, tenantID, metric)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) IncrementUsage(ctx context.Context, tenantID, metric string, amount int64, resetAt time.Time) (*models.QuotaUsage, error) {
	existing, err := r.GetUsage(ctx, tenantID, metric)
	if err != nil {
		// Create new
		u := models.QuotaUsage{
			TenantID:     tenantID,
			Metric:       metric,
			CurrentValue: amount,
			PeakValue:    amount,
			WindowStart:  time.Now(),
			WindowEnd:    time.Now().Add(time.Hour),
			ResetAt:      resetAt,
			UpdatedAt:    time.Now(),
		}
		if err := r.createUsage(&u); err != nil {
			return nil, err
		}
		return &u, nil
	}
	existing.CurrentValue += amount
	if existing.CurrentValue > existing.PeakValue {
		existing.PeakValue = existing.CurrentValue
	}
	existing.UpdatedAt = time.Now()
	if err := r.updateUsage(existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (r *Repository) createUsage(u *models.QuotaUsage) error {
	_, err := r.db.ExecContext(context.Background(),
		`INSERT INTO tenant_quota_usage (id, tenant_id, metric, current_value, peak_value, window_start, window_end, reset_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.TenantID, u.Metric, u.CurrentValue, u.PeakValue, u.WindowStart, u.WindowEnd, u.ResetAt, u.UpdatedAt)
	return err
}

func (r *Repository) updateUsage(u *models.QuotaUsage) error {
	_, err := r.db.ExecContext(context.Background(),
		`UPDATE tenant_quota_usage SET current_value=?, peak_value=?, window_start=?, window_end=?, reset_at=?, updated_at=?
		 WHERE tenant_id=? AND metric=?`,
		u.CurrentValue, u.PeakValue, u.WindowStart, u.WindowEnd, u.ResetAt, u.UpdatedAt, u.TenantID, u.Metric)
	return err
}

func (r *Repository) ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsage, error) {
	var items []models.QuotaUsage
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM tenant_quota_usage WHERE tenant_id=? ORDER BY metric`, tenantID)
	return items, err
}

func (r *Repository) ResetUsage(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE tenant_quota_usage SET current_value=0, updated_at=NOW() WHERE tenant_id=?`, tenantID)
	return err
}

func (r *Repository) CreateAlert(ctx context.Context, a *models.QuotaAlert) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tenant_quota_alert (id, tenant_id, metric, current_value, limit_value, usage_pct, alert_level, notified_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.TenantID, a.Metric, a.CurrentValue, a.LimitValue, a.UsagePct, a.AlertLevel, a.NotifiedAt)
	return err
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error) {
	var items []models.QuotaAlert
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM tenant_quota_alert WHERE tenant_id=? ORDER BY notified_at DESC`, tenantID)
	return items, err
}
