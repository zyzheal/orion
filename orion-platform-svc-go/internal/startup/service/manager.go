package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/startup/models"
	"orion/platform-svc-go/internal/startup/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrModuleNotFound      = errors.New("startup module not found")
	ErrDuplicateModule     = errors.New("startup module with this name already exists")
	ErrDuplicateDependency = errors.New("startup dependency already exists")
	ErrDependencyMissing   = errors.New("module dependency not found")
	ErrCircularDep         = errors.New("circular dependency detected")
	ErrAlreadyStarted      = errors.New("module already started")
	ErrNotRunning          = errors.New("module is not running")
	ErrModuleUnhealthy     = errors.New("startup module health check failed")
)

// IsNotFound reports whether err means the requested module does not exist.
// Handlers answer 404 for these and 500 for anything else.
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrModuleNotFound) || errors.Is(err, sentinel.NotFound)
}

// IsUnhealthy reports whether err means the module answered "not healthy" — the
// manager has not started, the module is stopped, or its own HealthCheck failed
// — as opposed to the check being unable to run. The handler answers 200 with
// healthy=false in the first case and 500 in the second.
func IsUnhealthy(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrNotRunning) || errors.Is(err, ErrModuleUnhealthy)
}

// IsConflict reports whether err means the request contradicts existing state:
// a duplicate module name, a duplicate dependency edge, or a dependency cycle.
func IsConflict(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrDuplicateModule) ||
		errors.Is(err, ErrDuplicateDependency) ||
		errors.Is(err, ErrCircularDep)
}

// IStartup is the interface that all startup modules must implement.
type IStartup interface {
	// Name returns the unique name of the module.
	Name() string
	// Priority returns the initialization priority (higher = earlier).
	Priority() int
	// DependsOn returns the names of modules this module depends on.
	DependsOn() []string
	// Initialize performs the module's initialization logic.
	Initialize(ctx context.Context, config map[string]string) error
	// HealthCheck verifies the module is still healthy.
	HealthCheck() error
	// Shutdown gracefully shuts down the module.
	Shutdown() error
}

// StartupManager orchestrates the lifecycle of IStartup modules.
type StartupManager struct {
	modules map[string]IStartup // keyed by module Name()
	repo    *repository.Repository
	logger  *zap.Logger
	mu      sync.RWMutex

	// Runtime state
	running map[string]bool // keyed by module Name()
	started time.Time       // when Start() completed successfully
}

// NewStartupManager creates a new StartupManager.
func NewStartupManager(repo *repository.Repository, logger *zap.Logger) *StartupManager {
	return &StartupManager{
		modules: make(map[string]IStartup),
		repo:    repo,
		logger:  logger,
		running: make(map[string]bool),
	}
}

// The three classifiers below delegate to the package-level functions so the
// handler can route errors to HTTP statuses through the Service interface
// without importing this package.
func (m *StartupManager) IsNotFound(err error) bool  { return IsNotFound(err) }
func (m *StartupManager) IsUnhealthy(err error) bool { return IsUnhealthy(err) }
func (m *StartupManager) IsConflict(err error) bool  { return IsConflict(err) }

// -------------------------------------------------------
// Registration
// -------------------------------------------------------

// Register adds an IStartup module to the manager.
func (m *StartupManager) Register(s IStartup) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.modules[s.Name()] = s
	m.logger.Info("registered startup module",
		zap.String("name", s.Name()),
		zap.Int("priority", s.Priority()),
	)
}

// -------------------------------------------------------
// Lifecycle: Start
// -------------------------------------------------------

// Start initializes all registered modules in priority order, respecting
// dependencies. Modules with higher Priority() values start first.
// Circular dependencies are detected and cause the entire start to fail.
//
// tenantID scopes the config lookup: startup_modules.config is stored per
// tenant, so this must not be a constant.
func (m *StartupManager) Start(ctx context.Context, tenantID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.started.IsZero() {
		m.started = time.Now()
	}

	// Build topological order via Kahn's algorithm.
	order, err := m.topologicalSortLocked()
	if err != nil {
		m.logger.Error("startup failed: dependency resolution error",
			zap.Error(err),
		)
		return fmt.Errorf("startup dependency resolution failed: %w", err)
	}

	m.logger.Info("starting modules",
		zap.Int("count", len(order)),
	)

	for _, name := range order {
		module := m.modules[name]
		if err := m.startModuleLocked(ctx, module, tenantID); err != nil {
			m.logger.Error("startup failed during module init",
				zap.String("name", name),
				zap.Error(err),
			)
			// Mark all remaining modules as error so state is consistent.
			for _, remaining := range order[sort.SearchStrings(order, name)+1:] {
				m.running[remaining] = false
			}
			return fmt.Errorf("failed to start module %q: %w", name, err)
		}
	}

	m.logger.Info("all startup modules initialized successfully")
	return nil
}

