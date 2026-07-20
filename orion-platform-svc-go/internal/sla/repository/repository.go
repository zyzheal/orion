package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sla/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- SLA Definitions ---

func (r *Repository) CreateDefinition(ctx context.Context, d *models.SLADefinition) error {
	d.ID = uuid.New().String()
	d.CreatedAt = time.Now().UTC()
	d.UpdatedAt = time.Now().UTC()
	if d.Status == "" {
		d.Status = "active"
	}
	query := `INSERT INTO sla_definitions (id, tenant_id, name, description, definition_type, target_value, target_unit,
		business_hours_only, priority, category, escalation_rules, metadata, status, created_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :type, :target_value, :target_unit,
		:business_hours_only, :priority, :category, :escalation_rules, :metadata, :status, :created_by, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, d)
	return err
}

func (r *Repository) GetDefinitionByID(ctx context.Context, tenantID, id string) (*models.SLADefinition, error) {
	var d models.SLADefinition
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM sla_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListDefinitions(ctx context.Context, tenantID string, q models.DefinitionListQuery) ([]models.SLADefinition, int, error) {
	if q.Limit <= 0 {
	q.Limit = 20
	}
	if q.Offset <= 0 {
	q.Offset = 0
	}

	whereParts := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	pos := 2
	if q.Type != "" {
		whereParts = append(whereParts, fmt.Sprintf("definition_type=$%d", pos))
		args = append(args, q.Type)
	pos++
	}
	if q.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status=$%d", pos))
	args = append(args, q.Status)
		pos++
	}
	if q.Category != "" {
		whereParts = append(whereParts, fmt.Sprintf("category=$%d", pos))
	args = append(args, q.Category)
		pos++
	}
	whereClause := "WHERE " + joinWhereParts(whereParts)

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf("SELECT COUNT(*) FROM sla_definitions %s", whereClause), args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SLADefinition
	sql := fmt.Sprintf("SELECT * FROM sla_definitions %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		whereClause, pos, pos+1)
	args = append(args, q.Limit, q.Offset)
	err = r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) UpdateDefinition(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE sla_definitions SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`,
		map[string]interface{}{"id": id, "tenant_id": tenantID})
	return err
}

func (r *Repository) DeleteDefinition(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sla_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- SLA Tracking ---

func (r *Repository) CreateTracking(ctx context.Context, t *models.SLATracking) error {
	t.ID = uuid.New().String()
	t.Status = "tracking"
	t.CreatedAt = time.Now().UTC()
t.UpdatedAt = time.Now().UTC()
	t.StartedAt = time.Now().UTC()
	query := `INSERT INTO sla_tracking (id, tenant_id, sla_definition_id, entity_type, entity_id,
		status, target_time, notes, started_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :sla_definition_id, :entity_type, :entity_id,
		:status, :target_time, :notes, :started_at, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, t)
	return err
}

func (r *Repository) GetTrackingByID(ctx context.Context, tenantID, id string) (*models.SLATracking, error) {
	var t models.SLATracking
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM sla_tracking WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTracking(ctx context.Context, tenantID string, q models.TrackingListQuery) ([]models.SLATracking, int, error) {
	if q.Limit <= 0 {
	q.Limit = 20
	}
	if q.Offset <= 0 {
	q.Offset = 0
	}

	whereParts := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	pos := 2
	if q.Status != "" {
		whereParts = append(whereParts, fmt.Sprintf("status=$%d", pos))
		args = append(args, q.Status)
		pos++
	}
	if q.EntityType != "" {
		whereParts = append(whereParts, fmt.Sprintf("entity_type=$%d", pos))
		args = append(args, q.EntityType)
		pos++
	}
	if q.EntityID != "" {
		whereParts = append(whereParts, fmt.Sprintf("entity_id=$%d", pos))
		args = append(args, q.EntityID)
		pos++
	}
	whereClause := "WHERE " + joinWhereParts(whereParts)

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf("SELECT COUNT(*) FROM sla_tracking %s", whereClause), args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SLATracking
	sql := fmt.Sprintf("SELECT * FROM sla_tracking %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		whereClause, pos, pos+1)
	args = append(args, q.Limit, q.Offset)
	err = r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) UpdateTracking(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	now := time.Now().UTC()
	updates["updated_at"] = now

	// Map request-field keys to DB column names; only update columns present.
	columns := map[string]string{
		"status":            "status",
		"sla_definition_id": "sla_definition_id",
		"entity_type":       "entity_type",
		"entity_id":         "entity_id",
		"target_time":       "target_time",
		"notes":             "notes",
		"pause_reason":      "pause_reason",
		"updated_at":        "updated_at",
	}

	fields := []string{}
	for key, col := range columns {
		if _, ok := updates[key]; ok {
			fields = append(fields, fmt.Sprintf("%s=:%s", col, col))
		}
	}
	if len(fields) == 0 {
		return nil
	}
	updates["id"] = id
	updates["tenant_id"] = tenantID
	query := fmt.Sprintf("UPDATE sla_tracking SET %s WHERE id=:id AND tenant_id=:tenant_id",
		joinWhereParts(fields))
	_, err := r.db.NamedExecContext(ctx, query, updates)
	return err
}

func (r *Repository) UpdateTrackingStatus(ctx context.Context, tenantID, id, status string, reason string) error {
	if reason != "" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE sla_tracking SET status=$1, pause_reason=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
			status, reason, id, tenantID)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) MarkMet(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status='met', actual_time=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

func (r *Repository) MarkBreached(ctx context.Context, tenantID, id, details string) error {
	// details logged at the application layer; update tracking row.
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status='breached', actual_time=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

func (r *Repository) PauseTracking(ctx context.Context, tenantID, id, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status='paused', pause_reason=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		reason, id, tenantID)
	return err
}

func (r *Repository) ResumeTracking(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status='tracking', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

// --- SLA Breach Events ---

func (r *Repository) CreateBreachEvent(ctx context.Context, e *models.SLABreachEvent) error {
	e.ID = uuid.New().String()
	e.BreachTime = time.Now().UTC()
	e.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO sla_breach_events (id, tenant_id, tracking_id, breach_time, breach_details, created_at)
		VALUES (:id, :tenant_id, :tracking_id, :breach_time, :breach_details, :created_at)`,
		e)
	return err
}

