package service

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/agent-trace/models"
)

// RepositoryInterface defines the persistence contract for agent traces.
type RepositoryInterface interface {
	SaveTrace(ctx context.Context, t *models.AgentTrace) error
	GetByTraceID(ctx context.Context, tenantID, traceID string) (*models.AgentTrace, error)
	ListTraces(ctx context.Context, req models.TraceQueryRequest) ([]*models.AgentTrace, int, error)
	UpdateTraceStatus(ctx context.Context, tenantID, traceID string, status, err string, durationMs int64, response string) error
}

// InMemoryRepository provides a DB-free implementation for dev/test.
type InMemoryRepository struct {
	mu     sync.RWMutex
	traces []*models.AgentTrace
}

func NewInMemoryRepository() *InMemoryRepository {
	return &InMemoryRepository{traces: make([]*models.AgentTrace, 0)}
}

func (r *InMemoryRepository) SaveTrace(_ context.Context, t *models.AgentTrace) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	r.traces = append(r.traces, t)
	return nil
}

func (r *InMemoryRepository) GetByTraceID(_ context.Context, _, traceID string) (*models.AgentTrace, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, t := range r.traces {
		if t.ID == traceID {
			return t, nil
		}
	}
	return nil, fmt.Errorf("trace %q not found", traceID)
}

func (r *InMemoryRepository) ListTraces(_ context.Context, req models.TraceQueryRequest) ([]*models.AgentTrace, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}
	if len(r.traces) < req.Page*limit {
		return nil, len(r.traces), nil
	}
	end := req.Page*limit + limit
	if end > len(r.traces) {
		end = len(r.traces)
	}
	return r.traces[req.Page*limit : end], len(r.traces), nil
}

func (r *InMemoryRepository) UpdateTraceStatus(_ context.Context, _, traceID string, status, err string, durationMs int64, response string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, t := range r.traces {
		if t.ID == traceID {
			t.Status = status
			t.Error = err
			t.DurationMs = durationMs
			t.Response = response
			t.CompletedAt = time.Now().UTC()
			return nil
		}
	}
	return fmt.Errorf("trace %q not found", traceID)
}

var _ RepositoryInterface = (*InMemoryRepository)(nil)

// Service manages agent trace lifecycle and metric aggregation.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// RecordTrace saves an agent trace.
func (s *Service) RecordTrace(ctx context.Context, t *models.AgentTrace) error {
	if s.repo == nil {
		return fmt.Errorf("agent-trace: repository not configured")
	}
	return s.repo.SaveTrace(ctx, t)
}

// GetTrace retrieves a trace by ID.
func (s *Service) GetTrace(ctx context.Context, tenantID, traceID string) (*models.AgentTrace, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("agent-trace: repository not configured")
	}
	return s.repo.GetByTraceID(ctx, tenantID, traceID)
}

// ListTraces returns paginated traces.
func (s *Service) ListTraces(ctx context.Context, req models.TraceQueryRequest) ([]*models.AgentTrace, int, error) {
	if s.repo == nil {
		return nil, 0, fmt.Errorf("agent-trace: repository not configured")
	}
	return s.repo.ListTraces(ctx, req)
}

// CompleteTrace updates a trace to completed status.
func (s *Service) CompleteTrace(ctx context.Context, tenantID, traceID string, err string, durationMs int64, response string) error {
	if s.repo == nil {
		return fmt.Errorf("agent-trace: repository not configured")
	}
	status := "completed"
	if err != "" {
		status = "failed"
	}
	return s.repo.UpdateTraceStatus(ctx, tenantID, traceID, status, err, durationMs, response)
}

// GetMetrics aggregates trace data into AgentMetric for a given window.
func (s *Service) GetMetrics(ctx context.Context, tenantID string, agentID string, days int) (*models.AgentMetric, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("agent-trace: repository not configured")
	}
	if days <= 0 {
		days = 7
	}
	windowStart := time.Now().UTC().AddDate(0, 0, -days)

	traces, _, err := s.repo.ListTraces(ctx, models.TraceQueryRequest{
		AgentID:   agentID,
		StartTime: windowStart,
		EndTime:   time.Now().UTC(),
		Limit:     10000,
	})
	if err != nil {
		return nil, err
	}

	durations := make([]float64, 0, len(traces))
	var successCount, failureCount int
	var totalInput, totalOutput int
	var totalCost float64

	for _, t := range traces {
		if t.Status == "completed" {
			successCount++
		} else if t.Status == "failed" {
			failureCount++
		}
		durations = append(durations, float64(t.DurationMs))
		totalInput += t.TokenUsage.InputTokens
		totalOutput += t.TokenUsage.OutputTokens
		totalCost += t.TokenUsage.EstimatedCost
	}

	sort.Float64s(durations)
	p95 := percentile(durations, 95)
	var avg float64
	if len(durations) > 0 {
		var sum float64
		for _, d := range durations {
			sum += d
		}
		avg = sum / float64(len(durations))
	}

	rate := 0.0
	if len(traces) > 0 {
		rate = float64(successCount) / float64(len(traces))
	}

	return &models.AgentMetric{
		AgentID:            agentID,
		TotalRuns:          len(traces),
		SuccessCount:       successCount,
		FailureCount:       failureCount,
		SuccessRate:        rate,
		AvgDurationMs:      avg,
		P95DurationMs:      p95,
		TotalInputTokens:   totalInput,
		TotalOutputTokens:  totalOutput,
		TotalEstimatedCost: totalCost,
		WindowStart:        windowStart,
		WindowEnd:          time.Now().UTC(),
	}, nil
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}
	idx := float64(len(sorted)-1) * p / 100.0
	lower := int(idx)
	upper := lower + 1
	if upper >= len(sorted) {
		return sorted[len(sorted)-1]
	}
	frac := idx - float64(lower)
	return sorted[lower] + frac*(sorted[upper]-sorted[lower])
}
