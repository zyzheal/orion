package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"orion/platform-svc-go/internal/ai-degradation/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrConfigDisabled = errors.New("config disabled")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// unixNow returns current unix seconds.
func unixNow() int64 {
	return time.Now().UTC().Unix()
}

// ts returns unix timestamp as *int64.
func ts(t time.Time) *int64 {
	v := t.Unix()
	return &v
}

// toJSON marshals a value to a JSON string.
func toJSON(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

// jsonSlice marshals a slice to a JSON string.
func jsonSlice(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]", err
	}
	return string(b), nil
}

// nullString returns the string pointer (nil-safe for sqlx).
func nullString(s *string) *string {
	return s
}

// nullInt64 returns the int64 pointer (nil-safe for sqlx).
func nullInt64(i *int64) *int64 {
	return i
}

// --- DegradationConfig ---

func (r *Repository) CreateConfig(ctx context.Context, config *models.DegradationConfig) error {
	config.ID = uuid.New().String()
	now := unixNow()
	config.CreatedAt = now
	config.UpdatedAt = now
	config.Status = models.StatusInactive
	if config.Triggers == "" || config.Triggers == "null" {
		t, _ := jsonSlice([]models.TriggerConfig{})
		config.Triggers = t
	}
	if config.Actions == "" || config.Actions == "null" {
		a, _ := jsonSlice([]models.ActionConfig{})
		config.Actions = a
	}
	if config.Metadata == "" || config.Metadata == "null" {
		config.Metadata = "{}"
	}
	if config.Recovery == "" || config.Recovery == "null" {
		rc := models.RecoveryConfig{
			AutoRecover:         true,
			RecoveryTimeout:     60000,
			HealthCheckInterval: 10000,
			MinHealthyDuration:  30000,
		}
		b, err := json.Marshal(rc)
		if err != nil {
			return err
		}
		config.Recovery = string(b)
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_degradation_configs (id, name, description, service_name, strategy, status,
			triggers, actions, recovery, metadata, enabled, created_at, updated_at, last_triggered_at,
			trigger_count, tenant_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		config.ID, config.Name, config.Description, config.ServiceName, string(config.Strategy),
		string(config.Status), config.Triggers, config.Actions, config.Recovery, config.Metadata,
		config.Enabled, now, now, nullInt64(config.LastTriggeredAt), config.TriggerCount, config.TenantID,
)
	return err
}

func (r *Repository) GetConfig(ctx context.Context, tenantID, configID string) (*models.DegradationConfig, error) {
	var config models.DegradationConfig
	err := r.db.GetContext(ctx, &config,
		`SELECT id, name, description, service_name, strategy, status, triggers, actions, recovery, metadata,
			enabled, created_at, updated_at, last_triggered_at, trigger_count, tenant_id
		 FROM ai_degradation_configs WHERE id=$1 AND tenant_id=$2`, configID, tenantID)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *Repository) UpdateConfig(ctx context.Context, tenantID, configID string,
	name *string, description *string, triggers *string, actions *string,
	recovery *string, metadata *string) (*models.DegradationConfig, error) {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_degradation_configs SET
			name=COALESCE($1, name),
			description=COALESCE($2, description),
			triggers=COALESCE($3, triggers),
			actions=COALESCE($4, actions),
			recovery=COALESCE($5, recovery),
			metadata=COALESCE($6, metadata),
			updated_at=$7
		 WHERE id=$8 AND tenant_id=$9`,
		name, description, triggers, actions, recovery, metadata,
		updated, configID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetConfig(ctx, tenantID, configID)
}

func (r *Repository) UpdateConfigStatus(ctx context.Context, tenantID, configID string, enabled bool, status models.DegradationStatus) (*models.DegradationConfig, error) {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_degradation_configs SET enabled=$1, status=$2, updated_at=$3
		 WHERE id=$4 AND tenant_id=$5`,
		enabled, string(status), updated, configID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetConfig(ctx, tenantID, configID)
}

func (r *Repository) UpdateConfigTriggered(ctx context.Context, tenantID, configID string, triggeredAt int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_degradation_configs SET status=$1, last_triggered_at=$2, trigger_count=trigger_count+1, updated_at=$3
		 WHERE id=$4 AND tenant_id=$5`,
		string(models.StatusTriggered), triggeredAt, unixNow(), configID, tenantID)
	return err
}

func (r *Repository) UpdateConfigRecovered(ctx context.Context, tenantID, configID string) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_degradation_configs SET status=$1, updated_at=$2
		 WHERE id=$3 AND tenant_id=$4`,
		string(models.StatusInactive), updated, configID, tenantID)
	return err
}

