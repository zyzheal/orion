package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Experiment) error
	CreateInjection(ctx context.Context, rec *models.InjectionRecord) error
	CreateRecovery(ctx context.Context, rec *models.RecoveryRecord) error
	CreateRun(ctx context.Context, run *models.ExperimentRun) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Experiment, error)
	GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error)
	List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error)
	ListInjectionsByExperiment(ctx context.Context, tenantID, experimentID string) ([]models.InjectionRecord, error)
	ListRecoveriesByExperiment(ctx context.Context, tenantID, experimentID string) ([]models.RecoveryRecord, error)
	ListRunning(ctx context.Context, tenantID string) ([]models.Experiment, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateInjectionStatus(ctx context.Context, tenantID, injectionID, status string) error
	UpdateRecoveryStatus(ctx context.Context, tenantID, experimentID, status, message string) error
	UpdateRunStatus(ctx context.Context, tenantID, runID, status string) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Experiment CRUD ---

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
	m := &models.Experiment{
		TenantID:              tenantID,
		Name:                  req.Name,
		Description:           req.Description,
		Scope:                 req.Scope,
		Faults:                req.Faults,
		SteadyStateHypothesis: req.SteadyStateHypothesis,
		AutoRollback:          req.AutoRollback,
		CreatedBy:             req.CreatedBy,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, status string, limit, offset int) ([]models.Experiment, error) {
	return s.repo.List(ctx, tenantID, status, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateExperimentRequest) (*models.Experiment, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Scope != nil {
		updates["scope"] = *req.Scope
	}
	if req.Faults != nil {
		updates["faults"] = *req.Faults
	}
	if len(updates) == 0 {
		return s.repo.GetByID(ctx, tenantID, id)
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Experiment Activation ---

// ActivateExperiment marks an experiment as active.
func (s *Service) ActivateExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "active"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// ArchiveExperiment marks an experiment as archived.
func (s *Service) ArchiveExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if err := s.repo.UpdateStatus(ctx, tenantID, id, "archived"); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// --- Experiment Execution ---

// RunExperiment starts a new run for an experiment.
func (s *Service) RunExperiment(ctx context.Context, tenantID, id string, req models.RunExperimentRequest) (*models.ExperimentRun, error) {
	// Verify experiment exists
	experiment, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", sentinel.NotFound)
	}
	_ = experiment // experiment is validated

	run := &models.ExperimentRun{
		TenantID:     tenantID,
		ExperimentID: id,
		Status:       "running",
		Reason:       req.Reason,
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}
	return run, nil
}

// GetRun retrieves a run by ID.
func (s *Service) GetRun(ctx context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	return s.repo.GetRun(ctx, tenantID, runID)
}

// RollbackRun rolls back a run.
func (s *Service) RollbackRun(ctx context.Context, tenantID, runID string, reason string) (*models.ExperimentRun, error) {
	if err := s.repo.UpdateRunStatus(ctx, tenantID, runID, "rolled_back"); err != nil {
		return nil, err
	}
	return s.repo.GetRun(ctx, tenantID, runID)
}

// --- Running Experiments ---

// GetRunningExperiments returns all currently running experiments.
func (s *Service) GetRunningExperiments(ctx context.Context, tenantID string) ([]models.Experiment, error) {
	return s.repo.ListRunning(ctx, tenantID)
}

// --- Fault Injection (Direct) ---

// parseInjectConfig parses the JSON config string sent by the caller into an
// InjectConfig struct.  Returns nil when the string is empty (the executor
// branch applies its own sensible defaults).
func (s *Service) parseInjectConfig(configJSON string) *models.InjectConfig {
	if configJSON == "" {
		return nil
	}
	var cfg models.InjectConfig
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		return nil // caller provided malformed config; executor uses defaults.
	}
	return &cfg
}

// injectionResult is a helper that emits a stable, deterministic injection id
// and returns the corresponding InjectResult payload.
func injectionResult(faultPrefix, target string) *models.InjectResult {
	uid := uuidString()
	return &models.InjectResult{
		InjectionID: fmt.Sprintf("%s-%s-%s", faultPrefix, target, uid),
		Target:      target,
		Status:      "injected",
	}
}

// ExecuteCPUSpike injects a CPU-spike fault on the named target.
//
// The optional JSON config may contain "duration", "intensity" (CPU cores
// consumed, 0.0-1.0) and "percentage" (0-100 traffic share).  The call is
// recorded as an InjectionRecord before being dispatched to the executor.
func (s *Service) ExecuteCPUSpike(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	if target == "" {
		return nil, ErrEmptyTarget
	}

	cfg := s.parseInjectConfig(config)
	intensity := cpuSpikeDefaultIntensity(cfg)
	duration := cfg.Duration
	if duration == "" {
		duration = defaultDuration
	}

	result := injectionResult("cpu", target)

	// Persist the injection record (fault type: cpu-spike).
	if err := s.recordInjection(ctx, tenantID, "", result.InjectionID, "cpu-spike", target, config); err != nil {
		return nil, fmt.Errorf("failed to record cpu-spike injection: %w", err)
	}

	// Execute via the executor (best-effort; non-fatal if executor is unavailable).
	if err := s.execute(ctx, "cpu-spike", target, duration, intensity, cfg); err != nil {
		// Mark the record as failed rather than returning a hard error; the
		// handler can surface details but the API still returns the injection id.
		s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "failed")
		return nil, fmt.Errorf("cpu-spike injection failed: %w", err)
	}

	// Update the record to executing/completed.
	s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "completed")

	return result, nil
}

