package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/ai-decisions/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Decisions ---

func (r *Repository) CreateDecision(ctx context.Context, d *models.AIDecision) error {
	d.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_decisions (id, tenant_id, type, status, input, output, confidence,
		   model_id, model_version, reasoning, context, impact, created_by,
		   created_at, executed_at, expires_at)
		 VALUES (:id, :tenantId, :type, :status, :input::jsonb, :output::jsonb, :confidence,
		   :modelId, :modelVersion, :reasoning::jsonb, :context::jsonb, :impact,
		   :createdBy, :createdAt, :executedAt, :expiresAt)`,
		d)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.AIDecision, error) {
	var d models.AIDecision
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM ai_decisions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.AIDecision, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Type != nil && *filter.Type != "" {
		where += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filter.Type)
		argIdx++
	}
	if filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.ModelID != nil && *filter.ModelID != "" {
		where += fmt.Sprintf(" AND model_id = $%d", argIdx)
		nn := *filter.ModelID
		args = append(args, sql.NullString{String: nn, Valid: nn != ""})
		argIdx++
	}
	if filter.StartDate != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, *filter.StartDate)
		argIdx++
	}
	if filter.EndDate != nil {
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, *filter.EndDate)
		argIdx++
	}

	// Defaults
	limit := 20
	offset := 0
	sortField := "created_at"
	sortOrder := "DESC"

	if filter.Limit != nil && *filter.Limit > 0 {
		limit = *filter.Limit
	}
	if filter.Offset != nil {
		offset = *filter.Offset
	}
	if filter.Sort != nil && *filter.Sort != "" {
		sortField = sanitizeSortField(*filter.Sort)
	}
	if filter.Order != nil && *filter.Order != "" {
		sortOrder = strings.ToUpper(*filter.Order)
		if sortOrder != "ASC" {
			sortOrder = "DESC"
		}
	}

	where += fmt.Sprintf(" ORDER BY %s %s LIMIT $%d OFFSET $%d", sortField, sortOrder, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var decisions []models.AIDecision
	err := r.db.SelectContext(ctx, &decisions, fmt.Sprintf(`SELECT * FROM ai_decisions %s`, where), args...)
	return decisions, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, filter *ListFilter) (int64, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Type != nil && *filter.Type != "" {
		where += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filter.Type)
		argIdx++
	}
	if filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.ModelID != nil && *filter.ModelID != "" {
		where += fmt.Sprintf(" AND model_id = $%d", argIdx)
		nn := *filter.ModelID
		args = append(args, sql.NullString{String: nn, Valid: nn != ""})
		argIdx++
	}
	if filter.StartDate != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, *filter.StartDate)
		argIdx++
	}
	if filter.EndDate != nil {
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		nn := *filter.EndDate
		args = append(args, sql.NullInt64{Int64: nn, Valid: true})
		argIdx++
	}

	var total int64
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM ai_decisions %s`, where), args...)
	return total, err
}

