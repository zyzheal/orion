package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"strings"

	"orion/platform-svc-go/internal/alert-escalation/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO escalation_policy (id, tenant_id, name, description, severity, status, rules, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Severity, p.Status, p.Rules, p.CreatedBy, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *Repository) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	var p models.EscalationPolicy
	err := r.db.GetContext(ctx, &p, `SELECT * FROM escalation_policy WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	var items []models.EscalationPolicy
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM escalation_policy WHERE tenant_id=? ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdatePolicy(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationPolicy, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE escalation_policy SET %s WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetPolicy(ctx, id, tenantID)
}

func (r *Repository) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM escalation_policy WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) CreateTrigger(ctx context.Context, t *models.EscalationTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO escalation_trigger (id, tenant_id, policy_id, alert_id, level, target, channel, message, triggered_at, status, resolved_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.TenantID, t.PolicyID, t.AlertID, t.Level, t.Target, t.Channel, t.Message, t.TriggeredAt, t.Status, t.ResolvedAt)
	return err
}

func (r *Repository) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if policyID != "" {
		where += " AND policy_id=?"
		args = append(args, policyID)
	}
	query := fmt.Sprintf("SELECT * FROM escalation_trigger WHERE %s ORDER BY triggered_at DESC", where)
	var items []models.EscalationTrigger
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateTrigger(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationTrigger, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE escalation_trigger SET %s WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	var t models.EscalationTrigger
	err = r.db.GetContext(ctx, &t, `SELECT * FROM escalation_trigger WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateClosure(ctx context.Context, c *models.AlertClosure) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_closure (id, tenant_id, alert_id, status, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution_note, mttr_seconds, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.TenantID, c.AlertID, c.Status, c.AcknowledgedBy, c.AcknowledgedAt, c.ResolvedBy, c.ResolvedAt, c.ResolutionNote, c.MTTRSeconds, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *Repository) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	var c models.AlertClosure
	err := r.db.GetContext(ctx, &c, `SELECT * FROM alert_closure WHERE alert_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 1`, alertID, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if status != "" {
		where += " AND status=?"
		args = append(args, status)
	}
	query := fmt.Sprintf("SELECT * FROM alert_closure WHERE %s ORDER BY created_at DESC", where)
	var items []models.AlertClosure
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateClosure(ctx context.Context, alertID, tenantID string, attrs map[string]interface{}) (*models.AlertClosure, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, alertID, tenantID)
	query := fmt.Sprintf("UPDATE alert_closure SET %s WHERE alert_id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	c, err := r.GetClosure(ctx, alertID, tenantID)
	return c, err
}

func (r *Repository) CreateMetrics(ctx context.Context, m *models.AlertMetrics) error {
	date := m.MetricDate.Format("2006-01-02")
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO alert_metrics (id, tenant_id, metric_date, total_alerts, acknowledged_count, resolved_count, escalated_count, avg_response_seconds, avg_resolution_seconds, p95_response_seconds, p95_resolution_seconds, sla_breach_count, auto_remediation_success, auto_remediation_failed, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.TenantID, date, m.TotalAlerts, m.AcknowledgedCount, m.ResolvedCount, m.EscalatedCount,
		m.AvgResponseSeconds, m.AvgResolutionSeconds, m.P95ResponseSeconds, m.P95ResolutionSeconds,
		m.SLABreachCount, m.AutoRemediationSuccess, m.AutoRemediationFailed, m.CreatedAt)
	return err
}

func (r *Repository) ListMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	var items []models.AlertMetrics
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM alert_metrics WHERE tenant_id=? AND metric_date BETWEEN ? AND ? ORDER BY metric_date DESC`,
		tenantID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	return items, err
}

func init() {
	_ = json.Marshal
	_ = strings.Contains
}