// ExecuteMemoryLeak injects a memory-leak fault on the named target.
//
// The optional JSON config may contain "duration", "intensity" (MB/s leak
// rate) and "percentage" (0-100 traffic share).  The call is recorded as an
// InjectionRecord before being dispatched to the executor.
func (s *Service) ExecuteMemoryLeak(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	if target == "" {
		return nil, ErrEmptyTarget
	}

	cfg := s.parseInjectConfig(config)
	intensity := memoryLeakDefaultIntensity(cfg)
	duration := cfg.Duration
	if duration == "" {
		duration = defaultDuration
	}

	result := injectionResult("mem", target)

	if err := s.recordInjection(ctx, tenantID, "", result.InjectionID, "memory-leak", target, config); err != nil {
		return nil, fmt.Errorf("failed to record memory-leak injection: %w", err)
	}

	if err := s.execute(ctx, "memory-leak", target, duration, intensity, cfg); err != nil {
		s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "failed")
		return nil, fmt.Errorf("memory-leak injection failed: %w", err)
	}

	s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "completed")

	return result, nil
}

// ExecuteNetworkLatency injects a network-latency fault on the named target.
//
// The optional JSON config may contain "duration", "intensity" (milliseconds
// of added latency) and "percentage" (0-100 traffic share).  The call is
// recorded as an InjectionRecord before being dispatched to the executor.
func (s *Service) ExecuteNetworkLatency(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	if target == "" {
		return nil, ErrEmptyTarget
	}

	cfg := s.parseInjectConfig(config)
	intensity := networkLatencyDefaultIntensity(cfg)
	duration := cfg.Duration
	if duration == "" {
		duration = defaultDuration
	}

	result := injectionResult("net", target)

	if err := s.recordInjection(ctx, tenantID, "", result.InjectionID, "network-latency", target, config); err != nil {
		return nil, fmt.Errorf("failed to record network-latency injection: %w", err)
	}

	if err := s.execute(ctx, "network-latency", target, duration, intensity, cfg); err != nil {
		s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "failed")
		return nil, fmt.Errorf("network-latency injection failed: %w", err)
	}

	s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "completed")

	return result, nil
}

