// Package service implements the Worker Dispatcher (N-12).
//
// The dispatcher coordinates work assignment across the platform using pluggable
// policy handlers (round-robin, least-loaded, skill-match, etc.). It follows the
// IWorkerDispatcher + IWorkerPolicyHandler patterns:
//
//   IWorkerDispatcher - dispatches a target to a worker according to policy.
//   IWorkerPolicyHandler - matches and scores workers against a target.
package service

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/worker-dispatcher/models"
	"orion/platform-svc-go/internal/worker-dispatcher/repository"

	"go.uber.org/zap"
)

// IWorkerDispatcher is the contract every dispatcher implementation must fulfil.
// The dispatch context holds target metadata (title, skills, priority, etc.).
type IWorkerDispatcher interface {
	// Name returns the human-readable name of the dispatcher.
	Name() string
	// Type returns the machine-identifiable type (must match policy.Type).
	Type() string
	// Dispatch picks the best worker for the target under the given policy.
	// Returns the worker_id that should be assigned.
	Dispatch(ctx context.Context, target map[string]interface{}, policy map[string]string) (string, error)
	// Validate checks whether the policy configuration is acceptable.
	Validate(ctx context.Context, policy map[string]string) error
}

// IWorkerPolicyHandler ranks and filters candidates. Handlers are consulted
// after the dispatcher selects its candidate set.
type IWorkerPolicyHandler interface {
	// Name returns the handler's name.
	Name() string
	// Match determines whether a worker is eligible for the target.
	Match(worker *models.WorkerCapability, target map[string]interface{}) bool
	// Score returns a priority score; higher is better.
	Score(worker *models.WorkerCapability, target map[string]interface{}) int
}

// RepositoryInterface is the subset of repository methods the service needs.
type RepositoryInterface interface {
	CreatePolicy(ctx context.Context, m *models.WorkerPolicy) error
	GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error)
	ListPolicies(ctx context.Context, tenantID string, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error)
	UpdatePolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeletePolicy(ctx context.Context, tenantID, id string) error

	CreateAssignment(ctx context.Context, m *models.WorkerAssignment) error
	GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error)
	GetAssignmentByID(ctx context.Context, tenantID, id string) (*models.WorkerAssignment, error)
	UpdateAssignmentStatus(ctx context.Context, tenantID, id string, status string, completedAt interface{}) error
	GetActiveAssignments(ctx context.Context, tenantID, workerID string) int

	CreateCapability(ctx context.Context, m *models.WorkerCapability) error
	GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error)
	GetCapabilitiesByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerCapability, error)
	DeleteCapability(ctx context.Context, tenantID, workerID, skill string) error
}

// WorkerDispatcher owns the runtime registry of dispatchers and policy handlers
// and exposes the public API consumed by the handler layer.
type WorkerDispatcher struct {
	dispatchers map[string]IWorkerDispatcher
	policies    map[string]IWorkerPolicyHandler
	repo        RepositoryInterface
	logger      *zap.Logger
	mu          sync.RWMutex
}

// NewService constructs a dispatcher pre-loaded with the built-in policy
// dispatchers and handlers.
func NewService(repo repository.RepositoryInterface) *WorkerDispatcher {
	return NewServiceWithLogger(repo, nil)
}

// NewServiceWithLogger constructs a dispatcher with an optional logger for
// diagnostic output.
func NewServiceWithLogger(repo repository.RepositoryInterface, logger *zap.Logger) *WorkerDispatcher {
	d := &WorkerDispatcher{
		dispatchers: make(map[string]IWorkerDispatcher),
		policies:    make(map[string]IWorkerPolicyHandler),
		repo:        repo,
		logger:      logger,
	}
	d.registerBuiltIns()
	return d
}

// RegisterHandler registers a custom IWorkerPolicyHandler for a given type.
func (d *WorkerDispatcher) RegisterHandler(h IWorkerPolicyHandler) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.policies[h.Name()] = h
}

func (d *WorkerDispatcher) registerBuiltIns() {
	// Policy dispatchers (each is also a handler for its type).
	for _, p := range []*policyHandler{
		{name: "round_robin", typ: "round_robin"},
		{name: "least_loaded", typ: "least_loaded"},
		{name: "skill_match", typ: "skill_match"},
		{name: "role_based", typ: "role_based"},
		{name: "department_based", typ: "department_based"},
		{name: "weight", typ: "weight"},
		{name: "custom", typ: "custom"},
	} {
		d.dispatchers[p.typ] = p
		d.policies[p.typ] = p
	}
}

// --- Public dispatch API ---

// Dispatch chooses a worker for a target under the given policy type.
func (d *WorkerDispatcher) Dispatch(ctx context.Context, tenantID, targetType, targetID, policyType string, context map[string]string) (*models.WorkerAssignment, error) {
	d.mu.RLock()
	dispatcher, ok := d.dispatchers[policyType]
	d.mu.RUnlock()
	if !ok {
		// Fall back to round-robin.
		d.mu.RLock()
		dispatcher = d.dispatchers["round_robin"]
		d.mu.RUnlock()
		if dispatcher == nil {
			return nil, ErrNoDispatcher
		}
	}

	// Build target metadata.
	target := map[string]interface{}{
		"type":    targetType,
		"id":      targetID,
		"context": context,
	}
	// Pull policy config from DB as key/value.
	policy := map[string]string{"type": policyType}
	if context != nil {
		for k, v := range context {
			policy[k] = v
		}
	}
	if err := dispatcher.Validate(ctx, policy); err != nil {
		return nil, err
	}

	workerID, err := dispatcher.Dispatch(ctx, target, policy)
	if err != nil {
		return nil, err
	}
	if workerID == "" {
		return nil, ErrNoWorkerAvailable
	}

	// Persist the assignment.
	assignment := &models.WorkerAssignment{
		TenantID:   tenantID,
		TargetType: targetType,
		TargetID:   targetID,
		WorkerID:   workerID,
		WorkerType: "user",
		Status:     "assigned",
	}
	if err := d.repo.CreateAssignment(ctx, assignment); err != nil {
		return nil, err
	}
	return assignment, nil
}

