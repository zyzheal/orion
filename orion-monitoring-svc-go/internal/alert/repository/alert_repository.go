package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"orion/monitoring-svc-go/internal/alert/models"
)

// AlertRepository handles CRUD for the alerts table.
type AlertRepository struct {
	base BaseRepository
}

// AlertRuleRepository handles CRUD for the alert_rules table.
type AlertRuleRepository struct {
	base BaseRepository
}

// AlertSilenceRepository handles CRUD for the alert_silences table.
type AlertSilenceRepository struct {
	base BaseRepository
}

// AlertNotificationRepository handles CRUD for the alert_notifications table.
type AlertNotificationRepository struct {
	base BaseRepository
}

// DeduplicationRepository handles the alert_deduplication table.
type DeduplicationRepository struct {
	base BaseRepository
}

// CorrelationRepository handles the alert_correlation_groups table.
type CorrelationRepository struct {
	base BaseRepository
}

// RCARepository handles the rca_results table.
type RCARepository struct {
	base BaseRepository
}

// CreateAlert inserts a new alert and returns the created model.
func (r *AlertRepository) Create(ctx context.Context, a *models.Alert) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alerts (id, tenant_id, fingerprint, name, severity, status, source_type,
			source_id, source_name, labels, annotations, value, threshold, starts_at, ends_at,
			root_cause_alert_id, related_alert_ids, maintenance_window_id, known_issue_id, created_at, updated_at)
		VALUES (:id, :tenant_id, :fingerprint, :name, :severity, :status, :source_type,
			:source_id, :source_name, :labels, :annotations, :value, :threshold, :starts_at, :ends_at,
			:root_cause_alert_id, :related_alert_ids, :maintenance_window_id, :known_issue_id, NOW(), NOW())`,
		a,
	)
}

// GetByID retrieves an alert by id within a tenant.
func (r *AlertRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Alert, error) {
	var a models.Alert
	err := r.base.Get(ctx, &a, `
		SELECT * FROM alerts WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// List returns alerts matching filters for a tenant.
func (r *AlertRepository) List(ctx context.Context, tenantID uuid.UUID, req models.AlertQueryRequest) (models.AlertResponse, error) {
	limit, offset := req.Limit, req.Offset
	if limit <= 0 {
		limit = 50
	}
	where, args := "1=1", []interface{}{tenantID}
	argIdx := 3
	if req.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, req.Status)
		argIdx++
	}
	if req.Severity != "" {
		where += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, req.Severity)
		argIdx++
	}
	if req.Fingerprint != "" {
		where += fmt.Sprintf(" AND fingerprint = $%d", argIdx)
		args = append(args, req.Fingerprint)
		argIdx++
	}
	if req.SourceID != "" {
		where += fmt.Sprintf(" AND source_id = $%d", argIdx)
		args = append(args, req.SourceID)
		argIdx++
	}
	limitIdx, offsetIdx := argIdx, argIdx+1
	where += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", limitIdx, offsetIdx)
	args = append(args, limit, offset)

	var resp models.AlertResponse
	err := r.base.Select(ctx, &resp.Data, fmt.Sprintf(`
		SELECT * FROM alerts WHERE tenant_id = $1 AND %s`, where), args...)
	if err != nil {
		return resp, err
	}

	countArgs := args[:len(args)-2]
	err = r.base.Get(ctx, &resp.Total, fmt.Sprintf(`
		SELECT COUNT(*) FROM alerts WHERE tenant_id = $1 AND %s`,
		where), countArgs...)
	return resp, err
}

// UpdateStatus sets the status on an alert.
func (r *AlertRepository) UpdateStatus(ctx context.Context, tenantID, id uuid.UUID, status string) error {
	_, err := r.base.Exec(ctx, `
		UPDATE alerts SET status = $1, updated_at = NOW()
		WHERE id = $2 AND tenant_id = $3`, status, id, tenantID)
	return err
}

// Resolve sets status=resolved and populated fields.
func (r *AlertRepository) Resolve(ctx context.Context, tenantID, id uuid.UUID) error {
	now := r.base.Now()
	_, err := r.base.Exec(ctx, `
		UPDATE alerts SET status = 'resolved', resolved_at = $1, ends_at = $1, updated_at = $1
		WHERE id = $2 AND tenant_id = $3`, now, id, tenantID)
	return err
}

