package statistics

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Processor stores, aggregates, and provides statistics for ingested metrics.
// It is safe for concurrent use.
type Processor struct {
	aggregator *Aggregator
	mu         sync.RWMutex
	// metrics stores all ingested StatMetric values for a given (name, tags) key.
	metrics map[groupKey][]StatMetric
	// retention is the maximum age for stored metrics; expired values are cleaned
	// during periodic pruning. Zero means no retention.
	retention time.Duration
	// logger is the structured logger used by the processor.
	logger *slog.Logger
}

type ProcessorOption func(*Processor)

// WithRetention sets the maximum retention period for stored metrics.
func WithRetention(retention time.Duration) ProcessorOption {
	return func(p *Processor) {
		p.retention = retention
	}
}

// WithLogger sets a custom structured logger. If not set, a default slog logger is used.
func WithLogger(logger *slog.Logger) ProcessorOption {
	return func(p *Processor) {
		p.logger = logger
	}
}

// NewProcessor creates a new Processor with the given options.
func NewProcessor(opts ...ProcessorOption) *Processor {
	p := &Processor{
		aggregator: DefaultAggregator(),
		metrics:    make(map[groupKey][]StatMetric),
		logger:     slog.Default(),
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

// Ingest accepts a StatMetric, storing it for later aggregation.
func (p *Processor) Ingest(m StatMetric) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if m.Timestamp.IsZero() {
		m.Timestamp = time.Now().UTC()
	}

	key := p.metricKey(m.Name, m.Tags)
	p.metrics[key] = append(p.metrics[key], m)
}

// IngestBatch accepts multiple StatMetric values and stores them.
func (p *Processor) IngestBatch(metrics []StatMetric) {
	for _, m := range metrics {
		p.Ingest(m)
	}
}

// Aggregate returns the aggregation for the named metric over the requested window,
// filtered by the provided tags. The timestamp argument determines the window end;
// when zero, the current time is used.
func (p *Processor) Aggregate(name string, tags map[string]string, window AggregationWindow, unit string, ts time.Time) (*AggregationResult, error) {
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	key := p.metricKey(name, tags)
	raw, ok := p.metrics[key]
	if !ok {
		return nil, fmt.Errorf("statistics: no data for metric %q with tags %v", name, tags)
	}

	// Prune values outside the requested window so we only aggregate relevant data.
	windowStart := ts.Add(-window.Duration())
	values := make([]float64, 0, len(raw))
	for _, m := range raw {
		if !m.Timestamp.Before(windowStart) && !m.Timestamp.After(ts) {
			values = append(values, m.Value)
		}
	}

	return p.aggregator.Aggregate(values, name, unit, tags, window, ts)
}

// AggregateHistogram returns an aggregation that includes histogram buckets for
// the named metric over the requested window.
func (p *Processor) AggregateHistogram(name string, tags map[string]string, window AggregationWindow, unit string, ts time.Time, buckets []float64) (*AggregationResult, error) {
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	key := p.metricKey(name, tags)
	raw, ok := p.metrics[key]
	if !ok {
		return nil, fmt.Errorf("statistics: no data for metric %q with tags %v", name, tags)
	}

	windowStart := ts.Add(-window.Duration())
	values := make([]float64, 0, len(raw))
	for _, m := range raw {
		if !m.Timestamp.Before(windowStart) && !m.Timestamp.After(ts) {
			values = append(values, m.Value)
		}
	}

	return p.aggregator.AggregateHistogram(values, name, unit, tags, window, ts, buckets)
}

// AggregateAll returns aggregations for every stored metric over the requested window.
func (p *Processor) AggregateAll(window AggregationWindow, ts time.Time) ([]*AggregationResult, error) {
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	var all []StatMetric
	p.mu.RLock()
	for _, raw := range p.metrics {
		all = append(all, raw...)
	}
	p.mu.RUnlock()

	return p.aggregator.AggregateByWindow(all, window, ts)
}

// AggregateByWindow returns aggregations for the named metric grouped by time windows.
func (p *Processor) AggregateByWindow(name string, tags map[string]string, window AggregationWindow, unit string, ts time.Time) ([]*AggregationResult, error) {
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	p.mu.RLock()
	raw, ok := p.metrics[p.metricKey(name, tags)]
	p.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("statistics: no data for metric %q with tags %v", name, tags)
	}

	return p.aggregator.AggregateByWindow(raw, window, ts)
}

// Prune removes metrics older than the configured retention period. Returns the
// number of metrics removed.
func (p *Processor) Prune(ctx context.Context) int {
	if p.retention == 0 {
		return 0
	}

	cutoff := time.Now().UTC().Add(-p.retention)
	removed := 0

	p.mu.Lock()
	defer p.mu.Unlock()

	for key, raw := range p.metrics {
		kept := make([]StatMetric, 0, len(raw))
		for _, m := range raw {
			if m.Timestamp.After(cutoff) {
				kept = append(kept, m)
			}
		}
		removed += len(raw) - len(kept)

		if len(kept) == 0 {
			delete(p.metrics, key)
			p.logger.Debug("statistics: removed empty metric group",
				slog.String("key", key.name),
				slog.String("tags", key.tags))
		} else {
			p.metrics[key] = kept
		}

		select {
		case <-ctx.Done():
			p.logger.Warn("statistics: prune cancelled",
				slog.String("error", ctx.Err().Error()))
			return removed
		default:
		}
	}

	p.logger.Info("statistics: prune completed",
		slog.Int("removed", removed))

	return removed
}

// StartBackgroundPrune starts a goroutine that periodically prunes expired metrics
// every interval. It returns a stop channel that should be closed to halt the
// background worker.
func (p *Processor) StartBackgroundPrune(ctx context.Context, interval time.Duration) <-chan struct{} {
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				p.logger.Info("statistics: background prune stopped")
				return
			case <-ctx.Done():
				p.logger.Info("statistics: background prune stopped (context cancelled)")
				return
			case <-ticker.C:
				if n := p.Prune(ctx); n > 0 {
					p.logger.Info("statistics: pruned expired metrics",
						slog.Int("removed", n))
				}
			}
		}
	}()
	return stop
}

// MetricCount returns the total number of stored metric values.
func (p *Processor) MetricCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	total := 0
	for _, raw := range p.metrics {
		total += len(raw)
	}
	return total
}

// SeriesCount returns the number of distinct metric series (name + tags) stored.
func (p *Processor) SeriesCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.metrics)
}

// metricKey creates a deterministic group key for a metric name + tags.
func (p *Processor) metricKey(name string, tags map[string]string) groupKey {
	return groupKey{
		name: name,
		tags: serializeTags(tags),
	}
}