// StartModule initializes a single module by name, respecting its dependencies.
func (m *StartupManager) StartModule(ctx context.Context, tenantID, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	module, exists := m.modules[name]
	if !exists {
		return ErrModuleNotFound
	}

	// Ensure all dependencies are already running.
	for _, depName := range module.DependsOn() {
		if !m.running[depName] {
			return fmt.Errorf("%w: %q depends on %q which is not running", ErrDependencyMissing, name, depName)
		}
	}

	return m.startModuleLocked(ctx, module, tenantID)
}

func (m *StartupManager) startModuleLocked(ctx context.Context, module IStartup, tenantID string) error {
	name := module.Name()
	if m.running[name] {
		return ErrAlreadyStarted
	}

	m.logger.Info("initializing module", zap.String("name", name))

	// Fetch config from the module repository row. A missing row means the
	// module was registered in code without a persisted configuration entry.
	cfg, err := m.repo.GetModuleByName(ctx, tenantID, name)
	moduleConfig := make(map[string]string)
	if err == nil && cfg != nil && cfg.Config != "" {
		moduleConfig, err = parseConfigString(cfg.Config)
		if err != nil {
			m.running[name] = false
			return fmt.Errorf("module %q config: %w", name, err)
		}
	} else if err != nil {
		m.logger.Warn("module config lookup failed; starting with empty config",
			zap.String("name", name),
			zap.Error(err),
		)
	}

	start := time.Now()
	err = module.Initialize(ctx, moduleConfig)
	durationMs := time.Since(start).Milliseconds()

	if err != nil {
		m.running[name] = false
		m.logger.Error("module initialization failed",
			zap.String("name", name),
			zap.Error(err),
			zap.Int64("duration_ms", durationMs),
		)
		return err
	}

	m.running[name] = true
	m.logger.Info("module initialized",
		zap.String("name", name),
		zap.Int64("duration_ms", durationMs),
	)
	return nil
}

// -------------------------------------------------------
// Lifecycle: Stop
// -------------------------------------------------------

// Stop shuts down all registered modules in reverse priority order.
func (m *StartupManager) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Collect modules sorted by priority ascending (reverse of start order).
	names := make([]string, 0, len(m.modules))
	for name := range m.modules {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool {
		return m.modules[names[i]].Priority() < m.modules[names[j]].Priority()
	})

	for _, name := range names {
		module := m.modules[name]
		if !m.running[name] {
			continue
		}
		if err := module.Shutdown(); err != nil {
			m.logger.Warn("module shutdown error",
				zap.String("name", name),
				zap.Error(err),
			)
		}
		m.running[name] = false
		m.logger.Info("module stopped", zap.String("name", name))
	}

	m.started = time.Time{}
	m.logger.Info("all modules stopped")
	return nil
}

// -------------------------------------------------------
// Status / Progress
// -------------------------------------------------------

// GetModuleStatus returns the lifecycle status of a registered module by name.
// It returns "active" while the module is running, "pending" before Start has
// ever completed, "initialized" once Start completed but the module is not
// running, and "unknown" when no IStartup implementation is registered.
func (m *StartupManager) GetModuleStatus(name string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if _, exists := m.modules[name]; !exists {
		return "unknown"
	}
	if m.running[name] {
		return "active"
	}
	if m.started.IsZero() {
		return "pending"
	}
	return "initialized"
}