func (r *Repository) DeleteConfig(ctx context.Context, tenantID, configID string) error {
	// Delete history first
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_degradation_history WHERE config_id=$1 AND tenant_id=$2`, configID, tenantID)
	if err != nil {
		return err
	}
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_degradation_configs WHERE id=$1 AND tenant_id=$2`, configID, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ListConfigs builds the SELECT query with optional filters, sorting, and pagination.
func (r *Repository) ListConfigs(ctx context.Context, tenantID string, q models.ListConfigsQuery) (*models.ConfigListResponse, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Sort == "" {
		q.Sort = "created_at"
	}
	if q.Order == "" {
		q.Order = "desc"
	}

	whereParts := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if q.ServiceName != "" {
		whereParts = append(whereParts, fmt.Sprintf("service_name=$%d", argIdx))
		args = append(args, q.ServiceName)
		argIdx++
	}
	if q.Strategy != "" {
		whereParts = append(whereParts, fmt.Sprintf("strategy=$%d", argIdx))
		args = append(args, q.Strategy)
		argIdx++
	}
	if q.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, q.Status)
		_ = argIdx
		argIdx++
	}
	if q.Enabled != "" {
		var enabled bool
		if q.Enabled == "true" {
			enabled = true
		} else {
			enabled = false
		}
		whereParts = append(whereParts, fmt.Sprintf("enabled=$%d", argIdx))
		args = append(args, enabled)
		_ = argIdx
		argIdx++
	}

	orderBy := fmt.Sprintf("%s %s", q.Sort, q.Order)
	whereClause := "WHERE " + joinStr(whereParts, " AND ")

	// Count
	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf("SELECT COUNT(*) FROM ai_degradation_configs %s", whereClause), args...)
	if err != nil {
		return nil, err
	}

	// Data
	selectFields := "id, name, description, service_name, strategy, status, triggers, actions, recovery, metadata, enabled, created_at, updated_at, last_triggered_at, trigger_count, tenant_id"
	dataQuery := fmt.Sprintf("SELECT %s FROM ai_degradation_configs %s ORDER BY %s LIMIT $%d OFFSET $%d",
		selectFields, whereClause, orderBy, argIdx, argIdx+1)
	args = append(args, q.Limit, q.Offset)

	configs := make([]models.DegradationConfig, 0)
	err = r.db.SelectContext(ctx, &configs, dataQuery, args...)
	if err != nil {
		return nil, err
	}

	return &models.ConfigListResponse{
		Data:   configs,
		Total:  total,
		Offset: q.Offset,
		Limit:  q.Limit,
	}, nil
}

// --- DegradationHistory ---

