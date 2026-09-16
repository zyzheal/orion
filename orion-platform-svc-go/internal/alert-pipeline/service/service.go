// Package service provides the alert pipeline orchestration service.
// It chains the predefined stages (receive → validate → dedup → enrich → route → notify)
// and returns a structured PipelineResult.
package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"
	"orion/platform-svc-go/internal/alert-pipeline/repository"
	stages_pkg "orion/platform-svc-go/internal/alert-pipeline/stages"
	"orion/platform-svc-go/internal/alert-pipeline/stages/dedup"
	"orion/platform-svc-go/internal/alert-pipeline/stages/enrich"
	"orion/platform-svc-go/internal/alert-pipeline/stages/notify"
	"orion/platform-svc-go/internal/alert-pipeline/stages/receive"
	"orion/platform-svc-go/internal/alert-pipeline/stages/route"
	"orion/platform-svc-go/internal/alert-pipeline/stages/track"
	"orion/platform-svc-go/internal/alert-pipeline/stages/validate"

	"github.com/google/uuid"

	"go.uber.org/zap"
)

// ErrPipelineDisabled is returned when the pipeline is not enabled for a tenant.
var ErrPipelineDisabled = errors.New("alert pipeline is disabled for this tenant")

// ErrUnknownStage is returned by UpdateConfig when a configured stage has no
// implementation. newStage tolerates an unknown name by substituting a no-op
// stage so that a hand-edited config file can never take the pipeline down;
// UpdateConfig does not inherit that tolerance, because accepting a typo'd
// stage name over PUT and silently running a no-op stage in its place is the
// defect the endpoint must not have.
var ErrUnknownStage = errors.New("unknown pipeline stage")

// ErrNilConfig is returned by UpdateConfig when the caller sends no config at
// all.
var ErrNilConfig = errors.New("pipeline config is required")

// ErrInvalidConfigValue is returned by UpdateConfig when a numeric config value
// is negative.
var ErrInvalidConfigValue = errors.New("pipeline config values must be non-negative")

// knownStageNames mirrors newStage's switch. A stage added in newStage without
// being added here would be rejected by UpdateConfig even though it can be
// built, so the two lists must move together.
var knownStageNames = map[string]bool{
	"receive":  true,
	"validate": true,
	"dedup":    true,
	"enrich":   true,
	"route":    true,
	"notify":   true,
	"track":    true,
}

// RepositoryInterface defines the persistence interface for alert pipeline results.
// Only Save is used at runtime; the full interface is kept for future query methods.
type RepositoryInterface interface {
	Save(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) error
	GetByResultID(ctx context.Context, resultID uuid.UUID) (*repository.Result, error)
	GetByAlertID(ctx context.Context, alertID string) (*repository.Result, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]*repository.Result, error)
	Count(ctx context.Context, tenantID string) (int, error)
}

// PipelineService orchestrates the end-to-end alert processing pipeline.
type PipelineService struct {
	mu     sync.RWMutex
	chains map[string]*stages_pkg.Chain // tenantID → chain
	cfg    *models.PipelineConfig
	logger *zap.Logger
	repo   RepositoryInterface
}

// NewPipelineService creates a new PipelineService.
func NewPipelineService(logger *zap.Logger, repo RepositoryInterface) *PipelineService {
	if logger == nil {
		logger = zap.NewNop()
	}
	cfg := models.DefaultPipelineConfig("default")
	cfg.Stages = []string{"receive", "validate", "dedup", "enrich", "route", "notify"}
	return &PipelineService{
		chains: make(map[string]*stages_pkg.Chain),
		cfg:    cfg,
		logger: logger,
		repo:   repo,
	}
}

// Execute runs the full alert pipeline for a single alert.
// Returns a PipelineResult describing what happened at each stage.
func (s *PipelineService) Execute(ctx context.Context, tenantID string, alert models.AlertEvent) *models.PipelineResult {
	s.mu.RLock()
	chain := s.chains[tenantID]
	s.mu.RUnlock()

	if chain == nil {
		chain = s.buildChain(tenantID)
		s.mu.Lock()
		s.chains[tenantID] = chain
		s.mu.Unlock()
	}

	// Build context.
	//
	// Every field a stage can read has to be present here. The validate stage
	// requires "sourceId" and stops the chain when it is missing, so omitting it
	// silently truncated the pipeline at stage 2 of 6: dedup, enrich, route and
	// notify never ran and every execution came back with status "error". AlertEvent
	// advertises sourceId/sourceName in its JSON tags, so a caller that followed
	// the documented shape was still rejected -- the handler accepted the field
	// and this map threw it away.
	alertMap := map[string]interface{}{
		"name":        alert.Name,
		"severity":    alert.Severity,
		"status":      alert.Status,
		"fingerprint": alert.Fingerprint,
		"sourceType":  alert.SourceType,
		"sourceId":    alert.SourceID,
		"sourceName":  alert.SourceName,
		"labels":      alert.Labels,
		"annotations": alert.Annotations,
		"value":       alert.Value,
		"threshold":   alert.Threshold,
		"metric":      alert.Metric,
	}

	alertCtx := models.NewAlertContext(tenantID, alert.ID, alert.SourceType, alertMap)

	// Execute pipeline
	resultCtx := chain.Execute(ctx, alertCtx)

	// Build result
	errors := make([]string, 0)
	if resultCtx.Error != "" {
		errors = append(errors, resultCtx.Error)
	}
	for _, h := range resultCtx.History {
		if h.ExitCode == "error" {
			errors = append(errors, fmt.Sprintf("%s: %s", h.Stage, h.ExitMsg))
		}
	}
	// Chain.Execute records a failing stage into Stage but returns without
	// Snapshotting it, so the erroring stage is not in History. Collect it here
	// or the pipeline reports "success" while an alert failed validation.
	if resultCtx.Stage.ExitCode == "error" {
		errors = append(errors, fmt.Sprintf("%s: %s", resultCtx.Stage.Stage, resultCtx.Stage.ExitMsg))
	}

	status := "success"
	if resultCtx.IsDuplicate {
		status = "dropped"
	} else if len(errors) > 0 {
		status = "error"
	}

	return &models.PipelineResult{
		AlertID:    alert.ID,
		Status:     status,
		Stages:     stageNames(resultCtx.History),
		StageCount: len(resultCtx.History),
		Errors:     errors,
	}
}

