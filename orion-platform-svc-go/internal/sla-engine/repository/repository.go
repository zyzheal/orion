package repository

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/sla-engine/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// profileColumns and trackerColumns list the columns a caller may write on
// sla_profiles and sla_trackers.
//
// UpdateProfile and UpdateTracker rendered every key of a caller-supplied map
// into "UPDATE <table> SET <key>=$N WHERE id=$1 AND tenant_id=$2". id and
// tenant_id were deleted before the walk, but nothing else was filtered: a
// typo'd column name, created_at, or any other real column of the table was
// spliced into the statement. Every key that reaches these two methods today is
// a hardcoded literal in service code, so this is the trust-seam check rather
// than the only check, and it also makes the row-identity columns impossible to
// touch instead of merely being deleted from the map first.
var profileColumns = map[string]bool{
	"name":              true,
	"type":              true,
	"priority":          true,
	"response_sla":      true,
	"resolution_sla":    true,
	"business_hours":    true,
	"weekends_included": true,
	"holidays_excluded": true,
	"working_days":      true,
	"working_hours":     true,
	"description":       true,
	"status":            true,
	"updated_at":        true,
}

var trackerColumns = map[string]bool{
	"sla_profile_id":      true,
	"target_id":           true,
	"target_type":         true,
	"opened_at":           true,
	"response_deadline":   true,
	"resolution_deadline": true,
	"response_time":       true,
	"resolution_time":     true,
	"paused_at":           true,
	"paused_reason":       true,
	"resumed_at":          true,
	"status":              true,
	"breach_reason":       true,
	"updated_at":          true,
}

// updateRows renders an UPDATE for table from updates and reports whether a row
// was actually changed.
//
// updates is copied before it is mutated: the previous version stamped
// updated_at and deleted id and tenant_id in the caller's map, so a caller that
// reused the map (calculator's tracker lifecycle does) would have seen its own
// id and tenant_id keys disappear between calls.
//
// Keys are sorted before the SET clause is built because Go maps iterate in
// unspecified order; unsorted, the same input rendered a different statement on
// every call and the placeholder order was unreproducible.
//
// RowsAffected is checked because Postgres evaluates SET before WHERE, so an
// UPDATE that matched nothing still returned a nil error and the caller reported
// a successful write for an id that does not exist.
func updateRows(ctx context.Context, db *sqlx.DB, table string, allowed map[string]bool, tenantID, id string, updates map[string]interface{}) error {
	set := make(map[string]interface{}, len(updates)+1)
	for k, v := range updates {
		set[k] = v
	}
	delete(set, "id")
	delete(set, "tenant_id")

	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	for _, k := range keys {
		if !allowed[k] {
			return fmt.Errorf("%w: column %q is not updatable on %s", sentinel.BadRequest, k, table)
		}
	}

	set["updated_at"] = time.Now().UTC()
	keys = append(keys, "updated_at")
	slices.Sort(keys)

	parts := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys)+2)
	for i, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, set[k])
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE %s SET %s WHERE id=$%d AND tenant_id=$%d",
		table, strings.Join(parts, ", "), len(args)-1, len(args))

	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("%s rows affected: %w", table, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: no %s row with id %q in tenant %q", sentinel.NotFound, table, id, tenantID)
	}
	return nil
}

// --- SLA Profiles ---