func (r *Repository) CreateHistory(ctx context.Context, history *models.DegradationHistory) error {
	history.ID = uuid.New().String()
	now := unixNow()
	history.CreatedAt = now
	if history.Actions == "" {
		b, err := jsonSlice([]string{})
		if err != nil {
			return err
		}
		history.Actions = b
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_degradation_history (id, config_id, triggered_at, recovered_at, trigger_type,
			trigger_value, trigger_threshold, duration, status, actions, tenant_id, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		history.ID, history.ConfigID, history.TriggeredAt, nullInt64(history.RecoveredAt),
		string(history.TriggerType), history.TriggerValue, history.TriggerThreshold,
		history.Duration, string(history.Status), history.Actions, history.TenantID, now,
)
	return err
}

func (r *Repository) UpdateHistoryRecovered(ctx context.Context, tenantID, historyID string, recoveredAt int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_degradation_history SET status=$1, recovered_at=$2
		 WHERE id=$3 AND tenant_id=$4`,
		string(models.HistoryStatusRecovered), recoveredAt, historyID, tenantID)
	return err
}

func (r *Repository) GetHistoryList(ctx context.Context, tenantID, configID string, q models.ListHistoryQuery) (*models.HistoryListResponse, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}

	// Count
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM ai_degradation_history WHERE config_id=$1 AND tenant_id=$2`, configID, tenantID)
	if err != nil {
		return nil, err
	}

	// Data
	fields := "id, config_id, triggered_at, recovered_at, trigger_type, trigger_value, trigger_threshold, duration, status, actions, tenant_id, created_at"
	query := fmt.Sprintf("SELECT %s FROM ai_degradation_history WHERE config_id=$1 AND tenant_id=$2 ORDER BY triggered_at DESC LIMIT $3 OFFSET $4", fields)
	histories := make([]models.DegradationHistory, 0)
	err = r.db.SelectContext(ctx, &histories, query, configID, tenantID, q.Limit, q.Offset)
	if err != nil {
		return nil, err
	}

	return &models.HistoryListResponse{
		Data:   histories,
		Total:  total,
		Offset: q.Offset,
		Limit:  q.Limit,
	}, nil
}

func (r *Repository) GetLatestTriggeredHistory(ctx context.Context, tenantID, configID string) (*models.DegradationHistory, error) {
	var h models.DegradationHistory
	err := r.db.GetContext(ctx, &h,
		`SELECT id, config_id, triggered_at, recovered_at, trigger_type, trigger_value, trigger_threshold, duration, status, actions, tenant_id, created_at
		 FROM ai_degradation_history WHERE config_id=$1 AND tenant_id=$2 AND status=$3
		 ORDER BY triggered_at DESC LIMIT 1`, configID, tenantID, string(models.HistoryStatusTriggered))
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// --- Global Status ---

func (r *Repository) CountActiveConfigs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ai_degradation_configs WHERE tenant_id=$1 AND status=$2`,
		tenantID, string(models.StatusTriggered))
	return count, err
}

func (r *Repository) CountTotalConfigs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM ai_degradation_configs WHERE tenant_id=$1`, tenantID)
	return count, err
}

// GetServiceSummary returns aggregated status per service.
type ServiceSummary struct {
	ServiceName        string `db:"service_name"`
	ActiveDegradations int    `db:"active_degradations"`
	LastIncident       *int64 `db:"last_incident"`
}

func (r *Repository) GetServiceSummary(ctx context.Context, tenantID string) ([]ServiceSummary, error) {
	summaries := make([]ServiceSummary, 0)
	serviceNames := make([]string, 0)
	err := r.db.SelectContext(ctx, &serviceNames,
		`SELECT DISTINCT service_name FROM ai_degradation_configs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return summaries, err
	}

	for _, name := range serviceNames {
		var ss ServiceSummary
		err := r.db.GetContext(ctx, &ss,
			`SELECT service_name,
				COUNT(*) FILTER (WHERE status=$2) AS active_degradations,
				MAX(last_triggered_at) AS last_incident
			FROM ai_degradation_configs
			WHERE tenant_id=$1 AND service_name=$3
			GROUP BY service_name`,
			tenantID, string(models.StatusTriggered), name)
		if err == sql.ErrNoRows {
			ss.ServiceName = name
			ss.ActiveDegradations = 0
		} else if err != nil {
			return summaries, err
		}
		summaries = append(summaries, ss)
	}
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].ServiceName < summaries[j].ServiceName
	})
	return summaries, nil
}

// SumTriggerCounts returns the total trigger count across all configs.
func (r *Repository) SumTriggerCounts(ctx context.Context, tenantID string) (int, error) {
	var sum sql.NullInt64
	err := r.db.GetContext(ctx, &sum,
		`SELECT COALESCE(SUM(trigger_count), 0) FROM ai_degradation_configs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, err
	}
	return int(sum.Int64), nil
}

// joinStr joins strings with a separator.
func joinStr(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
