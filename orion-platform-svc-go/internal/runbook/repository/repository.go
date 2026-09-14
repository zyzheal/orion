package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/runbook/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS runbooks (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		title VARCHAR(255) NOT NULL,
		description TEXT DEFAULT '',
		category VARCHAR(64) DEFAULT '',
		severity VARCHAR(32) DEFAULT 'medium',
		steps JSONB DEFAULT '[]',
		tags JSONB DEFAULT '[]',
		owner VARCHAR(128) DEFAULT '',
		approved BOOLEAN DEFAULT FALSE,
		enabled BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_runbooks_tenant ON runbooks(tenant_id);
	CREATE TABLE IF NOT EXISTS runbook_executions (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		runbook_id UUID NOT NULL,
		incident_id UUID,
		executor_id VARCHAR(128) DEFAULT '',
		status VARCHAR(32) DEFAULT 'pending',
		started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		completed_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_runbook_executions_tenant ON runbook_executions(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id);
	CREATE TABLE IF NOT EXISTS runbook_execution_steps (
		id UUID PRIMARY KEY,
		execution_id UUID NOT NULL,
		step_order INTEGER NOT NULL,
		status VARCHAR(32) DEFAULT 'pending',
		output TEXT DEFAULT '',
		started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		completed_at TIMESTAMP WITH TIME ZONE,
		UNIQUE(execution_id, step_order)
	);
	`)
	return err
}

// runbookColumns is the canonical SELECT list. It is explicit rather than
// "SELECT *" for two reasons:
//
//   - steps and tags are JSONB and come back as []byte, which database/sql can
//     scan into []byte but not into []models.RunbookStep or []string. runbookRow
//     therefore holds the raw bytes and decodeRunbook unmarshals them.
//   - a column no field declares fails the whole read under safe-mode sqlx with
//     "missing destination name". Migration 572 already adds created_by and
//     updated_by to this table, so "SELECT *" would have broken every read once
//     it ran.
const runbookColumns = `id, tenant_id, title, description, category, severity, steps, tags, owner, approved, enabled, created_at, updated_at`

// executionColumns mirrors models.RunbookExecution exactly.
const executionColumns = `id, tenant_id, runbook_id, incident_id, executor_id, status, started_at, completed_at, created_at`

// runbookRow is the scan shape for runbooks: models.Runbook with the two JSONB
// columns held as raw bytes until decodeRunbook. The db tags are mandatory
// rather than optional -- sqlx's default NameMapper is strings.ToLower, which
// maps the column "tenant_id" to "tenant_id" but the field TenantID to
// "tenantid", so without tags every read failed with
// "missing destination name tenant_id".
type runbookRow struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	Title       string    `db:"title"`
	Description string    `db:"description"`
	Category    string    `db:"category"`
	Severity    string    `db:"severity"`
	StepsRaw    []byte    `db:"steps"`
	TagsRaw     []byte    `db:"tags"`
	Owner       string    `db:"owner"`
	Approved    bool      `db:"approved"`
	Enabled     bool      `db:"enabled"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func decodeRunbook(row *runbookRow) *models.Runbook {
	m := &models.Runbook{
		ID:          row.ID,
		TenantID:    row.TenantID,
		Title:       row.Title,
		Description: row.Description,
		Category:    row.Category,
		Severity:    row.Severity,
		Owner:       row.Owner,
		Approved:    row.Approved,
		Enabled:     row.Enabled,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
	// Malformed JSON in either column should not fail the whole read: the row is
	// still usable with an empty slice, and the write path is the only place that
	// can repair the value.
	if len(row.StepsRaw) > 0 {
		_ = json.Unmarshal(row.StepsRaw, &m.Steps)
	}
	if len(row.TagsRaw) > 0 {
		_ = json.Unmarshal(row.TagsRaw, &m.Tags)
	}
	return m
}

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.Runbook) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	if m.Steps == nil {
		m.Steps = []models.RunbookStep{}
	}
	if m.Tags == nil {
		m.Tags = []string{}
	}
	steps, _ := json.Marshal(m.Steps)
	tags, _ := json.Marshal(m.Tags)
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO runbooks (id, tenant_id, title, description, category, severity, steps, tags, owner, approved, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :title, :description, :category, :severity, :steps, :tags, :owner, :approved, :enabled, :created_at, :updated_at)`,
		map[string]interface{}{
			"id": m.ID, "tenant_id": m.TenantID,
			"title": m.Title, "description": m.Description,
			"category": m.Category, "severity": m.Severity,
			"steps": string(steps), "tags": string(tags),
			"owner": m.Owner, "approved": m.Approved,
			"enabled": m.Enabled, "created_at": m.CreatedAt,
			"updated_at": m.UpdatedAt,
		})
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Runbook, error) {
	var row runbookRow
	err := r.db.GetContext(ctx, &row,
		`SELECT `+runbookColumns+` FROM runbooks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return decodeRunbook(&row), nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Runbook, int, error) {
	cond := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if q.Category != "" {
		cond += " AND category = $" + strconv.Itoa(idx)
		args = append(args, q.Category)
		idx++
	}
	if q.Severity != "" {
		cond += " AND severity = $" + strconv.Itoa(idx)
		args = append(args, q.Severity)
		idx++
	}
	if q.Approved != nil {
		cond += " AND approved = $" + strconv.Itoa(idx)
		args = append(args, *q.Approved)
		idx++
	}

	limit := 20
	offset := 0
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	if q.Offset != nil {
		offset = *q.Offset
	}

	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM runbooks "+cond, args...)
	if err != nil {
		return nil, 0, err
	}

	var rows []runbookRow
	// cond starts with "WHERE", so the statement must supply its own
	// "SELECT ... FROM runbooks". Building the query as cond+" ORDER BY ..."
	// sent
	//   WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
	// to the database: no SELECT, no FROM, a syntax error on every call, so
	// GET /runbooks never returned a runbook.
	err = r.db.SelectContext(ctx, &rows,
		"SELECT "+runbookColumns+" FROM runbooks "+cond+" ORDER BY created_at DESC LIMIT $"+strconv.Itoa(idx)+" OFFSET $"+strconv.Itoa(idx+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	items := make([]models.Runbook, 0, len(rows))
	for i := range rows {
		items = append(items, *decodeRunbook(&rows[i]))
	}
	return items, total, err
}

// runbookUpdatable lists the columns a partial update may touch, in a fixed
// order. updated_at is deliberately absent: it is set by the UPDATE itself.
var runbookUpdatable = []string{
	"title", "description", "category", "severity", "steps", "tags", "owner", "approved", "enabled",
}

// buildRunbookSET renders "col = $1, col = $2, ..." for the entries of updates
// that are allowed, in allowed's order, and returns the values to bind. Walking
// the whitelist rather than the map keeps the generated SQL deterministic,
// because Go maps have no iteration order. A key outside the whitelist is an
// error instead of being interpolated into the SQL as a column name.
func buildRunbookSET(updates map[string]interface{}) (string, []interface{}, error) {
	ok := make(map[string]bool, len(runbookUpdatable))
	for _, col := range runbookUpdatable {
		ok[col] = true
	}
	for k := range updates {
		if !ok[k] {
			return "", nil, fmt.Errorf("column %q is not updatable", k)
		}
	}
	clauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	for _, col := range runbookUpdatable {
		v, exists := updates[col]
		if !exists {
			continue
		}
		args = append(args, encodeJSONColumn(v))
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	return strings.Join(clauses, ", "), args, nil
}

// encodeJSONColumn turns the two JSONB columns into the string form Postgres
// expects. Any other value is passed through untouched.
func encodeJSONColumn(v interface{}) interface{} {
	switch t := v.(type) {
	case []models.RunbookStep:
		b, _ := json.Marshal(t)
		return string(b)
	case []string:
		b, _ := json.Marshal(t)
		return string(b)
	default:
		return v
	}
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Runbook, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}
	setClause, args, err := buildRunbookSET(updates)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE runbooks SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	if _, err = r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `DELETE FROM runbook_execution_steps WHERE execution_id IN (SELECT id FROM runbook_executions WHERE runbook_id = $1)`, id)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM runbook_executions WHERE runbook_id = $1`, id)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM runbooks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return tx.Commit()
}

func (r *Repository) CreateExecution(ctx context.Context, tenantID string, ex *models.RunbookExecution) error {
	ex.ID = uuid.New().String()
	ex.TenantID = tenantID
	ex.StartedAt = time.Now().UTC()
	ex.CreatedAt = ex.StartedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO runbook_executions (id, tenant_id, runbook_id, incident_id, executor_id, status, started_at, completed_at, created_at)
		VALUES (:id, :tenant_id, :runbook_id, :incident_id, :executor_id, :status, :started_at, :completed_at, :created_at)`,
		ex)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID, runbookID string, limit int) ([]models.RunbookExecution, error) {
	var items []models.RunbookExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+executionColumns+` FROM runbook_executions WHERE tenant_id = $1 AND runbook_id = $2 ORDER BY started_at DESC LIMIT $3`,
		tenantID, runbookID, limit)
	return items, err
}

func (r *Repository) UpdateExecutionStatus(ctx context.Context, tenantID, executionID string, status string) error {
	completedAt := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE runbook_executions SET status = $1, completed_at = $2 WHERE id = $3 AND tenant_id = $4`,
		status, completedAt, executionID, tenantID)
	return err
}
