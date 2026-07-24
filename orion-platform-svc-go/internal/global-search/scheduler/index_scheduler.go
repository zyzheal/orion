// Package scheduler provides periodic reindex management.
package scheduler

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/global-search/index"

	"go.uber.org/zap"
)

// IndexScheduler periodically triggers reindex for registered modules.
type IndexScheduler struct {
	registry *index.IndexerRegistry
	logger   *zap.Logger
	intervals map[string]time.Duration // module -> reindex interval
	mu       sync.RWMutex
	cancel   context.CancelFunc
	ctx      context.Context
	done     chan struct{}
}

// New creates a new IndexScheduler.
func New(registry *index.IndexerRegistry, logger *zap.Logger) *IndexScheduler {
	return &IndexScheduler{
		registry: registry,
		logger:   logger,
		intervals: make(map[string]time.Duration),
		done:     make(chan struct{}),
	}
}

// SetInterval sets the reindex interval for a module.
// If interval is zero, reindex is disabled for that module.
func (s *IndexScheduler) SetInterval(module string, interval time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if interval == 0 {
		delete(s.intervals, module)
		return
	}
	s.intervals[module] = interval
}

// Start begins the periodic reindex cycle.
func (s *IndexScheduler) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	s.ctx = ctx
	s.cancel = cancel
	go s.run()
}

// Stop gracefully shuts down the scheduler.
func (s *IndexScheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
		<-s.done
	}
}

// ForceReindex triggers an immediate reindex for a module (empty = all).
func (s *IndexScheduler) ForceReindex(module string) error {
	// Use a short timeout to avoid blocking
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Minute)
	defer cancel()
	results, err := s.registry.Reindex(ctx, module)
	if err != nil {
		return err
	}
	for _, r := range results {
		if r.Success {
			s.logger.Info("reindex completed", zap.String("module", r.Module), zap.Duration("duration", time.Duration(r.DurationMs)*time.Millisecond))
		} else {
			s.logger.Error("reindex failed", zap.String("module", r.Module), zap.Error(err))
		}
	}
	return nil
}

// run executes the scheduling loop.
func (s *IndexScheduler) run() {
	defer close(s.done)
	s.logger.Info("global-search index scheduler started")

	// Run per-module intervals
	s.mu.RLock()
	intervals := make(map[string]time.Duration, len(s.intervals))
	for k, v := range s.intervals {
		intervals[k] = v
	}
	s.mu.RUnlock()

	if len(intervals) == 0 {
		s.logger.Info("no reindex intervals configured, scheduler idle")
		<-s.ctx.Done()
		return
	}

	// For simplicity, run all on a single timer (every 24h by default)
	// Production would use individual timers per module.
	s.mu.RLock()
	minInterval := s.minInterval()
	s.mu.RUnlock()

	if minInterval == 0 {
		<-s.ctx.Done()
		return
	}

	ticker := time.NewTicker(minInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info("global-search index scheduler stopping")
			return
		case <-ticker.C:
			s.runAll()
		}
	}
}

// runAll triggers reindex for all configured modules.
func (s *IndexScheduler) runAll() {
	s.mu.RLock()
	modules := make([]string, 0, len(s.intervals))
	for mod := range s.intervals {
		modules = append(modules, mod)
	}
	s.mu.RUnlock()

	s.logger.Info("triggering scheduled reindex", zap.Strings("modules", modules))
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Minute)
	defer cancel()

	for _, mod := range modules {
		results, err := s.registry.Reindex(ctx, mod)
		if err != nil {
			s.logger.Error("scheduled reindex error", zap.String("module", mod), zap.Error(err))
			continue
		}
		for _, r := range results {
			if r.Success {
				s.logger.Info("scheduled reindex complete",
					zap.String("module", r.Module),
					zap.Duration("duration", time.Duration(r.DurationMs)*time.Millisecond),
					zap.Int64("docs", r.Indexed),
				)
			} else {
				s.logger.Error("scheduled reindex failed",
					zap.String("module", r.Module),
					zap.String("error", r.Error),
				)
			}
		}
	}
}

// minInterval returns the shortest configured interval (for ticker).
func (s *IndexScheduler) minInterval() time.Duration {
	var min time.Duration
	for _, d := range s.intervals {
		if min == 0 || d < min {
			min = d
		}
	}
	return min
}
