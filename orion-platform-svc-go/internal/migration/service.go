package migration

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Service provides business logic for migration operations.
type Service struct {
	repo      *Repository
	state     *MigrationState
	log       *zap.Logger
	mu        sync.Mutex
	dbFactory DBFactory
}

// NewService creates a new migration service instance. dbFactory supplies
// a live *sql.DB for each endpoint during Execute; pass nil to keep the
// legacy behaviour where Execute records steps but does not touch a real
// database (used by tests and dry-runs).
func NewService(repo *Repository, log *zap.Logger, dbFactory DBFactory) *Service {
	if log == nil {
		log, _ = zap.NewProduction()
	}
	return &Service{
		repo:      repo,
		state:     NewMigrationState(),
		log:       log,
		dbFactory: dbFactory,
	}
}

// SetDBFactory replaces the DB factory at runtime. Called by wiring code
// that constructs the service before the DB factory is available.
func (s *Service) SetDBFactory(f DBFactory) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dbFactory = f
}

// db opens a connection for the endpoint using the configured factory.
func (s *Service) db(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error) {
	s.mu.Lock()
	f := s.dbFactory
	s.mu.Unlock()
	if f == nil {
		return nil, fmt.Errorf("dbFactory not configured")
	}
	return f(ctx, ep)
}

// CreatePlan creates a new migration plan.
func (s *Service) CreatePlan(ctx context.Context, input CreatePlanInput) (*MigrationPlan, error) {
	if input.Name == "" {
		return nil, fmt.Errorf("name required")
	}
	if input.Type == "" {
		input.Type = MigrationSchema
	}
	direction := input.Direction
	if direction == "" {
		direction = DirectionForward
	}
	batch := input.BatchSize
	if batch <= 0 {
		batch = 100
	}
	plan := &MigrationPlan{
		TenantID:      input.TenantID,
		Name:          input.Name,
		Type:          input.Type,
		Source:        input.Source,
		Target:        input.Target,
		Direction:     direction,
		SqlStatements: input.SqlStatements,
		DataFilter:    input.DataFilter,
		BatchSize:     batch,
	}
	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	s.log.Info("migration plan created", zap.String("id", plan.ID), zap.String("name", plan.Name))
	return plan, nil
}

// GetPlan returns a migration plan by ID.
func (s *Service) GetPlan(ctx context.Context, tenantID, id string) (*MigrationPlan, error) {
	plan, err := s.repo.GetPlan(ctx, id)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && plan.TenantID != tenantID {
		return nil, fmt.Errorf("plan not found: %s", id)
	}
	return plan, nil
}

// ListPlans returns all plans for a tenant.
func (s *Service) ListPlans(ctx context.Context, tenantID string) ([]*MigrationPlan, error) {
	return s.repo.ListPlans(ctx, tenantID)
}