// Update updates fields on an alert.
func (r *AlertRepository) Update(ctx context.Context, a *models.Alert) error {
	set := "updated_at = NOW()"
	args := []interface{}{}
	argIdx := 4
	if a.Severity != "" {
		set += fmt.Sprintf(", severity = $%d", argIdx)
		args = append(args, a.Severity)
		argIdx++
	}
	if a.Status != "" {
		set += fmt.Sprintf(", status = $%d", argIdx)
		args = append(args, a.Status)
		argIdx++
	}
	if a.Value != 0 {
		set += fmt.Sprintf(", value = $%d", argIdx)
		args = append(args, a.Value)
		argIdx++
	}
	if a.Threshold != 0 {
		set += fmt.Sprintf(", threshold = $%d", argIdx)
		args = append(args, a.Threshold)
		argIdx++
	}
	if a.ResolvedAt != nil {
		set += fmt.Sprintf(", resolved_at = $%d", argIdx)
		args = append(args, a.ResolvedAt)
		argIdx++
	}
	if a.Annotations != nil {
		set += fmt.Sprintf(", annotations = $%d", argIdx)
		args = append(args, a.Annotations)
		argIdx++
	}
	args = append([]interface{}{set, a.ID, a.TenantID}, args...)
	_, err := r.base.Exec(ctx, fmt.Sprintf(`
		UPDATE alerts SET %s WHERE id = $1 AND tenant_id = $2`, set), args...)
	return err
}

// Delete removes an alert.
func (r *AlertRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	_, err := r.base.Exec(ctx, `
		DELETE FROM alerts WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ==================== AlertRule CRUD ====================

func (r *AlertRuleRepository) Create(ctx context.Context, rule *models.AlertRule) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alert_rules (id, tenant_id, name, description, rule_type, condition,
			severity, enabled, notification_channels, evaluation_interval_sec, cooldown_sec,
			created_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :rule_type, :condition,
			:severity, :enabled, :notification_channels, :evaluation_interval_sec, :cooldown_sec,
			:created_by, NOW(), NOW())`, rule)
}

func (r *AlertRuleRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.AlertRule, error) {
	var rule models.AlertRule
	err := r.base.Get(ctx, &rule, `
		SELECT * FROM alert_rules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return &rule, err
}

func (r *AlertRuleRepository) List(ctx context.Context, tenantID uuid.UUID) (models.AlertRuleResponse, error) {
	var resp models.AlertRuleResponse
	err := r.base.Select(ctx, &resp.Data, `
		SELECT * FROM alert_rules WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return resp, err
	}
	err = r.base.Get(ctx, &resp.Total, `
		SELECT COUNT(*) FROM alert_rules WHERE tenant_id = $1`, tenantID)
	return resp, err
}

func (r *AlertRuleRepository) Update(ctx context.Context, id uuid.UUID, tenantID uuid.UUID, rule *models.AlertRule) error {
	set := "updated_at = NOW()"
	args := []interface{}{}
	argIdx := 4
	if rule.Name != "" {
		set += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, rule.Name)
		argIdx++
	}
	if rule.Condition != nil {
		set += fmt.Sprintf(", condition = $%d", argIdx)
		args = append(args, rule.Condition)
		argIdx++
	}
	if rule.Severity != "" {
		set += fmt.Sprintf(", severity = $%d", argIdx)
		args = append(args, rule.Severity)
		argIdx++
	}
	if rule.Enabled {
		set += fmt.Sprintf(", enabled = $%d", argIdx)
		args = append(args, true)
		argIdx++
	}
	args = append([]interface{}{set, id, tenantID}, args...)
	_, err := r.base.Exec(ctx, fmt.Sprintf(`
		UPDATE alert_rules SET %s WHERE id = $1 AND tenant_id = $2`, set), args...)
	return err
}

func (r *AlertRuleRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	_, err := r.base.Exec(ctx, `
		DELETE FROM alert_rules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ==================== AlertSilence CRUD ====================

func (r *AlertSilenceRepository) Create(ctx context.Context, s *models.AlertSilence) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alert_silences (id, tenant_id, name, description, silence_type, matchers,
			starts_at, ends_at, created_by, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :silence_type, :matchers,
			:starts_at, :ends_at, :created_by, :enabled, NOW(), NOW())`, s)
}

func (r *AlertSilenceRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*models.AlertSilence, error) {
	var s models.AlertSilence
	err := r.base.Get(ctx, &s, `
		SELECT * FROM alert_silences WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return &s, err
}

func (r *AlertSilenceRepository) List(ctx context.Context, tenantID uuid.UUID) (models.AlertSilenceResponse, error) {
	var resp models.AlertSilenceResponse
	err := r.base.Select(ctx, &resp.Data, `
		SELECT * FROM alert_silences WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return resp, err
	}
	err = r.base.Get(ctx, &resp.Total, `
		SELECT COUNT(*) FROM alert_silences WHERE tenant_id = $1`, tenantID)
	return resp, err
}

func (r *AlertSilenceRepository) Active(ctx context.Context, tenantID uuid.UUID) ([]models.AlertSilence, error) {
	var list []models.AlertSilence
	err := r.base.Select(ctx, &list, `
		SELECT * FROM alert_silences
		WHERE tenant_id = $1 AND enabled = true
			AND starts_at <= NOW() AND ends_at > NOW()
		ORDER BY created_at DESC`, tenantID)
	return list, err
}