// GetStartupProgress returns a map summarizing startup state.
func (m *StartupManager) GetStartupProgress() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	running := 0
	stopped := 0
	modules := make([]map[string]interface{}, 0, len(m.modules))
	for name, mod := range m.modules {
		status := "pending"
		if m.running[name] {
			status = "active"
			running++
		} else if m.started.IsZero() {
			status = "pending"
			stopped++
		} else {
			status = "initialized"
		}
		modules = append(modules, map[string]interface{}{
			"name":     name,
			"priority": mod.Priority(),
			"status":   status,
		})
	}
	// Sort by priority descending for readability.
	sort.Slice(modules, func(i, j int) bool {
		return modules[i]["priority"].(int) > modules[j]["priority"].(int)
	})

	return map[string]interface{}{
		"total":     len(m.modules),
		"running":   running,
		"stopped":   stopped,
		"startedAt": m.started,
		"modules":   modules,
	}
}

// HealthCheck runs HealthCheck on all running modules and returns true
// only if all modules are healthy.
func (m *StartupManager) HealthCheck(ctx context.Context) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// If startup never completed, not healthy.
	if m.started.IsZero() {
		return false, ErrNotRunning
	}

	unhealthy := make([]string, 0)
	for name, mod := range m.modules {
		if !m.running[name] {
			unhealthy = append(unhealthy, name)
			continue
		}
		if err := mod.HealthCheck(); err != nil {
			m.logger.Warn("module health check failed",
				zap.String("name", name),
				zap.Error(err),
			)
			unhealthy = append(unhealthy, name)
		}
	}

	if len(unhealthy) > 0 {
		return false, fmt.Errorf("unhealthy modules: %v", unhealthy)
	}
	return true, nil
}

// -------------------------------------------------------
// Persistence helpers (module CRUD via repository)
// -------------------------------------------------------

// CreateModuleRow persists a new startup module configuration row in the database.
func (m *StartupManager) CreateModuleRow(ctx context.Context, tenantID string, req *models.CreateModuleRequest) (*models.StartupModule, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check for duplicate name. Only a definitive "no such row" may fall
	// through to the INSERT; any other error is a real failure and must not be
	// reported as a duplicate name, which is what `if err == nil` used to do.
	_, err := m.repo.GetModuleByName(ctx, tenantID, req.Name)
	switch {
	case err == nil:
		return nil, ErrDuplicateModule
	case errors.Is(err, sentinel.NotFound):
		// No existing row with this name: proceed to the INSERT below.
	default:
		return nil, fmt.Errorf("failed to check for an existing module: %w", err)
	}

	now := time.Now()
	mod := &models.StartupModule{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Type:        req.Type,
		Priority:    req.Priority,
		Description: req.Description,
		Config:      req.Config,
		Status:      models.StatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := m.repo.CreateModule(ctx, mod); err != nil {
		return nil, fmt.Errorf("failed to create module row: %w", err)
	}
	return mod, nil
}

// UpdateModuleRow updates a startup module configuration row.
func (m *StartupManager) UpdateModuleRow(ctx context.Context, tenantID, id string, req *models.UpdateModuleRequest) (*models.StartupModule, error) {
	mod, err := m.repo.GetModuleByID(ctx, tenantID, id)
	if err != nil {
		// Only a missing row becomes ErrModuleNotFound; a database outage used to
		// be reported as "module not found", which made an outage look like a
		// bad id in every client.
		if !errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("failed to load module: %w", err)
		}
		return nil, fmt.Errorf("%w: %q", ErrModuleNotFound, id)
	}

	if req.Type != nil {
		mod.Type = *req.Type
	}
	if req.Priority != nil {
		mod.Priority = *req.Priority
	}
	if req.Description != nil {
		mod.Description = *req.Description
	}
	if req.Config != nil {
		mod.Config = *req.Config
	}
	mod.UpdatedAt = time.Now()

	if err := m.repo.UpdateModule(ctx, mod); err != nil {
		return nil, fmt.Errorf("failed to update module row: %w", err)
	}
	return mod, nil
}

