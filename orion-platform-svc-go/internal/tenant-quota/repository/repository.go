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

	"orion/platform-svc-go/internal/tenant-quota/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// planColumns is the canonical SELECT list for tenant_quota_plan. It is explicit
// rather than "SELECT *" for two reasons:
//
//   - WarnThresholds is declared db:"-" on models.QuotaPlan (it is carried as
//     a comma-separated string in the column), so a column named
//     warn_thresholds has no destination field and safe-mode sqlx fails the
//     whole read with "missing destination name warn_thresholds".
//   - Migration 588 adds soft_limit, hard_limit, over_limit_action and
//     warn_thresholds. Those four are exactly the columns a plan update wrote
//     before the migration existed, so every policy update died with
//     pq: column "soft_limit" of relation "tenant_quota_plan" does not exist.
//
// The list is the 16 columns 398_create_tenant_quota.sql declares plus the 4
// 588_add_tenant_quota_plan_policy.sql adds. cmd/server/
// migration_tenant_quota_tables_test.go derives both halves out of the source
// and the migrations so they cannot drift apart.
const planColumns = `id, tenant_id, name, description, status, api_rate_limit_per_min, api_rate_limit_per_hour, max_cis, max_users, max_storages_mb, max_pipelines, max_concurrent_jobs, max_alerts_per_day, sla_tier, soft_limit, hard_limit, over_limit_action, warn_thresholds, created_at, updated_at`

const usageColumns = `id, tenant_id, metric, current_value, peak_value, window_start, window_end, reset_at, updated_at`

const alertColumns = `id, tenant_id, metric, current_value, limit_value, usage_pct, alert_level, notified_at`

// planRow is the scan shape for tenant_quota_plan: models.QuotaPlan with the
// threshold list held as its raw column string until decodeThresholds. The db
// tags are mandatory, not optional -- sqlx's default NameMapper is
// strings.ToLower, which maps the column "tenant_id" but the field TenantID to
// "tenantid", so an untagged read fails with "missing destination name
// tenant_id".
type planRow struct {
	ID                  string    `db:"id"`
	TenantID            string    `db:"tenant_id"`
	Name                string    `db:"name"`
	Description         string    `db:"description"`
	Status              string    `db:"status"`
	APIRateLimitPerMin  int       `db:"api_rate_limit_per_min"`
	APIRateLimitPerHour int       `db:"api_rate_limit_per_hour"`
	MaxCIs              int       `db:"max_cis"`
	MaxUsers            int       `db:"max_users"`
	MaxStorageMB        int64     `db:"max_storages_mb"`
	MaxPipelines        int       `db:"max_pipelines"`
	MaxConcurrentJobs   int       `db:"max_concurrent_jobs"`
	MaxAlertsPerDay     int       `db:"max_alerts_per_day"`
	SLATier             string    `db:"sla_tier"`
	SoftLimit           int64     `db:"soft_limit"`
	HardLimit           int64     `db:"hard_limit"`
	OverLimitAction     string    `db:"over_limit_action"`
	WarnThresholdsRaw   string    `db:"warn_thresholds"`
	CreatedAt           time.Time `db:"created_at"`
	UpdatedAt           time.Time `db:"updated_at"`
}

// decodePlan copies a row into the API model. decodeThresholds is best-effort:
// a row with a malformed threshold list still answers with the rest of its
// fields, because the write path is the only place that can repair it.
func decodePlan(row *planRow) *models.QuotaPlan {
	return &models.QuotaPlan{
		ID:                  row.ID,
		TenantID:            row.TenantID,
		Name:                row.Name,
		Description:         row.Description,
		Status:              row.Status,
		APIRateLimitPerMin:  row.APIRateLimitPerMin,
		APIRateLimitPerHour: row.APIRateLimitPerHour,
		MaxCIs:              row.MaxCIs,
		MaxUsers:            row.MaxUsers,
		MaxStorageMB:        row.MaxStorageMB,
		MaxPipelines:        row.MaxPipelines,
		MaxConcurrentJobs:   row.MaxConcurrentJobs,
		MaxAlertsPerDay:     row.MaxAlertsPerDay,
		SLATier:             row.SLATier,
		SoftLimit:           row.SoftLimit,
		HardLimit:           row.HardLimit,
		OverLimitAction:     row.OverLimitAction,
		WarnThresholds:      decodeThresholds(row.WarnThresholdsRaw),
		CreatedAt:           row.CreatedAt,
		UpdatedAt:           row.UpdatedAt,
	}
}

