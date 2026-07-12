package service

import (
	"context"
	"errors"
	"fmt"
	"database/sql"

	"orion/platform-svc-go/internal/serverless/models"
	"orion/platform-svc-go/internal/serverless/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// --- Functions ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateFunctionRequest) (*models.Function, error) {
	f := &models.Function{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Runtime:     req.Runtime,
		Handler:     req.Handler,
		Memory:      req.Memory,
		Timeout:     req.Timeout,
		Environment: req.Environment,
		Code:        req.Code,
		Replicas:    req.Replicas,
		Status:      models.StatusCreated,
	}
	if f.Memory <= 0 {
		f.Memory = 512 // default 512 MB
	}
	if f.Timeout <= 0 {
		f.Timeout = 30 // default 30s
	}
	if f.Replicas <= 0 {
		f.Replicas = 1
	}
	if f.Environment == nil {
		f.Environment = make(map[string]string)
	}
	if err := s.repo.CreateFunction(ctx, f); err != nil {
		return nil, fmt.Errorf("failed to create function: %w", err)
	}
	return f, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Function, error) {
	f, err := s.repo.GetFunction(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get function: %w", err)
	}
	return f, nil
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListFunctionsQuery, limit, offset int) ([]models.Function, error) {
	items, err := s.repo.ListFunctions(ctx, tenantID, q, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list functions: %w", err)
	}
	return items, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateFunctionRequest) (*models.Function, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Runtime != nil {
		updates["runtime"] = *req.Runtime
	}
	if req.Handler != nil {
		updates["handler"] = *req.Handler
	}
	if req.Memory != nil {
		updates["memory"] = *req.Memory
	}
	if req.Timeout != nil {
		updates["timeout"] = *req.Timeout
	}
	if req.Code != nil {
		updates["code"] = *req.Code
	}
	if req.Replicas != nil {
		updates["replicas"] = *req.Replicas
	}
	if err := s.repo.UpdateFunction(ctx, tenantID, id, updates); err != nil {
		return nil, fmt.Errorf("failed to update function: %w", err)
	}
	f, err := s.repo.GetFunction(ctx, tenantID, id)
	return f, err
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteFunction(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("failed to delete function: %w", err)
	}
	if !deleted {
		return sql.ErrNoRows
	}
	return nil
}

// --- Deployments ---

func (s *Service) Deploy(ctx context.Context, tenantID, functionID string) (*models.Deployment, error) {
	exists, err := s.repo.FunctionExists(ctx, tenantID, functionID)
	if err != nil {
		return nil, fmt.Errorf("failed to check function: %w", err)
	}
	if !exists {
		return nil, sql.ErrNoRows
	}
	d := &models.Deployment{
		TenantID:   tenantID,
		FunctionID: functionID,
		Status:     "success",
	}
	if err := s.repo.CreateDeployment(ctx, d); err != nil {
		return nil, fmt.Errorf("failed to create deployment: %w", err)
	}
	// Update function status to deployed.
	if err := s.repo.UpdateFunction(ctx, tenantID, functionID, map[string]interface{}{"status": models.StatusDeployed}); err != nil {
		return d, err
	}
	return d, nil
}

func (s *Service) ListDeployments(ctx context.Context, tenantID, functionID string) ([]models.Deployment, error) {
	items, err := s.repo.ListDeployments(ctx, tenantID, functionID)
	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}
	return items, nil
}

// --- Invocation ---

func (s *Service) Invoke(ctx context.Context, tenantID, functionID string, payload interface{}) (*models.InvokeResult, error) {
	f, err := s.repo.GetFunction(ctx, tenantID, functionID)
	if err != nil {
		if IsNotFound(err) {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}
	if f.Status != models.StatusDeployed {
		return nil, fmt.Errorf("function not deployed")
	}
	// Simulate invocation result
	result := &models.InvokeResult{
		Success:     true,
		Output:      fmt.Sprintf("OK: %s invoked", f.Name),
		DurationMs:  42,
	}
	// Log the invocation
	s.repo.CreateFunctionLog(ctx, &models.FunctionLog{
		TenantID:   tenantID,
		FunctionID: functionID,
		Level:      "info",
		Message:    fmt.Sprintf("invoked with payload: %v", payload),
	})
	return result, nil
}

// --- Logs ---

func (s *Service) GetLogs(ctx context.Context, tenantID, functionID string, q models.GetFunctionLogsQuery) ([]models.FunctionLog, error) {
	items, err := s.repo.GetFunctionLogs(ctx, tenantID, functionID, q)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs: %w", err)
	}
	return items, nil
}

// --- Metrics ---

func (s *Service) GetMetrics(ctx context.Context, tenantID, functionID string) (*models.FunctionMetric, error) {
	m, err := s.repo.GetFunctionMetrics(ctx, tenantID, functionID)
	if err != nil {
		if IsNotFound(err) {
			// Return zeroed metrics if none exist
			return &models.FunctionMetric{FunctionID: functionID}, nil
		}
		return nil, err
	}
	return m, nil
}

func (s *Service) GetAggregateMetrics(ctx context.Context, tenantID string) (*models.AggregateMetrics, error) {
	agg, err := s.repo.GetAggregateMetrics(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get aggregate metrics: %w", err)
	}
	return agg, nil
}

// --- Triggers ---

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) (*models.Trigger, error) {
	exists, err := s.repo.FunctionExists(ctx, tenantID, req.FunctionID)
	if err != nil {
		return nil, fmt.Errorf("failed to check function: %w", err)
	}
	if !exists {
		return nil, sql.ErrNoRows
	}
	t := &models.Trigger{
		TenantID:   tenantID,
		FunctionID: req.FunctionID,
		Type:       req.Type,
		Name:       req.Name,
		Config:     req.Config,
	}
	if err := s.repo.CreateTrigger(ctx, t); err != nil {
		return nil, fmt.Errorf("failed to create trigger: %w", err)
	}
	return t, nil
}

func (s *Service) GetTrigger(ctx context.Context, tenantID, id string) (*models.Trigger, error) {
	t, err := s.repo.GetTrigger(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Service) ListTriggers(ctx context.Context, tenantID string, q models.ListTriggersQuery) ([]models.Trigger, error) {
	items, err := s.repo.ListTriggers(ctx, tenantID, q)
	if err != nil {
		return nil, fmt.Errorf("failed to list triggers: %w", err)
	}
	return items, nil
}

func (s *Service) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteTrigger(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("failed to delete trigger: %w", err)
	}
	if !deleted {
		return sql.ErrNoRows
	}
	return nil
}

// --- Auto-scaling ---

func (s *Service) EvaluateAutoScaling(ctx context.Context, tenantID string) ([]models.AutoScalingRecommendation, error) {
	recommendations, err := s.repo.EvaluateAutoScaling(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate autoscaling: %w", err)
	}
	// Enrich with recommended replicas and reason
	for i := range recommendations {
		if recommendations[i].RecommendedReplicas == 0 {
			recommendations[i].RecommendedReplicas = recommendations[i].CurrentReplicas + 1
		}
		recommendations[i].Reason = "high error rate, scale out"
	}
	return recommendations, nil
}
