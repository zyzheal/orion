// Package service provides the Crossover service that orchestrates the
// registry, router, and dispatcher for cross-module calls.
//
// The Crossover service exposes the complete cross-module call API:
//   - Register/Unregister operations
//   - Invoke operations (request/response, event, async)
//   - List operations, modules, and jobs
//   - Query call history and statistics
package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/crossover/dispatcher"
	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/registry"
	"orion/platform-svc-go/internal/crossover/router"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrInvalidCallType = errors.New("invalid call type")
	ErrInvalidModule   = errors.New("invalid module name")
	ErrOperationExists = errors.New("operation already exists")
)

// ---------------------------------------------------------------------------
// RepositoryInterface
// ---------------------------------------------------------------------------

// RepositoryInterface defines persistence operations for crossover calls.
type RepositoryInterface interface {
	Create(ctx context.Context, call *models.CrossoverCall) error
	Get(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error)
	UpdateResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error
	List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CrossoverCall, error)
	ListByTarget(ctx context.Context, tenantID, targetModule string, opts *ListOptions) ([]models.CrossoverCall, error)
	Delete(ctx context.Context, tenantID, id string) error
}

// ---------------------------------------------------------------------------
// CrossoverService
// ---------------------------------------------------------------------------

// CrossoverService is the main service for cross-module calls.
type CrossoverService struct {
	repo          RepositoryInterface
	opRegistry    *registry.CallOperationRegistry
	callRouter    *router.CallRouter
	asyncDispatch *dispatcher.CallDispatcher
	asyncBatch    *dispatcher.BatchDispatcher

	// default timeout for sync calls
	defaultTimeout time.Duration
}

// ServiceOption configures the crossover service.
type ServiceOption func(*CrossoverService)

// WithTimeout sets the default timeout for synchronous calls.
func WithTimeout(d time.Duration) ServiceOption {
	return func(s *CrossoverService) {
		s.defaultTimeout = d
	}
}