// InitModule initializes a single module by id using its DB-stored config.
func (m *StartupManager) InitModule(ctx context.Context, tenantID, id string) (*models.StartupModule, error) {
	mod, err := m.repo.GetModuleByID(ctx, tenantID, id)
	if err != nil {
		if !errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("failed to load module: %w", err)
		}
		return nil, fmt.Errorf("%w: %q", ErrModuleNotFound, id)
	}

	m.mu.Lock()
	if m.running[mod.Name] {
		m.mu.Unlock()
		return nil, fmt.Errorf("%w: %q", ErrAlreadyStarted, mod.Name)
	}
	// Find the corresponding IStartup by name.
	startupMod, exists := m.modules[mod.Name]
	m.mu.Unlock()
	if !exists {
		return nil, fmt.Errorf("%w: no IStartup implementation registered for %q", ErrModuleNotFound, mod.Name)
	}

	// Mark in progress.
	start := time.Now()
	mod.Status = models.StatusInitialized

	moduleConfig := make(map[string]string)
	if mod.Config != "" {
		moduleConfig, err = parseConfigString(mod.Config)
		if err != nil {
			mod.Status = models.StatusError
			mod.Error = err.Error()
			if updateErr := m.repo.UpdateModule(ctx, mod); updateErr != nil {
				m.logger.Error("failed to update module error state", zap.Error(updateErr))
			}
			return mod, fmt.Errorf("failed to initialize module %q: %w", mod.Name, err)
		}
	}

	err = startupMod.Initialize(ctx, moduleConfig)
	durationMs := time.Since(start).Milliseconds()
	initAt := time.Now()

	if err != nil {
		m.mu.Lock()
		m.running[mod.Name] = false
		m.mu.Unlock()
		mod.Status = models.StatusError
		mod.Error = err.Error()
		mod.DurationMs = durationMs
		if updateErr := m.repo.UpdateModule(ctx, mod); updateErr != nil {
			m.logger.Error("failed to update module error state", zap.Error(updateErr))
		}
		return mod, fmt.Errorf("failed to initialize module %q: %w", mod.Name, err)
	}

	m.mu.Lock()
	// Without this, InitModule activated the module in the database while
	// GetModuleStatus and HealthCheckModule still reported it as pending, so a
	// successful initialisation was immediately reported as unhealthy.
	m.running[mod.Name] = true
	if m.started.IsZero() {
		m.started = time.Now()
	}
	m.mu.Unlock()

	mod.Status = models.StatusActive
	mod.DurationMs = durationMs
	mod.InitializedAt = &initAt
	if updateErr := m.repo.UpdateModule(ctx, mod); updateErr != nil {
		m.logger.Error("failed to update module active state", zap.Error(updateErr))
	}
	return mod, nil
}

// -------------------------------------------------------
// Module queries and dependency edges
// -------------------------------------------------------

// ListModules returns the persisted module rows for a tenant in priority order
// together with the total count for pagination.
func (m *StartupManager) ListModules(ctx context.Context, tenantID string, offset, limit int) ([]models.StartupModule, int, error) {
	items, err := m.repo.ListModules(ctx, tenantID, offset, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list modules: %w", err)
	}
	total, err := m.repo.CountModules(ctx, tenantID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count modules: %w", err)
	}
	return items, total, nil
}

// GetModuleByID returns one module row for a tenant, or sentinel.NotFound.
func (m *StartupManager) GetModuleByID(ctx context.Context, tenantID, id string) (*models.StartupModule, error) {
	mod, err := m.repo.GetModuleByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("%w: %q", ErrModuleNotFound, id)
		}
		return nil, fmt.Errorf("failed to load module: %w", err)
	}
	return mod, nil
}

// DeleteModule removes a module row for a tenant, or returns sentinel.NotFound
// when nothing was deleted.
func (m *StartupManager) DeleteModule(ctx context.Context, tenantID, id string) error {
	if err := m.repo.DeleteModule(ctx, tenantID, id); err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return fmt.Errorf("%w: %q", ErrModuleNotFound, id)
		}
		return fmt.Errorf("failed to delete module: %w", err)
	}
	return nil
}

// HealthCheckModule reports whether one module, addressed by row id, is
// running and passes its own HealthCheck.
//
// Every failure mode returns healthy=false with a classifiable error: the
// manager has never started (ErrNotRunning), the module is stopped (ErrNotRunning),
// or the module's own check failed (ErrModuleUnhealthy). Only a missing row
// and a repository failure escape as not-found / internal respectively.
func (m *StartupManager) HealthCheckModule(ctx context.Context, tenantID, id string) (bool, error) {
	mod, err := m.repo.GetModuleByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return false, fmt.Errorf("%w: %q", ErrModuleNotFound, id)
		}
		return false, fmt.Errorf("failed to load module: %w", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.started.IsZero() {
		return false, fmt.Errorf("%w: manager has not started", ErrNotRunning)
	}
	if !m.running[mod.Name] {
		return false, fmt.Errorf("%w: %q is not running", ErrNotRunning, mod.Name)
	}
	impl, ok := m.modules[mod.Name]
	if !ok {
		return false, fmt.Errorf("%w: %q has no registered implementation", ErrModuleUnhealthy, mod.Name)
	}
	if err := impl.HealthCheck(); err != nil {
		return false, fmt.Errorf("%w: %s", ErrModuleUnhealthy, err.Error())
	}
	return true, nil
}

