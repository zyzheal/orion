// Package registry provides the CallOperationRegistry for discovering
// registered cross-module operations.
//
// The registry maintains a catalog of operations that modules expose to other
// modules, indexed by (module, operation, callType) for efficient lookup.
package registry

import (
	"context"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/crossover/models"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrOperationNotFound = errors.New("operation not found")
	ErrOperationDisabled = errors.New("operation is disabled")
	ErrInvalidCallType   = errors.New("invalid call type")
)

// ---------------------------------------------------------------------------
// RepositoryInterface
// ---------------------------------------------------------------------------

// RepositoryInterface defines persistence operations for call operations.
type RepositoryInterface interface {
	Create(ctx context.Context, op *models.CallOperation) error
	Delete(ctx context.Context, tenantID, module, name string) error
	Get(ctx context.Context, tenantID, module, name string) (*models.CallOperation, error)
	ListByModule(ctx context.Context, tenantID, module string) ([]models.CallOperation, error)
	List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CallOperation, error)
}

// ---------------------------------------------------------------------------
// CallOperationRegistry
// ---------------------------------------------------------------------------

// CallOperationRegistry is the call registry for discovering available
// cross-module operations.
type CallOperationRegistry struct {
	repo RepositoryInterface
	mu   sync.RWMutex
	// in-memory cache of registered operations (tenantID + module + name → operation)
	cache map[string]*models.CallOperation
}

// ListOptions holds query parameters for listing operations.
type ListOptions struct {
	Module   string
	CallType models.CallType
	Status   models.OperationStatus
	Offset   int
	Limit    int
}

// NewCallOperationRegistry creates a new registry.
func NewCallOperationRegistry(repo RepositoryInterface) *CallOperationRegistry {
	return &CallOperationRegistry{
		repo:  repo,
		cache: make(map[string]*models.CallOperation),
	}
}

// Register registers a new cross-module operation.
// Returns the registered operation.
func (r *CallOperationRegistry) Register(ctx context.Context, tenantID string, req *models.RegisterOperationRequest) (*models.CallOperation, error) {
	if !models.ValidCallTypes[req.CallType] {
		return nil, ErrInvalidCallType
	}

	// Check for duplicate
	existing, _ := r.repo.Get(ctx, tenantID, req.Module, req.Name)
	if existing != nil {
		return nil, errors.New("operation already exists: " + req.Module + "." + req.Name)
	}

	op := &models.CallOperation{
		TenantID:     tenantID,
		Module:       req.Module,
		Name:         req.Name,
		CallType:     req.CallType,
		Status:       models.OperationStatusActive,
		Description:  req.Description,
		InputSchema:  req.InputSchema,
		OutputSchema: req.OutputSchema,
		RegisteredBy: req.RegisteredBy,
	}
	if err := r.repo.Create(ctx, op); err != nil {
		return nil, err
	}

	key := r.cacheKey(tenantID, req.Module, req.Name)
	r.mu.Lock()
	r.cache[key] = op
	r.mu.Unlock()

	return op, nil
}

// Unregister removes a registered operation.
func (r *CallOperationRegistry) Unregister(ctx context.Context, tenantID, module, name string) error {
	_, err := r.repo.Get(ctx, tenantID, module, name)
	if err != nil {
		return ErrOperationNotFound
	}
	if err := r.repo.Delete(ctx, tenantID, module, name); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.cache, r.cacheKey(tenantID, module, name))
	r.mu.Unlock()
	return nil
}

// Get retrieves a registered operation.
func (r *CallOperationRegistry) Get(ctx context.Context, tenantID, module, name string) (*models.CallOperation, error) {
	key := r.cacheKey(tenantID, module, name)
	r.mu.RLock()
	op := r.cache[key]
	r.mu.RUnlock()
	if op != nil {
		return r.clone(op), nil
	}

	if r.repo == nil {
		return nil, ErrOperationNotFound
	}

	op, err := r.repo.Get(ctx, tenantID, module, name)
	if err != nil {
		return nil, ErrOperationNotFound
	}
	r.mu.Lock()
	r.cache[key] = op
	r.mu.Unlock()
	return r.clone(op), nil
}

