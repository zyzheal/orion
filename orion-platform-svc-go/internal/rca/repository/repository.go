package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/rca/models"
)

// Repository is the storage contract the service is programmed against. It
// exists so the service can be tested with a recording fake: every one of its
// methods takes tenantID, and the fake is what proves the caller's tenant
// actually reaches each statement instead of a hardcoded zero UUID.
//
// *RCARespository satisfies it, so wiring is unchanged.
type Repository interface {
	CreateAnalysis(ctx context.Context, tenantID uuid.UUID, incidentID, triggeredBy string) (*models.RCAAnalysis, error)
	GetAnalysis(ctx context.Context, tenantID, id uuid.UUID) (*models.RCAAnalysis, error)
	UpdateAnalysis(ctx context.Context, tenantID, id uuid.UUID, status string, rootCauses []models.RootCause, confidence float64) error
	QueryAnalysisHistory(ctx context.Context, tenantID uuid.UUID, incidentID string, limit, offset int) (models.RCAAnalysisResponse, error)
	GetTimeline(ctx context.Context, tenantID uuid.UUID, incidentID string, limit int) ([]models.TimelineEvent, error)
}

type RCARespository struct {
	db     *sqlx.DB
	logger *zap.Logger
}

func NewRCARespository(db *sqlx.DB, logger *zap.Logger) *RCARespository {
	return &RCARespository{db: db, logger: logger}
}

// analysisCols is the SELECT list shared by GetAnalysis and
// QueryAnalysisHistory. root_causes and completed_at are scanned into local
// variables by the callers rather than into the model directly: RootCauses is a
// []models.RootCause and completed_at is nullable, neither of which sqlx can map
// straight into models.RCAAnalysis.
const analysisCols = `id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at`