// AddDependency records a startup dependency edge.
//
// startup_dependencies.module_id stores startup_modules.name (see migration
// 275), so the route's :id is resolved to a name before the INSERT. The target
// must be a module name that exists for the same tenant and the same edge may
// not already be recorded.
func (m *StartupManager) AddDependency(ctx context.Context, tenantID, id, dependsOn string) (*models.StartupDependency, error) {
	source, err := m.repo.GetModuleByID(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("%w: %q", ErrModuleNotFound, id)
		}
		return nil, fmt.Errorf("failed to load module: %w", err)
	}

	if dependsOn == source.Name {
		return nil, fmt.Errorf("%w: module %q cannot depend on itself", ErrCircularDep, source.Name)
	}

	target, err := m.repo.GetModuleByName(ctx, tenantID, dependsOn)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("%w: dependency target %q", ErrModuleNotFound, dependsOn)
		}
		return nil, fmt.Errorf("failed to load dependency target: %w", err)
	}

	if m.repo.HasDependency(ctx, tenantID, source.Name, dependsOn) {
		return nil, ErrDuplicateDependency
	}

	dep := &models.StartupDependency{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		ModuleID:  source.Name,
		DependsOn: target.Name,
		CreatedAt: time.Now(),
	}
	if err := m.repo.CreateDependency(ctx, dep); err != nil {
		return nil, fmt.Errorf("failed to create dependency: %w", err)
	}
	return dep, nil
}

// -------------------------------------------------------
// Topological sort (Kahn's algorithm) — caller holds lock
// -------------------------------------------------------

func (m *StartupManager) topologicalSortLocked() ([]string, error) {
	// Build adjacency + in-degree.
	inDeg := make(map[string]int)
	successors := make(map[string][]string)
	for name := range m.modules {
		inDeg[name] = 0
	}
	for name, mod := range m.modules {
		for _, dep := range mod.DependsOn() {
			if _, exists := m.modules[dep]; !exists {
				return nil, fmt.Errorf("%w: module %q depends on unknown module %q", ErrDependencyMissing, name, dep)
			}
			successors[dep] = append(successors[dep], name)
			inDeg[name]++
		}
	}

	// Seed queue with zero in-degree nodes, sorted by priority descending.
	var queue []string
	for name, deg := range inDeg {
		if deg == 0 {
			queue = append(queue, name)
		}
	}
	sort.Slice(queue, func(i, j int) bool {
		return m.modules[queue[i]].Priority() > m.modules[queue[j]].Priority()
	})

	order := make([]string, 0, len(m.modules))
	for len(queue) > 0 {
		// Pop the highest-priority ready node.
		sort.Slice(queue, func(i, j int) bool {
			return m.modules[queue[i]].Priority() > m.modules[queue[j]].Priority()
		})
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)

		for _, succ := range successors[cur] {
			inDeg[succ]--
			if inDeg[succ] == 0 {
				queue = append(queue, succ)
			}
		}
	}

	if len(order) != len(m.modules) {
		return nil, ErrCircularDep
	}
	return order, nil
}

// -------------------------------------------------------
// Config helpers
// -------------------------------------------------------

// parseConfigString decodes startup_modules.config, which is a JSON object of
// string values, into the map handed to IStartup.Initialize.
//
// An empty raw returns an empty map. Malformed JSON is returned as an error:
// the previous implementation stored the whole payload under the key "raw" and
// returned it as if it were parsed, so every module silently received
// {"raw": "<json>"} instead of its real configuration.
func parseConfigString(raw string) (map[string]string, error) {
	cfg := make(map[string]string)
	if raw == "" {
		return cfg, nil
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return cfg, fmt.Errorf("module config is not a JSON object of strings: %w", err)
	}
	return cfg, nil
}