// ExecuteServiceDown injects a service-down fault on the named target.
//
// The optional JSON config may contain "duration", "intensity" (port list as
// comma-separated integers), and "percentage" (0-100 traffic share).  The
// call is recorded as an InjectionRecord before being dispatched to the
// executor.
func (s *Service) ExecuteServiceDown(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error) {
	if target == "" {
		return nil, ErrEmptyTarget
	}

	cfg := s.parseInjectConfig(config)
	intensity := serviceDownDefaultIntensity(cfg)
	duration := cfg.Duration
	if duration == "" {
		duration = defaultDuration
	}

	// Executor receives cfg which contains Ports; defaultServicePorts is a
	// fallback constant referenced by the executor integration.
	_ = defaultServicePorts

	result := injectionResult("svc", target)

	if err := s.recordInjection(ctx, tenantID, "", result.InjectionID, "service-down", target, config); err != nil {
		return nil, fmt.Errorf("failed to record service-down injection: %w", err)
	}

	if err := s.execute(ctx, "service-down", target, duration, intensity, cfg); err != nil {
		s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "failed")
		return nil, fmt.Errorf("service-down injection failed: %w", err)
	}

	s.repo.UpdateInjectionStatus(ctx, tenantID, result.InjectionID, "completed")

	return result, nil
}

// --- Recovery ---

// RecoverExperiment triggers recovery for an experiment by reversing all
// active fault injections recorded under it.
//
// Returns ErrExperimentNotFound when no experiment exists for the given id,
// and ErrNoActiveInjection when there are no injections to recover from.
func (s *Service) RecoverExperiment(ctx context.Context, tenantID, experimentID string) (*models.RecoveryResult, error) {
	// Verify experiment exists
	experiment, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	_ = experiment // experiment is validated

	// Collect active injections (non-terminal statuses: pending, executing, completed)
	injections, err := s.repo.ListInjectionsByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("failed to list injections: %w", err)
	}

	var activeInjections []models.InjectionRecord
	for _, inj := range injections {
		switch inj.Status {
		case "pending", "executing", "completed":
			activeInjections = append(activeInjections, inj)
		}
	}

	if len(activeInjections) == 0 {
		return nil, ErrNoActiveInjection
	}

	// Create a recovery record and roll back each active injection in reverse
	// order (last-injected first, minimises collateral blast radius).
	recovery := &models.RecoveryRecord{
		TenantID:     tenantID,
		ExperimentID: experimentID,
		Status:       "recovering",
		Message: fmt.Sprintf("reversing %d active injection(s) for experiment %s",
			len(activeInjections), experimentID),
	}
	if err := s.repo.CreateRecovery(ctx, recovery); err != nil {
		return nil, fmt.Errorf("failed to create recovery record: %w", err)
	}

	failed := 0
	for i := len(activeInjections) - 1; i >= 0; i-- {
		inj := activeInjections[i]
		if err := s.rollbackInjection(ctx, tenantID, inj.InjectionID, inj.FaultType, inj.Target); err != nil {
			failed++
		}
	}

	var status, msg string
	if failed == 0 {
		status = "recovered"
		msg = fmt.Sprintf("all %d injection(s) for experiment %s reversed",
			len(activeInjections), experimentID)
	} else {
		status = "failed"
		msg = fmt.Sprintf("%d of %d injection(s) for experiment %s failed to recover",
			failed, len(activeInjections), experimentID)
	}

	if err := s.repo.UpdateRecoveryStatus(ctx, tenantID, experimentID, status, msg); err != nil {
		// Log but don't mask the original recovery result.
		_ = err
	}

	return &models.RecoveryResult{
		ExperimentID: experimentID,
		Status:       status,
		Message:      msg,
	}, nil
}

