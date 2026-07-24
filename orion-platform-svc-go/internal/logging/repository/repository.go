package repository

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/logging/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Insert(ctx context.Context, m *models.LogEntry) error {
	m.ID = uuid.New().String()
	if m.Timestamp.IsZero() {
		m.Timestamp = time.Now().UTC()
	}
	if m.Metadata == nil {
		m.Metadata = json.RawMessage("{}")
	}
	m.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO log_entries (id, tenant_id, service, level, message, timestamp,
			trace_id, metadata, created_at)
		VALUES (:id, :tenant_id, :service, :level, :message, :timestamp,
			:trace_id, :metadata, :created_at)`, m)
	return err
}

func (r *Repository) InsertBatch(ctx context.Context, entries []*models.LogEntry) error {
	if len(entries) == 0 {
		return nil
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i := range entries {
		m := entries[i]
		m.ID = uuid.New().String()
		if m.Timestamp.IsZero() {
			m.Timestamp = time.Now().UTC()
		}
		if m.Metadata == nil {
			m.Metadata = json.RawMessage("{}")
		}
		m.CreatedAt = time.Now().UTC()
		_, err := tx.NamedExecContext(ctx, `
			INSERT INTO log_entries (id, tenant_id, service, level, message, timestamp,
				trace_id, metadata, created_at)
			VALUES (:id, :tenant_id, :service, :level, :message, :timestamp,
				:trace_id, :metadata, :created_at)`, m)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.LogEntry, error) {
	var m models.LogEntry
	err := r.db.GetContext(ctx, &m, `SELECT * FROM log_entries WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) FindByTraceID(ctx context.Context, tenantID, traceID string) ([]models.LogEntry, error) {
	var items []models.LogEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM log_entries WHERE tenant_id = $1 AND trace_id = $2 ORDER BY timestamp ASC`, tenantID, traceID)
	return items, err
}

func (r *Repository) Query(ctx context.Context, q *models.LogQuery) ([]models.LogEntry, int64, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 || q.PageSize > 100 {
		q.PageSize = 20
	}
	offset := (q.Page - 1) * q.PageSize

	conds := []string{"tenant_id = $1"}
	args := []interface{}{q.TenantID}
	argIdx := 2

	if q.Service != "" {
		conds = append(conds, "service = $"+strconv.Itoa(argIdx))
		args = append(args, q.Service)
		argIdx++
	}
	if q.Level != "" {
		conds = append(conds, "level = $"+strconv.Itoa(argIdx))
		args = append(args, q.Level)
		argIdx++
	}
	if !q.TimeFrom.IsZero() {
		conds = append(conds, "timestamp >= $"+strconv.Itoa(argIdx))
		args = append(args, q.TimeFrom)
		argIdx++
	}
	if !q.TimeTo.IsZero() {
		conds = append(conds, "timestamp <= $"+strconv.Itoa(argIdx))
		args = append(args, q.TimeTo)
		argIdx++
	}
	if q.TraceID != "" {
		conds = append(conds, "trace_id = $"+strconv.Itoa(argIdx))
		args = append(args, q.TraceID)
		argIdx++
	}
	for _, kw := range q.Keywords {
		conds = append(conds, "message ILIKE $"+strconv.Itoa(argIdx))
		args = append(args, "%"+kw+"%")
		argIdx++
	}

	where := "WHERE " + strings.Join(conds, " AND ")
	query := `SELECT * FROM log_entries ` + where + ` ORDER BY timestamp DESC LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)
	args = append(args, q.PageSize, offset)

	var items []models.LogEntry
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, 0, err
	}

	// Count query
	countQuery := `SELECT COUNT(*) FROM log_entries ` + where
	var total int64
	err = r.db.GetContext(ctx, &total, countQuery, args[:len(args)-2]...)
	return items, total, err
}

func (r *Repository) Aggregation(ctx context.Context, q *models.LogQuery) (*models.LogAggregation, error) {
	agg := &models.LogAggregation{
		ByLevel:   make(map[string]int64),
		ByService: make(map[string]int64),
	}

	conds := []string{"tenant_id = $1"}
	args := []interface{}{q.TenantID}
	argIdx := 2

	if q.Service != "" {
		conds = append(conds, "service = $"+strconv.Itoa(argIdx))
		args = append(args, q.Service)
		argIdx++
	}
	if q.Level != "" {
		conds = append(conds, "level = $"+strconv.Itoa(argIdx))
		args = append(args, q.Level)
		argIdx++
	}
	if !q.TimeFrom.IsZero() {
		conds = append(conds, "timestamp >= $"+strconv.Itoa(argIdx))
		args = append(args, q.TimeFrom)
		argIdx++
	}
	if !q.TimeTo.IsZero() {
		conds = append(conds, "timestamp <= $"+strconv.Itoa(argIdx))
		args = append(args, q.TimeTo)
		argIdx++
	}
	if q.TraceID != "" {
		conds = append(conds, "trace_id = $"+strconv.Itoa(argIdx))
		args = append(args, q.TraceID)
		argIdx++
	}

	where := "WHERE " + strings.Join(conds, " AND ")

	// Total count
	var total int64
	err := r.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM log_entries `+where, args...)
	if err != nil {
		return nil, err
	}
	agg.Total = total

	// Count by level
	var levels []struct {
		Level string `db:"level"`
		Count int64  `db:"count"`
	}
	err = r.db.SelectContext(ctx, &levels, `SELECT level, COUNT(*) as count FROM log_entries `+where+` GROUP BY level`, args...)
	if err == nil {
		for _, l := range levels {
			agg.ByLevel[l.Level] = l.Count
		}
	}

	// Count by service
	var services []struct {
		Service string `db:"service"`
		Count   int64  `db:"count"`
	}
	err = r.db.SelectContext(ctx, &services, `SELECT service, COUNT(*) as count FROM log_entries `+where+` GROUP BY service`, args...)
	if err == nil {
		for _, s := range services {
			agg.ByService[s.Service] = s.Count
		}
	}

	// Time range
	err = r.db.GetContext(ctx, &agg.TimeRange, `SELECT MIN(timestamp) as from_ts, MAX(timestamp) as to_ts FROM log_entries `+where, args...)
	// time range query needs different dest type — skip if failed
	if err != nil {
		agg.TimeRange = struct {
			From time.Time `json:"from"`
			To   time.Time `json:"to"`
		}{}
	}

	return agg, nil
}

func (r *Repository) DeleteByTime(ctx context.Context, tenantID string, before time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM log_entries WHERE tenant_id = $1 AND created_at < $2`, tenantID, before)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}