func (r *AlertSilenceRepository) Update(ctx context.Context, id uuid.UUID, tenantID uuid.UUID, s *models.AlertSilence) error {
	set := "updated_at = NOW()"
	args := []interface{}{}
	argIdx := 4
	if s.Name != "" {
		set += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, s.Name)
		argIdx++
	}
	if s.Matchers != nil {
		set += fmt.Sprintf(", matchers = $%d", argIdx)
		args = append(args, s.Matchers)
		argIdx++
	}
	if s.Enabled {
		set += fmt.Sprintf(", enabled = $%d", argIdx)
		args = append(args, true)
		argIdx++
	}
	if s.SilenceType != "" {
		set += fmt.Sprintf(", silence_type = $%d", argIdx)
		args = append(args, s.SilenceType)
		argIdx++
	}
	if s.EndsAt != r.base.ZeroTime() {
		set += fmt.Sprintf(", ends_at = $%d", argIdx)
		args = append(args, s.EndsAt)
		argIdx++
	}
	args = append([]interface{}{set, id, tenantID}, args...)
	_, err := r.base.Exec(ctx, fmt.Sprintf(`
		UPDATE alert_silences SET %s WHERE id = $1 AND tenant_id = $2`, set), args...)
	return err
}

func (r *AlertSilenceRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	_, err := r.base.Exec(ctx, `
		DELETE FROM alert_silences WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *AlertSilenceRepository) Expire(ctx context.Context) (int64, error) {
	result, err := r.base.Exec(ctx, `DELETE FROM alert_silences WHERE ends_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// ==================== AlertNotification CRUD ====================

func (r *AlertNotificationRepository) Create(ctx context.Context, n *models.AlertNotification) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alert_notifications (id, tenant_id, alert_id, channel, status, payload, error, sent_at, created_at)
		VALUES (:id, :tenant_id, :alert_id, :channel, :status, :payload, :error, :sent_at, NOW())`, n)
}

func (r *AlertNotificationRepository) List(ctx context.Context, tenantID uuid.UUID, alertID uuid.UUID) ([]models.AlertNotification, error) {
	var list []models.AlertNotification
	err := r.base.Select(ctx, &list, `
		SELECT * FROM alert_notifications
		WHERE tenant_id = $1 AND alert_id = $2
		ORDER BY created_at DESC`, tenantID, alertID)
	return list, err
}

func (r *AlertNotificationRepository) Recent(ctx context.Context, tenantID uuid.UUID, limit int) ([]models.AlertNotification, error) {
	var list []models.AlertNotification
	err := r.base.Select(ctx, &list, `
		SELECT * FROM alert_notifications WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`, tenantID, limit)
	return list, err
}

// ==================== Deduplication Repository ====================

func (r *DeduplicationRepository) Create(ctx context.Context, rec *models.DeduplicationRecord) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alert_deduplication (id, tenant_id, fingerprint, alert_id, first_seen, last_seen, occurrence_count, suppressed)
		VALUES (:id, :tenant_id, :fingerprint, :alert_id, :first_seen, :last_seen, :occurrence_count, :suppressed)`, rec)
}

func (r *DeduplicationRepository) GroupByFingerprint(ctx context.Context, tenantID uuid.UUID, fingerprint string) (*models.AlertGroup, error) {
	var rec models.DeduplicationRecord
	err := r.base.Get(ctx, &rec, `
		SELECT fingerprint, MIN(first_seen) AS first_seen, MAX(last_seen) AS last_seen,
			SUM(occurrence_count) AS occurrence_count, MAX(suppressed) AS suppressed
		FROM alert_deduplication
		WHERE tenant_id = $1 AND fingerprint = $2
		GROUP BY fingerprint`, tenantID, fingerprint)
	if err != nil {
		return nil, err
	}
	return &models.AlertGroup{
		Fingerprint:     rec.Fingerprint,
		Count:           rec.OccurrenceCount,
		FirstOccurrence: rec.FirstSeen,
		LastOccurrence:  rec.LastSeen,
		Suppressed:      rec.Suppressed,
	}, nil
}

func (r *DeduplicationRepository) CountByGroup(ctx context.Context, tenantID uuid.UUID, fingerprint string) (int, error) {
	var count int
	err := r.base.Get(ctx, &count, `
		SELECT COUNT(*) FROM alert_deduplication WHERE tenant_id = $1 AND fingerprint = $2`, tenantID, fingerprint)
	return count, err
}