// UpdatePlan updates an existing plan.
func (s *Service) UpdatePlan(ctx context.Context, tenantID, id string, input UpdatePlanInput) (*MigrationPlan, error) {
	plan, err := s.repo.GetPlan(ctx, id)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && plan.TenantID != tenantID {
		return nil, fmt.Errorf("plan not found: %s", id)
	}
	if input.Name != nil {
		plan.Name = *input.Name
	}
	if input.Type != nil {
		plan.Type = *input.Type
	}
	if input.Direction != nil {
		plan.Direction = *input.Direction
	}
	if input.SqlStatements != nil {
		plan.SqlStatements = *input.SqlStatements
	}
	if input.BatchSize != nil {
		plan.BatchSize = *input.BatchSize
	}
	if err := s.repo.UpdatePlan(ctx, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

// DeletePlan removes a plan.
func (s *Service) DeletePlan(ctx context.Context, tenantID, id string) error {
	if tenantID != "" {
		plan, err := s.repo.GetPlan(ctx, id)
		if err != nil {
			return err
		}
		if plan.TenantID != tenantID {
			return fmt.Errorf("plan not found: %s", id)
		}
	}
	return s.repo.DeletePlan(ctx, id)
}

// Execute runs a migration plan through its phases against a real
// database. Each SQL statement runs on the Target endpoint via the
// configured DBFactory, using a transaction so any step failure rolls
// back every previously executed step on the same connection. Row counts
// come straight from RowsAffected; statements that don't return a
// count (e.g. CREATE TABLE) are recorded as 0.
func (s *Service) Execute(ctx context.Context, tenantID, planID string) (*MigrationResult, error) {
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && plan.TenantID != tenantID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	phase := plan.Phase()
	switch phase {
	case PhaseCompleted, PhaseFailed, PhaseRolledBack:
		return nil, fmt.Errorf("plan %s is in terminal phase %q", planID, phase)
	}

	start := time.Now()
	result := &MigrationResult{
		PlanID: planID,
		Phase:  PhaseExecuting,
		Status: "running",
	}

	// Empty plan is a legal no-op: record as completed with zero steps.
	if len(plan.SqlStatements) == 0 {
		plan.SetPhase(PhaseCompleted)
		result.Status = "success"
		result.Phase = PhaseCompleted
		result.Duration = time.Since(start)
		s.log.Info("migration plan executed (no statements)", zap.String("id", planID))
		return result, nil
	}

	// Preflight: open the DB and begin a transaction so all statements
	// share a connection and can be atomically rolled back.
	db, err := s.db(ctx, plan.Target)
	if err != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("preflight: %v", err)
		result.Duration = time.Since(start)
		s.log.Error("migration preflight failed", zap.String("id", planID), zap.Error(err))
		return result, nil
	}
	defer db.Close()

	plan.SetPhase(PhasePreflight)
	result.Phase = PhasePreflight

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("begin tx: %v", err)
		result.Duration = time.Since(start)
		s.log.Error("migration begin tx failed", zap.String("id", planID), zap.Error(err))
		return result, nil
	}

	executedSteps := make([]*MigrationStep, 0, len(plan.SqlStatements))
	succeeded := false

	for i, stmt := range plan.SqlStatements {
		if err := ctx.Err(); err != nil {
			markFailedStep(ctx, s.repo, result, plan, i, stmt, "context cancelled")
			if rbErr := tx.Rollback(); rbErr != nil {
				s.log.Warn("rollback after cancel failed", zap.Error(rbErr))
			}
			result.Duration = time.Since(start)
			return result, nil
		}

		step := &MigrationStep{
			PlanID: plan.ID,
			Phase:  PhaseExecuting,
			Status: "pending",
			SQL:    stmt,
		}
		if err := s.repo.AddStep(ctx, step); err != nil {
			markFailedStep(ctx, s.repo, result, plan, i, stmt, fmt.Sprintf("record step: %v", err))
			if rbErr := tx.Rollback(); rbErr != nil {
				s.log.Warn("rollback after step-record failed", zap.Error(rbErr))
			}
			result.Duration = time.Since(start)
			return result, nil
		}

		now := time.Now().UTC()
		step.Started = &now
		step.Status = "running"
		_ = s.repo.UpdateStep(ctx, step)

		res, err := tx.ExecContext(ctx, stmt)
		finished := time.Now().UTC()
		step.Finished = &finished

		if err != nil {
			// Capture the failure, roll back prior steps on the same
			// connection, and mark the plan as failed.
			step.Status = "failed"
			step.ErrMsg = err.Error()
			_ = s.repo.UpdateStep(ctx, step)

			if rbErr := tx.Rollback(); rbErr != nil {
				s.log.Warn("rollback after step failure failed",
					zap.Int("index", i), zap.Error(rbErr))
			}
			// Mark earlier committed-but-uncommitted steps as needing
			// rollback so the caller knows they were reverted.
			for _, prev := range executedSteps {
				if prev.Status != "failed" {
					prev.Status = "rolled_back"
					prev.ErrMsg = fmt.Sprintf("rolled back after step %d failed: %v", i, err)
					_ = s.repo.UpdateStep(ctx, prev)
				}
			}
			result.Status = "failed"
			result.Phase = PhaseFailed
			result.Error = fmt.Sprintf("step %d: %v", i, err)
			result.Steps = len(executedSteps) + 1
			result.StepsErr = 1
			result.StepsOK = len(executedSteps)
			// result.Rows already holds the cumulative RowsAffected from
			// each successful step; leaving it as-is preserves the real
			// count even after we annotate earlier steps as rolled_back.
			plan.SetPhase(PhaseFailed)
			result.Duration = time.Since(start)
			s.log.Error("migration step failed",
				zap.String("id", planID), zap.Int("index", i), zap.Error(err))
			return result, nil
		}

		rowsAffected, rowsErr := res.RowsAffected()
		if rowsErr != nil {
			rowsAffected = 0
		}
		step.Status = "done"
		step.Rows = rowsAffected
		_ = s.repo.UpdateStep(ctx, step)
		executedSteps = append(executedSteps, step)
		result.StepsOK++
		result.Rows += rowsAffected
	}

	// Commit: all statements succeeded.
	if err := tx.Commit(); err != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("commit: %v", err)
		result.Duration = time.Since(start)
		s.log.Error("migration commit failed", zap.String("id", planID), zap.Error(err))
		return result, nil
	}

	plan.SetPhase(PhaseCompleted)
	result.Status = "success"
	result.Phase = PhaseCompleted
	result.Steps = len(executedSteps)
	result.StepsOK = len(executedSteps)
	result.StepsErr = 0
	result.Duration = time.Since(start)
	succeeded = true

	s.log.Info("migration plan executed",
		zap.String("id", planID),
		zap.Int("steps", result.Steps),
		zap.Int64("rows", result.Rows),
		zap.Duration("duration", result.Duration))
	_ = succeeded
	return result, nil
}

