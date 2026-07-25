package repository

import (
	"context"
	"fmt"
	"time"

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
	updates["updated_at"] = time.Now().UTC()
	delete(updates, "id")
	delete(updates, "tenant_id")
	if len(updates) == 0 {
		return nil
	}
	var parts []string
	args := []interface{}{id, tenantID}
	idx := 3
	for k := range updates {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, idx))
		// sqlx column names use underscore; map keys may use snake_case which matches
		args = append(args, updates[k])
		idx++
	}
	set := parts[0]
	for i := 1; i < len(parts); i++ {
		set += ", " + parts[i]
	}
	query := "UPDATE sla_profiles SET " + set + " WHERE id=$1 AND tenant_id=$2"
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
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
	updates["updated_at"] = time.Now().UTC()
	delete(updates, "id")
	delete(updates, "tenant_id")
	if len(updates) == 0 {
		return nil
	}
	var parts []string
	args := []interface{}{id, tenantID}
	idx := 3
	for k := range updates {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, updates[k])
		idx++
	}
	set := parts[0]
	for i := 1; i < len(parts); i++ {
		set += ", " + parts[i]
	}
	query := "UPDATE sla_trackers SET " + set + " WHERE id=$1 AND tenant_id=$2"
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
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
	_ = r.db.GetContext(ctx, &stats.Total,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &stats.Active,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`, tenantID, "active")
	_ = r.db.GetContext(ctx, &stats.Responded,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`, tenantID, "responded")
	_ = r.db.GetContext(ctx, &stats.Resolved,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`, tenantID, "resolved")
	_ = r.db.GetContext(ctx, &stats.Breached,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`, tenantID, "breached")
	_ = r.db.GetContext(ctx, &stats.Paused,
		`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`, tenantID, "paused")
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