type usageRow struct {
	ID           string    `db:"id"`
	TenantID     string    `db:"tenant_id"`
	Metric       string    `db:"metric"`
	CurrentValue int64     `db:"current_value"`
	PeakValue    int64     `db:"peak_value"`
	WindowStart  time.Time `db:"window_start"`
	WindowEnd    time.Time `db:"window_end"`
	ResetAt      time.Time `db:"reset_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

func decodeUsage(row *usageRow) *models.QuotaUsage {
	return &models.QuotaUsage{
		ID:           row.ID,
		TenantID:     row.TenantID,
		Metric:       row.Metric,
		CurrentValue: row.CurrentValue,
		PeakValue:    row.PeakValue,
		WindowStart:  row.WindowStart,
		WindowEnd:    row.WindowEnd,
		ResetAt:      row.ResetAt,
		UpdatedAt:    row.UpdatedAt,
	}
}

type alertRow struct {
	ID           string    `db:"id"`
	TenantID     string    `db:"tenant_id"`
	Metric       string    `db:"metric"`
	CurrentValue int64     `db:"current_value"`
	LimitValue   int64     `db:"limit_value"`
	UsagePct     float64   `db:"usage_pct"`
	AlertLevel   string    `db:"alert_level"`
	NotifiedAt   time.Time `db:"notified_at"`
}

func decodeAlert(row *alertRow) *models.QuotaAlert {
	return &models.QuotaAlert{
		ID:           row.ID,
		TenantID:     row.TenantID,
		Metric:       row.Metric,
		CurrentValue: row.CurrentValue,
		LimitValue:   row.LimitValue,
		UsagePct:     row.UsagePct,
		AlertLevel:   row.AlertLevel,
		NotifiedAt:   row.NotifiedAt,
	}
}

// decodeThresholds is the inverse of encodeThresholds. Non-numeric fragments
// are dropped rather than failing the read, and the result is normalised the
// way the service expects it (ascending, deduped, clamped to [0, 100]) so a
// hand-edited row cannot produce a plan whose warning bands are unsorted.
func decodeThresholds(raw string) []int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]int, 0, len(parts))
	seen := make(map[int]struct{}, len(parts))
	for _, p := range parts {
		v, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil {
			continue
		}
		if v < 0 {
			v = 0
		}
		if v > 100 {
			v = 100
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	sort.Ints(out)
	return out
}

// encodeThresholds renders the threshold list in the form the column stores.
// It is comma-separated rather than JSONB because the service already serialises
// the list with joinInts; keeping the wire format in the column avoids a second
// representation of the same data. The column's NOT NULL default is the empty
// string, so an empty list is a legitimate value.
func encodeThresholds(in []int) string {
	parts := make([]string, 0, len(in))
	for _, v := range in {
		parts = append(parts, strconv.Itoa(v))
	}
	return strings.Join(parts, ",")
}

// bindPlan is the named-argument map for tenant_quota_plan. Passing an explicit
// map rather than the struct removes any dependence on sqlx's NameMapper, which
// in v1.4.0 keys a named argument off the raw db tag value.
func bindPlan(p *models.QuotaPlan) map[string]interface{} {
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	if p.UpdatedAt.IsZero() {
		p.UpdatedAt = p.CreatedAt
	}
	return map[string]interface{}{
		"id":                      p.ID,
		"tenant_id":               p.TenantID,
		"name":                    p.Name,
		"description":             p.Description,
		"status":                  p.Status,
		"api_rate_limit_per_min":  p.APIRateLimitPerMin,
		"api_rate_limit_per_hour": p.APIRateLimitPerHour,
		"max_cis":                 p.MaxCIs,
		"max_users":               p.MaxUsers,
		"max_storages_mb":         p.MaxStorageMB,
		"max_pipelines":           p.MaxPipelines,
		"max_concurrent_jobs":     p.MaxConcurrentJobs,
		"max_alerts_per_day":      p.MaxAlertsPerDay,
		"sla_tier":                p.SLATier,
		"soft_limit":              p.SoftLimit,
		"hard_limit":              p.HardLimit,
		"over_limit_action":       p.OverLimitAction,
		"warn_thresholds":         encodeThresholds(p.WarnThresholds),
		"created_at":              p.CreatedAt,
		"updated_at":              p.UpdatedAt,
	}
}

func (r *Repository) CreatePlan(ctx context.Context, p *models.QuotaPlan) error {
	// All twenty columns are named. The pre-R43 INSERT omitted soft_limit,
	// hard_limit, over_limit_action and warn_thresholds, so a plan created with
	// a policy came back from the database without it.
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_quota_plan (id, tenant_id, name, description, status,
			api_rate_limit_per_min, api_rate_limit_per_hour, max_cis, max_users,
			max_storages_mb, max_pipelines, max_concurrent_jobs, max_alerts_per_day,
			sla_tier, soft_limit, hard_limit, over_limit_action, warn_thresholds,
			created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :status,
			:api_rate_limit_per_min, :api_rate_limit_per_hour, :max_cis, :max_users,
			:max_storages_mb, :max_pipelines, :max_concurrent_jobs, :max_alerts_per_day,
			:sla_tier, :soft_limit, :hard_limit, :over_limit_action, :warn_thresholds,
			:created_at, :updated_at)`,
		bindPlan(p))
	return err
}