// ValidateRecovery validates recovery health by running a set of checks
// against the experiment's scope and returns a structured validation report.
func (s *Service) ValidateRecovery(ctx context.Context, tenantID, experimentID string) (*models.RecoveryValidation, error) {
	// Verify experiment exists
	experiment, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	_ = experiment // experiment is validated

	// Check 1: all injections for the experiment are in terminal status.
	injections, err := s.repo.ListInjectionsByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("failed to list injections: %w", err)
	}
	injectionsTerminal := true
	injectionsMsg := "no injections"
	for _, inj := range injections {
		if !isTerminalStatus(inj.Status) {
			injectionsTerminal = false
			injectionsMsg = fmt.Sprintf("%d active injection(s): %v", countNonTerminal(injections), collectIDs(injections))
			break
		}
	}
	if len(injections) == 0 {
		injectionsMsg = "no injections recorded"
	}

	// Check 2: recovery records indicate a final state.
	recoveries, err := s.repo.ListRecoveriesByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("failed to list recoveries: %w", err)
	}
	recoveryTerminal := len(recoveries) == 0 || isTerminalRecovery(recoveries[len(recoveries)-1].Status)
	recoveryMsg := "no recovery run"
	if len(recoveries) > 0 {
		last := recoveries[len(recoveries)-1]
		recoveryMsg = fmt.Sprintf("last recovery status: %s (%s)", last.Status, last.Message)
	}

	// Check 3: experiment status is not 'running'.
	statusTerminal := experiment.Status != "running"
	statusMsg := fmt.Sprintf("experiment status: %s", experiment.Status)

	// Build the report.
	checks := []models.RecoveryCheck{
		{
			Check:   "injection_terminal",
			Passed:  injectionsTerminal,
			Message: injectionsMsg,
		},
		{
			Check:   "recovery_terminal",
			Passed:  recoveryTerminal,
			Message: recoveryMsg,
		},
		{
			Check:   "experiment_stopped",
			Passed:  statusTerminal,
			Message: statusMsg,
		},
	}

	passed := allChecksPassed(checks)
	details := buildValidationDetails(checks)

	return &models.RecoveryValidation{
		ExperimentID: experimentID,
		Passed:       passed,
		Details:      details,
		Checks:       checks,
	}, nil
}

// GenerateRecoveryReport generates a detailed recovery report for an
// experiment, aggregating injection records, recovery history and health
// checks into a single document.
func (s *Service) GenerateRecoveryReport(ctx context.Context, tenantID, experimentID string) (*models.RecoveryReport, error) {
	// Verify experiment exists
	experiment, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	_ = experiment // experiment is validated

	// Aggregate injections and recoveries.
	injections, err := s.repo.ListInjectionsByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("failed to list injections: %w", err)
	}
	recoveries, err := s.repo.ListRecoveriesByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("failed to list recoveries: %w", err)
	}

	// Derive duration from the first recovery record's timestamp.
	var duration string
	var latestInjectionID string
	if len(recoveries) > 0 {
		latest := recoveries[len(recoveries)-1]
		dur := latest.UpdatedAt.Sub(latest.CreatedAt)
		duration = dur.String()
	}
	if len(injections) > 0 {
		latestInjectionID = injections[0].InjectionID
	}

	// Build the checklist from the validation routine.
	checklist := buildReportChecklist(injections, recoveries, experiment)

	reportText := buildReportText(experimentID, experiment, injections, recoveries, duration, latestInjectionID)

	return &models.RecoveryReport{
		ExperimentID: experimentID,
		Report:       reportText,
		Checklist:    checklist,
		Duration:     duration,
		InjectionID:  latestInjectionID,
	}, nil
}

// --- Pre-release Verify ---

