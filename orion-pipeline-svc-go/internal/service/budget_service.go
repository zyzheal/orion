package service

import (
	"context"
	"fmt"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/repository"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// BudgetService manages pipeline budget operations.
type BudgetService struct {
	budgetRepo *repository.BudgetRepository
}

func NewBudgetService(budgetRepo *repository.BudgetRepository) *BudgetService {
	return &BudgetService{budgetRepo: budgetRepo}
}

// Set creates or updates a budget for a tenant/pipeline.
func (s *BudgetService) Set(ctx context.Context, tenantID, createdBy string, req models.SetBudgetRequest) (*models.PipelineBudget, error) {
	ctx, span := tracer.Start(ctx, "BudgetService.Set",
		trace.WithAttributes(
			attribute.String("tenant.id", tenantID),
			attribute.Float64("budget.limit", req.BudgetLimit),
		))
	defer span.End()

	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}
	period := req.Period
	if period == "" {
		period = "monthly"
	}

	budget := &models.PipelineBudget{
		TenantID:     tenantID,
		PipelineID:   req.PipelineID,
		BudgetLimit:  req.BudgetLimit,
		CurrentSpend: 0,
		Currency:     currency,
		Period:       period,
		Description:  req.Description,
		CreatedBy:    createdBy,
	}

	if err := s.budgetRepo.Create(ctx, budget); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to set budget: %w", err)
	}

	span.SetAttributes(attribute.String("budget.id", budget.ID))
	return budget, nil
}

// Get retrieves the effective budget for a tenant/pipeline.
func (s *BudgetService) Get(ctx context.Context, tenantID, pipelineID string) (*models.PipelineBudget, error) {
	ctx, span := tracer.Start(ctx, "BudgetService.Get",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	if pipelineID != "" {
		b, err := s.budgetRepo.GetByPipelineID(ctx, tenantID, pipelineID)
		if err == nil {
			return b, nil
		}
	}
	return s.budgetRepo.GetByTenant(ctx, tenantID)
}

// Update updates an existing budget.
func (s *BudgetService) Update(ctx context.Context, tenantID string, budget *models.PipelineBudget) error {
	ctx, span := tracer.Start(ctx, "BudgetService.Update",
		trace.WithAttributes(
			attribute.String("budget.id", budget.ID),
			attribute.Float64("budget.limit", budget.BudgetLimit),
		))
	defer span.End()

	if err := s.budgetRepo.Update(ctx, budget); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("failed to update budget: %w", err)
	}
	return nil
}

// Delete removes a budget.
func (s *BudgetService) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "BudgetService.Delete",
		trace.WithAttributes(attribute.String("budget.id", id)))
	defer span.End()

	if err := s.budgetRepo.Delete(ctx, tenantID, id); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("failed to delete budget: %w", err)
	}
	return nil
}

// Check checks whether the current spend is within the budget limit.
func (s *BudgetService) Check(ctx context.Context, tenantID, pipelineID string) (*models.BudgetCheckResult, error) {
	ctx, span := tracer.Start(ctx, "BudgetService.Check",
		trace.WithAttributes(
			attribute.String("tenant.id", tenantID),
			attribute.String("pipeline.id", pipelineID),
		))
	defer span.End()

	budget, err := s.budgetRepo.GetEffectiveBudget(ctx, tenantID, pipelineID)
	if err != nil {
		// No budget configured = within budget
		return &models.BudgetCheckResult{
			WithinBudget: true,
			BudgetLimit:  0,
			CurrentSpend: 0,
			Remaining:    0,
			UsagePercent: 0,
			Currency:     "USD",
		}, nil
	}

	remaining := budget.BudgetLimit - budget.CurrentSpend
	usagePercent := 0.0
	if budget.BudgetLimit > 0 {
		usagePercent = (budget.CurrentSpend / budget.BudgetLimit) * 100
	}

	return &models.BudgetCheckResult{
		WithinBudget: remaining >= 0,
		BudgetLimit:  budget.BudgetLimit,
		CurrentSpend: budget.CurrentSpend,
		Remaining:    remaining,
		UsagePercent: usagePercent,
		Currency:     budget.Currency,
	}, nil
}