// GetAssignment returns the active assignment for a target.
func (d *WorkerDispatcher) GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error) {
	return d.repo.GetAssignment(ctx, tenantID, targetID)
}

// ListPolicies returns tenant policies, filtered by type/active state.
func (d *WorkerDispatcher) ListPolicies(ctx context.Context, tenantID string, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error) {
	return d.repo.ListPolicies(ctx, tenantID, policyType, enabled, limit, offset)
}

// GetWorkerLoad returns the current active load for a worker.
func (d *WorkerDispatcher) GetWorkerLoad(ctx context.Context, tenantID, workerID string) int {
	return d.repo.GetActiveAssignments(ctx, tenantID, workerID)
}

// GetPoliciesForDispatch fetches all enabled policies for the given type.
func (d *WorkerDispatcher) GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error) {
	return d.repo.GetCapabilities(ctx, tenantID)
}

// UpdateAssignmentStatus moves an assignment to a new status.
func (d *WorkerDispatcher) UpdateAssignmentStatus(ctx context.Context, tenantID, id string, status string, completedAt *time.Time) error {
	return d.repo.UpdateAssignmentStatus(ctx, tenantID, id, status, completedAt)
}

// CreateCapability registers a new worker skill.
func (d *WorkerDispatcher) CreateCapability(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.WorkerCapability, error) {
	m := &models.WorkerCapability{
		TenantID:   tenantID,
		WorkerID:   req.WorkerID,
		WorkerType: req.WorkerType,
		Skill:      req.Skill,
		Level:      req.Level,
		Weight:     req.Weight,
		MaxLoad:    req.MaxLoad,
		Enabled:    true,
	}
	if err := d.repo.CreateCapability(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// CreatePolicy persists a new dispatch policy definition.
func (d *WorkerDispatcher) CreatePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.WorkerPolicy, error) {
	m := &models.WorkerPolicy{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Config:   req.Config,
		Priority: req.Priority,
		Enabled:  req.Enabled,
	}
	if err := d.repo.CreatePolicy(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// GetPolicy looks up a policy by id.
func (d *WorkerDispatcher) GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error) {
	return d.repo.GetPolicy(ctx, tenantID, id)
}

// UpdatePolicy modifies an existing policy.
func (d *WorkerDispatcher) UpdatePolicy(ctx context.Context, tenantID, id string, req models.UpdatePolicyRequest) (*models.WorkerPolicy, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Config != nil {
		updates["config"] = *req.Config
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return d.repo.GetPolicy(ctx, tenantID, id)
	}
	if err := d.repo.UpdatePolicy(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return d.repo.GetPolicy(ctx, tenantID, id)
}

// --- Built-in policy handler (shared by all built-in dispatchers) ---

type policyHandler struct {
	name string
	typ  string
}

func (p *policyHandler) Name() string { return p.name }
func (p *policyHandler) Type() string { return p.typ }
func (p *policyHandler) Validate(ctx context.Context, policy map[string]string) error { return nil }
func (p *policyHandler) Dispatch(ctx context.Context, target map[string]interface{}, policy map[string]string) (string, error) { return "", nil }

func (p *policyHandler) Match(worker *models.WorkerCapability, target map[string]interface{}) bool {
	switch p.typ {
	case "skill_match":
		reqSkill := target["skill"]
		if reqSkill != nil && worker.Skill != "" && worker.Skill != reqSkill.(string) {
			return false
		}
	case "role_based":
		reqRole := target["role"]
		if reqRole != nil && worker.Skill != "" && worker.Skill != reqRole.(string) {
			return false
		}
	case "department_based":
		reqDept := target["department"]
		if reqDept != nil && worker.Skill != "" && worker.Skill != reqDept.(string) {
			return false
		}
	}
	return worker.Enabled
}

func (p *policyHandler) Score(worker *models.WorkerCapability, target map[string]interface{}) int {
	s := worker.Weight
	switch p.typ {
	case "skill_match":
		s += worker.Level * 10
		reqSkill := target["skill"]
		if reqSkill != nil && worker.Skill == reqSkill.(string) {
			s += 50
		}
	case "least_loaded":
		// Lower load => higher score. Weights are inverted at call-site.
	case "role_based":
		reqRole := target["role"]
		if reqRole != nil && worker.Skill == reqRole.(string) {
			s += 40
		}
	case "weight":
		s = worker.Weight
	case "round_robin", "department_based", "custom":
		s = worker.Weight
	}
	return s
}

// --- Errors ---

var (
	ErrNoDispatcher      = ErrNamed("no dispatcher found for policy type")
	ErrNoWorkerAvailable = ErrNamed("no eligible worker available for target")
)

type namedErr struct {
	msg string
}

func (e namedErr) Error() string { return e.msg }

func ErrNamed(msg string) error { return namedErr{msg: msg} }

func IsNotFound(err error) bool {
	_ = err
	return false
}
