package migration

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Service provides business logic for migration operations.
type Service struct {
	repo  *Repository
	state *MigrationState
	log   *zap.Logger
	mu    sync.Mutex
}

// NewService creates a new migration service instance.
func NewService(repo *Repository, log *zap.Logger) *Service {
	return &Service{
		repo:  repo,
		state: NewMigrationState(),
		log:   log,
	}
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

// Execute runs a migration plan through its phases.
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

	// Simulate preflight check
	plan.SetPhase(PhasePreflight)
	result.Phase = PhasePreflight

	// Execute SQL statements as steps
	if len(plan.SqlStatements) > 0 {
		for i, sql := range plan.SqlStatements {
			step := &MigrationStep{
				PlanID: plan.ID,
				Phase:  PhaseExecuting,
				Status: "pending",
				SQL:    sql,
			}
			if err := s.repo.AddStep(ctx, step); err != nil {
				result.Error = fmt.Sprintf("step %d: %v", i, err)
				result.Status = "failed"
				result.Phase = PhaseFailed
				plan.SetPhase(PhaseFailed)
				break
			}

			now := time.Now().UTC()
			step.Started = &now
			step.Status = "running"
			_ = s.repo.UpdateStep(ctx, step)

			// Simulate execution delay (100ms per statement)
			select {
			case <-ctx.Done():
				step.Status = "failed"
				step.ErrMsg = "context cancelled"
				finished := time.Now().UTC()
				step.Finished = &finished
				_ = s.repo.UpdateStep(ctx, step)
				result.Error = "execution cancelled"
				result.Status = "failed"
				result.Phase = PhaseFailed
				plan.SetPhase(PhaseFailed)
				return result, nil
			case <-time.After(100 * time.Millisecond):
			}

			step.Status = "done"
			step.Rows = 1
			finished := time.Now().UTC()
			step.Finished = &finished
			_ = s.repo.UpdateStep(ctx, step)
			result.Steps++
			result.StepsOK++
			result.Rows++
		}
	}

	// Simulation: all done
	result.Status = "success"
	result.Phase = PhaseCompleted
	plan.SetPhase(PhaseCompleted)
	result.Duration = time.Since(start)

	steps, _ := s.repo.ListSteps(ctx, planID)
	result.Steps = len(steps)
	result.StepsOK = result.Steps
	result.StepsErr = 0

	s.log.Info("migration plan executed", zap.String("id", planID), zap.Duration("duration", result.Duration))
	return result, nil
}

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

	// Generate rollback SQL (simulated)
	rollbackSQL := "ROLLBACK TO SAVEPOINT pre_migration"
	step := &MigrationStep{
		PlanID: plan.ID,
		Phase:  PhaseExecuting,
		Status: "pending",
		SQL:    rollbackSQL,
	}
	if err := s.repo.AddStep(ctx, step); err != nil {
		result.Error = err.Error()
		result.Status = "failed"
		result.Phase = PhaseFailed
		plan.SetPhase(PhaseFailed)
		return result, nil
	}

	now := time.Now().UTC()
	step.Started = &now
	step.Status = "running"
	_ = s.repo.UpdateStep(ctx, step)

	select {
	case <-ctx.Done():
		step.Status = "failed"
		step.ErrMsg = "context cancelled"
		finished := time.Now().UTC()
		step.Finished = &finished
		_ = s.repo.UpdateStep(ctx, step)
		result.Error = "rollback cancelled"
		result.Status = "failed"
		result.Phase = PhaseFailed
		plan.SetPhase(PhaseFailed)
		return result, nil
	case <-time.After(100 * time.Millisecond):
	}

	step.Status = "done"
	step.Rows = 1
	finished := time.Now().UTC()
	step.Finished = &finished
	_ = s.repo.UpdateStep(ctx, step)
	result.Steps++
	result.StepsOK++
	result.Rows++
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