func (r *Repository) GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error) {
	var row planRow
	err := r.db.GetContext(ctx, &row,
		"SELECT "+planColumns+" FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return decodePlan(&row), nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error) {
	var rows []planRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+planColumns+" FROM tenant_quota_plan WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	items := make([]models.QuotaPlan, 0, len(rows))
	for i := range rows {
		items = append(items, *decodePlan(&rows[i]))
	}
	return items, nil
}

// planUpdatable lists the columns a partial update may touch, in a fixed order.
// id, tenant_id, created_at and updated_at are deliberately absent: the first
// two are identity and the latter two are managed by the statement itself.
var planUpdatable = []string{
	"name", "description", "status",
	"api_rate_limit_per_min", "api_rate_limit_per_hour",
	"max_cis", "max_users", "max_storages_mb", "max_pipelines",
	"max_concurrent_jobs", "max_alerts_per_day", "sla_tier",
	"soft_limit", "hard_limit", "over_limit_action", "warn_thresholds",
}

// buildPlanSET renders "col = $1, col = $2, ..." for the entries of attrs that
// are allowed, in planUpdatable's order, and returns the values to bind. Walking
// the whitelist rather than the map keeps the generated SQL deterministic,
// because Go maps have no iteration order. A key outside the whitelist is an
// error instead of being interpolated into the SQL as a column name: the
// previous code did fmt.Sprintf("%s=?", k) over the caller's map keys, which on
// PUT /tenant-quota/plans/:id was a SQL injection sink.
func buildPlanSET(attrs map[string]interface{}) (string, []interface{}, error) {
	ok := make(map[string]bool, len(planUpdatable))
	for _, col := range planUpdatable {
		ok[col] = true
	}
	for k := range attrs {
		if !ok[k] {
			return "", nil, fmt.Errorf("column %q is not updatable", k)
		}
	}
	clauses := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs))
	for _, col := range planUpdatable {
		v, exists := attrs[col]
		if !exists {
			continue
		}
		args = append(args, v)
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	return strings.Join(clauses, ", "), args, nil
}

func (r *Repository) UpdatePlan(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.QuotaPlan, error) {
	if len(attrs) == 0 {
		return r.GetPlan(ctx, id, tenantID)
	}
	setClause, args, err := buildPlanSET(attrs)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE tenant_quota_plan SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetPlan(ctx, id, tenantID)
}

func (r *Repository) DeletePlan(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, err
	}
	// The row count is the "was it deleted?" answer, so a failure reading it is
	// a failure: discarding it made a real statement error report as
	// "not deleted" instead of surfacing.
	rows, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("counting deleted quota plans: %w", err)
	}
	return rows > 0, nil
}

