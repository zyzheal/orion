package repository

import (
	"context"
	"database/sql"
	"errors"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/rca/models"
	"go.uber.org/zap"
)

type RCARespository struct {
	db     *DB
	logger *zap.Logger
}

func NewRCARespository(db *DB, logger *zap.Logger) *RCARespository {
	return &RCARespository{db: db, logger: logger}
}

// CreateAnalysis creates a new RCA analysis session.
func (r *RCARespository) CreateAnalysis(ctx context.Context, tenantID uuid.UUID, incidentID, triggeredBy string, timeRange *models.TimeRange) (*models.RCAAnalysis, error) {
	now := time.Now()
	id := uuid.New()

	timeRangeJSON, _ := json.Marshal(timeRange)

	query := `INSERT INTO rca_analyses (id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	if _, err := r.db.Pool().Exec(ctx, query, id, tenantID, incidentID, "running", "[]", 0.0, triggeredBy, now, nil); err != nil {
		return nil, fmt.Errorf("create rca analysis: %w", err)
	}

	_ = timeRangeJSON
	analysis := &models.RCAAnalysis{
		ID:          id,
		TenantID:    tenantID,
		IncidentID:  incidentID,
		Status:      "running",
		RootCauses:  []models.RootCause{},
		Confidence:  0.0,
		TriggeredBy: triggeredBy,
		StartedAt:   now,
	}
	return analysis, nil
}

// GetAnalysis returns an analysis by ID.
func (r *RCARespository) GetAnalysis(ctx context.Context, tenantID, id uuid.UUID) (*models.RCAAnalysis, error) {
	var a models.RCAAnalysis
	var rootCausesJSON sql.NullString
	var completedAt sql.NullTime

	query := `SELECT id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at FROM rca_analyses WHERE id = $1 AND tenant_id = $2`
	if err := r.db.Pool().QueryRow(ctx, query, id, tenantID).Scan(
		&a.ID, &a.TenantID, &a.IncidentID, &a.Status, &rootCausesJSON, &a.Confidence, &a.TriggeredBy, &a.StartedAt, &completedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("rca analysis not found: %s", id)
		}
		return nil, fmt.Errorf("get rca analysis: %w", err)
	}

	if rootCausesJSON.Valid && rootCausesJSON.String != "[]" && rootCausesJSON.String != "" {
		if err := json.Unmarshal([]byte(rootCausesJSON.String), &a.RootCauses); err != nil {
			return nil, fmt.Errorf("unmarshal root causes: %w", err)
		}
	}
	if completedAt.Valid {
		a.CompletedAt = &completedAt.Time
	}
	return &a, nil
}

// UpdateAnalysis updates the analysis status and root causes.
func (r *RCARespository) UpdateAnalysis(ctx context.Context, id uuid.UUID, status string, rootCauses []models.RootCause, confidence float64) error {
	var completedAt interface{}
	if status == "completed" || status == "failed" {
		completedAt = time.Now()
		now = completedAt.(time.Time)
	}

	rootCausesJSON, err := json.Marshal(rootCauses)
	if err != nil {
		return fmt.Errorf("marshal root causes: %w", err)
	}

	query := `UPDATE rca_analyses SET status=$1, root_causes=$2, confidence=$3, completed_at=$4 WHERE id=$5`
	_, err = r.db.Pool().Exec(ctx, query, status, string(rootCausesJSON), confidence, completedAt, id)
	return err
}

// CreateRootCause adds a root cause to an analysis.
func (r *RCARespository) CreateRootCause(ctx context.Context, analysisID uuid.UUID, req *models.RootCause) (*models.RootCause, error) {
	now := time.Now()

	// Use a simple incrementing ID based on current timestamp for demo
	rootCauseID := uuid.New()

	fixesJSON := "[]"
	if len(req.Fixes) > 0 {
		fixesBytes, err := json.Marshal(req.Fixes)
		if err != nil {
			return nil, fmt.Errorf("marshal fixes: %w", err)
		}
		fixesJSON = string(fixesBytes)
	}

	evidenceJSON := "[]"
	if len(req.Evidence) > 0 {
		evidenceBytes, err := json.Marshal(req.Evidence)
		if err != nil {
			return nil, fmt.Errorf("marshal evidence: %w", err)
		}
		evidenceJSON = string(evidenceBytes)
	}

	query := `INSERT INTO rca_root_causes (id, analysis_id, component, category, description, evidence, impact, priority, fixes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
	if _, err := r.db.Pool().Exec(ctx, query, rootCauseID, analysisID, req.Component, req.Category, req.Description, evidenceJSON, req.Impact, req.Priority, fixesJSON, now); err != nil {
		return nil, fmt.Errorf("create root cause: %w", err)
	}

	req.ID = rootCauseID
	req.AnalysisID = analysisID
	req.CreatedAt = now
	return req, nil
}

// QueryRootCauses returns root causes for an analysis.
func (r *RCARespository) QueryRootCauses(ctx context.Context, analysisID uuid.UUID, limit, offset int) (models.RootCauseResponse, error) {
	var resp models.RootCauseResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM rca_root_causes WHERE analysis_id = $1`
	query := `SELECT id, analysis_id, component, category, description, evidence, impact, priority, fixes, created_at FROM rca_root_causes WHERE analysis_id = $1 ORDER BY priority ASC LIMIT $2 OFFSET $3`

	if err := r.db.Pool().QueryRow(ctx, countQuery, analysisID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count root causes: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, analysisID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query root causes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var rc models.RootCause
		var evidenceJSON, fixesJSON sql.NullString
		if err := rows.Scan(&rc.ID, &rc.AnalysisID, &rc.Component, &rc.Category, &rc.Description, &evidenceJSON, &rc.Impact, &rc.Priority, &fixesJSON, &rc.CreatedAt); err != nil {
			return resp, fmt.Errorf("scan root cause: %w", err)
		}
		if evidenceJSON.Valid && evidenceJSON.String != "" {
			_ = json.Unmarshal([]byte(evidenceJSON.String), &rc.Evidence)
		}
		if fixesJSON.Valid && fixesJSON.String != "" {
			_ = json.Unmarshal([]byte(fixesJSON.String), &rc.Fixes)
		}
		resp.Data = append(resp.Data, rc)
	}
	return resp, nil
}

// QueryAnalysisHistory returns paginated analysis history.
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
	query := fmt.Sprintf(`
		SELECT id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at
		FROM rca_analyses %s
		ORDER BY started_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.db.Pool().QueryRow(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count rca analyses: %w", err)
	}

	rows, err := r.db.Pool().Query(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query rca analyses: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var a models.RCAAnalysis
		var rootCausesJSON sql.NullString
		var completedAt sql.NullTime
		if err := rows.Scan(&a.ID, &a.TenantID, &a.IncidentID, &a.Status, &rootCausesJSON, &a.Confidence, &a.TriggeredBy, &a.StartedAt, &completedAt); err != nil {
			return resp, fmt.Errorf("scan rca analysis: %w", err)
		}
		if rootCausesJSON.Valid {
			_ = json.Unmarshal([]byte(rootCausesJSON.String), &a.RootCauses)
		}
		if completedAt.Valid {
			a.CompletedAt = &completedAt.Time
		}
		resp.Data = append(resp.Data, a)
	}
	return resp, nil
}

// CreateTimelineEvent adds an event to the incident timeline.
func (r *RCARespository) CreateTimelineEvent(ctx context.Context, tenantID uuid.UUID, incidentID string, req *models.TimelineEvent) (*models.TimelineEvent, error) {
	id := uuid.New()
	now := time.Now()
	if req.Timestamp.IsZero() {
		req.Timestamp = now
	}

	query := `INSERT INTO rca_timeline_events (id, tenant_id, incident_id, timestamp, type, source, message, severity, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	if _, err := r.db.Pool().Exec(ctx, query, id, tenantID, incidentID, req.Timestamp, req.Type, req.Source, req.Message, req.Severity, now); err != nil {
		return nil, fmt.Errorf("create timeline event: %w", err)
	}

	req.ID = id
	return req, nil
}

// GetTimeline returns events for an incident.
func (r *RCARespository) GetTimeline(ctx context.Context, tenantID uuid.UUID, incidentID string, limit int) ([]models.TimelineEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `SELECT id, timestamp, type, source, message, severity FROM rca_timeline_events WHERE tenant_id = $1 AND incident_id = $2 ORDER BY timestamp ASC LIMIT $3`
	rows, err := r.db.Pool().Query(ctx, query, tenantID, incidentID, limit)
	if err != nil {
		return nil, fmt.Errorf("query timeline: %w", err)
	}
	defer rows.Close()

	var events []models.TimelineEvent
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

// joinStrings joins string slices with a separator.
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
