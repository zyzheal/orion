package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- Alert ----------

func (r *Repository) CreateAlert(ctx context.Context, a *models.Alert) error {
	a.CreatedAt = time.Now().UTC()
	a.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alerts (id, tenant_id, name, severity, status, fingerprint, source_type, source_id, source_name, labels, annotations, value, threshold, metric, is_duplicate, group_id, created_at, updated_at, resolved_at) VALUES (:id, :tenant_id, :name, :severity, :status, :fingerprint, :source_type, :source_id, :source_name, :labels, :annotations, :value, :threshold, :metric, :is_duplicate, :group_id, :created_at, :updated_at, :resolved_at)`, a)
	return err
}

func (r *Repository) GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	var a models.Alert
	err := r.db.GetContext(ctx, &a, `SELECT * FROM alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) DeleteAlert(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdateAlert(ctx context.Context, a *models.Alert) error {
	a.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE alerts SET name=:name, severity=:severity, status=:status, fingerprint=:fingerprint, source_type=:source_type, source_id=:source_id, source_name=:source_name, labels=:labels, annotations=:annotations, value=:value, threshold=:threshold, metric=:metric, is_duplicate=:is_duplicate, group_id=:group_id, updated_at=:updated_at, resolved_at=:resolved_at WHERE id=:id AND tenant_id=:tenant_id`, a)
	return err
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) ([]models.Alert, int, error) {
	if limit <= 0 {
		limit = 100
	}
	query := `SELECT * FROM alerts WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if severity != "" {
		query += fmt.Sprintf(" AND severity=$%d", argIdx)
		args = append(args, severity)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
	args = append(args, limit)
	var items []models.Alert
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, 0, err
	}
	// count
	countQuery := `SELECT count(*) FROM alerts WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if severity != "" {
		countQuery += fmt.Sprintf(" AND severity=$%d", ci)
		_ = countArgs[ci-2] // placeholder
		countArgs = append(countArgs, severity)
		ci++
	}
	if status != "" {
		countQuery += fmt.Sprintf(" AND status=$%d", ci)
		countArgs = append(countArgs, status)
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error) {
	var groups []models.AlertGroup
	err := r.db.SelectContext(ctx, &groups, `SELECT group_id as "groupId", fingerprint, count(*) as "alertCount", max(severity) as severity, max(status) as status, max(created_at) as created_at, max(updated_at) as updated_at FROM alerts WHERE tenant_id=$1 AND status != 'resolved' GROUP BY group_id, fingerprint ORDER BY max(updated_at) DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	// Fetch alerts for each group
	for i := range groups {
		alerts, _, _ := r.ListByGroup(ctx, tenantID, groups[i].GroupID)
		groups[i].Alerts = alerts
	}
	return groups, nil
}

func (r *Repository) ListByGroup(ctx context.Context, tenantID, groupID string) ([]models.Alert, int, error) {
	var items []models.Alert
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM alerts WHERE tenant_id=$1 AND group_id=$2 ORDER BY created_at DESC`, tenantID, groupID)
	if err != nil {
		return nil, 0, err
	}
	return items, len(items), nil
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.DedupStats, error) {
	var stats models.DedupStats
	err := r.db.GetContext(ctx, &stats, `SELECT count(DISTINCT group_id) as total_groups, count(*) as total_alerts, sum(CASE WHEN is_duplicate THEN 1 ELSE 0 END) as duplicates, sum(CASE WHEN NOT is_duplicate THEN 1 ELSE 0 END) as unique_alerts FROM alerts WHERE tenant_id=$1 AND status != 'resolved'`, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// ---------- Topology ----------

func (r *Repository) GetTopology(ctx context.Context, tenantID string) (*models.Topology, error) {
	var t models.Topology
	err := r.db.GetContext(ctx, &t, `SELECT * FROM alert_topologies WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) SetTopology(ctx context.Context, tenantID string, nodes, edges any) (*models.Topology, error) {
	t := &models.Topology{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	// Serialize nodes/edges to JSON
	if nodes != nil {
		if b, ok := nodes.([]byte); ok {
			t.Nodes = b
		} else {
			b, err := json.Marshal(nodes)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal nodes: %w", err)
			}
			t.Nodes = b
		}
	}
	if edges != nil {
		if b, ok := edges.([]byte); ok {
			t.Edges = b
		} else {
			b, err := json.Marshal(edges)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal edges: %w", err)
			}
			t.Edges = b
		}
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alert_topologies (id, tenant_id, nodes, edges, created_at, updated_at) VALUES (:id, :tenant_id, :nodes, :edges, :created_at, :updated_at)`, t)
	return t, err
}

func (r *Repository) UpdateNodeHealth(ctx context.Context, tenantID string, node models.NodeHealth) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alert_node_health (id, tenant_id, node_id, node_name, health, alert_count, last_update) VALUES (:id, :tenant_id, :nodeId, :nodeName, :health, :alertCount, :lastUpdate) ON CONFLICT (tenant_id, node_id) DO UPDATE SET health=EXCLUDED.health, alert_count=EXCLUDED.alert_count, last_update=EXCLUDED.last_update`,
		&node)
	return err
}