func (r *DeduplicationRepository) Expire(ctx context.Context, olderThan interface{}) (int64, error) {
	result, err := r.base.Exec(ctx, `DELETE FROM alert_deduplication WHERE last_seen < $1`, olderThan)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// ==================== Correlation Repository ====================

func (r *CorrelationRepository) Create(ctx context.Context, g *models.AlertCorrelationGroup) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO alert_correlation_groups (id, tenant_id, root_alert_id, correlated_alert_ids,
			common_labels, category, severity, first_fired_at, last_fired_at, total_count,
			unique_services, recommended_action, created_at, updated_at)
		VALUES (:id, :tenant_id, :root_alert_id, :correlated_alert_ids,
			:common_labels, :category, :severity, :first_fired_at, :last_fired_at, :total_count,
			:unique_services, :recommended_action, NOW(), NOW())`, g)
}

func (r *CorrelationRepository) List(ctx context.Context, tenantID uuid.UUID) ([]models.AlertCorrelationGroup, error) {
	var list []models.AlertCorrelationGroup
	err := r.base.Select(ctx, &list, `
		SELECT * FROM alert_correlation_groups
		WHERE tenant_id = $1 ORDER BY last_fired_at DESC`, tenantID)
	return list, err
}

func (r *CorrelationRepository) GetByRoot(ctx context.Context, tenantID uuid.UUID, rootID uuid.UUID) (*models.AlertCorrelationGroup, error) {
	var g models.AlertCorrelationGroup
	err := r.base.Get(ctx, &g, `
		SELECT * FROM alert_correlation_groups
		WHERE tenant_id = $1 AND root_alert_id = $2`, tenantID, rootID)
	return &g, err
}

func (r *CorrelationRepository) UpdateGroupAlerts(ctx context.Context, id uuid.UUID, correlated []uuid.UUID, count int, lastFired interface{}, labels json.RawMessage) error {
	_, err := r.base.Exec(ctx, `
		UPDATE alert_correlation_groups
		SET correlated_alert_ids = $1, total_count = $2, last_fired_at = $3,
			common_labels = $4, updated_at = NOW()
		WHERE id = $5`, correlated, count, lastFired, labels, id)
	return err
}

func (r *CorrelationRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	_, err := r.base.Exec(ctx, `DELETE FROM alert_correlation_groups WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ==================== RCA Repository ====================

func (r *RCARepository) Create(ctx context.Context, res *models.RCAResult) error {
	return r.base.NamedExec(ctx, `
		INSERT INTO rca_results (id, tenant_id, status, affected_services, correlated_alerts,
			root_cause, top_root_causes, topology_path, time_window_start, time_window_end,
			alert_count, group_count, completed_at)
		VALUES (:analysis_id, :tenant_id, :status, :affected_services, :correlated_alerts,
			:root_cause, :top_root_causes, :topology_path, :time_window_start, :time_window_end,
			:alert_count, :group_count, :completed_at)`, res)
}

func (r *RCARepository) GetByAnalysisID(ctx context.Context, tenantID uuid.UUID, analysisID string) (*models.RCAResult, error) {
	var res models.RCAResult
	err := r.base.Get(ctx, &res, `
		SELECT * FROM rca_results WHERE id = $1 AND tenant_id = $2`, analysisID, tenantID)
	return &res, err
}

func (r *RCARepository) List(ctx context.Context, tenantID uuid.UUID, limit int) ([]models.RCAResult, error) {
	var list []models.RCAResult
	err := r.base.Select(ctx, &list, `
		SELECT * FROM rca_results WHERE tenant_id = $1 ORDER BY completed_at DESC LIMIT $2`, tenantID, limit)
	return list, err
}

// ==================== Helpers for JSON marshaling ====================

// scanUUID is a helper that converts a raw slice into uuid.UUID.
func scanUUID(raw interface{}) (uuid.UUID, error) {
	switch v := raw.(type) {
	case uuid.UUID:
		return v, nil
	case []byte:
		return uuid.FromBytes(v)
	case string:
		return uuid.Parse(v)
	default:
		return uuid.Nil, fmt.Errorf("cannot scan %T as uuid", raw)
	}
}

// scanJSONRaw converts a raw value to json.RawMessage.
func scanJSONRaw(raw interface{}) (json.RawMessage, error) {
	switch v := raw.(type) {
	case []byte:
		return json.RawMessage(v), nil
	case string:
		return json.RawMessage(v), nil
	case json.RawMessage:
		return v, nil
	default:
		if raw == nil {
			return nil, nil
		}
		b, err := json.Marshal(raw)
		if err != nil {
			return nil, err
		}
		return b, nil
	}
}

// scanUUIDSlice parses a JSON array of UUIDs.
func scanUUIDSlice(raw interface{}) ([]uuid.UUID, error) {
	data, err := scanJSONRaw(raw)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, nil
	}
	var s []string
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, len(s))
	for i, v := range s {
		p, err := uuid.Parse(v)
		if err != nil {
			return nil, err
		}
		ids[i] = p
	}
	return ids, nil
}
