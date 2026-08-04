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
	"orion/platform-svc-go/internal/alert-pipeline/stages/dedup"
	"orion/platform-svc-go/internal/alert-pipeline/stages/enrich"
	"orion/platform-svc-go/internal/alert-pipeline/stages/notify"
	"orion/platform-svc-go/internal/alert-pipeline/stages/receive"
	"orion/platform-svc-go/internal/alert-pipeline/stages/route"
	"orion/platform-svc-go/internal/alert-pipeline/stages/track"
	"orion/platform-svc-go/internal/alert-pipeline/stages/validate"
	stages_pkg "orion/platform-svc-go/internal/alert-pipeline/stages"

	"github.com/google/uuid"

	"go.uber.org/zap"
)

// ErrPipelineDisabled is returned when the pipeline is not enabled for a tenant.
var ErrPipelineDisabled = errors.New("alert pipeline is disabled for this tenant")

// RepositoryInterface defines the persistence interface for alert pipeline results.
// Only Save is used at runtime; the full interface is kept for future query methods.
type RepositoryInterface interface {
	Save(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) error
	GetByResultID(ctx context.Context, resultID interface{}) (*repository.Result, error)
	GetByAlertID(ctx context.Context, alertID string) (*repository.Result, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]*repository.Result, error)
	Count(ctx context.Context, tenantID string) (int, error)
}

// PipelineService orchestrates the end-to-end alert processing pipeline.
type PipelineService struct {
	mu        sync.RWMutex
	chains    map[string]*stages_pkg.Chain  // tenantID → chain
	cfg       *models.PipelineConfig
	logger    *zap.Logger
	repo      RepositoryInterface
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

	// Build context
	alertMap := map[string]interface{}{
		"name":        alert.Name,
		"severity":    alert.Severity,
		"status":      alert.Status,
		"fingerprint": alert.Fingerprint,
		"sourceType":  alert.SourceType,
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

	status := "success"
	if resultCtx.IsDuplicate {
		status = "dropped"
	} else if len(errors) > 0 {
		status = "error"
	}

	return &models.PipelineResult{
		AlertID:   alert.ID,
		Status:    status,
		Stages:    stageNames(resultCtx.History),
		StageCount: len(resultCtx.History),
		Errors:    errors,
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

func (n *noopStage) Name() string            { return n.name }
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
