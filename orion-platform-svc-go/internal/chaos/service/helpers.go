package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
)

// --- Internal helpers -----------------------------------------------

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
		_ = faultType
		_ = target
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
		CreatedAt:    time.Now().UTC(),
	}
	return s.repo.CreateInjection(ctx, rec)
}

// --- Config defaults ------------------------------------------------

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

// --- Config defaults (continued) -------------------------------------

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

// --- Terminal status helpers ----------------------------------------

func isTerminalStatus(status string) bool {
	switch strings.ToLower(status) {
	case "rolled_back", "failed":
		return true
	}
	return false
}

func isTerminalRecovery(status string) bool {
	switch strings.ToLower(status) {
	// A recovery record is terminal once it reached a final state.
	// Empty status is treated as non-terminal (still running).
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

// --- Report helpers -------------------------------------------------

func buildReportChecklist(experiment *models.Experiment, injections []models.InjectionRecord, recoveries []models.RecoveryRecord) []models.RecoveryCheck {
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
	sb.WriteString(fmt.Sprintf("Faults: %s\n\n", experiment.FaultType))

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

// --- Pre-release check implementations ------------------------------

func (s *Service) checkExperimentCleanup(ctx context.Context, serviceID, env string) (string, string) {
	// Verify no active experiments target this service in this environment.
	// In production this queries the experiment repository filtered by service
	// and environment; here we return skip with a placeholder message.
	_ = ctx
	return "skip", fmt.Sprintf("no experiment cleanup check for %s/%s", serviceID, env)
}

func (s *Service) checkInjectionQuietPeriod(ctx context.Context, serviceID, env string) (string, string) {
	// Confirm there have been no injections within the last 5 minutes.
	_ = ctx
	return "skip", fmt.Sprintf("quiet period not checked for %s/%s", serviceID, env)
}

func (s *Service) checkHealthEndpoint(ctx context.Context, serviceID, env string) (string, string) {
	// Hit the service's /healthz endpoint and verify a 200 response.
	_ = ctx
	return "skip", fmt.Sprintf("health endpoint not checked for %s/%s", serviceID, env)
}

func (s *Service) checkSteadyState(ctx context.Context, serviceID, env string) (string, string) {
	// Poll key metrics (error rate, latency p99, throughput) against steady-state baseline.
	_ = ctx
	return "skip", fmt.Sprintf("steady state not checked for %s/%s", serviceID, env)
}

// --- Utility --------------------------------------------------------

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