// CreateAnalysis creates a new RCA analysis session.
//
// The analysis window is not persisted: rca_analyses has no column for it, and
// it is recorded on each root cause's evidence instead. It used to be taken as a
// parameter and discarded with `_ = timeRange`, which looked like it mattered.
func (r *RCARespository) CreateAnalysis(ctx context.Context, tenantID uuid.UUID, incidentID, triggeredBy string) (*models.RCAAnalysis, error) {
	now := time.Now()
	id := uuid.New()

	query := `INSERT INTO rca_analyses (id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	if _, err := r.db.ExecContext(ctx, query, id, tenantID, incidentID, "running", "[]", 0.0, triggeredBy, now, nil); err != nil {
		return nil, fmt.Errorf("create rca analysis: %w", err)
	}

	return &models.RCAAnalysis{
		ID:          id,
		TenantID:    tenantID,
		IncidentID:  incidentID,
		Status:      "running",
		RootCauses:  []models.RootCause{},
		Confidence:  0.0,
		TriggeredBy: triggeredBy,
		StartedAt:   now,
	}, nil
}

// analysisRow is the scan target for rca_analyses. It is explicit rather than
// scanning straight into models.RCAAnalysis because sqlx maps a column to a
// field by the field's lowercased name, not its snake_case column name:
// tenant_id does not match TenantID (tenantid), started_at does not match
// StartedAt, and root_causes does not match RootCauses ([]models.RootCause is
// not a sql.Scanner at all). Every one of those columns would have been
// "missing destination name" at runtime, so GET /rca/:analysis_id and
// /rca/history answered 500 for every request.
type analysisRow struct {
	ID          uuid.UUID      `db:"id"`
	TenantID    uuid.UUID      `db:"tenant_id"`
	IncidentID  string         `db:"incident_id"`
	Status      string         `db:"status"`
	RootCauses  sql.NullString `db:"root_causes"`
	Confidence  float64        `db:"confidence"`
	TriggeredBy string         `db:"triggered_by"`
	StartedAt   time.Time      `db:"started_at"`
	CompletedAt sql.NullTime   `db:"completed_at"`
}

func (row analysisRow) analysis() *models.RCAAnalysis {
	a := &models.RCAAnalysis{
		ID:          row.ID,
		TenantID:    row.TenantID,
		IncidentID:  row.IncidentID,
		Status:      row.Status,
		Confidence:  row.Confidence,
		TriggeredBy: row.TriggeredBy,
		StartedAt:   row.StartedAt,
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		a.CompletedAt = &t
	}
	return a
}

// GetAnalysis returns an analysis by ID, scoped to the caller's tenant.
func (r *RCARespository) GetAnalysis(ctx context.Context, tenantID, id uuid.UUID) (*models.RCAAnalysis, error) {
	query := fmt.Sprintf(`SELECT %s FROM rca_analyses WHERE id = $1 AND tenant_id = $2`, analysisCols)
	var row analysisRow
	if err := r.db.GetContext(ctx, &row, query, id, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("rca analysis not found: %s", id)
		}
		return nil, fmt.Errorf("get rca analysis: %w", err)
	}
	a := row.analysis()
	if err := decodeRootCauses(a, row.RootCauses); err != nil {
		return nil, err
	}
	return a, nil
}

// UpdateAnalysis updates the analysis status and root causes, scoped to the
// caller's tenant.
func (r *RCARespository) UpdateAnalysis(ctx context.Context, tenantID, id uuid.UUID, status string, rootCauses []models.RootCause, confidence float64) error {
	var completedAt interface{}
	if status == "completed" || status == "failed" {
		completedAt = time.Now()
	}

	rootCausesJSON, err := json.Marshal(rootCauses)
	if err != nil {
		return fmt.Errorf("marshal root causes: %w", err)
	}

	// tenant_id is in the WHERE clause, not just the column list: an update keyed
	// on id alone let one tenant overwrite another tenant's analysis.
	query := `UPDATE rca_analyses SET status=$1, root_causes=$2, confidence=$3, completed_at=$4 WHERE id=$5 AND tenant_id=$6`
	_, err = r.db.ExecContext(ctx, query, status, string(rootCausesJSON), confidence, completedAt, id, tenantID)
	return err
}

// QueryAnalysisHistory returns paginated analysis history for one tenant.
func (r *RCARespository) QueryAnalysisHistory(ctx context.Context, tenantID uuid.UUID, incidentID string, limit, offset int) (models.RCAAnalysisResponse, error) {
	var resp models.RCAAnalysisResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if incidentID != "" {
		where = append(where, fmt.Sprintf("incident_id = $%d", argIdx))
		args = append(args, incidentID)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]any, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM rca_analyses %s`, whereClause)
	query := fmt.Sprintf(`SELECT %s FROM rca_analyses %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`, analysisCols, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.db.GetContext(ctx, &resp.Total, countQuery, countArgs...); err != nil {
		return resp, fmt.Errorf("count rca analyses: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query rca analyses: %w", err)
	}
	defer rows.Close()

	resp.Data = make([]models.RCAAnalysis, 0)
	for rows.Next() {
		var a models.RCAAnalysis
		var rootCausesJSON sql.NullString
		var cAT sql.NullTime
		if err := rows.Scan(&a.ID, &a.TenantID, &a.IncidentID, &a.Status, &rootCausesJSON, &a.Confidence, &a.TriggeredBy, &a.StartedAt, &cAT); err != nil {
			return resp, fmt.Errorf("scan rca analysis: %w", err)
		}
		if err := decodeRootCauses(&a, rootCausesJSON); err != nil {
			return resp, err
		}
		if cAT.Valid {
			t := cAT.Time
			a.CompletedAt = &t
		}
		resp.Data = append(resp.Data, a)
	}
	return resp, nil
}

// decodeRootCauses unmarshals the root_causes JSON column into the model. A
// corrupt value is an error, not a silently empty slice.
func decodeRootCauses(a *models.RCAAnalysis, raw sql.NullString) error {
	if !raw.Valid || raw.String == "" {
		return nil
	}
	if err := json.Unmarshal([]byte(raw.String), &a.RootCauses); err != nil {
		return fmt.Errorf("unmarshal root causes for analysis %s: %w", a.ID, err)
	}
	return nil
}

// GetTimeline returns events for an incident.
func (r *RCARespository) GetTimeline(ctx context.Context, tenantID uuid.UUID, incidentID string, limit int) ([]models.TimelineEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `SELECT id, timestamp, type, source, message, severity FROM rca_timeline_events WHERE tenant_id = $1 AND incident_id = $2 ORDER BY timestamp ASC LIMIT $3`
	rows, err := r.db.QueryContext(ctx, query, tenantID, incidentID, limit)
	if err != nil {
		return nil, fmt.Errorf("query timeline: %w", err)
	}
	defer rows.Close()

	events := make([]models.TimelineEvent, 0)
	for rows.Next() {
		var e models.TimelineEvent
		var id uuid.UUID
		if err := rows.Scan(&id, &e.Timestamp, &e.Type, &e.Source, &e.Message, &e.Severity); err != nil {
			return nil, fmt.Errorf("scan timeline event: %w", err)
		}
		e.ID = id
		events = append(events, e)
	}
	return events, nil
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
