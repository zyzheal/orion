package slowquery

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
)

// Service wires together the collector (reads live DBs), the repository
// (writes collected rows to PG), and the analyzer (turns a SQL string
// into optimization hints). It is the sole surface the HTTP handler
// and any future CLI need to call.
type Service struct {
	repo      *Repository
	collector *Collector
	log       *zap.Logger
}

// NewService constructs a Service. When collector is nil (e.g. when
// the wiring cannot resolve a DataSourceLookup) only the analyzer
// and top-N endpoints work; Collect returns a descriptive error.
func NewService(repo *Repository, collector *Collector, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{repo: repo, collector: collector, log: log}
}

// Collect runs one collection pass for a data source and returns the
// number of distinct queries ingested.
func (s *Service) Collect(ctx context.Context, tenantID string, req CollectRequest) (int, error) {
	if s.collector == nil {
		return 0, fmt.Errorf("slowquery collector not wired")
	}
	n, err := s.collector.Collect(ctx, tenantID, req.DataSourceID, req.ThresholdMs, req.Since)
	if err != nil {
		s.log.Warn("slowquery collect failed",
			zap.String("ds", req.DataSourceID),
			zap.Error(err),
		)
		return 0, err
	}
	s.log.Info("slowquery collect done",
		zap.String("ds", req.DataSourceID),
		zap.Int("rows", n),
	)
	return n, nil
}

// TopN returns the top slow queries from the repository, ordered by
// total_time_ms (or whichever order_by the caller set).
func (s *Service) TopN(ctx context.Context, req TopNRequest) ([]SlowQuery, error) {
	return s.repo.TopN(ctx, req)
}

// Analyze runs the heuristic analyzer against one SQL string and
// returns the suggestions + a passed/failed verdict.
func (s *Service) Analyze(ctx context.Context, req AnalyzeRequest) (*AnalysisResult, error) {
	if strings.TrimSpace(req.SQL) == "" {
		return nil, fmt.Errorf("slowquery analyze: sql is required")
	}
	dbType := strings.ToLower(strings.TrimSpace(req.DBType))
	if dbType == "" {
		dbType = "postgres"
	}
	result := analyzeSQL(req.SQL, dbType, req.RowsRead)
	result.AnalyzedAt = time.Now().UTC()
	return result, nil
}

// Stats returns aggregate counts for a data source's slow query
// inventory in the last N hours. Used by dashboards.
func (s *Service) Stats(ctx context.Context, tenantID, dataSourceID string, since time.Time) (int, error) {
	return s.repo.CountActive(ctx, tenantID, dataSourceID, since)
}

// PruneOlderThan removes rows older than the cutoff and returns how
// many were removed.
func (s *Service) PruneOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	return s.repo.Prune(ctx, cutoff)
}
