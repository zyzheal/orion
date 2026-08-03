// Package service provides the alert pipeline orchestration service.
// It chains the predefined stages (receive → validate → dedup → enrich → route → notify)
// and returns a structured PipelineResult.
package service

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/alert-pipeline/models"
	stages_pkg "orion/platform-svc-go/internal/alert-pipeline/stages"

	"github.com/google/uuid"

	"go.uber.org/zap"
)

// ErrPipelineDisabled is returned when the pipeline is not enabled for a tenant.
var ErrPipelineDisabled = errors.New("alert pipeline is disabled for this tenant")

// PipelineService orchestrates the end-to-end alert processing pipeline.
type PipelineService struct {
	mu        sync.RWMutex
	chains    map[string]*stages_pkg.Chain  // tenantID → chain
	cfg       *models.PipelineConfig
	logger    *zap.Logger
}

// NewPipelineService creates a new PipelineService.
func NewPipelineService(logger *zap.Logger) *PipelineService {
	cfg := models.DefaultPipelineConfig("default")
	cfg.Stages = []string{"receive", "validate", "dedup", "enrich", "route", "notify"}
	return &PipelineService{
		chains: make(map[string]*stages_pkg.Chain),
		cfg:    cfg,
		logger: logger,
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

// newStage creates a stage by name. If no concrete implementation exists,
// returns a no-op stage that always passes through.
func newStage(name string, logger *zap.Logger) stages_pkg.Stage {
	logger.Debug("pipeline stage", zap.String("stage", name))
	return &noopStage{
		name:   name,
		logger: logger,
	}
}

// noopStage is a placeholder that passes through without processing.
// Concrete implementations (validate, dedup, enrich, route, notify) should
// replace this once their full logic is ready.
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