func (r *Repository) GetBreachEventsByTracking(ctx context.Context, trackingID string) ([]models.SLABreachEvent, error) {
	var events []models.SLABreachEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM sla_breach_events WHERE tracking_id=$1 ORDER BY created_at DESC`, trackingID)
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (r *Repository) ListBreachEvents(ctx context.Context, tenantID string, limit, offset int) ([]models.SLABreachEvent, int, error) {
	if limit <= 0 {
		limit = 20
	}
	var events []models.SLABreachEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM sla_breach_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM sla_breach_events WHERE tenant_id=$1`, tenantID)
	return events, total, err
}

func (r *Repository) DetectBreaches(ctx context.Context, tenantID string) (int, int, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE sla_tracking SET status='breached', actual_time=NOW(), updated_at=NOW()
			WHERE tenant_id=$1 AND status='tracking' AND target_time < NOW()`,
		tenantID)
	if err != nil {
		return 0, 0, err
	}
	n, _ := result.RowsAffected()

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id FROM sla_tracking WHERE tenant_id=$1 AND status='breached' AND updated_at >= NOW() - INTERVAL '1 minute'`,
		tenantID)
	if err != nil {
		return int(n), 0, err
	}
	var created int
	defer rows.Close()
	for rows.Next() {
		var trackingID, tTenantID string
		if err := rows.Scan(&trackingID, &tTenantID); err != nil {
			continue
		}
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO sla_breach_events (id, tenant_id, tracking_id, breach_time, created_at)
				VALUES ($1, $2, $3, NOW(), NOW())`,
			uuid.New().String(), tTenantID, trackingID)
		if err != nil {
			continue
		}
		created++
	}
	return int(n), created, nil
}

// --- Statistics ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.StatsResult, error) {
	stats := &models.StatsResult{}

	err := r.db.GetContext(ctx, &stats.TotalDefinitions,
		`SELECT COUNT(*) FROM sla_definitions WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.ActiveTrackings,
		`SELECT COUNT(*) FROM sla_tracking WHERE tenant_id=$1 AND status='tracking'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.MetCount,
		`SELECT COUNT(*) FROM sla_tracking WHERE tenant_id=$1 AND status='met'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.BreachedCount,
		`SELECT COUNT(*) FROM sla_tracking WHERE tenant_id=$1 AND status='breached'`, tenantID)
	if err != nil {
		return nil, err
	}

	var met, breached int
	err = r.db.GetContext(ctx, &met,
		`SELECT COUNT(*) FROM sla_tracking WHERE tenant_id=$1 AND status='met'`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &breached,
		`SELECT COUNT(*) FROM sla_tracking WHERE tenant_id=$1 AND status='breached'`, tenantID)
	if err != nil {
		return nil, err
	}
	total := met + breached
	if total > 0 {
		stats.ComplianceRate = float64(met) / float64(total)
	}

	return stats, nil
}

// --- Not found error helpers ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundSLA(id string) error {
	return fmt.Errorf("sla %q not found: %w", id, sentinel.NotFound)
}

// --- Helper ---

func joinWhereParts(parts []string) string {
	result := ""
	for i, p := range parts {
		if i == 0 {
			result = p
		} else {
			result += " AND " + p
		}
	}
	return result
}
