package migration

import "context"

// PlanRepository abstracts persistence of migration plans and steps.
type PlanRepository interface {
	CreatePlan(ctx context.Context, plan *MigrationPlan) error
	GetPlan(ctx context.Context, id string) (*MigrationPlan, error)
	ListPlans(ctx context.Context, tenantID string) ([]*MigrationPlan, error)
	UpdatePlan(ctx context.Context, plan *MigrationPlan) error
	DeletePlan(ctx context.Context, id string) error

	AddStep(ctx context.Context, step *MigrationStep) error
	ListSteps(ctx context.Context, planID string) ([]*MigrationStep, error)
	UpdateStep(ctx context.Context, step *MigrationStep) error
	AddRows(ctx context.Context, n int64)
	Stats() MigrationPlanStats
}

// PlanService abstracts migration plan business logic.
type PlanService interface {
	CreatePlan(ctx context.Context, input CreatePlanInput) (*MigrationPlan, error)
	GetPlan(ctx context.Context, tenantID, id string) (*MigrationPlan, error)
	ListPlans(ctx context.Context, tenantID string) ([]*MigrationPlan, error)
	UpdatePlan(ctx context.Context, tenantID, id string, input UpdatePlanInput) (*MigrationPlan, error)
	DeletePlan(ctx context.Context, tenantID, id string) error

	Execute(ctx context.Context, tenantID, planID string) (*MigrationResult, error)
	Validate(ctx context.Context, tenantID, planID string) (*MigrationResult, error)
	Rollback(ctx context.Context, tenantID, planID string) (*MigrationResult, error)
	SchemaDiff(ctx context.Context, planID string) (*SchemaDiff, error)
	GetSteps(ctx context.Context, planID string) ([]*MigrationStep, error)
	GetStats(ctx context.Context) MigrationPlanStats
	GetPlanPhase(ctx context.Context, planID string) (MigrationPhase, error)
}
