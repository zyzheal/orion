package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/job-source/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, m *models.JobSource) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = "active"
	}
	if m.Config == "" {
		m.Config = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO job_sources (id, tenant_id, name, type, config, enabled, status, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :type, :config, :enabled, :status, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error) {
	var m models.JobSource
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM job_sources WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		// sqlx reports an empty result set as sql.ErrNoRows, which is a
		// different error from the sentinel every caller compares with.
		// Without the wrap, an absent source and a down database looked
		// identical, and PUT /job-sources/:id plus POST /:id/trigger
		// answered 500 for every id that had never existed.
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.JobSource, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.JobSource
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM job_sources WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	return r.update(ctx, tenantID, id, updates)
}

func (r *Repository) update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	// Column names come from the literal in this map, never from the caller,
	// so no map key can inject an identifier into the SET clause. id and
	// tenant_id are deliberately absent: they scope the WHERE clause and must
	// not be settable through the statement that names the row.
	columns := map[string]string{
		"name":       "name",
		"type":       "type",
		"config":     "config",
		"enabled":    "enabled",
		"status":     "status",
		"updated_at": "updated_at",
	}
	// Only the keys this statement knows about reach SQL. A nil value means
	// "the caller did not send this field"; binding it would write NULL, which
	// job_sources rejects for name, type, status, created_at and updated_at.
	keys := []string{}
	for key, value := range updates {
		if _, ok := columns[key]; !ok {
			continue
		}
		if value == nil {
			continue
		}
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		// The pre-fix body indexed setClauses[0] without a length guard, so a
		// map whose only entry was filtered out here would panic instead of
		// being a no-op.
		return nil
	}
	// Map iteration is unordered; sorting keeps the compiled statement stable
	// so an expectation written against it does not depend on the scheduler.
	sort.Strings(keys)
	fields := make([]string, len(keys))
	args := make([]interface{}, 0, len(keys)+2)
	for i, key := range keys {
		fields[i] = fmt.Sprintf("%s = $%d", columns[key], i+1)
		args = append(args, updates[key])
	}
	args = append(args, id, tenantID)
	idArg := len(args) - 1
	q := fmt.Sprintf("UPDATE job_sources SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(fields, ", "), idArg, idArg+1)

	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("failed to update job source: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM job_sources WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CreateEvent(ctx context.Context, e *models.JobSourceEvent) error {
	e.ID = uuid.New().String()
	e.CreatedAt = time.Now().UTC()
	if e.ReceivedAt.IsZero() {
		// 685 declares received_at TIMESTAMPTZ NOT NULL and ORDER BY received_at
		// DESC sorts on it, so an unset value had to be filled: time.Time is
		// never nil, so IsZero is the only way to tell "the caller left it" from
		// a real timestamp, and the zero value would have been written as year 1.
		e.ReceivedAt = time.Now().UTC()
	}
	if e.Status == "" {
		e.Status = "received"
	}
	if e.Payload == "" {
		e.Payload = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO job_source_events (id, tenant_id, source_id, payload, status, job_id, error, received_at, processed_at, created_at)
		 VALUES (:id, :tenant_id, :source_id, :payload, :status, :job_id, :error, :received_at, :processed_at, :created_at)`, e)
	return err
}

func (r *Repository) UpdateEventStatus(ctx context.Context, tenantID, id string, status string, jobID string, err string) error {
	// Build dynamic update with parameterized args
	fields := []string{"status = $1"}
	args := []interface{}{status}
	argIdx := 2
	if jobID != "" {
		fields = append(fields, fmt.Sprintf("job_id = $%d", argIdx))
		args = append(args, jobID)
		argIdx++
	}
	if err != "" {
		fields = append(fields, fmt.Sprintf("error = $%d", argIdx))
		args = append(args, err)
		argIdx++
	}
	fields = append(fields, fmt.Sprintf("processed_at = $%d", argIdx))
	args = append(args, time.Now().UTC())

	args = append(args, id, tenantID)
	idArg := len(args) - 2
	tenantArg := len(args) - 1

	q := fmt.Sprintf("UPDATE job_source_events SET %s WHERE id=$%d AND tenant_id=$%d",
		fields[0], idArg, tenantArg)
	for _, clause := range fields[1:] {
		q += ", " + clause
	}

	_, execErr := r.db.ExecContext(ctx, q, args...)
	if execErr != nil {
		return fmt.Errorf("failed to update event status: %w", execErr)
	}
	return nil
}

func (r *Repository) ListEvents(ctx context.Context, tenantID, sourceID string, limit, offset int) ([]models.JobSourceEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	if sourceID != "" {
		var items []models.JobSourceEvent
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM job_source_events WHERE tenant_id=$1 AND source_id=$2 ORDER BY received_at DESC LIMIT $3 OFFSET $4`,
			tenantID, sourceID, limit, offset)
		return items, err
	}
	var items []models.JobSourceEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM job_source_events WHERE tenant_id=$1 ORDER BY received_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

// MarshalJSONConfig serializes a map to a JSON string.
func MarshalJSONConfig(cfg map[string]string) (string, error) {
	if cfg == nil {
		return "{}", nil
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %w", err)
	}
	return string(data), nil
}

// UnmarshalJSONConfig deserializes a JSON string to a map.
func UnmarshalJSONConfig(s string) (map[string]string, error) {
	if s == "" {
		return nil, nil
	}
	var cfg map[string]string
	err := json.Unmarshal([]byte(s), &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	return cfg, nil
}

// NullTime is a sql-compatible nullable time wrapper.
type NullTime struct {
	Time  time.Time
	Valid bool
}

func (nt *NullTime) Scan(value interface{}) error {
	if value == nil {
		nt.Valid = false
		return nil
	}
	var t time.Time
	switch v := value.(type) {
	case time.Time:
		t = v
	case *time.Time:
		if v != nil {
			t = *v
		}
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}
	nt.Time = t
	nt.Valid = true
	return nil
}

func (nt NullTime) Value() (interface{}, error) {
	if !nt.Valid {
		return sql.NullTime{}, nil
	}
	return sql.NullTime{Time: nt.Time, Valid: true}, nil
}
