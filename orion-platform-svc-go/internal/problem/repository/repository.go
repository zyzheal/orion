package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/problem/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)
// ErrNotFound is an alias for sentinel.NotFound for test compatibility.
var ErrNotFound = sentinel.NotFound


type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Problems ---

func (r *Repository) CreateProblem(ctx context.Context, problem *models.Problem) error {
	problem.ID = uuid.New().String()
	now := time.Now().UTC()
	problem.CreatedAt = now
	problem.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO problem_problems (id, tenant_id, title, description, status, priority, severity, category, assigned_to, created_by, metadata, created_at, updated_at)
		 VALUES (:id, :tenantId, :title, :description, :status, :priority, :severity, :category, :assignedTo, :createdBy, :metadata, :createdAt, :updatedAt)`,
		problem)
	return err
}

func (r *Repository) GetProblemByID(ctx context.Context, id string, tenantID string) (*models.Problem, error) {
	var problem models.Problem
	err := r.db.GetContext(ctx, &problem,
		`SELECT * FROM problem_problems WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &problem, nil
}

func (r *Repository) ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Severity != nil && *filter.Severity != "" {
			where += fmt.Sprintf(" AND severity = $%d", argIdx)
			args = append(args, *filter.Severity)
			argIdx++
		}
		if filter.AssignedTo != nil && *filter.AssignedTo != "" {
			where += fmt.Sprintf(" AND assigned_to = $%d", argIdx)
			args = append(args, *filter.AssignedTo)
			argIdx++
		}
		if filter.Category != nil && *filter.Category != "" {
			where += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, *filter.Category)
			argIdx++
		}
	}

	var problems []models.Problem
	if filter != nil && filter.Limit > 0 {
		where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		args = append(args, filter.Limit, filter.Offset)
	}
	err := r.db.SelectContext(ctx, &problems,
		fmt.Sprintf(`SELECT * FROM problem_problems %s ORDER BY created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	// Count total (without limit)
	countArgs := []interface{}{tenantID}
	countIdx := 2
	countWhere := "WHERE tenant_id = $1"
	if filter != nil {
		if filter.Status != nil && *filter.Status != "" {
			countWhere += fmt.Sprintf(" AND status = $%d", countIdx)
			countArgs = append(countArgs, *filter.Status)
			countIdx++
		}
		if filter.Severity != nil && *filter.Severity != "" {
			countWhere += fmt.Sprintf(" AND severity = $%d", countIdx)
			countArgs = append(countArgs, *filter.Severity)
			countIdx++
		}
		if filter.AssignedTo != nil && *filter.AssignedTo != "" {
			countWhere += fmt.Sprintf(" AND assigned_to = $%d", countIdx)
			countArgs = append(countArgs, *filter.AssignedTo)
			countIdx++
		}
		if filter.Category != nil && *filter.Category != "" {
			countWhere += fmt.Sprintf(" AND category = $%d", countIdx)
			countArgs = append(countArgs, *filter.Category)
			countIdx++
		}
	}
	var total int
	err = r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM problem_problems %s`, countWhere), countArgs...)
	if err != nil {
		return nil, 0, err
	}

	if problems == nil {
		problems = []models.Problem{}
	}
	return problems, total, nil
}

func (r *Repository) UpdateProblem(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Problem, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE problem_problems SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetProblemByID(ctx, id, tenantID)
}

func (r *Repository) DeleteProblem(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM problem_problems WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error) {
	stats := &models.ProblemStats{
		ByStatus:   map[string]int{},
		ByPriority: map[string]int{},
		BySeverity: map[string]int{},
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM problem_problems WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.Total = total

	var rows []struct {
		Status sql.NullString `db:"status"`
		Count  int            `db:"count"`
	}
	err = r.db.SelectContext(ctx, &rows,
		`SELECT status, COUNT(*) AS count FROM problem_problems WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row.Status.Valid {
			stats.ByStatus[row.Status.String] = row.Count
		}
	}

	var priorityRows []struct {
		Priority sql.NullString `db:"priority"`
		Count    int            `db:"count"`
	}
	err = r.db.SelectContext(ctx, &priorityRows,
		`SELECT priority, COUNT(*) AS count FROM problem_problems WHERE tenant_id=$1 GROUP BY priority`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range priorityRows {
		if row.Priority.Valid {
			stats.ByPriority[row.Priority.String] = row.Count
		}
	}

	var severityRows []struct {
		Severity sql.NullString `db:"severity"`
		Count    int            `db:"count"`
	}
	err = r.db.SelectContext(ctx, &severityRows,
		`SELECT severity, COUNT(*) AS count FROM problem_problems WHERE tenant_id=$1 AND severity IS NOT NULL GROUP BY severity`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range severityRows {
		if row.Severity.Valid {
			stats.BySeverity[row.Severity.String] = row.Count
		}
	}

	return stats, nil
}

// --- Known Errors ---

func (r *Repository) CreateKnownError(ctx context.Context, ke *models.KnownError) error {
	ke.ID = uuid.New().String()
	ke.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO problem_known_errors (id, problem_id, name, symptoms, workaround, root_cause, permanent_fix, affected_services, keywords, created_at)
		 VALUES (:id, :problemId, :name, :symptoms, :workaround, :rootCause, :permanentFix, :affectedServices, :keywords, :createdAt)`,
		ke)
	return err
}

func (r *Repository) GetKnownErrorByID(ctx context.Context, id string) (*models.KnownError, error) {
	var ke models.KnownError
	err := r.db.GetContext(ctx, &ke,
		`SELECT * FROM problem_known_errors WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &ke, nil
}

func (r *Repository) ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error) {
	// Need to join with problem_problems to enforce tenant isolation
	where := "JOIN problem_problems p ON p.id = ke.problem_id WHERE p.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.ProblemID != nil && *filter.ProblemID != "" {
			where += fmt.Sprintf(" AND ke.problem_id = $%d", argIdx)
			args = append(args, *filter.ProblemID)
			argIdx++
		}
	}

	var kes []models.KnownError
	if filter != nil && filter.Limit > 0 {
		where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		args = append(args, filter.Limit, filter.Offset)
	}
	err := r.db.SelectContext(ctx, &kes,
		fmt.Sprintf(`SELECT ke.* FROM problem_known_errors ke %s ORDER BY ke.created_at DESC`, where), args...)
	if err != nil {
		return nil, 0, err
	}

	var total int
	countArgs := []interface{}{tenantID}
	countIdx := 2
	countWhere := "JOIN problem_problems p ON p.id = ke.problem_id WHERE p.tenant_id = $1"
	if filter != nil && filter.ProblemID != nil && *filter.ProblemID != "" {
		countWhere += fmt.Sprintf(" AND ke.problem_id = $%d", countIdx)
		countArgs = append(countArgs, *filter.ProblemID)
		countIdx++
	}
	err = r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM problem_known_errors ke %s`, countWhere), countArgs...)
	if err != nil {
		return nil, 0, err
	}

	if kes == nil {
		kes = []models.KnownError{}
	}
	return kes, total, nil
}