func (r *Repository) CreateProfile(ctx context.Context, m *models.SLAProfile) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Status == "" {
		m.Status = "active"
	}
	if m.Priority == "" {
		m.Priority = "P2"
	}
	if m.Type == "" {
		m.Type = "both"
	}
	query := `INSERT INTO sla_profiles (id, tenant_id, name, type, priority, response_sla, resolution_sla,
		business_hours, weekends_included, holidays_excluded, working_days, working_hours,
		description, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :type, :priority, :response_sla, :resolution_sla,
		:business_hours, :weekends_included, :holidays_excluded, :working_days, :working_hours,
		:description, :status, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetProfile(ctx context.Context, tenantID, id string) (*models.SLAProfile, error) {
	var m models.SLAProfile
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM sla_profiles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListProfiles(ctx context.Context, tenantID string, q models.ProfileListQuery) ([]models.SLAProfile, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if q.Priority != "" {
		conds = append(conds, fmt.Sprintf("priority=$%d", idx))
		args = append(args, q.Priority)
		idx++
	}
	if q.Type != "" {
		conds = append(conds, fmt.Sprintf("type=$%d", idx))
		args = append(args, q.Type)
		idx++
	}
	if q.Status != "" {
		conds = append(conds, fmt.Sprintf("status=$%d", idx))
		args = append(args, q.Status)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	sql := fmt.Sprintf("SELECT * FROM sla_profiles WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.SLAProfile
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

func (r *Repository) UpdateProfile(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	return updateRows(ctx, r.db, "sla_profiles", profileColumns, tenantID, id, updates)
}

func (r *Repository) DeleteProfile(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sla_profiles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- SLA Trackers ---

func (r *Repository) CreateTracker(ctx context.Context, m *models.SLATracker) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Status == "" {
		m.Status = "active"
	}
	query := `INSERT INTO sla_trackers (id, tenant_id, sla_profile_id, target_id, target_type,
		opened_at, response_deadline, resolution_deadline, response_time, resolution_time,
		paused_at, paused_reason, resumed_at, status, breach_reason, created_at, updated_at)
		VALUES (:id, :tenant_id, :sla_profile_id, :target_id, :target_type,
		:opened_at, :response_deadline, :resolution_deadline, :response_time, :resolution_time,
		:paused_at, :paused_reason, :resumed_at, :status, :breach_reason, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetTracker(ctx context.Context, tenantID, id string) (*models.SLATracker, error) {
	var m models.SLATracker
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM sla_trackers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListTrackers(ctx context.Context, tenantID string, q models.TrackerListQuery) ([]models.SLATracker, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if q.TargetType != "" {
		conds = append(conds, fmt.Sprintf("target_type=$%d", idx))
		// idx incremented via args append below
		args = append(args, q.TargetType)
		idx++
	}
	if q.Status != "" {
		conds = append(conds, fmt.Sprintf("status=$%d", idx))
		args = append(args, q.Status)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	sql := fmt.Sprintf("SELECT * FROM sla_trackers WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.SLATracker
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateTracker(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	return updateRows(ctx, r.db, "sla_trackers", trackerColumns, tenantID, id, updates)
}

func (r *Repository) DeleteTracker(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sla_trackers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- SLA Holidays ---

func (r *Repository) CreateHoliday(ctx context.Context, m *models.SLAHoliday) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	query := `INSERT INTO sla_holidays (id, tenant_id, name, date, created_at)
		VALUES (:id, :tenant_id, :name, :date, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) ListHolidays(ctx context.Context, tenantID string, year int) ([]models.SLAHoliday, error) {
	var items []models.SLAHoliday
	sql := `SELECT * FROM sla_holidays WHERE tenant_id=$1 AND EXTRACT(YEAR FROM date)=$2 ORDER BY date`
	err := r.db.SelectContext(ctx, &items, sql, tenantID, year)
	return items, err
}

func (r *Repository) DeleteHoliday(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM sla_holidays WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Lookup helpers ---

func (r *Repository) GetActiveTrackersByProfile(ctx context.Context, tenantID, profileID string) ([]models.SLATracker, error) {
	var items []models.SLATracker
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM sla_trackers WHERE tenant_id=$1 AND sla_profile_id=$2 AND status NOT IN ('resolved', 'breached') ORDER BY response_deadline`,
		tenantID, profileID)
	return items, err
}

func (r *Repository) GetTrackerStatistics(ctx context.Context, tenantID string) (models.TrackerStatistics, error) {
	var stats models.TrackerStatistics
	// Each count is its own statement and can fail on its own. Discarding every
	// error reported a tenant with no trackers at all while the database was
	// down, so the SLA dashboard showed total 0 and a 0.0 breach rate -
	// fully compliant - during the outage.
	for _, probe := range []struct {
		target *int
		status string
		label  string
	}{
		{&stats.Total, "", "total"},
		{&stats.Active, "active", "active"},
		{&stats.Responded, "responded", "responded"},
		{&stats.Resolved, "resolved", "resolved"},
		{&stats.Breached, "breached", "breached"},
		{&stats.Paused, "paused", "paused"},
	} {
		var query string
		var args []interface{}
		if probe.status == "" {
			query = `SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1`
			args = []interface{}{tenantID}
		} else {
			query = `SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`
			args = []interface{}{tenantID, probe.status}
		}
		if err := r.db.GetContext(ctx, probe.target, query, args...); err != nil {
			return models.TrackerStatistics{}, fmt.Errorf("sla tracker statistics %s: %w", probe.label, err)
		}
	}
	totalResolved := stats.Resolved + stats.Breached
	if totalResolved > 0 {
		stats.BreachRate = float64(stats.Breached) / float64(totalResolved)
	}
	return stats, nil
}

func (r *Repository) GetHolidaysForPeriod(ctx context.Context, tenantID string, start, end interface{}) ([]models.SLAHoliday, error) {
	var items []models.SLAHoliday
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM sla_holidays WHERE tenant_id=$1 AND date >= $2 AND date <= $3 ORDER BY date`,
		tenantID, start, end)
	return items, err
}
