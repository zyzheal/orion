package repository

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
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
	query := `INSERT INTO sla_definitions (id, tenant_id, name, description, type, target_value, target_unit,
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
		whereParts = append(whereParts, fmt.Sprintf("type=$%d", pos))
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
	// The caller builds `updates` from the PUT body, one key per pointer field it
	// sent, so every key it passes must reach a SET clause. This method used to
	// stamp updated_at onto the map and then run a fixed
	// `SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2` -- the map was
	// thrown away, so PUT /sla/definitions/:id silently changed nothing.
	//
	// Column names come from the literal in this map, never from the caller, so no
	// input value can inject an identifier. id and tenant_id are deliberately not
	// keys here: they scope the WHERE clause and must not be settable through the
	// same statement that names the row.
	columns := map[string]string{
		"name":                "name",
		"description":         "description",
		"type":                "type",
		"target_value":        "target_value",
		"target_unit":         "target_unit",
		"business_hours_only": "business_hours_only",
		"priority":            "priority",
		"category":            "category",
		"escalation_rules":    "escalation_rules",
		"metadata":            "metadata",
		"status":              "status",
		"updated_at":          "updated_at",
	}
	fields := []string{}
	for key := range updates {
		col, ok := columns[key]
		if !ok {
			continue
		}
		fields = append(fields, fmt.Sprintf("%s=:%s", col, col))
	}
	if len(fields) == 0 {
		return nil
	}
	// The guard above runs before updated_at is injected, so a caller that only
	// names unlisted columns writes nothing at all. Without it the PUT body was
	// silently dropped and only updated_at moved, which is the same silent no-op
	// this method used to perform wholesale.
	updates["updated_at"] = time.Now().UTC()
	updates["id"] = id
	updates["tenant_id"] = tenantID
	if !containsField(fields, "updated_at=:updated_at") {
		fields = append(fields, "updated_at=:updated_at")
	}
	// Map iteration is unordered; sorting keeps the compiled statement stable so
	// an expectation written against it does not depend on the scheduler.
	sort.Strings(fields)
	query := fmt.Sprintf("UPDATE sla_definitions SET %s WHERE id=:id AND tenant_id=:tenant_id",
		strings.Join(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, query, updates)
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
	query := `INSERT INTO sla_trackings (id, tenant_id, sla_definition_id, entity_type, entity_id,
		status, target_time, notes, started_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :sla_definition_id, :entity_type, :entity_id,
		:status, :target_time, :notes, :started_at, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, t)
	return err
}

func (r *Repository) GetTrackingByID(ctx context.Context, tenantID, id string) (*models.SLATracking, error) {
	var t models.SLATracking
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM sla_trackings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
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
		fmt.Sprintf("SELECT COUNT(*) FROM sla_trackings %s", whereClause), args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.SLATracking
	sql := fmt.Sprintf("SELECT * FROM sla_trackings %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
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
	// fields is collected from a map, so without this sort the compiled statement
	// came out in a different order on every run: PATCH /sla/tracking/:id issued
	// a new statement each call and no test or expectation could pin it.
	sort.Strings(fields)
	// SET clauses are comma-separated. joinWhereParts joins with AND, which the
	// repository used to pass it -- UPDATE sla_trackings SET notes=$1 AND
	// status=$2 WHERE ... is not valid SQL, so PATCH /sla/tracking/:id with more
	// than one field in the body failed at the driver every time.
	query := fmt.Sprintf("UPDATE sla_trackings SET %s WHERE id=:id AND tenant_id=:tenant_id",
		strings.Join(fields, ", "))
	_, err := r.db.NamedExecContext(ctx, query, updates)
	return err
}

func (r *Repository) UpdateTrackingStatus(ctx context.Context, tenantID, id, status string, reason string) error {
	if reason != "" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE sla_trackings SET status=$1, pause_reason=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
			status, reason, id, tenantID)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_trackings SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) MarkMet(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_trackings SET status='met', actual_time=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

func (r *Repository) MarkBreached(ctx context.Context, tenantID, id, details string) error {
	// details logged at the application layer; update tracking row.
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_trackings SET status='breached', actual_time=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}

func (r *Repository) PauseTracking(ctx context.Context, tenantID, id, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_trackings SET status='paused', pause_reason=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		reason, id, tenantID)
	return err
}

func (r *Repository) ResumeTracking(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sla_trackings SET status='tracking', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
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

func (r *Repository) GetBreachEventsByTracking(ctx context.Context, tenantID, trackingID string) ([]models.SLABreachEvent, error) {
	// tracking_id is a VARCHAR(255) the caller of StartTracking chose for its own
	// entity; it is not a UUID and two tenants can hold the same value. Without
	// the tenant predicate GET /sla/tracking/:id/breaches answered with whichever
	// tenant had created that tracking id.
	var events []models.SLABreachEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM sla_breach_events WHERE tracking_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, trackingID, tenantID)
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
		`UPDATE sla_trackings SET status='breached', actual_time=NOW(), updated_at=NOW()
			WHERE tenant_id=$1 AND status='tracking' AND target_time < NOW()`,
		tenantID)
	if err != nil {
		return 0, 0, err
	}
	n, _ := result.RowsAffected()

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id FROM sla_trackings WHERE tenant_id=$1 AND status='breached' AND updated_at >= NOW() - INTERVAL '1 minute'`,
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
		`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status='tracking'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.MetCount,
		`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status='met'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.BreachedCount,
		`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status='breached'`, tenantID)
	if err != nil {
		return nil, err
	}

	var met, breached int
	err = r.db.GetContext(ctx, &met,
		`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status='met'`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &breached,
		`SELECT COUNT(*) FROM sla_trackings WHERE tenant_id=$1 AND status='breached'`, tenantID)
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

func containsField(fields []string, want string) bool {
	for _, f := range fields {
		if f == want {
			return true
		}
	}
	return false
}

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
