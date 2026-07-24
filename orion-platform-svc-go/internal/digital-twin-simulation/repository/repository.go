package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/digital-twin-simulation/models"

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

// --- Digital Twins ---

func (r *Repository) CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
	twin := &models.DigitalTwin{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		EntityType:  req.EntityType,
		SourceID:    req.SourceID,
		Status:      models.TwinStatusInitializing,
		Config:      toJSON([]byte("{}")),
		Metadata:    toJSON([]byte("{}")),
		SyncPolicy:  toJSON([]byte("{}")),
		SyncHealth:  models.SyncHealthHealthy,
		CreatedAt:   now(),
		UpdatedAt:   now(),
	}
	if req.Config != nil {
		twin.Config = *req.Config
	}
	if req.SyncPolicy != nil {
		twin.SyncPolicy = *req.SyncPolicy
	}
	if req.Metadata != nil {
		twin.Metadata = *req.Metadata
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_sim_twins (id, tenant_id, name, description, entity_type, source_id, status, config, metadata, sync_policy, last_sync_time, sync_health, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :entity_type, :source_id, :status, :config, :metadata, :sync_policy, :last_sync_time, :sync_health, :created_at, :updated_at)`,
		twin)
	if err != nil {
		return nil, err
	}
	return twin, nil
}

func (r *Repository) FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	var twin models.DigitalTwin
	err := r.db.GetContext(ctx, &twin,
		`SELECT * FROM digital_twin_sim_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &twin, nil
}

func (r *Repository) ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error) {
	where, args := buildTwinWhere(tenantID, q)
	// Count.
	var total int64
	countSQL := fmt.Sprintf(`SELECT COUNT(*) FROM digital_twin_sim_twins WHERE %s`, where)
	err := r.db.GetContext(ctx, &total, countSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	// Rows.
	sortField := safeSortField(q.Sort)
	sortOrder := safeSortOrder(q.Order)
	offset := q.Offset
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	rowsSQL := fmt.Sprintf(`SELECT * FROM digital_twin_sim_twins WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, sortField, sortOrder, len(args)+1, len(args)+2)
	args = append(args, limit, offset)
	var twins []models.DigitalTwin
	err = r.db.SelectContext(ctx, &twins, rowsSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	return twins, total, nil
}

func (r *Repository) UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error) {
	twin, err := r.FindTwinByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		twin.Name = req.Name
	}
	if req.Description != "" {
		twin.Description = req.Description
	}
	if req.Config != nil {
		twin.Config = *req.Config
	}
	if req.SyncPolicy != nil {
		twin.SyncPolicy = *req.SyncPolicy
	}
	if req.Metadata != nil {
		twin.Metadata = *req.Metadata
	}
	twin.UpdatedAt = now()
	_, err = r.db.NamedExecContext(ctx,
		`UPDATE digital_twin_sim_twins SET name=:name, description=:description, config=:config, sync_policy=:sync_policy, metadata=:metadata, updated_at=:updated_at WHERE id=:id`,
		twin)
	if err != nil {
		return nil, err
	}
	return twin, nil
}

func (r *Repository) DeleteTwin(ctx context.Context, tenantID, id string) error {
	// Delete dependent rows first.
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM digital_twin_sim_simulations WHERE twin_id=$1`, id)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM digital_twin_sim_states WHERE twin_id=$1`, id)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM digital_twin_sim_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return nil
}

func (r *Repository) UpdateTwinStatusAndSync(ctx context.Context, tenantID, id string, status string, lastSync *int64, updatedAt int64) (*models.DigitalTwin, error) {
	var twin models.DigitalTwin
	query := `SELECT * FROM digital_twin_sim_twins WHERE id=$1 AND tenant_id=$2`
	err := r.db.GetContext(ctx, &twin, query, id, tenantID)
	if err != nil {
		return nil, err
	}
	_, err = r.db.NamedExecContext(ctx,
		`UPDATE digital_twin_sim_twins SET status=:status, last_sync_time=:last_sync_time, updated_at=:updated_at WHERE id=:id`,
		map[string]interface{}{
			"status":         status,
			"last_sync_time": lastSync,
			"updated_at":     updatedAt,
			"id":             id,
		})
	if err != nil {
		return nil, err
	}
	return r.FindTwinByID(ctx, tenantID, id)
}

// --- Twin States ---

func (r *Repository) CreateState(ctx context.Context, state models.TwinState) (*models.TwinState, error) {
	state.CreatedAt = now()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_sim_states (twin_id, timestamp, status, resources, performance, dependencies, events, created_at)
		 VALUES (:twin_id, :timestamp, :status, :resources, :performance, :dependencies, :events, :created_at)`,
		state)
	if err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *Repository) GetLatestState(ctx context.Context, twinID string) (*models.TwinState, error) {
	var state models.TwinState
	err := r.db.GetContext(ctx, &state,
		`SELECT * FROM digital_twin_sim_states WHERE twin_id=$1 ORDER BY timestamp DESC LIMIT 1`, twinID)
	if err != nil {
		return nil, err
	}
	return &state, nil
}