// List lists operations with optional filters.
func (r *CallOperationRegistry) List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CallOperation, error) {
	if opts == nil {
		opts = &ListOptions{Limit: 20}
	}
	if opts.Limit <= 0 {
		opts.Limit = 20
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}
	// TODO: pass filter to repo; for now fetch all and filter in-memory
	all, err := r.repo.List(ctx, tenantID, opts)
	if err != nil {
		return nil, err
	}
	if opts.Module != "" || opts.CallType != "" || opts.Status != "" {
		filtered := make([]models.CallOperation, 0, len(all))
		for _, op := range all {
			if opts.Module != "" && op.Module != opts.Module {
				continue
			}
			if opts.CallType != "" && op.CallType != opts.CallType {
				continue
			}
			if opts.Status != "" && op.Status != opts.Status {
				continue
			}
			filtered = append(filtered, op)
		}
		all = filtered
	}
	if len(all) > opts.Limit {
		end := opts.Offset + opts.Limit
		if end > len(all) {
			end = len(all)
		}
		all = all[opts.Offset:end]
	}
	return all, nil
}

// ListByModule lists all operations for a module.
func (r *CallOperationRegistry) ListByModule(ctx context.Context, tenantID, module string) ([]models.CallOperation, error) {
	return r.repo.ListByModule(ctx, tenantID, module)
}

// IsAvailable checks if an operation exists, is active, and supports the given call type.
func (r *CallOperationRegistry) IsAvailable(ctx context.Context, tenantID, module, name string, callType models.CallType) (bool, error) {
	op, err := r.Get(ctx, tenantID, module, name)
	if err != nil {
		return false, nil
	}
	if op.Status != models.OperationStatusActive {
		return false, nil
	}
	// Allow if operation's callType matches or is request_response (universal)
	if op.CallType != callType && op.CallType != models.CallTypeRequestResponse {
		return false, nil
	}
	return true, nil
}

// GetOrRegister retrieves an operation, creating a minimal entry if it doesn't exist
// (useful for dynamic discovery).
func (r *CallOperationRegistry) GetOrRegister(ctx context.Context, tenantID, module, name string, callType models.CallType) (*models.CallOperation, error) {
	op, err := r.Get(ctx, tenantID, module, name)
	if err == nil {
		return op, nil
	}
	// Auto-register a minimal operation
	op = &models.CallOperation{
		TenantID: tenantID,
		Module:   module,
		Name:     name,
		CallType: callType,
		Status:   models.OperationStatusActive,
	}
	if err := r.repo.Create(ctx, op); err != nil {
		return nil, err
	}
	key := r.cacheKey(tenantID, module, name)
	r.mu.Lock()
	r.cache[key] = op
	r.mu.Unlock()
	return r.clone(op), nil
}

// cacheKey creates a unique key for the cache.
func (r *CallOperationRegistry) cacheKey(tenantID, module, name string) string {
	return tenantID + "::" + module + "::" + name
}

// clone returns a defensive copy of the operation.
func (r *CallOperationRegistry) clone(op *models.CallOperation) *models.CallOperation {
	inSchema := make(map[string]interface{})
	for k, v := range op.InputSchema {
		inSchema[k] = v
	}
	outSchema := make(map[string]interface{})
	for k, v := range op.OutputSchema {
		outSchema[k] = v
	}
	return &models.CallOperation{
		ID:           op.ID,
		TenantID:     op.TenantID,
		Module:       op.Module,
		Name:         op.Name,
		CallType:     op.CallType,
		Status:       op.Status,
		Description:  op.Description,
		InputSchema:  inSchema,
		OutputSchema: outSchema,
		RegisteredBy: op.RegisteredBy,
		CreatedAt:    op.CreatedAt,
		UpdatedAt:    op.UpdatedAt,
	}
}

// Stats returns aggregated operation statistics.
func (r *CallOperationRegistry) Stats(ctx context.Context, tenantID string) (*models.CrossoverCallStats, error) {
	ops, err := r.List(ctx, tenantID, &ListOptions{})
	if err != nil {
		return nil, err
	}
	stats := &models.CrossoverCallStats{
		Total: int64(len(ops)),
	}
	for _, op := range ops {
		if op.Status == models.OperationStatusActive {
			stats.Success++
		} else {
			stats.Failed++
		}
	}
	return stats, nil
}

// LastModified returns the time the registry was last updated.
func (r *CallOperationRegistry) LastModified() time.Time {
	// TODO: track actual last modified time
	return time.Now().UTC()
}