func (r *Repository) UpdateDecisionStatus(ctx context.Context, id string, tenantID string, status models.DecisionStatus, executedAt *int64) (*models.AIDecision, error) {
	var nullExec sql.NullInt64
	if executedAt != nil {
		nullExec = sql.NullInt64{Int64: *executedAt, Valid: true}
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_decisions SET status=$1, executed_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, nullExec, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_decisions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Feedback ---

func (r *Repository) CreateFeedback(ctx context.Context, fb *models.DecisionFeedback) error {
	fb.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_decision_feedback (id, tenant_id, decision_id, type, comment, outcome,
		   actual_impact, created_by, created_at)
		 VALUES (:id, :tenantId, :decisionId, :type, :comment, :outcome, :actualImpact::jsonb,
		   :createdBy, :createdAt)`,
		fb)
	return err
}

func (r *Repository) GetFeedbacks(ctx context.Context, decisionID string, tenantID string) ([]models.DecisionFeedback, error) {
	var fbs []models.DecisionFeedback
	err := r.db.SelectContext(ctx, &fbs,
		`SELECT * FROM ai_decision_feedback WHERE decision_id=$1 AND tenant_id=$2 ORDER BY created_at`,
		decisionID, tenantID)
	return fbs, err
}

// --- Traces ---

func (r *Repository) CreateTrace(ctx context.Context, t *models.DecisionTrace) error {
	t.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_decision_traces (id, tenant_id, decision_id, step, action, description,
		   input, output, duration, timestamp)
		 VALUES (:id, :tenantId, :decisionId, :step, :action, :description,
		   :input::jsonb, :output::jsonb, :duration, :timestamp)`,
		t)
	return err
}

func (r *Repository) CreateTraces(ctx context.Context, traces []*models.DecisionTrace) error {
	if len(traces) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO ai_decision_traces (id, tenant_id, decision_id, step, action, description,
		   input, output, duration, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range traces {
		_, err = stmt.ExecContext(ctx,
			t.ID, t.TenantID, t.DecisionID, t.Step, t.Action, t.Description,
			t.Input, t.Output, t.Duration, t.Timestamp)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) GetTraces(ctx context.Context, decisionID string, tenantID string) ([]models.DecisionTrace, error) {
	var traces []models.DecisionTrace
	err := r.db.SelectContext(ctx, &traces,
		`SELECT * FROM ai_decision_traces WHERE decision_id=$1 AND tenant_id=$2 ORDER BY step`,
		decisionID, tenantID)
	return traces, err
}

func (r *Repository) DeleteTraces(ctx context.Context, decisionID string, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_decision_traces WHERE decision_id=$1 AND tenant_id=$2`,
		decisionID, tenantID)
	return err
}

func (r *Repository) DeleteFeedbacks(ctx context.Context, decisionID string, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_decision_feedback WHERE decision_id=$1 AND tenant_id=$2`,
		decisionID, tenantID)
	return err
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error) {
	// Base WHERE
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if dateRange != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, dateRange.Start)
		argIdx++
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, dateRange.End)
		argIdx++
	}

	stats := &models.DecisionStats{
		ByStatus: make(map[models.DecisionStatus]int64),
		ByType:   make(map[models.DecisionType]int64),
	}

	// Total
	err := r.db.GetContext(ctx, &stats.Total,
		fmt.Sprintf(`SELECT COUNT(*) FROM ai_decisions %s`, where), args...)
	if err != nil {
		return nil, err
	}

	// Avg confidence
	err = r.db.GetContext(ctx, &stats.AvgConfidence,
		fmt.Sprintf(`SELECT COALESCE(AVG(confidence), 0) FROM ai_decisions %s`, where), args...)
	if err != nil {
		return nil, err
	}

	// By status
	var statusRows []struct {
		Status models.DecisionStatus `db:"status"`
		Count  int64                 `db:"count"`
	}
	err = r.db.SelectContext(ctx, &statusRows,
		fmt.Sprintf(`SELECT status, COUNT(*) AS count FROM ai_decisions %s GROUP BY status`, where), args...)
	if err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		stats.ByStatus[row.Status] = row.Count
	}

	// By type
	var typeRows []struct {
		Type  models.DecisionType `db:"type"`
		Count int64               `db:"count"`
	}
	err = r.db.SelectContext(ctx, &typeRows,
		fmt.Sprintf(`SELECT type, COUNT(*) AS count FROM ai_decisions %s GROUP BY type`, where), args...)
	if err != nil {
		return nil, err
	}
	for _, row := range typeRows {
		stats.ByType[row.Type] = row.Count
	}

	// Acceptance rate
	acceptedCount := stats.ByStatus[models.DecisionStatusAccepted]
	if stats.Total > 0 {
		stats.AcceptanceRate = float64(acceptedCount) / float64(stats.Total)
	}

	// Positive feedback rate
	var feedbackStats struct {
		TotalFeedbacks       int64 `db:"total"`
		PositiveFeedbacks    int64 `db:"positive"`
	}
	err = r.db.GetContext(ctx, &feedbackStats,
		fmt.Sprintf(`SELECT
			(SELECT COUNT(*) FROM ai_decision_feedback f JOIN ai_decisions d ON f.decision_id = d.id %s) AS total,
			(SELECT COUNT(*) FROM ai_decision_feedback f JOIN ai_decisions d ON f.decision_id = d.id %s AND f.type = 'positive') AS positive`,
			where, where), args...)
	if err != nil {
		// Non-fatal: just set to 0
		feedbackStats.TotalFeedbacks = 0
		feedbackStats.PositiveFeedbacks = 0
	}
	if feedbackStats.TotalFeedbacks > 0 {
		stats.PositiveFeedbackRate = float64(feedbackStats.PositiveFeedbacks) / float64(feedbackStats.TotalFeedbacks)
	}

	// Avg impact
	var impactSum struct {
		CostSavings   float64 `db:"cost_savings"`
		TimeSavings   float64 `db:"time_savings"`
		RiskReduction float64 `db:"risk_reduction"`
	}
	err = r.db.GetContext(ctx, &impactSum,
		fmt.Sprintf(`SELECT
			COALESCE(SUM(impact->>'costSavings')::numeric, 0),
			COALESCE(SUM(impact->>'timeSavings')::numeric, 0),
			COALESCE(SUM(impact->>'riskReduction')::numeric, 0)
		FROM ai_decisions d %s WHERE impact IS NOT NULL`, where), args...)
	if err != nil {
		// Non-fatal: keep 0s
	}
	if stats.Total > 0 {
		stats.AvgImpact.CostSavings = impactSum.CostSavings / float64(stats.Total)
		stats.AvgImpact.TimeSavings = impactSum.TimeSavings / float64(stats.Total)
		stats.AvgImpact.RiskReduction = impactSum.RiskReduction / float64(stats.Total)
	}

	return stats, nil
}

// ListFilter holds query parameters for listing decisions.
type ListFilter struct {
	Type      *string
	Status    *string
	ModelID   *string
	StartDate *int64
	EndDate   *int64
	Sort      *string
	Order     *string
	Limit     *int
	Offset    *int
}

// sanitizeSortField restricts allowed sort columns.
func sanitizeSortField(s string) string {
	allowed := map[string]bool{
		"created_at": true, "status": true, "type": true,
		"confidence": true, "created_by": true,
	}
	if allowed[s] {
		return s
	}
	return "created_at"
}
