package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"orion/diagnostic-svc-go/internal/models"
	"time"

	"github.com/jmoiron/sqlx"
)

// --- SessionRepository ---

type SessionRepository struct{ db *sqlx.DB }

func NewSessionRepository(db *sqlx.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(ctx context.Context, s *models.DiagnosticSession) error {
	symptomsJSON, _ := json.Marshal(s.Symptoms)
	findingsJSON, _ := json.Marshal(s.Findings)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO diagnostic_sessions (id, tenant_id, title, status, trigger_type, trigger_id, symptoms, findings, started_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		s.ID, s.TenantID, s.Title, s.Status, s.TriggerType, s.TriggerID,
		string(symptomsJSON), string(findingsJSON), s.StartedAt, time.Now(),
	)
	return err
}

func (r *SessionRepository) GetByID(ctx context.Context, tenantID, id string) (*models.DiagnosticSession, error) {
	var s models.DiagnosticSession
	err := r.db.GetContext(ctx, &s, `SELECT * FROM diagnostic_sessions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SessionRepository) Update(ctx context.Context, s *models.DiagnosticSession) error {
	findingsJSON, _ := json.Marshal(s.Findings)
	_, err := r.db.ExecContext(ctx, `
		UPDATE diagnostic_sessions
		SET status=$1, findings=$2, completed_at=$3, updated_at=$4
		WHERE id=$5 AND tenant_id=$6`,
		s.Status, string(findingsJSON), s.CompletedAt, time.Now(), s.ID, s.TenantID,
	)
	return err
}

func (r *SessionRepository) UpdateSymptoms(ctx context.Context, id, tenantID string, symptoms string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE diagnostic_sessions SET symptoms=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		symptoms, time.Now(), id, tenantID,
	)
	return err
}

func (r *SessionRepository) List(ctx context.Context, tenantID string, status, triggerType string, since *time.Time, offset, limit int) ([]models.DiagnosticSession, error) {
	var items []models.DiagnosticSession
	query := fmt.Sprintf(`SELECT * FROM diagnostic_sessions WHERE tenant_id=$1`)
	args := []interface{}{tenantID}
	param := 2
	if status != "" {
		query += fmt.Sprintf(` AND status=$%d`, param); args = append(args, status); param++
	}
	if triggerType != "" {
		query += fmt.Sprintf(` AND trigger_type=$%d`, param); args = append(args, triggerType); param++
	}
	if since != nil {
		query += fmt.Sprintf(` AND started_at >= $%d`, param); args = append(args, since); param++
	}
	query += fmt.Sprintf(` ORDER BY started_at DESC OFFSET $%d LIMIT $%d`, param, param+1)
	args = append(args, offset, limit)
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// --- ReportRepository ---

type ReportRepository struct{ db *sqlx.DB }

func NewReportRepository(db *sqlx.DB) *ReportRepository {
	return &ReportRepository{db: db}
}

func (r *ReportRepository) Create(ctx context.Context, rpt *models.DiagnosticReport) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO diagnostic_reports (id, tenant_id, session_id, summary, findings, root_cause, recommendations, timeline, estimated_fix_time_ms, generated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		rpt.ID, rpt.TenantID, rpt.SessionID, rpt.Summary, rpt.Findings, rpt.RootCause,
		rpt.Recommendations, rpt.Timeline, rpt.EstimatedFixTimeMs, rpt.GeneratedAt,
	)
	return err
}

func (r *ReportRepository) GetByID(ctx context.Context, id string) (*models.DiagnosticReport, error) {
	var rpt models.DiagnosticReport
	err := r.db.GetContext(ctx, &rpt, `SELECT * FROM diagnostic_reports WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

func (r *ReportRepository) GetBySession(ctx context.Context, tenantID, sessionID string) (*models.DiagnosticReport, error) {
	var rpt models.DiagnosticReport
	err := r.db.GetContext(ctx, &rpt, `SELECT * FROM diagnostic_reports WHERE session_id=$1 AND tenant_id=$2`, sessionID, tenantID)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

func (r *ReportRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.DiagnosticReport, error) {
	var items []models.DiagnosticReport
	err := r.db.SelectContext(ctx, &items, `
		SELECT * FROM diagnostic_reports WHERE tenant_id=$1 ORDER BY generated_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// --- KnowledgeRepository ---

type KnowledgeRepository struct{ db *sqlx.DB }

func NewKnowledgeRepository(db *sqlx.DB) *KnowledgeRepository {
	return &KnowledgeRepository{db: db}
}

func (r *KnowledgeRepository) Create(ctx context.Context, e *models.KnowledgeEntry) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO diagnostic_knowledge (id, tenant_id, name, symptoms, root_cause, solution, category, frequency, average_confidence, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		e.ID, e.TenantID, e.Name, e.Symptoms, e.RootCause, e.Solution,
		e.Category, e.Frequency, e.AverageConfidence, e.CreatedAt,
	)
	return err
}

func (r *KnowledgeRepository) GetByID(ctx context.Context, tenantID, id string) (*models.KnowledgeEntry, error) {
	var e models.KnowledgeEntry
	err := r.db.GetContext(ctx, &e, `SELECT * FROM diagnostic_knowledge WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *KnowledgeRepository) List(ctx context.Context, tenantID string, category, keyword string, minFrequency int, offset, limit int) ([]models.KnowledgeEntry, error) {
	var items []models.KnowledgeEntry
	query := fmt.Sprintf(`SELECT * FROM diagnostic_knowledge WHERE tenant_id=$1`)
	args := []interface{}{tenantID}
	param := 2
	if category != "" {
		query += fmt.Sprintf(` AND category=$%d`, param); args = append(args, category); param++
	}
	if keyword != "" {
		query += fmt.Sprintf(` AND (name ILIKE $%d OR root_cause ILIKE $%d OR solution ILIKE $%d)`, param, param+1, param+2)
		pattern := "%" + keyword + "%"
		args = append(args, pattern, pattern, pattern)
		param += 3
	}
	if minFrequency > 0 {
		query += fmt.Sprintf(` AND frequency >= $%d`, param); args = append(args, minFrequency); param++
	}
	query += fmt.Sprintf(` ORDER BY frequency DESC OFFSET $%d LIMIT $%d`, param, param+1)
	args = append(args, offset, limit)
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *KnowledgeRepository) SearchByKeyword(ctx context.Context, tenantID, keyword string) ([]models.KnowledgeEntry, error) {
	var items []models.KnowledgeEntry
	pattern := "%" + keyword + "%"
	err := r.db.SelectContext(ctx, &items, `
		SELECT * FROM diagnostic_knowledge WHERE tenant_id=$1 AND (name ILIKE $2 OR root_cause ILIKE $2 OR solution ILIKE $2)
		ORDER BY frequency DESC`,
		tenantID, pattern,
	)
	return items, err
}

func (r *KnowledgeRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM diagnostic_knowledge WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *KnowledgeRepository) IncrementFrequency(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE diagnostic_knowledge SET frequency=frequency+1 WHERE id=$1`, id)
	return err
}

// --- StepRepository ---

type StepRepository struct{ db *sqlx.DB }

func NewStepRepository(db *sqlx.DB) *StepRepository {
	return &StepRepository{db: db}
}

func (r *StepRepository) Create(ctx context.Context, s *models.DiagnosticStep) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO diagnostic_steps (id, session_id, step_type, status, result, executed_at, err)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.SessionID, s.StepType, s.Status, s.Result, s.ExecutedAt, s.Error,
	)
	return err
}

func (r *StepRepository) ListBySession(ctx context.Context, tenantID, sessionID string) ([]models.DiagnosticStep, error) {
	var items []models.DiagnosticStep
	err := r.db.SelectContext(ctx, &items, `
		SELECT ds.* FROM diagnostic_steps ds
		JOIN diagnostic_sessions dsess ON ds.session_id = dsess.id
		WHERE dsess.tenant_id=$1 AND ds.session_id=$2 ORDER BY ds.executed_at`,
		tenantID, sessionID,
	)
	return items, err
}