// persistResult saves the pipeline result to the repository (best-effort).
func (s *PipelineService) persistResult(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) {
	if s.repo == nil || result == nil {
		return
	}
	if err := s.repo.Save(ctx, tenantID, result, alertName, severity); err != nil {
		s.logger.Debug("failed to persist pipeline result", zap.Error(err))
	}
}

// ExecuteBatch runs the pipeline for multiple alerts concurrently.
func (s *PipelineService) ExecuteBatch(ctx context.Context, tenantID string, alerts []models.AlertEvent) []*models.PipelineResult {
	var wg sync.WaitGroup
	results := make([]*models.PipelineResult, len(alerts))
	sem := make(chan struct{}, 10) // concurrency limit

	for i, alert := range alerts {
		wg.Add(1)
		go func(idx int, a models.AlertEvent) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			results[idx] = s.Execute(ctx, tenantID, a)
		}(i, alert)
	}

	wg.Wait()
	return results
}

// Config returns the current pipeline configuration.
func (s *PipelineService) Config() *models.PipelineConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg
}

// Enable toggles the pipeline on/off for a tenant.
func (s *PipelineService) Enable(tenantID string, enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.Enabled = enabled
	if !enabled {
		delete(s.chains, tenantID)
	}
}

// UpdateConfig validates cfg and installs it as the active pipeline
// configuration, returning the config actually applied.
//
// Fields the caller leaves empty keep their current value: an empty Name keeps
// the existing name and an empty Stages keeps the current stage list. That is
// the PUT contract -- a caller sending only {"maxRetries":5} must not lose its
// stage list -- and it is also why the handler no longer substitutes
// DefaultPipelineConfig's stages locally, which would have made two sources of
// truth for what the default is.
//
// The stage list is enforced against knownStageNames. newStage substitutes a
// no-op stage for an unknown name so that a broken config file cannot stop the
// pipeline; a PUT that did the same would accept "recieve" and run a no-op
// stage in place of the real one, which is indistinguishable from dropping the
// field.
//
// Applying the config drops every built chain. Chains are constructed once per
// tenant and cached in s.chains, and they bake in cfg.Stages at construction
// time, so without invalidation a stage-list change would be accepted and then
// ignored by every subsequent Execute -- the update would mutate memory the
// pipeline never reads again.
func (s *PipelineService) UpdateConfig(ctx context.Context, cfg *models.PipelineConfig) (*models.PipelineConfig, error) {
	if cfg == nil {
		return nil, ErrNilConfig
	}
	if cfg.MaxRetries < 0 || cfg.RetryDelay < 0 || cfg.StageTimeout < 0 {
		return nil, ErrInvalidConfigValue
	}
	for _, name := range cfg.Stages {
		if !knownStageNames[name] {
			return nil, fmt.Errorf("%w %q", ErrUnknownStage, name)
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	current := *s.cfg
	if cfg.Name == "" {
		cfg.Name = current.Name
	}
	if len(cfg.Stages) == 0 {
		cfg.Stages = current.Stages
	}
	*s.cfg = *cfg
	s.chains = make(map[string]*stages_pkg.Chain)
	return s.cfg, nil
}

// buildChain constructs a stage chain for the given tenant.
func (s *PipelineService) buildChain(_ string) *stages_pkg.Chain {
	stageList := make([]stages_pkg.Stage, 0, len(s.cfg.Stages))
	for _, name := range s.cfg.Stages {
		st := newStage(name, s.logger)
		if st != nil {
			stageList = append(stageList, st)
		}
	}
	return stages_pkg.NewChain(stageList, stages_pkg.WithSkipStage(func(name string) bool {
		return false
	}))
}

// newStage creates a concrete stage by name. Falls back to a no-op stage
// for unknown names so that misconfigured pipelines still execute.
func newStage(name string, logger *zap.Logger) stages_pkg.Stage {
	switch name {
	case "receive":
		return receive.NewStage(logger)
	case "validate":
		return validate.NewStage(logger)
	case "dedup":
		return dedup.NewStage(logger, 10*time.Minute)
	case "enrich":
		return enrich.NewStage(logger)
	case "route":
		return route.NewStage(logger, []string{"default"})
	case "notify":
		return notify.NewStage(logger, false) // dryRun=false
	case "track":
		return track.NewStage(nil, logger)
	default:
		return &noopStage{name: name, logger: logger}
	}
}

// noopStage is a placeholder that passes through without processing.
// Used as a fallback when newStage encounters an unknown stage name.
type noopStage struct {
	name   string
	logger *zap.Logger
}

func (n *noopStage) Name() string { return n.name }
func (n *noopStage) Process(ctx context.Context, alertCtx *models.AlertContext) error {
	n.logger.Debug("noop stage", zap.String("stage", n.name), zap.String("alert_id", alertCtx.AlertID))
	return nil
}

func stageNames(history []models.AlertStage) []string {
	names := make([]string, len(history))
	for i, h := range history {
		names[i] = h.Stage
	}
	return names
}

// GenerateAlertID returns a new UUID-based alert ID.
func GenerateAlertID() string {
	return uuid.New().String()
}
