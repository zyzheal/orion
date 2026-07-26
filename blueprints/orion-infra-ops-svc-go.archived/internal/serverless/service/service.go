package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/infra-ops-svc-go/internal/serverless/models"
	"orion/infra-ops-svc-go/internal/serverless/repository"

	"github.com/google/uuid"
)

var (
	ErrFunctionNotFound = errors.New("serverless function not found")
	ErrTriggerNotFound  = errors.New("trigger not found")
	ErrInvalidInput     = errors.New("invalid input")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ─── Function CRUD ─────────────────────────────────────────────────────────────

func (s *Service) CreateFunction(ctx context.Context, tenantID string, req *models.CreateFunctionRequest) (*models.ServerlessFunction, error) {
	if req.Name == "" || req.Runtime == "" || req.Handler == "" {
		return nil, fmt.Errorf("%w: name, runtime, and handler are required", ErrInvalidInput)
	}
	now := time.Now()
	memory := req.Memory
	if memory <= 0 {
		memory = 256
	}
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 30
	}
	replicas := req.Replicas
	if replicas <= 0 {
		replicas = 1
	}

	fn := &models.ServerlessFunction{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Runtime:     req.Runtime,
		Handler:     req.Handler,
		Memory:      memory,
		Timeout:     timeout,
		Environment: req.Environment,
		Code:        req.Code,
		Replicas:    replicas,
		Status:      "created",
		CreatedBy:   "system",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateFunction(ctx, fn); err != nil {
		return nil, fmt.Errorf("create function: %w", err)
	}
	return fn, nil
}

func (s *Service) GetFunction(ctx context.Context, tenantID, id string) (*models.ServerlessFunction, error) {
	fn, err := s.repo.GetFunctionByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, id)
	}
	return fn, nil
}

func (s *Service) ListFunctions(ctx context.Context, tenantID string, offset, limit int) ([]models.ServerlessFunction, error) {
	return s.repo.ListFunctions(ctx, tenantID, offset, limit)
}

func (s *Service) UpdateFunction(ctx context.Context, tenantID, id string, req *models.UpdateFunctionRequest) (*models.ServerlessFunction, error) {
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, id)
	}
	return s.repo.UpdateFunction(ctx, tenantID, id, req)
}

func (s *Service) DeleteFunction(ctx context.Context, tenantID, id string) error {
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrFunctionNotFound, id)
	}
	return s.repo.DeleteFunction(ctx, tenantID, id)
}

// ─── Deployment ────────────────────────────────────────────────────────────────

func (s *Service) DeployFunction(ctx context.Context, tenantID, functionID string) (*models.FunctionDeployment, error) {
	fn, err := s.repo.GetFunctionByID(ctx, tenantID, functionID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, functionID)
	}
	d := &models.FunctionDeployment{
		ID:         uuid.New().String(),
		FunctionID: functionID,
		TenantID:   tenantID,
		Version:    fmt.Sprintf("v%d", time.Now().Unix()),
		Status:     "deploying",
		CreatedAt:  time.Now(),
	}
	if err := s.repo.CreateDeployment(ctx, d); err != nil {
		return nil, fmt.Errorf("create deployment: %w", err)
	}
	_ = s.repo.UpdateFunctionStatus(ctx, tenantID, functionID, "deploying")
	_ = fn // fn validated
	return d, nil
}

func (s *Service) ListDeployments(ctx context.Context, tenantID, functionID string) ([]models.FunctionDeployment, error) {
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, functionID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, functionID)
	}
	return s.repo.ListDeployments(ctx, tenantID, functionID)
}

// ─── Invocation ────────────────────────────────────────────────────────────────

func (s *Service) InvokeFunction(ctx context.Context, tenantID, functionID string, payload map[string]interface{}) (map[string]interface{}, error) {
	fn, err := s.repo.GetFunctionByID(ctx, tenantID, functionID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, functionID)
	}
	if fn.Status != "deployed" && fn.Status != "active" {
		return nil, fmt.Errorf("FUNCTION_NOT_DEPLOYED")
	}
	// Simulated invocation result
	return map[string]interface{}{
		"function_id": functionID,
		"status":      "success",
		"payload":     payload,
		"executed_at": time.Now().Format(time.RFC3339),
	}, nil
}

// ─── Logs & Metrics ────────────────────────────────────────────────────────────

func (s *Service) GetFunctionLogs(ctx context.Context, tenantID, functionID string, level string, limit int) ([]models.FunctionLog, error) {
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, functionID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, functionID)
	}
	if limit <= 0 {
		limit = 100
	}
	return s.repo.ListLogs(ctx, tenantID, functionID, level, limit)
}

func (s *Service) GetFunctionMetrics(ctx context.Context, tenantID, functionID string) ([]models.FunctionMetric, error) {
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, functionID); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrFunctionNotFound, functionID)
	}
	return s.repo.ListMetrics(ctx, tenantID, functionID)
}

func (s *Service) GetAggregateMetrics(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	total, err := s.repo.CountFunctions(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	active, _ := s.repo.CountFunctionsByStatus(ctx, tenantID, "active")
	deployed, _ := s.repo.CountFunctionsByStatus(ctx, tenantID, "deployed")
	return map[string]interface{}{
		"total_functions":   total,
		"active":            active,
		"deployed":          deployed,
		"aggregated_at":     time.Now().Format(time.RFC3339),
	}, nil
}

// ─── Triggers ──────────────────────────────────────────────────────────────────

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.FunctionTrigger, error) {
	if req.FunctionID == "" || req.Type == "" || req.Name == "" {
		return nil, fmt.Errorf("%w: function_id, type, and name are required", ErrInvalidInput)
	}
	if _, err := s.repo.GetFunctionByID(ctx, tenantID, req.FunctionID); err != nil {
		return nil, fmt.Errorf("%w: function %s", ErrFunctionNotFound, req.FunctionID)
	}
	now := time.Now()
	t := &models.FunctionTrigger{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		FunctionID: req.FunctionID,
		Name:       req.Name,
		Type:       req.Type,
		Config:     req.Config,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.repo.CreateTrigger(ctx, t); err != nil {
		return nil, fmt.Errorf("create trigger: %w", err)
	}
	return t, nil
}

func (s *Service) ListTriggers(ctx context.Context, tenantID string, functionID *string) ([]models.FunctionTrigger, error) {
	return s.repo.ListTriggers(ctx, tenantID, functionID)
}

func (s *Service) GetTrigger(ctx context.Context, tenantID, id string) (*models.FunctionTrigger, error) {
	t, err := s.repo.GetTriggerByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrTriggerNotFound, id)
	}
	return t, nil
}

func (s *Service) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	if _, err := s.repo.GetTriggerByID(ctx, tenantID, id); err != nil {
		return fmt.Errorf("%w: %s", ErrTriggerNotFound, id)
	}
	return s.repo.DeleteTrigger(ctx, tenantID, id)
}

// ─── Auto-scaling ──────────────────────────────────────────────────────────────

func (s *Service) EvaluateAutoScaling(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	// Simplified auto-scaling evaluation
	functions, err := s.repo.ListFunctions(ctx, tenantID, 0, 1000)
	if err != nil {
		return nil, err
	}
	var recs []map[string]interface{}
	for _, fn := range functions {
		recs = append(recs, map[string]interface{}{
			"function_id":     fn.ID,
			"function_name":   fn.Name,
			"current_replicas": fn.Replicas,
			"recommended":      fn.Replicas, // no change by default
			"reason":           "stable",
		})
	}
	return recs, nil
}