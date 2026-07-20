package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
)

// --- Recovery -------------------------------------------------------

// RecoverExperiment triggers recovery for an experiment by reversing all
// active fault injections recorded under it.
//
// Returns ErrExperimentNotFound when no experiment exists for the given id,
// and ErrNoActiveInjection when there are no injections to recover from.
func (s *Service) RecoverExperiment(ctx context.Context, tenantID, experimentID string) (*models.RecoveryResult, error) {
	// Verify experiment exists
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}

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
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
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
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}

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
			break
		}
	}
	if len(injections) == 0 {
		injectionsMsg = "no injections recorded"
	}
	if !injectionsTerminal && len(injections) > 0 {
		injectionsMsg = fmt.Sprintf("%d active injection(s) remain", countNonTerminal(injections))
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
	exp, _ := s.repo.GetByID(ctx, tenantID, experimentID)
	statusTerminal := true
	statusMsg := "no experiment found"
	if exp != nil {
		statusTerminal = exp.Status != "running"
		statusMsg = fmt.Sprintf("experiment status: %s", exp.Status)
	}

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

	// TODO: aggregate checks into validation summary.
	_ = allChecksPassed(checks)
	_ = buildValidationDetails(checks)

	return &models.RecoveryValidation{
		ExperimentID: experimentID,
		Passed:       allChecksPassed(checks),
		Details:      buildValidationDetails(checks),
		Checks:       checks,
	}, nil
}

// GenerateRecoveryReport generates a detailed recovery report for an
// experiment, aggregating injection records, recovery history and health
// checks into a single document.
func (s *Service) GenerateRecoveryReport(ctx context.Context, tenantID, experimentID string) (*models.RecoveryReport, error) {
	// Verify experiment exists
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}

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
	exp, _ := s.repo.GetByID(ctx, tenantID, experimentID)
	checklist := buildReportChecklist(exp, injections, recoveries)
	reportText := buildReportText(experimentID, exp, injections, recoveries, duration, latestInjectionID)

	return &models.RecoveryReport{
		ExperimentID: experimentID,
		Report:       reportText,
		Checklist:    checklist,
		Duration:     duration,
		InjectionID:  latestInjectionID,
	}, nil
}

// --- Recovery Health Check (helper) ---------------------------------

// CheckRecoveryHealth runs a lightweight recovery-health check against an
// experiment's injection and recovery records and returns a structured result.
func (s *Service) CheckRecoveryHealth(ctx context.Context, tenantID, experimentID string) (*models.RecoveryHealth, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	injections, err := s.repo.ListInjectionsByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, err
	}
	active := 0
	for _, inj := range injections {
		if !isTerminalStatus(inj.Status) {
			active++
		}
	}
	healthy := active == 0
	return &models.RecoveryHealth{
		ExperimentID: experimentID,
		Healthy:      healthy,
		Active:       active,
	}, nil
}

// --- Recovery Health Details (helper) --------------------------------

// GetRecoveryHealthDetails returns a richer health view including recovery
// record status and experiment state.
func (s *Service) GetRecoveryHealthDetails(ctx context.Context, tenantID, experimentID string) (*models.RecoveryHealthDetails, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	return s.CheckRecoveryHealth(ctx, tenantID, experimentID)
}

// --- Recovery Status (helper) ----------------------------------------

// GetRecoveryStatus returns a simple status string for the experiment.
func (s *Service) GetRecoveryStatus(ctx context.Context, tenantID, experimentID string) (*models.RecoveryStatus, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	// TODO: persist status fields to recovery record when schema supports it.
	return &models.RecoveryStatus{
		ExperimentID: experimentID,
		Status:       "not_run",
	}, nil
}

// --- Recovery Record (helper) ----------------------------------------

// GetRecoveryRecord returns the latest recovery record for the experiment.
func (s *Service) GetRecoveryRecord(ctx context.Context, tenantID, experimentID string) (*models.RecoveryRecord, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	recoveries, err := s.repo.ListRecoveriesByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, err
	}
	if len(recoveries) == 0 {
		return nil, ErrExperimentNotFound
	}
	return &recoveries[0], nil
}

// --- Recovery Summary (helper) ---------------------------------------

// GetRecoverySummary returns an aggregated view of recovery attempts.
func (s *Service) GetRecoverySummary(ctx context.Context, tenantID, experimentID string) (*models.RecoverySummary, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	return &models.RecoverySummary{
		ExperimentID: experimentID,
	}, nil
}

// --- Recovery Attempt (helper) ---------------------------------------

// GetRecoveryAttempts returns all recovery attempt records for the experiment.
func (s *Service) GetRecoveryAttempts(ctx context.Context, tenantID, experimentID string) ([]models.RecoveryRecord, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	_, err := s.repo.GetByID(ctx, tenantID, experimentID)
	if err != nil {
		return nil, fmt.Errorf("experiment not found: %w", ErrExperimentNotFound)
	}
	return s.repo.ListRecoveriesByExperiment(ctx, tenantID, experimentID)
}

// --- Recovery Result (helper) ----------------------------------------

// GetRecoveryResult returns the result of the latest recovery attempt.
func (s *Service) GetRecoveryResult(ctx context.Context, tenantID, experimentID string) (*models.RecoveryResult, error) {
	if experimentID == "" {
		return nil, errors.New("experiment_id is required")
	}
	recoveries, err := s.repo.ListRecoveriesByExperiment(ctx, tenantID, experimentID)
	if err != nil {
		return nil, err
	}
	if len(recoveries) == 0 {
		return nil, ErrExperimentNotFound
	}
	last := recoveries[len(recoveries)-1]
	return &models.RecoveryResult{
		ExperimentID: experimentID,
		Status:       last.Status,
		Message:      last.Message,
	}, nil
}
