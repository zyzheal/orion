package repository

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/statistics"
)

// Repository provides persistent storage for aggregated statistics.
// In-memory implementation that stores per-tenant metric series.
type Repository struct {
	mu       sync.RWMutex
	metrics  map[string][]statistics.StatMetric
	retained int
}

func NewRepository(retained int) *Repository {
	if retained <= 0 {
		retained = 1000
	}
	return &Repository{
		metrics:  make(map[string][]statistics.StatMetric),
		retained: retained,
	}
}

func (r *Repository) Store(ctx context.Context, tenantID string, m statistics.StatMetric) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	series := r.metrics[tenantID]
	series = append(series, m)
	if len(series) > r.retained {
		series = series[len(series)-r.retained:]
	}
	r.metrics[tenantID] = series
	return nil
}

func (r *Repository) StoreBatch(ctx context.Context, tenantID string, metrics []statistics.StatMetric) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	series := r.metrics[tenantID]
	series = append(series, metrics...)
	if len(series) > r.retained {
		series = series[len(series)-r.retained:]
	}
	r.metrics[tenantID] = series
	return nil
}

func (r *Repository) GetByWindow(ctx context.Context, tenantID, name string, tags map[string]string, window statistics.AggregationWindow, now time.Time) ([]statistics.StatMetric, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cutoff := now.Add(-window.Duration())
	var result []statistics.StatMetric
	for _, m := range r.metrics[tenantID] {
		if m.Name == name && m.Timestamp.After(cutoff) {
			result = append(result, m)
		}
	}
	return result, nil
}

func (r *Repository) Prune(ctx context.Context, tenantID string, retention time.Duration) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	cutoff := time.Now().Add(-retention)
	series := r.metrics[tenantID]
	kept := 0
	for _, m := range series {
		if m.Timestamp.After(cutoff) {
			kept++
		}
	}
	if kept < len(series) {
		if kept > 0 {
			r.metrics[tenantID] = series[len(series)-kept:]
		} else {
			delete(r.metrics, tenantID)
		}
	}
	return len(series) - kept
}

func (r *Repository) Count(ctx context.Context, tenantID string) int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.metrics[tenantID])
}
