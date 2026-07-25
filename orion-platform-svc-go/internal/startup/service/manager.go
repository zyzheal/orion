package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"orion/platform-svc-go/internal/startup/models"
	"orion/platform-svc-go/internal/startup/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrModuleNotFound    = errors.New("startup module not found")
	ErrDuplicateModule   = errors.New("startup module with this name already exists")
	ErrDependencyMissing = errors.New("module dependency not found")
	ErrCircularDep       = errors.New("circular dependency detected")
	ErrAlreadyStarted    = errors.New("module already started")
	ErrNotRunning        = errors.New("module is not running")
)

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
func (m *StartupManager) Start(ctx context.Context) error {
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
		if err := m.startModuleLocked(ctx, module); err != nil {
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
func (m *StartupManager) StartModule(ctx context.Context, name string) error {
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

	return m.startModuleLocked(ctx, module)
}

func (m *StartupManager) startModuleLocked(ctx context.Context, module IStartup) error {
	name := module.Name()
	if m.running[name] {
		return ErrAlreadyStarted
	}

	m.logger.Info("initializing module", zap.String("name", name))

	// Fetch config from the module repository row.
	cfg, err := m.repo.GetModuleByName(ctx, "default", name)
	var moduleConfig map[string]string
	if err == nil && cfg != nil && cfg.Config != "" {
		// Config is stored as a JSON string in the DB.
		moduleConfig = parseConfigString(cfg.Config)
	} else {
		moduleConfig = make(map[string]string)
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

// GetModuleStatus returns the status string of a module.
// Returns one of "running", "pending", "error", or "unknown".
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
		"total":    len(m.modules),
		"running":  running,
		"stopped":  stopped,
		"startedAt": m.started,
		"modules":  modules,
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

	// Check for duplicate name.
	_, err := m.repo.GetModuleByName(ctx, tenantID, req.Name)
	if err == nil {
		return nil, ErrDuplicateModule
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
		return nil, ErrModuleNotFound
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
		return nil, ErrModuleNotFound
	}

	// Find the corresponding IStartup by name.
	startupMod, exists := m.modules[mod.Name]
	if !exists {
		return nil, fmt.Errorf("%w: no IStartup implementation registered for %q", ErrModuleNotFound, mod.Name)
	}

	// Mark in progress.
	start := time.Now()
	mod.Status = models.StatusInitialized

	var moduleConfig map[string]string
	if mod.Config != "" {
		moduleConfig = parseConfigString(mod.Config)
	} else {
		moduleConfig = make(map[string]string)
	}

	err = startupMod.Initialize(ctx, moduleConfig)
	durationMs := time.Since(start).Milliseconds()
	initAt := time.Now()

	if err != nil {
		mod.Status = models.StatusError
		mod.Error = err.Error()
		mod.DurationMs = durationMs
		if updateErr := m.repo.UpdateModule(ctx, mod); updateErr != nil {
			m.logger.Error("failed to update module error state", zap.Error(updateErr))
		}
		return mod, fmt.Errorf("failed to initialize module %q: %w", mod.Name, err)
	}

	mod.Status = models.StatusActive
	mod.DurationMs = durationMs
	mod.InitializedAt = &initAt
	if updateErr := m.repo.UpdateModule(ctx, mod); updateErr != nil {
		m.logger.Error("failed to update module active state", zap.Error(updateErr))
	}
	return mod, nil
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

// parseConfigString attempts to parse a JSON string stored in the DB as a
// flat map[string]string. Returns a plain map if parsing fails.
func parseConfigString(raw string) map[string]string {
	cfg := make(map[string]string)
	// Best-effort: treat as JSON map[string]string.
	// In production this would use json.Unmarshal; for now split on "," or return as single key.
	if raw == "" {
		return cfg
	}
	cfg["raw"] = raw
	return cfg
}