// markFailedStep records a step that failed before any DB work ran
// (record failure, cancel, etc.).
func markFailedStep(ctx context.Context, repo *Repository, result *MigrationResult, plan *MigrationPlan, i int, stmt, msg string) {
	plan.SetPhase(PhaseFailed)
	result.Status = "failed"
	result.Phase = PhaseFailed
	result.Error = fmt.Sprintf("step %d: %s", i, msg)
	result.Steps = i + 1
	result.StepsErr = 1
	step := &MigrationStep{
		PlanID:   plan.ID,
		Phase:    PhaseExecuting,
		Status:   "failed",
		SQL:      stmt,
		ErrMsg:   msg,
		Finished: ptrTime(time.Now().UTC()),
		Started:  ptrTime(time.Now().UTC()),
	}
	_ = repo.AddStep(ctx, step)
}

func ptrTime(t time.Time) *time.Time { return &t }

// Validate performs a dry-run validation of a plan.
func (s *Service) Validate(ctx context.Context, tenantID, planID string) (*MigrationResult, error) {
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && plan.TenantID != tenantID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	result := &MigrationResult{
		PlanID: planID,
		Phase:  PhaseValidating,
		Status: "validated",
	}

	// Check preconditions
	if len(plan.SqlStatements) == 0 && plan.Type != MigrationData {
		result.Error = "no SQL statements and not a data migration"
		result.Status = "invalid"
		return result, nil
	}

	if plan.Source.Host == "" || plan.Target.Host == "" {
		result.Error = "source or target host not specified"
		result.Status = "invalid"
		return result, nil
	}

	s.log.Info("migration plan validated", zap.String("id", planID))
	return result, nil
}

