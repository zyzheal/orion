package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/ai-svc-go/internal/orchestration/models"
)

type OrchestrationRepository struct {
	DB *sql.DB
}

func NewOrchestrationRepository(db *sql.DB) *OrchestrationRepository {
	return &OrchestrationRepository{DB: db}
}

// Create creates a new orchestration.
func (r *OrchestrationRepository) Create(ctx context.Context, tenantID string, name, description string, agents []models.AgentConfig) (*models.Orchestration, error) {
	now := time.Now()
	id := fmt.Sprintf("orch_%d", time.Now().UnixNano())

	agentsJSON, _ := json.Marshal(agents)

	query := `INSERT INTO orchestrations (id, tenant_id, name, description, agents, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.DB.ExecContext(ctx, query, id, tenantID, name, description, string(agentsJSON), "active", now, now); err != nil {
		return nil, fmt.Errorf("create orchestration: %w", err)
	}

	return &models.Orchestration{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Description: description,
		Agents:      agents,
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// Query returns paginated orchestrations.
func (r *OrchestrationRepository) Query(ctx context.Context, tenantID string, limit, offset int) (models.OrchestrationResponse, error) {
	var resp models.OrchestrationResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM orchestrations WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, description, agents, status, created_at, updated_at FROM orchestrations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.DB.QueryRowContext(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count orchestrations: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query orchestrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var o models.Orchestration
		var agentsJSON sql.NullString
		if err := rows.Scan(&o.ID, &o.TenantID, &o.Name, &o.Description, &agentsJSON, &o.Status, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan orchestration: %w", err)
		}
		if agentsJSON.Valid {
			_ = json.Unmarshal([]byte(agentsJSON.String), &o.Agents)
		}
		resp.Data = append(resp.Data, o)
	}
	return resp, nil
}

// Get returns an orchestration by ID.
func (r *OrchestrationRepository) Get(ctx context.Context, tenantID, id string) (*models.Orchestration, error) {
	var o models.Orchestration
	var agentsJSON sql.NullString

	query := `SELECT id, tenant_id, name, description, agents, status, created_at, updated_at FROM orchestrations WHERE id = $1 AND tenant_id = $2`
	if err := r.DB.QueryRowContext(ctx, query, id, tenantID).Scan(
		&o.ID, &o.TenantID, &o.Name, &o.Description, &agentsJSON, &o.Status, &o.CreatedAt, &o.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("orchestration not found: %s", id)
		}
		return nil, fmt.Errorf("get orchestration: %w", err)
	}
	if agentsJSON.Valid {
		_ = json.Unmarshal([]byte(agentsJSON.String), &o.Agents)
	}
	return &o, nil
}

// CreateRun creates a new orchestration run.
func (r *OrchestrationRepository) CreateRun(ctx context.Context, orchestrationID string, input string) (*models.OrchestrationRun, error) {
	now := time.Now()
	id := fmt.Sprintf("run_%d", time.Now().UnixNano())

	query := `INSERT INTO orchestration_runs (id, orchestration_id, status, input, output, error, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.DB.ExecContext(ctx, query, id, orchestrationID, "running", input, "", "", now, nil); err != nil {
		return nil, fmt.Errorf("create orchestration run: %w", err)
	}

	return &models.OrchestrationRun{
		ID:              id,
		OrchestrationID: orchestrationID,
		Status:          "running",
		Input:           input,
		StartedAt:       now,
	}, nil
}

// UpdateRun updates a run's status and output.
func (r *OrchestrationRepository) UpdateRun(ctx context.Context, id string, status, output, errorStr string) error {
	now := time.Time{}
	var completedAt interface{}
	if status == "completed" || status == "failed" {
		completedAt = time.Now()
		now = completedAt.(time.Time)
	}

	query := `UPDATE orchestration_runs SET status=$1, output=$2, error=$3, completed_at=$4 WHERE id=$5`
	_, err := r.DB.ExecContext(ctx, query, status, output, errorStr, completedAt, id)
	return err
}

// QueryRuns returns paginated runs.
func (r *OrchestrationRepository) QueryRuns(ctx context.Context, orchestrationID string, limit, offset int) ([]models.OrchestrationRun, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM orchestration_runs WHERE orchestration_id = $1`
	if err := r.DB.QueryRowContext(ctx, countQuery, orchestrationID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count runs: %w", err)
	}

	query := `SELECT id, orchestration_id, status, input, output, error, started_at, completed_at FROM orchestration_runs WHERE orchestration_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.DB.QueryContext(ctx, query, orchestrationID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query runs: %w", err)
	}
	defer rows.Close()

	var runs []models.OrchestrationRun
	for rows.Next() {
		var run models.OrchestrationRun
		var completedAt sql.NullTime
		if err := rows.Scan(&run.ID, &run.OrchestrationID, &run.Status, &run.Input, &run.Output, &run.Error, &run.StartedAt, &completedAt); err != nil {
			return nil, 0, fmt.Errorf("scan run: %w", err)
		}
		if completedAt.Valid {
			run.CompletedAt = &completedAt.Time
		}
		runs = append(runs, run)
	}
	return runs, total, nil
}

// GetRun returns a run by ID.
func (r *OrchestrationRepository) GetRun(ctx context.Context, id string) (*models.OrchestrationRun, error) {
	var run models.OrchestrationRun
	var completedAt sql.NullTime

	query := `SELECT id, orchestration_id, status, input, output, error, started_at, completed_at FROM orchestration_runs WHERE id = $1`
	if err := r.DB.QueryRowContext(ctx, query, id).Scan(
		&run.ID, &run.OrchestrationID, &run.Status, &run.Input, &run.Output, &run.Error, &run.StartedAt, &completedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("run not found: %s", id)
		}
		return nil, fmt.Errorf("get run: %w", err)
	}
	if completedAt.Valid {
		run.CompletedAt = &completedAt.Time
	}
	return &run, nil
}

// Delete removes an orchestration.
func (r *OrchestrationRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM orchestrations WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete orchestration: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("orchestration not found: %s", id)
	}
	return nil
}
