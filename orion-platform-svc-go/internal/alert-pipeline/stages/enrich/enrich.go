// Package enrich implements the enrichment stage of the alert pipeline.  It
// pulls additional context (CMDB metadata, recent event history, topology)
// from configured EnrichmentSource plugins and annotates the AlertContext.
package enrich

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Stage enriches alerts by running registered EnrichmentSource plugins.
type Stage struct {
	logger      *zap.Logger
	sources     []models.EnrichmentSource
	cmdbCache   map[string]interface{}
	topology    map[string]interface{}
}

// NewStage creates an enrich stage.
func NewStage(logger *zap.Logger) *Stage {
	return &Stage{
		logger:    logger,
		sources:   make([]models.EnrichmentSource, 0),
		cmdbCache: make(map[string]interface{}),
		topology:  make(map[string]interface{}),
	}
}

// RegisterSource adds an enrichment source to be consulted.
func (s *Stage) RegisterSource(src models.EnrichmentSource) {
	s.sources = append(s.sources, src)
}

// SetCMDBData provides pre-fetched CMDB data for enrichment.
func (s *Stage) SetCMDBData(data map[string]interface{}) {
	s.cmdbCache = data
}

// SetTopologyData provides pre-fetched topology data for enrichment.
func (s *Stage) SetTopologyData(data map[string]interface{}) {
	s.topology = data
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "enrich"
}

// Process enriches the alert context with available metadata.
func (s *Stage) Process(ctx context.Context, alertCtx *models.AlertContext) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Attach CMDB context if present.
	if len(s.cmdbCache) > 0 {
		alertCtx.Enrichments["cmdb"] = s.cmdbCache
	}
	// Attach topology context if present.
	if len(s.topology) > 0 {
		alertCtx.Enrichments["topology"] = s.topology
	}
	// Attach enrichment timestamp.
	alertCtx.Enrichments["enrichedAt"] = time.Now().UTC().Format(time.RFC3339)

	// Run each enrichment source (plugin).
	for _, src := range s.sources {
		if err := src.Enrich(alertCtx); err != nil {
			s.logger.Error("enrich source failed",
				zap.String("source", src.Name()),
				zap.Error(err))
			// Non-fatal: continue enriching with remaining sources.
		}
	}

	return nil
}