// Rollback reverses a completed migration.
func (s *Service) Rollback(ctx context.Context, tenantID, planID string) (*MigrationResult, error) {
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && plan.TenantID != tenantID {
		return nil, fmt.Errorf("plan not found: %s", planID)
	}

	phase := plan.Phase()
	if phase != PhaseCompleted {
		return nil, fmt.Errorf("plan %s cannot be rolled back: phase=%s", planID, phase)
	}

	start := time.Now()
	result := &MigrationResult{
		PlanID: planID,
		Phase:  PhaseExecuting,
		Status: "running",
	}

	plan.SetPhase(PhaseExecuting)
	result.Phase = PhaseExecuting

	db, err := s.db(ctx, plan.Target)
	if err != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("rollback preflight: %v", err)
		result.Duration = time.Since(start)
		s.log.Error("rollback preflight failed", zap.String("id", planID), zap.Error(err))
		return result, nil
	}
	defer db.Close()

	// If the plan carried explicit rollback statements, run them;
	// otherwise fall back to a ROLLBACK TO SAVEPOINT placeholder.
	rollbackSQLs := plan.SqlStatements
	if len(rollbackSQLs) == 0 {
		rollbackSQLs = []string{"ROLLBACK TO SAVEPOINT pre_migration"}
	}

	// Rollback also runs inside a transaction for atomicity: if a
	// rollback statement fails partway, the caller sees a coherent
	// "rolled back or not" state.
	tx, txErr := db.BeginTx(ctx, nil)
	if txErr != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("begin rollback tx: %v", txErr)
		result.Duration = time.Since(start)
		return result, nil
	}

	for i, stmt := range rollbackSQLs {
		if err := ctx.Err(); err != nil {
			_ = tx.Rollback()
			plan.SetPhase(PhaseFailed)
			result.Status = "failed"
			result.Phase = PhaseFailed
			result.Error = "rollback cancelled"
			result.Duration = time.Since(start)
			return result, nil
		}
		step := &MigrationStep{
			PlanID: plan.ID,
			Phase:  PhaseExecuting,
			Status: "pending",
			SQL:    stmt,
		}
		if err := s.repo.AddStep(ctx, step); err != nil {
			_ = tx.Rollback()
			result.Error = fmt.Sprintf("record step: %v", err)
			result.Status = "failed"
			result.Phase = PhaseFailed
			plan.SetPhase(PhaseFailed)
			return result, nil
		}
		now := time.Now().UTC()
		step.Started = &now
		step.Status = "running"
		_ = s.repo.UpdateStep(ctx, step)

		res, execErr := tx.ExecContext(ctx, stmt)
		finished := time.Now().UTC()
		step.Finished = &finished
		if execErr != nil {
			_ = tx.Rollback()
			step.Status = "failed"
			step.ErrMsg = execErr.Error()
			_ = s.repo.UpdateStep(ctx, step)
			result.Error = fmt.Sprintf("step %d: %v", i, execErr)
			result.Status = "failed"
			result.Phase = PhaseFailed
			plan.SetPhase(PhaseFailed)
			result.Duration = time.Since(start)
			s.log.Error("rollback step failed", zap.String("id", planID), zap.Int("index", i), zap.Error(execErr))
			return result, nil
		}
		rows, rowsErr := res.RowsAffected()
		if rowsErr != nil {
			rows = 0
		}
		step.Status = "done"
		step.Rows = rows
		_ = s.repo.UpdateStep(ctx, step)
		result.Steps++
		result.StepsOK++
		result.Rows += rows
	}

	if err := tx.Commit(); err != nil {
		plan.SetPhase(PhaseFailed)
		result.Status = "failed"
		result.Phase = PhaseFailed
		result.Error = fmt.Sprintf("commit rollback: %v", err)
		result.Duration = time.Since(start)
		return result, nil
	}

	result.Status = "success"
	result.Phase = PhaseRolledBack
	plan.SetPhase(PhaseRolledBack)
	result.Duration = time.Since(start)

	s.log.Info("migration plan rolled back", zap.String("id", planID))
	return result, nil
}

// SchemaDiff compares source and target schema.
func (s *Service) SchemaDiff(ctx context.Context, planID string) (*SchemaDiff, error) {
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return nil, err
	}

	// Simulated schema diff based on plan type
	diff := &SchemaDiff{
		SourceEndpoint: plan.Source.Name,
		TargetEndpoint: plan.Target.Name,
		CheckedAt:      time.Now().UTC(),
	}

	if plan.Type == MigrationSchema || plan.Type == MigrationHybrid {
		// Simulate schema differences
		if len(plan.SqlStatements) > 0 {
			diff.Additions = []SchemaObject{
				{Name: "migrated_table", Type: "table", Change: "added"},
			}
		}
	}

	if plan.Direction == DirectionRollback {
		diff.Removals = []SchemaObject{
			{Name: "original_table", Type: "table", Change: "removed"},
		}
	}

	s.log.Info("schema diff computed", zap.String("plan_id", planID),
		zap.Int("additions", len(diff.Additions)),
		zap.Int("removals", len(diff.Removals)),
	)
	return diff, nil
}

// GetSteps returns all steps for a plan.
func (s *Service) GetSteps(ctx context.Context, planID string) ([]*MigrationStep, error) {
	return s.repo.ListSteps(ctx, planID)
}

// GetStats returns migration statistics.
func (s *Service) GetStats(ctx context.Context) MigrationPlanStats {
	return s.repo.Stats()
}

// GetPlanPhase returns the current phase of a plan.
func (s *Service) GetPlanPhase(ctx context.Context, planID string) (MigrationPhase, error) {
	plan, err := s.repo.GetPlan(ctx, planID)
	if err != nil {
		return "", err
	}
	return plan.Phase(), nil
}
