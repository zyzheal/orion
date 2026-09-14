package repository

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"

	"github.com/jmoiron/sqlx"
)

// The four column lists below are migration 397's own column sets in declaration
// order. Every read spells them out instead of using SELECT *: sqlx scans in
// safe mode, so a column the model does not declare would fail the whole read
// rather than being skipped, and a SELECT * list cannot be checked against a
// migration at all.
const (
	policyColumns  = `id, tenant_id, name, description, severity, status, rules, created_by, created_at, updated_at`
	triggerColumns = `id, tenant_id, policy_id, alert_id, level, target, channel, message, triggered_at, status, resolved_at`
	closureColumns = `id, tenant_id, alert_id, status, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution_note, mttr_seconds, created_at, updated_at`
	metricsColumns = `id, tenant_id, metric_date, total_alerts, acknowledged_count, resolved_count, escalated_count, avg_response_seconds, avg_resolution_seconds, p95_response_seconds, p95_resolution_seconds, sla_breach_count, auto_remediation_success, auto_remediation_failed, created_at`
)

// The three whitelists are the injection boundary of the UPDATE statements.
// Each of them used to build its SET clause with fmt.Sprintf("%s=?", key) over
// the caller's map keys, so a caller could write id (breaking the primary key
// and every index on it), tenant_id (moving a row into someone else's
// namespace) or policy_id (re-parenting an escalation to another policy).
// Those four identifiers are absent on purpose: they are identity, not data.
var (
	policyUpdatable = []string{
		"name", "description", "severity", "status", "rules", "updated_at",
	}
	triggerUpdatable = []string{
		"level", "target", "channel", "message", "triggered_at", "status", "resolved_at",
	}
	closureUpdatable = []string{
		"status", "acknowledged_by", "acknowledged_at", "resolved_by", "resolved_at",
		"resolution_note", "mttr_seconds", "updated_at",
	}
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// buildSET turns a caller-supplied attribute map into a SET clause whose column
// order is fixed by the whitelist rather than by the map's iteration order,
// and whose placeholder numbering is correct for whatever subset was supplied.
// An unknown key is an error instead of a silent drop, and an empty map is an
// error instead of an empty clause: the old code happily produced
// "UPDATE escalation_policy SET  WHERE ..." which Postgres answers with a
// syntax error that the handler then reported as 404 policy not found.
func buildSET(table string, attrs map[string]interface{}, updatable []string) (string, []interface{}, error) {
	known := map[string]bool{}
	for _, c := range updatable {
		known[c] = true
	}
	keys := make([]string, 0, len(attrs))
	for k := range attrs {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if !known[k] {
			return "", nil, fmt.Errorf("column %q is not updatable on %s", k, table)
		}
	}
	set := []string{}
	args := []interface{}{}
	for _, col := range updatable {
		v, ok := attrs[col]
		if !ok {
			continue
		}
		args = append(args, v)
		set = append(set, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if len(set) == 0 {
		return "", nil, fmt.Errorf("no updatable columns supplied for %s", table)
	}
	return strings.Join(set, ", "), args, nil
}

func (r *Repository) CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO escalation_policy ("+policyColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
		p.ID, p.TenantID, p.Name, p.Description, p.Severity, p.Status, p.Rules, p.CreatedBy, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *Repository) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	var p models.EscalationPolicy
	err := r.db.GetContext(ctx, &p, "SELECT "+policyColumns+" FROM escalation_policy WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	var items []models.EscalationPolicy
	err := r.db.SelectContext(ctx, &items, "SELECT "+policyColumns+" FROM escalation_policy WHERE tenant_id = $1 ORDER BY created_at DESC", tenantID)
	return items, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationPolicy, error) {
	set, args, err := buildSET("escalation_policy", attrs, policyUpdatable)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := "UPDATE escalation_policy SET " + set +
		" WHERE id = $" + strconv.Itoa(len(args)-1) +
		" AND tenant_id = $" + strconv.Itoa(len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetPolicy(ctx, id, tenantID)
}

func (r *Repository) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM escalation_policy WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

func (r *Repository) CreateTrigger(ctx context.Context, t *models.EscalationTrigger) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO escalation_trigger ("+triggerColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
		t.ID, t.TenantID, t.PolicyID, t.AlertID, t.Level, t.Target, t.Channel, t.Message, t.TriggeredAt, t.Status, t.ResolvedAt)
	return err
}

func (r *Repository) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	query := "SELECT " + triggerColumns + " FROM escalation_trigger WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	if policyID != "" {
		query += " AND policy_id = $2"
		args = append(args, policyID)
	}
	query += " ORDER BY triggered_at DESC"
	var items []models.EscalationTrigger
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateTrigger(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationTrigger, error) {
	set, args, err := buildSET("escalation_trigger", attrs, triggerUpdatable)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := "UPDATE escalation_trigger SET " + set +
		" WHERE id = $" + strconv.Itoa(len(args)-1) +
		" AND tenant_id = $" + strconv.Itoa(len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	var t models.EscalationTrigger
	err = r.db.GetContext(ctx, &t, "SELECT "+triggerColumns+" FROM escalation_trigger WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateClosure(ctx context.Context, c *models.AlertClosure) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO alert_closure ("+closureColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
		c.ID, c.TenantID, c.AlertID, c.Status, c.AcknowledgedBy, c.AcknowledgedAt, c.ResolvedBy, c.ResolvedAt, c.ResolutionNote, c.MTTRSeconds, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *Repository) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	var c models.AlertClosure
	err := r.db.GetContext(ctx, &c, "SELECT "+closureColumns+" FROM alert_closure WHERE alert_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", alertID, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	query := "SELECT " + closureColumns + " FROM alert_closure WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC"
	var items []models.AlertClosure
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateClosure(ctx context.Context, alertID, tenantID string, attrs map[string]interface{}) (*models.AlertClosure, error) {
	set, args, err := buildSET("alert_closure", attrs, closureUpdatable)
	if err != nil {
		return nil, err
	}
	args = append(args, alertID, tenantID)
	query := "UPDATE alert_closure SET " + set +
		" WHERE alert_id = $" + strconv.Itoa(len(args)-1) +
		" AND tenant_id = $" + strconv.Itoa(len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetClosure(ctx, alertID, tenantID)
}

func (r *Repository) CreateMetrics(ctx context.Context, m *models.AlertMetrics) error {
	// metric_date is a DATE column, so the value is bound as a string in the
	// layout Postgres parses for DATE.
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO alert_metrics ("+metricsColumns+") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
		m.ID, m.TenantID, m.MetricDate.Format("2006-01-02"), m.TotalAlerts, m.AcknowledgedCount, m.ResolvedCount,
		m.EscalatedCount, m.AvgResponseSeconds, m.AvgResolutionSeconds, m.P95ResponseSeconds,
		m.P95ResolutionSeconds, m.SLABreachCount, m.AutoRemediationSuccess, m.AutoRemediationFailed, m.CreatedAt)
	return err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	var items []models.AlertMetrics
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+metricsColumns+" FROM alert_metrics WHERE tenant_id = $1 AND metric_date BETWEEN $2 AND $3 ORDER BY metric_date DESC",
		tenantID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	return items, err
}