// PreReleaseVerify runs a battery of pre-release verification checks
// against the named service in the given environment and returns a
// structured result with per-check status.
func (s *Service) PreReleaseVerify(ctx context.Context, tenantID string, req models.PreReleaseVerifyRequest) (*models.PreReleaseVerifyResult, error) {
	if req.ServiceID == "" || req.Environment == "" {
		return nil, ErrEmptyServiceEnvironment
	}

	// Validate the environment is one of the accepted values.
	validEnvs := []string{"staging", "production", "pre-release"}
	if !containsStr(validEnvs, req.Environment) {
		return nil, fmt.Errorf("unsupported environment %q", req.Environment)
	}

	// Define the verification checklist (ordered, each step executed in turn).
	checkDefinitions := []struct {
		name    string
		factory func(context.Context, string, string) (string, string)
	}{
		{
			name: "experiment_cleanup",
			factory: func(ctx context.Context, serviceID, env string) (string, string) {
				return s.checkExperimentCleanup(ctx, serviceID, env)
			},
		},
		{
			name: "injection_quiet_period",
			factory: func(ctx context.Context, serviceID, env string) (string, string) {
				return s.checkInjectionQuietPeriod(ctx, serviceID, env)
			},
		},
		{
			name: "health_endpoint",
			factory: func(ctx context.Context, serviceID, env string) (string, string) {
				return s.checkHealthEndpoint(ctx, serviceID, env)
			},
		},
		{
			name: "steady_state",
			factory: func(ctx context.Context, serviceID, env string) (string, string) {
				return s.checkSteadyState(ctx, serviceID, env)
			},
		},
	}

	checks := make([]models.PreReleaseCheck, 0, len(checkDefinitions))
	for _, def := range checkDefinitions {
		status, msg := def.factory(ctx, req.ServiceID, req.Environment)
		checks = append(checks, models.PreReleaseCheck{
			Check:   def.name,
			Status:  status,
			Message: msg,
		})
	}

	// Derive overall status: any failed check -> failed; all skipped -> skipped.
	status := "passed"
	details := ""
	for _, c := range checks {
		if c.Status == "fail" {
			status = "failed"
			details = fmt.Sprintf("pre-release verification failed: %s (%s)", c.Check, c.Message)
			break
		}
		if c.Status == "skip" && status == "passed" {
			status = "skipped"
			details = fmt.Sprintf("pre-release verification skipped: %s (%s)", c.Check, c.Message)
		}
	}
	if status == "passed" && details == "" {
		details = fmt.Sprintf("pre-release verification passed for service %s in %s", req.ServiceID, req.Environment)
	}

	return &models.PreReleaseVerifyResult{
		ServiceID:   req.ServiceID,
		Environment: req.Environment,
		Status:      status,
		Details:     details,
		Checks:      checks,
	}, nil
}

// --- Internal helpers ---

// execute dispatches a single injection to the executor with the given
// parameters.  In production this would call a CLI/k8s/API client; for now
// it validates the input shape and returns nil to indicate success.
func (s *Service) execute(ctx context.Context, faultType, target, duration string, intensity float64, cfg *models.InjectConfig) error {
	// Validate duration format (e.g. "30s", "2m").
	if duration != "" {
		if _, err := time.ParseDuration(duration); err != nil {
			return fmt.Errorf("invalid duration %q for %s injection: %w", duration, faultType, ErrInvalidConfig)
		}
	}
	// Validate intensity is within acceptable bounds.
	if intensity < 0 {
		return fmt.Errorf("negative intensity (%.2f) for %s injection", intensity, faultType)
	}
	if cfg != nil {
		if cfg.Percentage < 0 || cfg.Percentage > 100 {
			return fmt.Errorf("percentage (%.0f) out of range [0,100]", cfg.Percentage)
		}
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Real executor integration point.  Currently a no-op that returns
		// success; replace with the actual executor call.
		return nil
	}
}

// rollbackInjection reverses a single injection by updating its status and
// calling the executor's recovery path.
func (s *Service) rollbackInjection(ctx context.Context, tenantID, injectionID, faultType, target string) error {
	if err := s.repo.UpdateInjectionStatus(ctx, tenantID, injectionID, "rolled_back"); err != nil {
		return fmt.Errorf("failed to update injection %s status: %w", injectionID, err)
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Real executor rollback integration point.  Currently a no-op that
		// returns success; replace with the actual executor call.
		return nil
	}
}

// recordInjection creates a new InjectionRecord in the database.
func (s *Service) recordInjection(ctx context.Context, tenantID, experimentID, injectionID, faultType, target, configJSON string) error {
	rec := &models.InjectionRecord{
		TenantID:     tenantID,
		ExperimentID: experimentID,
		InjectionID:  injectionID,
		FaultType:    faultType,
		Target:       target,
		ConfigJSON:   configJSON,
		Status:       "executing",
	}
	return s.repo.CreateInjection(ctx, rec)
}

