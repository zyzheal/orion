package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/diagnostic/models"

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

// --- Sessions ---

func (r *Repository) CreateSession(ctx context.Context, session *models.Session) error {
	session.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO diagnostic_sessions (id, tenant_id, pipeline_id, trigger_type, trigger_id, triggered_by, status, started_at, completed_at, created_at)
		 VALUES (:id, :tenantId, :pipelineId, :triggerType, :triggerId, :triggeredBy, :status, :startedAt, :completedAt, :createdAt)`,
		session)
	return err
}

func (r *Repository) GetSessionByID(ctx context.Context, id string) (*models.Session, error) {
	var s models.Session
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM diagnostic_sessions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListSessions(ctx context.Context, tenantID string, status, triggerType, triggerID *string) ([]models.Session, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, *status)
		idx++
	}
	if triggerType != nil && *triggerType != "" {
		where += fmt.Sprintf(" AND trigger_type = $%d", idx)
		args = append(args, *triggerType)
		idx++
	}
	if triggerID != nil && *triggerID != "" {
		where += fmt.Sprintf(" AND trigger_id = $%d", idx)
		args = append(args, *triggerID)
		idx++
	}
	var sessions []models.Session
	err := r.db.SelectContext(ctx, &sessions,
		fmt.Sprintf(`SELECT * FROM diagnostic_sessions %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *Repository) UpdateSessionStatus(ctx context.Context, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE diagnostic_sessions SET status=$1, completed_at=NOW() WHERE id=$2`, status, id)
	return err
}

// --- Symptoms ---

func (r *Repository) CreateSymptom(ctx context.Context, symptom *models.Symptom) error {
	symptom.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO diagnostic_symptoms (id, session_id, name, description, type, source, severity, metadata, created_at)
		 VALUES (:id, :sessionId, :name, :description, :type, :source, :severity, :metadata, :createdAt)`,
		symptom)
	return err
}

func (r *Repository) ListSymptomsBySession(ctx context.Context, sessionID string) ([]models.Symptom, error) {
	var symptoms []models.Symptom
	err := r.db.SelectContext(ctx, &symptoms,
		`SELECT * FROM diagnostic_symptoms WHERE session_id=$1 ORDER BY created_at ASC`, sessionID)
	if err != nil {
		return nil, err
	}
	return symptoms, nil
}

// --- Reports ---

func (r *Repository) CreateReport(ctx context.Context, report *models.Report) error {
	report.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO diagnostic_reports (id, session_id, content, created_at)
		 VALUES (:id, :sessionId, :content, :createdAt)`,
		report)
	return err
}

func (r *Repository) GetReportByID(ctx context.Context, id string) (*models.Report, error) {
	var rpt models.Report
	err := r.db.GetContext(ctx, &rpt,
		`SELECT * FROM diagnostic_reports WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

func (r *Repository) GetReportBySession(ctx context.Context, sessionID string) (*models.Report, error) {
	var rpt models.Report
	err := r.db.GetContext(ctx, &rpt,
		`SELECT * FROM diagnostic_reports WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1`, sessionID)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

func (r *Repository) ListReports(ctx context.Context, tenantID, sessionID *string) ([]models.Report, error) {
	var query string
	var args []interface{}
	if sessionID != nil && *sessionID != "" {
		query = `SELECT dr.* FROM diagnostic_reports dr JOIN diagnostic_sessions ds ON dr.session_id=ds.id WHERE ds.tenant_id=$1 AND dr.session_id=$2 ORDER BY dr.created_at DESC`
		args = []interface{}{tenantID, *sessionID}
	} else {
		query = `SELECT dr.* FROM diagnostic_reports dr JOIN diagnostic_sessions ds ON dr.session_id=ds.id WHERE ds.tenant_id=$1 ORDER BY dr.created_at DESC`
		args = []interface{}{tenantID}
	}
	var reports []models.Report
	err := r.db.SelectContext(ctx, &reports, query, args...)
	if err != nil {
		return nil, err
	}
	return reports, err
}

// --- Patterns ---

func (r *Repository) CreatePattern(ctx context.Context, pattern *models.Pattern) error {
	pattern.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO diagnostic_patterns (id, tenant_id, name, category, symptoms, root_cause, solutions, frequency, created_at)
		 VALUES (:id, :tenantId, :name, :category, :symptoms, :rootCause, :solutions, :frequency, :createdAt)`,
		pattern)
	return err
}

func (r *Repository) GetPatternByID(ctx context.Context, id string) (*models.Pattern, error) {
	var p models.Pattern
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM diagnostic_patterns WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPatterns(ctx context.Context, tenantID, category, keyword *string) ([]models.Pattern, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2
	if category != nil && *category != "" {
		where += fmt.Sprintf(" AND category = $%d", idx)
		args = append(args, *category)
		idx++
	}
	if keyword != nil && *keyword != "" {
		where += fmt.Sprintf(" AND name ILIKE $%d", idx)
		args = append(args, "%"+*keyword+"%")
		idx++
	}
	var patterns []models.Pattern
	err := r.db.SelectContext(ctx, &patterns,
		fmt.Sprintf(`SELECT * FROM diagnostic_patterns %s ORDER BY frequency DESC`, where), args...)
	if err != nil {
		return nil, err
	}
	return patterns, nil
}

// --- Counts ---

func (r *Repository) CountSessions(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM diagnostic_sessions WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) CountReports(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM diagnostic_reports dr JOIN diagnostic_sessions ds ON dr.session_id=ds.id WHERE ds.tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) CountPatterns(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM diagnostic_patterns WHERE tenant_id=$1`, tenantID)
	return count, err
}

// --- Helpers ---

func buildWhereClause(base string, clauses []string, args []interface{}) (string, []interface{}) {
	var buf strings.Builder
	buf.WriteString(base)
	if len(clauses) > 0 {
		buf.WriteString(" WHERE")
		for i, c := range clauses {
			if i > 0 {
				buf.WriteString(" AND")
			}
			buf.WriteString(" " + c)
		}
	}
	return buf.String(), args
}