func (r *Repository) SearchKnownErrors(ctx context.Context, query string, tenantID string) ([]models.KnownError, int, error) {
	var kes []models.KnownError
	err := r.db.SelectContext(ctx, &kes,
		`SELECT ke.* FROM problem_known_errors ke
		 JOIN problem_problems p ON p.id = ke.problem_id
		 WHERE p.tenant_id=$1
		   AND (ke.name ILIKE $2 OR ke.keywords ILIKE $3 OR ke.symptoms::TEXT ILIKE $4)`,
		tenantID, "%"+query+"%", "%"+query+"%", "%"+query+"%")
	if err != nil {
		return nil, 0, err
	}
	if kes == nil {
		kes = []models.KnownError{}
	}
	return kes, len(kes), nil
}

func (r *Repository) UpdateKnownError(ctx context.Context, id string, updates map[string]interface{}) (*models.KnownError, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id)
	query := fmt.Sprintf(`UPDATE problem_known_errors SET %s WHERE id=$%d`,
		strings.Join(setClauses, ", "), i)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetKnownErrorByID(ctx, id)
}

func (r *Repository) DeleteKnownError(ctx context.Context, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM problem_known_errors WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Incident Links ---

func (r *Repository) LinkIncident(ctx context.Context, problemID, incidentID string) (*models.Problem, error) {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO problem_incident_links (id, problem_id, incident_id, created_at)
		 VALUES (:id, :problemId, :incidentId, :createdAt)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"problemId":  problemID,
			"incidentId": incidentID,
			"createdAt":  time.Now().UTC(),
		})
	if err != nil {
		return nil, err
	}
	return r.GetProblemByID(ctx, problemID, "") // tenantID retrieved via link below
}

// LinkIncidentWithTenant links an incident and returns the problem.
func (r *Repository) LinkIncidentWithTenant(ctx context.Context, problemID, incidentID, tenantID string) (*models.Problem, error) {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO problem_incident_links (id, problem_id, incident_id, created_at)
		 VALUES (:id, :problemId, :incidentId, :createdAt)`,
		map[string]interface{}{
			"id":         uuid.New().String(),
			"problemId":  problemID,
			"incidentId": incidentID,
			"createdAt":  time.Now().UTC(),
		})
	if err != nil {
		return nil, err
	}
	return r.GetProblemByID(ctx, problemID, tenantID)
}

func (r *Repository) GetIncidentLinks(ctx context.Context, problemID string) ([]string, error) {
	var incidentIDs []string
	err := r.db.SelectContext(ctx, &incidentIDs,
		`SELECT incident_id FROM problem_incident_links WHERE problem_id=$1`, problemID)
	return incidentIDs, err
}

// --- Change Links ---

func (r *Repository) LinkChangeWithTenant(ctx context.Context, problemID, changeID, tenantID string) (*models.Problem, error) {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO problem_change_links (id, problem_id, change_id, created_at)
		 VALUES (:id, :problemId, :changeId, :createdAt)`,
		map[string]interface{}{
			"id":        uuid.New().String(),
			"problemId": problemID,
			"changeId":  changeID,
			"createdAt": time.Now().UTC(),
		})
	if err != nil {
		return nil, err
	}
	return r.GetProblemByID(ctx, problemID, tenantID)
}

func (r *Repository) GetChangeLinks(ctx context.Context, problemID string) ([]string, error) {
	var changeIDs []string
	err := r.db.SelectContext(ctx, &changeIDs,
		`SELECT change_id FROM problem_change_links WHERE problem_id=$1`, problemID)
	return changeIDs, err
}