// NewCrossoverService creates a new crossover service.
func NewCrossoverService(repo RepositoryInterface, opts ...ServiceOption) *CrossoverService {
	handlerRegistry := router.NewHandlerRegistry()
	opRegistry := registry.NewCallOperationRegistry(nil) // repo passed via option
	asyncDispatch := dispatcher.NewCallDispatcher()

	s := &CrossoverService{
		repo:          repo,
		opRegistry:    opRegistry,
		callRouter:    router.NewCallRouter(handlerRegistry, opRegistry),
		asyncDispatch: asyncDispatch,
		asyncBatch:    dispatcher.NewBatchDispatcher(asyncDispatch),
		defaultTimeout: 10 * time.Second,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// NewCrossoverServiceWithRegistry creates a service with explicit registry and router.
func NewCrossoverServiceWithRegistry(
	repo RepositoryInterface,
	handlerRegistry *router.HandlerRegistry,
	opRegistry *registry.CallOperationRegistry,
	callRouter *router.CallRouter,
	opts ...ServiceOption,
) *CrossoverService {
	s := &CrossoverService{
		repo:          repo,
		opRegistry:    opRegistry,
		callRouter:    callRouter,
		asyncDispatch: dispatcher.NewCallDispatcher(),
		asyncBatch:    dispatcher.NewBatchDispatcher(dispatcher.NewCallDispatcher()),
		defaultTimeout: 10 * time.Second,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// ---------------------------------------------------------------------------
// Operation management
// ---------------------------------------------------------------------------

// RegisterOperation registers a new cross-module operation.
func (s *CrossoverService) RegisterOperation(ctx context.Context, tenantID string, req *models.RegisterOperationRequest) (*models.CallOperation, error) {
	if !models.ValidCallTypes[req.CallType] {
		return nil, ErrInvalidCallType
	}
	if req.Module == "" || req.Name == "" {
		return nil, ErrInvalidModule
	}
	return s.opRegistry.Register(ctx, tenantID, req)
}

// UnregisterOperation removes a registered operation.
func (s *CrossoverService) UnregisterOperation(ctx context.Context, tenantID, module, name string) error {
	if module == "" || name == "" {
		return ErrInvalidModule
	}
	return s.opRegistry.Unregister(ctx, tenantID, module, name)
}

// GetOperation retrieves a registered operation.
func (s *CrossoverService) GetOperation(ctx context.Context, tenantID, module, name string) (*models.CallOperation, error) {
	return s.opRegistry.Get(ctx, tenantID, module, name)
}

// ListOperations lists operations with optional filters.
func (s *CrossoverService) ListOperations(ctx context.Context, tenantID string, opts *registry.ListOptions) ([]models.CallOperation, error) {
	return s.opRegistry.List(ctx, tenantID, opts)
}

// ListOperationsByModule lists all operations for a module.
func (s *CrossoverService) ListOperationsByModule(ctx context.Context, tenantID, module string) ([]models.CallOperation, error) {
	return s.opRegistry.ListByModule(ctx, tenantID, module)
}

// ---------------------------------------------------------------------------
// Call execution
// ---------------------------------------------------------------------------

// Invoke executes a crossover call and returns the result.
func (s *CrossoverService) Invoke(ctx context.Context, tenantID string, req *models.CreateCrossoverCallRequest) (*models.CallResultObj, error) {
	if !models.ValidCallTypes[req.CallType] {
		return nil, ErrInvalidCallType
	}
	if req.TargetModule == "" || req.Operation == "" {
		return nil, ErrInvalidModule
	}

	// Check if operation is available
	available, _ := s.opRegistry.IsAvailable(ctx, tenantID, req.TargetModule, req.Operation, req.CallType)
	if !available {
		return nil, fmt.Errorf("operation %s/%s is not available", req.TargetModule, req.Operation)
	}

	call := &models.CrossoverCall{
		TenantID:     tenantID,
		CallType:     req.CallType,
		SourceModule: req.SourceModule,
		TargetModule: req.TargetModule,
		Operation:    req.Operation,
		Parameters:   req.Parameters,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	result, err := s.callRouter.Route(ctx, tenantID, call)
	if err != nil {
		call.Status = "failed"
		call.Result = &models.CallResultObj{Error: err.Error(), DoneAt: time.Now().UTC()}
		if err := s.repo.Create(ctx, call); err != nil {
			return nil, fmt.Errorf("failed to record crossover call: %w", err)
		}
		return result, err
	}

	call.Status = "completed"
	call.Result = result
	if err := s.repo.Create(ctx, call); err != nil {
		return nil, fmt.Errorf("failed to record crossover call: %w", err)
	}
	return result, nil
}

// InvokeWithTimeout executes with an explicit timeout.
func (s *CrossoverService) InvokeWithTimeout(ctx context.Context, tenantID string, req *models.CreateCrossoverCallRequest, timeout time.Duration) (*models.CallResultObj, error) {
	call := &models.CrossoverCall{
		TenantID:     tenantID,
		CallType:     req.CallType,
		SourceModule: req.SourceModule,
		TargetModule: req.TargetModule,
		Operation:    req.Operation,
		Parameters:   req.Parameters,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	return s.callRouter.RouteWithTimeout(ctx, tenantID, call, timeout)
}

// ---------------------------------------------------------------------------
// Async job management
// ---------------------------------------------------------------------------

// CreateAsyncJob creates an async job.
func (s *CrossoverService) CreateAsyncJob(ctx context.Context, tenantID string, req *models.CreateAsyncJobRequest) (*dispatcher.AsyncJob, error) {
	if req.TargetModule == "" || req.Operation == "" {
		return nil, ErrInvalidModule
	}
	return s.asyncDispatch.CreateJob(ctx, tenantID, req.TargetModule, req.Operation, req.Parameters)
}

// GetAsyncJob retrieves an async job by ID.
func (s *CrossoverService) GetAsyncJob(id string) (*dispatcher.AsyncJob, error) {
	return s.asyncDispatch.GetJob(id)
}

// ListAsyncJobs lists async jobs for a tenant.
func (s *CrossoverService) ListAsyncJobs(tenantID, status string) []*dispatcher.AsyncJob {
	return s.asyncDispatch.ListJobs(tenantID, status)
}

// CompleteAsyncJob marks a job as completed.
func (s *CrossoverService) CompleteAsyncJob(id string, result map[string]interface{}) error {
	return s.asyncDispatch.CompleteJob(id, result)
}

// FailAsyncJob marks a job as failed.
func (s *CrossoverService) FailAsyncJob(id string, errMsg string) error {
	return s.asyncDispatch.FailJob(id, errMsg)
}

// DispatchBatch creates multiple async jobs.
func (s *CrossoverService) DispatchBatch(ctx context.Context, tenantID string, calls []*models.CrossoverCall) ([]string, error) {
	return s.asyncBatch.DispatchBatch(ctx, tenantID, calls)
}

// GetBatchResult retrieves results for multiple jobs.
func (s *CrossoverService) GetBatchResult(ids []string) (map[string]*models.CallResultObj, error) {
	return s.asyncBatch.GetBatchResult(ids)
}

// ---------------------------------------------------------------------------
// Query and stats
// ---------------------------------------------------------------------------

// ListCalls lists crossover calls for a tenant.
func (s *CrossoverService) ListCalls(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CrossoverCall, error) {
	if opts == nil {
		opts = &ListOptions{Limit: 20}
	}
	if opts.Limit <= 0 {
		opts.Limit = 20
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}
	return s.repo.List(ctx, tenantID, opts)
}

// ListCallsByTarget lists calls for a specific target module.
func (s *CrossoverService) ListCallsByTarget(ctx context.Context, tenantID, targetModule string, opts *ListOptions) ([]models.CrossoverCall, error) {
	if opts == nil {
		opts = &ListOptions{Limit: 20}
	}
	return s.repo.ListByTarget(ctx, tenantID, targetModule, opts)
}

// GetCall retrieves a crossover call by ID.
func (s *CrossoverService) GetCall(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error) {
	return s.repo.Get(ctx, tenantID, id)
}

// UpdateCallResult updates the result of a crossover call.
func (s *CrossoverService) UpdateCallResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error {
	if result == nil {
		return errors.New("result cannot be nil")
	}
	return s.repo.UpdateResult(ctx, tenantID, id, result)
}

// DeleteCall removes a crossover call record.
func (s *CrossoverService) DeleteCall(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Stats returns aggregated statistics for crossover calls.
func (s *CrossoverService) Stats(ctx context.Context, tenantID string) (*models.CrossoverCallStats, error) {
	return s.opRegistry.Stats(ctx, tenantID)
}

// ModuleInfo returns information about a registered module.
func (s *CrossoverService) ModuleInfo(moduleName string) *models.ModuleInfo {
	// TODO: integrate with actual module registry
	return nil
}

// RegisterHandler registers a handler function for a module.operation.
func (s *CrossoverService) RegisterHandler(module, operation string, fn router.HandlerFunc) {
	s.callRouter.ListHandlers() // trigger any lazy init
	// The callRouter uses its internal handlerRegistry
	// TODO: expose handler registration on callRouter
}

// Cleanup cleans up finished async jobs older than maxAge.
func (s *CrossoverService) Cleanup(maxAge time.Duration) int {
	return s.asyncDispatch.CleanupFinishedJobs(maxAge)
}

// ---------------------------------------------------------------------------
// ListOptions
// ---------------------------------------------------------------------------

// ListOptions holds query parameters for listing calls.
type ListOptions struct {
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

// NewListOptions creates default pagination.
func NewListOptions(page, pageSize int) ListOptions {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return ListOptions{
		Offset: (page - 1) * pageSize,
		Limit:  pageSize,
	}
}