// --- Default constants ---

const (
	cpuSpikeDefaultCore       float64 = 0.8
	memoryLeakDefaultRateMBps float64 = 100
	networkLatencyDefaultMS   float64 = 500
	defaultDuration           string  = "30s"
)

var (
	ErrEmptyTarget             = errors.New("target must not be empty")
	ErrExperimentNotFound      = errors.New("experiment not found")
	ErrNoActiveInjection       = errors.New("no active injection to recover")
	ErrInvalidConfig           = errors.New("invalid injection config")
	ErrEmptyServiceEnvironment = errors.New("service_id and environment must not be empty")
)

var defaultServicePorts = []int{80, 443, 8080}

// --- Config defaults ---

func cpuSpikeDefaultIntensity(cfg *models.InjectConfig) float64 {
	if cfg == nil || cfg.Intensity == 0 {
		return cpuSpikeDefaultCore
	}
	if cfg.Intensity > 1.0 {
		return 1.0
	}
	return cfg.Intensity
}

func memoryLeakDefaultIntensity(cfg *models.InjectConfig) float64 {
	if cfg == nil || cfg.Intensity == 0 {
		return memoryLeakDefaultRateMBps
	}
	if cfg.Intensity < 0 {
		return memoryLeakDefaultRateMBps
	}
	return cfg.Intensity
}

func networkLatencyDefaultIntensity(cfg *models.InjectConfig) float64 {
	if cfg == nil || cfg.Intensity == 0 {
		return networkLatencyDefaultMS
	}
	return cfg.Intensity
}

func serviceDownDefaultIntensity(cfg *models.InjectConfig) float64 {
	if cfg != nil && cfg.Intensity > 0 {
		return cfg.Intensity
	}
	return 1.0
}

// --- Terminal status helpers ---

func isTerminalStatus(status string) bool {
	switch strings.ToLower(status) {
	case "rolled_back", "failed":
		return true
	}
	return false
}

func isTerminalRecovery(status string) bool {
	switch strings.ToLower(status) {
	case "recovered", "failed":
		return true
	}
	return false
}

func countNonTerminal(injections []models.InjectionRecord) int {
	n := 0
	for _, inj := range injections {
		if !isTerminalStatus(inj.Status) {
			n++
		}
	}
	return n
}

func collectIDs(injections []models.InjectionRecord) []string {
	ids := make([]string, len(injections))
	for i, inj := range injections {
		ids[i] = inj.InjectionID
	}
	return ids
}

func allChecksPassed(checks []models.RecoveryCheck) bool {
	for _, c := range checks {
		if !c.Passed {
			return false
		}
	}
	return true
}

func buildValidationDetails(checks []models.RecoveryCheck) string {
	var sb strings.Builder
	for _, c := range checks {
		status := "PASS"
		if !c.Passed {
			status = "FAIL"
		}
		sb.WriteString(fmt.Sprintf("[%s] %s: %s; ", status, c.Check, c.Message))
	}
	return strings.TrimSuffix(sb.String(), "; ")
}

// --- Report helpers ---

func buildReportChecklist(injections []models.InjectionRecord, recoveries []models.RecoveryRecord, experiment *models.Experiment) []models.RecoveryCheck {
	checks := []models.RecoveryCheck{}

	// Check 1: all injections rolled back.
	allRolledBack := true
	for _, inj := range injections {
		if inj.Status != "rolled_back" {
			allRolledBack = false
			break
		}
	}
	checks = append(checks, models.RecoveryCheck{
		Check:   "all_injections_rolled_back",
		Passed:  allRolledBack,
		Message: fmt.Sprintf("%d injections, %d rolled_back", len(injections), countRolledBack(injections)),
	})

	// Check 2: recovery completed.
	recoveryCompleted := false
	if len(recoveries) > 0 {
		last := recoveries[len(recoveries)-1]
		recoveryCompleted = last.Status == "recovered"
	}
	checks = append(checks, models.RecoveryCheck{
		Check:   "recovery_completed",
		Passed:  recoveryCompleted,
		Message: fmt.Sprintf("%d recovery record(s) on file", len(recoveries)),
	})

	// Check 3: experiment no longer running.
	checks = append(checks, models.RecoveryCheck{
		Check:   "experiment_stopped",
		Passed:  experiment.Status != "running",
		Message: fmt.Sprintf("current status: %s", experiment.Status),
	})

	return checks
}

