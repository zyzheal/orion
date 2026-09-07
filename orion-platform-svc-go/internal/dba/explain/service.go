package explain

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
)

// Service wires the fetcher, repository, and parser together. It is
// the sole surface the handler needs to call.
type Service struct {
	fetcher *Fetcher
	repo    *Repository
	log     *zap.Logger
}

// NewService constructs a Service.
func NewService(fetcher *Fetcher, repo *Repository, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{fetcher: fetcher, repo: repo, log: log}
}

// Explain runs EXPLAIN against a data source and returns the parsed
// plan + heuristic suggestions. When req.Analyze is true we run
// EXPLAIN ANALYZE (PG) to get actual timings.
func (s *Service) Explain(ctx context.Context, tenantID string, req ExplainRequest) (*ExplainResult, error) {
	if s.fetcher == nil {
		return nil, fmt.Errorf("explain fetcher not wired")
	}
	if s.repo == nil {
		return nil, fmt.Errorf("explain repository not wired")
	}
	if strings.TrimSpace(req.SQL) == "" {
		return nil, fmt.Errorf("explain: sql is required")
	}

	dbType := strings.ToLower(strings.TrimSpace(req.DBType))
	if dbType == "" {
		dbType = "postgres"
	}

	ds, err := s.fetcher.dsLookup.GetDataSource(ctx, req.DataSourceID)
	if err != nil {
		return nil, fmt.Errorf("resolve data source: %w", err)
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("explain: data source %q does not belong to tenant", req.DataSourceID)
	}

	var raw string
	var elapsed time.Duration
	switch dbType {
	case "postgres":
		raw, elapsed, err = s.fetcher.FetchPG(ctx, ds, req.SQL, req.Analyze)
	case "mysql":
		raw, elapsed, err = s.fetcher.FetchMySQL(ctx, ds, req.SQL, req.Analyze)
	default:
		return nil, fmt.Errorf("unsupported db type: %s", dbType)
	}
	if err != nil {
		s.log.Warn("explain fetch failed",
			zap.String("ds", req.DataSourceID),
			zap.Error(err),
		)
		return nil, err
	}

	plan := Parse(dbType, raw)
	suggestions := Suggest(plan, dbType)
	passed := len(suggestions) == 0

	result := &ExplainResult{
		SQL:          req.SQL,
		DBType:       dbType,
		PlanText:     raw,
		Plan:         plan,
		Suggestions:  suggestions,
		Passed:       passed,
		DurationMs:   elapsed.Milliseconds(),
		AnalyzedAt:   time.Now().UTC(),
	}

	// Persist for audit; failures are non-fatal — the caller still gets
	// the result even if the history write fails.
	job := &ExplainJob{
		TenantID:     tenantID,
		DataSourceID: req.DataSourceID,
		DBType:       dbType,
		SQL:          req.SQL,
		PlanText:     raw,
		Passed:       passed,
		DurationMs:   elapsed.Milliseconds(),
	}
	if err := s.repo.Insert(ctx, job); err != nil {
		s.log.Warn("explain history insert failed", zap.Error(err))
	}

	return result, nil
}

// RecentHistory returns the N most recent explain jobs for a tenant.
func (s *Service) RecentHistory(ctx context.Context, tenantID string, limit int) ([]ExplainJob, error) {
	return s.repo.Recent(ctx, tenantID, limit)
}
