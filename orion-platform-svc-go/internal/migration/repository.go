package migration

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Repository stores migration plans and steps in memory (phase 1).
type Repository struct {
	mu      sync.RWMutex
	plans   map[string]*MigrationPlan
	steps   map[string][]*MigrationStep // planID -> steps
	rowLog  int64 // cumulative rows migrated
}

func NewRepository() *Repository {
	return &Repository{
		plans: make(map[string]*MigrationPlan),
		steps: make(map[string][]*MigrationStep),
	}
}

func (r *Repository) CreatePlan(ctx context.Context, plan *MigrationPlan) error {
	if plan == nil {
		return fmt.Errorf("plan required")
	}
	if plan.ID == "" {
		plan.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	plan.CreatedAt = now
	plan.UpdatedAt = now
	r.mu.Lock()
	defer r.mu.Unlock()
	r.plans[plan.ID] = plan
	return nil
}

func (r *Repository) GetPlan(ctx context.Context, id string) (*MigrationPlan, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.plans[id]
	if !ok {
		return nil, fmt.Errorf("plan not found: %s", id)
	}
	return p, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string) ([]*MigrationPlan, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*MigrationPlan, 0, len(r.plans))
	for _, p := range r.plans {
		if tenantID == "" || p.TenantID == tenantID {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (r *Repository) UpdatePlan(ctx context.Context, plan *MigrationPlan) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.plans[plan.ID]
	if !ok {
		return fmt.Errorf("plan not found: %s", plan.ID)
	}
	plan.UpdatedAt = time.Now().UTC()
	r.plans[plan.ID] = plan
	return nil
}

func (r *Repository) DeletePlan(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.plans[id]; !ok {
		return fmt.Errorf("plan not found: %s", id)
	}
	delete(r.plans, id)
	delete(r.steps, id)
	return nil
}

func (r *Repository) AddStep(ctx context.Context, step *MigrationStep) error {
	if step == nil || step.PlanID == "" {
		return fmt.Errorf("plan_id required")
	}
	if step.ID == "" {
		step.ID = uuid.New().String()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.steps[step.PlanID] = append(r.steps[step.PlanID], step)
	return nil
}

func (r *Repository) ListSteps(ctx context.Context, planID string) ([]*MigrationStep, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.steps[planID], nil
}

func (r *Repository) UpdateStep(ctx context.Context, step *MigrationStep) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, s := range r.steps[step.PlanID] {
		if s.ID == step.ID {
			*s = *step
			return nil
		}
	}
	return fmt.Errorf("step not found: %s", step.ID)
}

func (r *Repository) AddRows(ctx context.Context, n int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rowLog += n
}

func (r *Repository) Stats() MigrationPlanStats {
	r.mu.RLock()
	defer r.mu.RUnlock()
	stats := MigrationPlanStats{TotalPlans: len(r.plans)}
	for _, p := range r.plans {
		steps := r.steps[p.ID]
		switch p.Phase() {
		case PhaseExecuting:
			stats.ActivePlans++
		case PhaseCompleted:
			stats.Completed++
		case PhaseFailed:
			stats.Failed++
		}
		for _, s := range steps {
			stats.RowsMigrated += s.Rows
		}
	}
	stats.RowsMigrated = r.rowLog
	return stats
}