// --- Simulations ---

func (r *Repository) CreateSimulation(ctx context.Context, tenantID string, sim models.Simulation) (*models.Simulation, error) {
	sim.CreatedAt = now()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO digital_twin_sim_simulations (id, tenant_id, twin_id, type, name, description, parameters, status, start_time, end_time, duration, results, created_at)
		 VALUES (:id, :tenant_id, :twin_id, :type, :name, :description, :parameters, :status, :start_time, :end_time, :duration, :results, :created_at)`,
		sim)
	if err != nil {
		return nil, err
	}
	return &sim, nil
}

func (r *Repository) ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error) {
	var total int64
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM digital_twin_sim_simulations WHERE twin_id=$1`, twinID)
	if err != nil {
		return nil, 0, err
	}
	offset := q.Offset
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	var sims []models.Simulation
	err = r.db.SelectContext(ctx, &sims,
		`SELECT * FROM digital_twin_sim_simulations WHERE twin_id=$1 ORDER BY start_time DESC LIMIT $2 OFFSET $3`,
		twinID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return sims, total, nil
}

func (r *Repository) UpdateSimulation(ctx context.Context, id string, status string, endTime *int64, duration *int64, results models.JSON) (*models.Simulation, error) {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE digital_twin_sim_simulations SET status=:status, end_time=:end_time, duration=:duration, results=:results WHERE id=:id`,
		map[string]interface{}{
			"status":   status,
			"end_time": endTime,
			"duration": duration,
			"results":  results,
			"id":       id,
		})
	if err != nil {
		return nil, err
	}
	var sim models.Simulation
	err = r.db.GetContext(ctx, &sim, `SELECT * FROM digital_twin_sim_simulations WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &sim, nil
}

// --- Sentinel errors ---

func ErrNotFoundMsg(msg string) error {
	return fmt.Errorf("%s: %w", msg, sentinel.NotFound)
}

// --- Helpers ---

func toJSON(b []byte) models.JSON {
	return models.JSON(b)
}

func now() int64 {
	return int64(0) // replaced by service layer with real time
}

func buildTwinWhere(tenantID string, q models.ListQuery) (string, []interface{}) {
	clauses := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	idx := 2
	if q.EntityType != "" {
		clauses = append(clauses, fmt.Sprintf("entity_type=$%d", idx))
		args = append(args, q.EntityType)
		idx++
	}
	if q.Status != "" {
		clauses = append(clauses, fmt.Sprintf("status=$%d", idx))
		args = append(args, q.Status)
		idx++
	}
	if q.SourceId != "" {
		clauses = append(clauses, fmt.Sprintf("source_id=$%d", idx))
		args = append(args, q.SourceId)
		idx++
	}
	where := " AND " + joinClauses(clauses, " AND ")
	return where, args
}

func joinClauses(clauses []string, sep string) string {
	if len(clauses) == 0 {
		return "1=1"
	}
	result := clauses[0]
	for _, c := range clauses[1:] {
		result += sep + c
	}
	return result
}

func safeSortField(field string) string {
	allowed := map[string]bool{
		"name": true, "status": true, "entity_type": true,
		"source_id": true, "created_at": true, "updated_at": true,
		"last_sync_time": true,
	}
	if field == "" || !allowed[field] {
		return "created_at"
	}
	return field
}

func safeSortOrder(order string) string {
	if order == "asc" || order == "ASC" {
		return "ASC"
	}
	return "DESC"
}