func (r *Repository) GetNodeHealth(ctx context.Context, tenantID string) ([]models.NodeHealth, error) {
	var nodes []models.NodeHealth
	err := r.db.SelectContext(ctx, &nodes, `SELECT node_id as "nodeId", node_name as "nodeName", health, alert_count as "alertCount", last_update as "lastUpdate" FROM alert_node_health WHERE tenant_id=$1 ORDER BY last_update DESC`, tenantID)
	return nodes, err
}

// ---------- Maintenance Window ----------

func (r *Repository) AddMaintenanceWindow(ctx context.Context, mw *models.MaintenanceWindow) error {
	mw.Status = "active"
	mw.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alert_maintenance_windows (id, tenant_id, name, start_time, end_time, scope, status, created_at) VALUES (:id, :tenant_id, :name, :start_time, :end_time, :scope, :status, :created_at)`, mw)
	return err
}

func (r *Repository) GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error) {
	var windows []models.MaintenanceWindow
	err := r.db.SelectContext(ctx, &windows, `SELECT * FROM alert_maintenance_windows WHERE tenant_id=$1 AND status='active' AND end_time > NOW() ORDER BY start_time`, tenantID)
	return windows, err
}

func (r *Repository) ExpireMaintenanceWindows(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE alert_maintenance_windows SET status='expired' WHERE tenant_id=$1 AND end_time <= NOW() AND status='active'`, tenantID)
	return err
}

func (r *Repository) IsWithinWindow(ctx context.Context, tenantID string, name string, at time.Time) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM alert_maintenance_windows WHERE tenant_id=$1 AND name=$2 AND status='active' AND start_time <= $3 AND end_time >= $3)`, tenantID, name, at)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// ---------- Known Issue ----------

func (r *Repository) AddKnownIssue(ctx context.Context, ki *models.KnownIssue) error {
	ki.CreatedAt = time.Now().UTC()
	ki.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO alert_known_issues (id, tenant_id, title, description, fingerprint_pattern, label_selectors, silence_duration, status, created_at, updated_at) VALUES (:id, :tenant_id, :title, :description, :fingerprint_pattern, :label_selectors, :silence_duration, :status, :created_at, :updated_at)`, ki)
	return err
}

func (r *Repository) GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error) {
	var issues []models.KnownIssue
	err := r.db.SelectContext(ctx, &issues, `SELECT * FROM alert_known_issues WHERE tenant_id=$1 AND status='open' ORDER BY created_at DESC`, tenantID)
	return issues, err
}

func (r *Repository) GetKnownIssueByPattern(ctx context.Context, tenantID, pattern string) (*models.KnownIssue, error) {
	var ki models.KnownIssue
	err := r.db.GetContext(ctx, &ki, `SELECT * FROM alert_known_issues WHERE tenant_id=$1 AND status='open' AND fingerprint_pattern=$2 ORDER BY created_at DESC LIMIT 1`, tenantID, pattern)
	if err != nil {
		return nil, err
	}
	return &ki, nil
}

// ---------- Suppression Stats ----------

func (r *Repository) GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error) {
	var stats models.SuppressionStats
	err := r.db.GetContext(ctx, &stats, `SELECT 0 as total_suppressed, count(DISTINCT id) as active_windows, 0 as active_issues FROM alert_maintenance_windows WHERE tenant_id=$1 AND status='active'`, tenantID)
	if err != nil {
		return nil, err
	}
	// Add active known issues count
	var issuesCount int
	err = r.db.GetContext(ctx, &issuesCount, `SELECT count(*) FROM alert_known_issues WHERE tenant_id=$1 AND status='open'`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.ActiveIssues = issuesCount
	return &stats, nil
}