// GetUsage returns (nil, nil) when the tenant has no row for the metric yet.
// Returning sql.ErrNoRows here was the defect: handler.GetUsage has an explicit
// "if u == nil" branch that answers with currentValue 0, and service.CheckQuota
// and CheckQuotaWithPolicy both guard "if usage != nil", so nil is the
// documented answer for an absent row. As written, POST /tenant-quota/check and
// POST /tenant-quota/check-with-policy returned 500 for any tenant that had no
// usage yet.
func (r *Repository) GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error) {
	var row usageRow
	err := r.db.GetContext(ctx, &row,
		"SELECT "+usageColumns+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1",
		tenantID, metric)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return decodeUsage(&row), nil
}

func (r *Repository) IncrementUsage(ctx context.Context, tenantID, metric string, amount int64, resetAt time.Time) (*models.QuotaUsage, error) {
	existing, err := r.GetUsage(ctx, tenantID, metric)
	if err != nil {
		// A statement failure is not the same as an absent row. Folding both
		// into "create new" made a failed read race to INSERT a second row for
		// the same (tenant, metric).
		return nil, err
	}
	if existing != nil {
		existing.CurrentValue += amount
		if existing.CurrentValue > existing.PeakValue {
			existing.PeakValue = existing.CurrentValue
		}
		existing.UpdatedAt = time.Now()
		if err := r.updateUsage(ctx, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	now := time.Now()
	u := models.QuotaUsage{
		// id is VARCHAR(36) NOT NULL PRIMARY KEY, so an empty ID fails the insert
		// and the first increment per (tenant, metric) always died.
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Metric:       metric,
		CurrentValue: amount,
		PeakValue:    amount,
		WindowStart:  now,
		WindowEnd:    now.Add(time.Hour),
		ResetAt:      resetAt,
		UpdatedAt:    now,
	}
	if err := r.createUsage(ctx, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) createUsage(ctx context.Context, u *models.QuotaUsage) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_quota_usage (id, tenant_id, metric, current_value, peak_value, window_start, window_end, reset_at, updated_at)
		VALUES (:id, :tenant_id, :metric, :current_value, :peak_value, :window_start, :window_end, :reset_at, :updated_at)`,
		map[string]interface{}{
			"id":            u.ID,
			"tenant_id":     u.TenantID,
			"metric":        u.Metric,
			"current_value": u.CurrentValue,
			"peak_value":    u.PeakValue,
			"window_start":  u.WindowStart,
			"window_end":    u.WindowEnd,
			"reset_at":      u.ResetAt,
			"updated_at":    u.UpdatedAt,
		})
	return err
}

func (r *Repository) updateUsage(ctx context.Context, u *models.QuotaUsage) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE tenant_quota_usage SET current_value = $1, peak_value = $2, window_start = $3, window_end = $4, reset_at = $5, updated_at = $6 WHERE tenant_id = $7 AND metric = $8",
		u.CurrentValue, u.PeakValue, u.WindowStart, u.WindowEnd, u.ResetAt, u.UpdatedAt, u.TenantID, u.Metric)
	return err
}

func (r *Repository) ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsage, error) {
	var rows []usageRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+usageColumns+" FROM tenant_quota_usage WHERE tenant_id = $1 ORDER BY metric", tenantID)
	if err != nil {
		return nil, err
	}
	items := make([]models.QuotaUsage, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeUsage(&rows[i]))
	}
	return items, nil
}

func (r *Repository) ResetUsage(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE tenant_quota_usage SET current_value = 0, updated_at = NOW() WHERE tenant_id = $1", tenantID)
	return err
}

func (r *Repository) CreateAlert(ctx context.Context, a *models.QuotaAlert) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO tenant_quota_alert (id, tenant_id, metric, current_value, limit_value, usage_pct, alert_level, notified_at)
		VALUES (:id, :tenant_id, :metric, :current_value, :limit_value, :usage_pct, :alert_level, :notified_at)`,
		map[string]interface{}{
			"id":            a.ID,
			"tenant_id":     a.TenantID,
			"metric":        a.Metric,
			"current_value": a.CurrentValue,
			"limit_value":   a.LimitValue,
			"usage_pct":     a.UsagePct,
			"alert_level":   a.AlertLevel,
			"notified_at":   a.NotifiedAt,
		})
	return err
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error) {
	var rows []alertRow
	err := r.db.SelectContext(ctx, &rows,
		"SELECT "+alertColumns+" FROM tenant_quota_alert WHERE tenant_id = $1 ORDER BY notified_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	items := make([]models.QuotaAlert, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeAlert(&rows[i]))
	}
	return items, nil
}
