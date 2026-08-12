package service

import (
        "context"
        "sync"
        "time"

        "orion/platform-svc-go/internal/statistics"
        "orion/platform-svc-go/internal/statistics/handler/models"
        "orion/platform-svc-go/internal/statistics/repository"
)

type Service struct {
        repo       *repository.Repository
        mu         sync.RWMutex
        processors map[string]*statistics.Processor
}

func NewService(repo *repository.Repository) *Service {
        return &Service{repo: repo, processors: make(map[string]*statistics.Processor)}
}

func (s *Service) getProcessor(tenantID string) *statistics.Processor {
        s.mu.RLock()
        p, ok := s.processors[tenantID]
        s.mu.RUnlock()
        if ok {
                return p
        }
        s.mu.Lock()
        defer s.mu.Unlock()
        if p, ok = s.processors[tenantID]; ok {
                return p
        }
        p = statistics.NewProcessor()
        s.processors[tenantID] = p
        return p
}

func (s *Service) Ingest(ctx context.Context, tenantID string, req *models.StatMetricRequest) error {
        proc := s.getProcessor(tenantID)
        m := statistics.NewStatMetric(req.Name, req.Value, req.Unit, req.Tags)
        proc.Ingest(m)
        if s.repo != nil {
                return s.repo.Store(ctx, tenantID, m)
        }
        return nil
}

func (s *Service) IngestBatch(ctx context.Context, tenantID string, metrics []models.StatMetricRequest) error {
        proc := s.getProcessor(tenantID)
        ms := make([]statistics.StatMetric, 0, len(metrics))
        for _, m := range metrics {
                ms = append(ms, statistics.NewStatMetric(m.Name, m.Value, m.Unit, m.Tags))
        }
        proc.IngestBatch(ms)
        if s.repo != nil {
                return s.repo.StoreBatch(ctx, tenantID, ms)
        }
        return nil
}

func (s *Service) Aggregate(ctx context.Context, tenantID string, req *models.AggregateRequest) (*models.AggregationResultResponse, error) {
        proc := s.getProcessor(tenantID)
        window := parseWindow(req.Window)
        result, err := proc.Aggregate(req.Name, req.Tags, window, req.Unit, time.Now())
        if err != nil {
                return nil, err
        }
        return toAggResponse(result), nil
}

func (s *Service) AggregateAll(ctx context.Context, tenantID string, windowStr string) ([]models.AggregationResultResponse, error) {
        proc := s.getProcessor(tenantID)
        window := parseWindow(windowStr)
        results, err := proc.AggregateAll(window, time.Now())
        if err != nil {
                return nil, err
        }
        resp := make([]models.AggregationResultResponse, 0, len(results))
        for _, r := range results {
                resp = append(resp, *toAggResponse(r))
        }
        return resp, nil
}

func (s *Service) Prune(ctx context.Context, tenantID string) (int, error) {
        proc := s.getProcessor(tenantID)
        memPruned := proc.Prune(ctx)
        if s.repo != nil {
                dbPruned := s.repo.Prune(ctx, tenantID, 24*time.Hour)
                return memPruned + dbPruned, nil
        }
        return memPruned, nil
}

func (s *Service) Stats(ctx context.Context, tenantID string) *models.ProcessorStats {
        proc := s.getProcessor(tenantID)
        return &models.ProcessorStats{
                MetricCount: proc.MetricCount(),
                SeriesCount: proc.SeriesCount(),
        }
}

func parseWindow(s string) statistics.AggregationWindow {
	switch s {
	case "5m":
		return statistics.AggregationWindow(5 * time.Minute)
	case "15m":
		return statistics.AggregationWindow(15 * time.Minute)
	case "1h":
		return statistics.AggregationWindow(time.Hour)
	case "1d":
		return statistics.AggregationWindow(24 * time.Hour)
	default:
		return statistics.AggregationWindow(time.Minute)
	}
}

func toAggResponse(r *statistics.AggregationResult) *models.AggregationResultResponse {
        return &models.AggregationResultResponse{
                Name:  r.Name,
                Count: int(r.Count),
                Sum:   r.Sum,
                Avg:   r.Avg,
                Min:   r.Min,
                Max:   r.Max,
                Tags:  r.Tags,
                Unit:  r.Unit,
        }
}