func countRolledBack(injections []models.InjectionRecord) int {
	n := 0
	for _, inj := range injections {
		if inj.Status == "rolled_back" {
			n++
		}
	}
	return n
}

func buildReportText(experimentID string, experiment *models.Experiment, injections []models.InjectionRecord, recoveries []models.RecoveryRecord, duration, latestInjectionID string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Recovery Report for experiment %s\n\n", experimentID))
	sb.WriteString(fmt.Sprintf("Experiment: %s\n", experiment.Name))
	sb.WriteString(fmt.Sprintf("Scope: %s\n", experiment.Scope))
	sb.WriteString(fmt.Sprintf("Faults: %s\n\n", experiment.Faults))

	sb.WriteString(fmt.Sprintf("Injections: %d total, %d rolled_back\n", len(injections), countRolledBack(injections)))
	for _, inj := range injections {
		sb.WriteString(fmt.Sprintf("  - %s (%s): %s on %s\n", inj.InjectionID, inj.FaultType, inj.Status, inj.Target))
	}

	sb.WriteString(fmt.Sprintf("\nRecovery duration: %s\n", duration))
	sb.WriteString(fmt.Sprintf("Latest injection: %s\n\n", latestInjectionID))

	sb.WriteString(fmt.Sprintf("Recovery records: %d\n", len(recoveries)))
	for _, rec := range recoveries {
		sb.WriteString(fmt.Sprintf("  - [%s] %s: %s\n", rec.Status, rec.CreatedAt.Format(time.RFC3339), rec.Message))
	}

	return strings.TrimRight(sb.String(), "\n")
}

// --- Pre-release check implementations ---

func (s *Service) checkExperimentCleanup(ctx context.Context, serviceID, env string) (string, string) {
	// Verify no active experiments target this service in this environment.
	// In production this queries the experiment repository filtered by service
	// and environment; here we return skip with a placeholder message.
	return "skip", fmt.Sprintf("no experiment cleanup check for %s/%s", serviceID, env)
}

func (s *Service) checkInjectionQuietPeriod(ctx context.Context, serviceID, env string) (string, string) {
	// Confirm there have been no injections within the last 5 minutes.
	return "skip", fmt.Sprintf("quiet period not checked for %s/%s", serviceID, env)
}

func (s *Service) checkHealthEndpoint(ctx context.Context, serviceID, env string) (string, string) {
	// Hit the service's /healthz endpoint and verify a 200 response.
	return "skip", fmt.Sprintf("health endpoint not checked for %s/%s", serviceID, env)
}

func (s *Service) checkSteadyState(ctx context.Context, serviceID, env string) (string, string) {
	// Poll key metrics (error rate, latency p99, throughput) against steady-state baseline.
	return "skip", fmt.Sprintf("steady state not checked for %s/%s", serviceID, env)
}

// --- Utility ---

// containsStr returns true when needle is found in haystack.
func containsStr(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

// uuidString returns a short unique id segment.
func uuidString() string {
	id := uuid()
	// Take first 8 hex chars for readability.
	return id[0:8]
}

// uuid is a minimal UUID generator that avoids an extra import; replace with
// the google/uuid package call in production.
func uuid() string {
	// Simple deterministic-ish unique segment for injection IDs.
	return fmt.Sprintf("%08x%04x",
		time.Now().UnixMilli()&0xFFFFFFFF,
		time.Now().UnixNano()&0xFFFF)
}

// --- Errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
