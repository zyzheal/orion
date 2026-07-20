package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
)

// --- Fault Injection (Direct) ---------------------------------------

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

	// Ensure target is not empty before proceeding.
	if target == "" {
		return nil, ErrEmptyTarget
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

// --- Pre-release Verify ---------------------------------------------

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
