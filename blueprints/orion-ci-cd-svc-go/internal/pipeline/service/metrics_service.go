package service

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/repository"

	"go.uber.org/zap"
)

// RunMetric represents a single recorded pipeline run metric.
type RunMetric struct {
	RunID       string
	PipelineID  string
	Status      models.PipelineRunStatus
	DurationMs  int64
	ErrorType   string
	TriggerType string
	CompletedAt time.Time
}

// PipelineMetric holds aggregated metrics for a pipeline.
type PipelineMetric struct {
	TotalRuns           int        `json:"total_runs"`
	SuccessRuns         int        `json:"success_runs"`
	FailedRuns          int        `json:"failed_runs"`
	CancelledRuns       int        `json:"cancelled_runs"`
	RunningRuns         int        `json:"running_runs"`
	PendingRuns         int        `json:"pending_runs"`
	SuccessRate         float64    `json:"success_rate"`
	AverageDurationMs   float64    `json:"average_duration_ms"`
	MedianDurationMs    int64      `json:"median_duration_ms"`
	P95DurationMs       int64      `json:"p95_duration_ms"`
	LastUpdated         time.Time  `json:"last_updated"`
	FailuresByErrorType map[string]int `json:"failures_by_error_type"`
	RunsByPipeline      map[string]PipelineRunMetric `json:"runs_by_pipeline"`
	RunsByTriggerType   map[string]int `json:"runs_by_trigger_type"`
}

// PipelineRunMetric holds metrics for a single pipeline.
type PipelineRunMetric struct {
	Total         int     `json:"total"`
	Success       int     `json:"success"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
}

// PrometheusMetric represents a single Prometheus metric line.
type PrometheusMetric struct {
	Name   string
	Help   string
	Type   string // counter, gauge, histogram
	Labels map[string]string
	Value  float64
}

// MetricsService provides pipeline metrics collection and aggregation.
type MetricsService struct {
	db           *repository.RunRepository
	logger       *zap.Logger
	metrics      []RunMetric
	mu           sync.RWMutex
	maxHistory   int
	maxAgeHours  int
}

// NewMetricsService creates a new metrics service.
func NewMetricsService(db *repository.RunRepository, logger *zap.Logger) *MetricsService {
	return &MetricsService{
		db:          db,
		logger:      logger,
		metrics:     make([]RunMetric, 0),
		maxHistory:  10000,
		maxAgeHours: 24,
	}
}

// Record records a completed pipeline run metric.
func (s *MetricsService) Record(run *models.PipelineRun) {
	s.mu.Lock()
	defer s.mu.Unlock()

	m := RunMetric{
		RunID:       run.ID,
		PipelineID:  run.PipelineID,
		Status:      run.Status,
		DurationMs:  run.DurationMs,
		TriggerType: string(run.TriggerType),
		CompletedAt: time.Now(),
	}

	// Classify error type for failed runs
	if run.Status == models.StatusFailed {
		m.ErrorType = s.classifyError(run.TriggerBy)
	}

	s.metrics = append(s.metrics, m)

	// Enforce max history size
	if len(s.metrics) > s.maxHistory {
		s.metrics = s.metrics[len(s.metrics)-s.maxHistory:]
	}

	s.logger.Debug("Recorded pipeline run metric",
		zap.String("run_id", run.ID),
		zap.String("status", string(run.Status)),
		zap.Int64("duration_ms", run.DurationMs),
	)
}

// GetMetrics returns aggregated metrics from in-memory history.
func (s *MetricsService) GetMetrics() PipelineMetric {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.aggregateMetrics(s.metrics)
}

// GetMetricsFromDB fetches metrics from the database.
func (s *MetricsService) GetMetricsFromDB() (PipelineMetric, error) {
	// We need to query the DB directly - use the run repository's DB
	// For now, return in-memory metrics (DB queries require sqlx.DB which we don't have here)
	return s.GetMetrics(), nil
}

// GetMetricsByPipeline returns metrics for a specific pipeline.
func (s *MetricsService) GetMetricsByPipeline(pipelineID string) PipelineRunMetric {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var total, success, failed, cancelled int
	var totalDuration int64
	var durations []int64

	for _, m := range s.metrics {
		if m.PipelineID != pipelineID {
			continue
		}
		total++
		if m.Status == models.StatusSuccess {
			success++
		} else if m.Status == models.StatusFailed {
			failed++
		} else if m.Status == models.StatusCancelled {
			cancelled++
		}
		if m.DurationMs > 0 {
			durations = append(durations, m.DurationMs)
			totalDuration += m.DurationMs
		}
	}

	avgDuration := float64(0)
	if total > 0 {
		avgDuration = float64(totalDuration) / float64(total)
	}

	return PipelineRunMetric{
		Total:         total,
		Success:       success,
		AvgDurationMs: avgDuration,
	}
}

// GetRecentRuns returns the N most recent run metrics.
func (s *MetricsService) GetRecentRuns(n int) []RunMetric {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if n > len(s.metrics) {
		n = len(s.metrics)
	}
	return s.metrics[len(s.metrics)-n:]
}

// GetPrometheusMetrics returns metrics in Prometheus exposition format.
func (s *MetricsService) GetPrometheusMetrics() string {
	m := s.GetMetrics()
	var lines []string

	// Overall counters
	lines = append(lines, "# HELP pipeline_runs_total Total number of pipeline runs")
	lines = append(lines, "# TYPE pipeline_runs_total counter")
	lines = append(lines, fmt.Sprintf("pipeline_runs_total %d", m.TotalRuns))

	lines = append(lines, "# HELP pipeline_runs_success_total Total successful runs")
	lines = append(lines, "# TYPE pipeline_runs_success_total counter")
	lines = append(lines, fmt.Sprintf("pipeline_runs_success_total %d", m.SuccessRuns))

	lines = append(lines, "# HELP pipeline_runs_failed_total Total failed runs")
	lines = append(lines, "# TYPE pipeline_runs_failed_total counter")
	lines = append(lines, fmt.Sprintf("pipeline_runs_failed_total %d", m.FailedRuns))

	lines = append(lines, "# HELP pipeline_runs_cancelled_total Total cancelled runs")
	lines = append(lines, "# TYPE pipeline_runs_cancelled_total counter")
	lines = append(lines, fmt.Sprintf("pipeline_runs_cancelled_total %d", m.CancelledRuns))

	// Gauges
	lines = append(lines, "# HELP pipeline_success_rate Success rate (0-1)")
	lines = append(lines, "# TYPE pipeline_success_rate gauge")
	lines = append(lines, fmt.Sprintf("pipeline_success_rate %.4f", m.SuccessRate))

	lines = append(lines, "# HELP pipeline_duration_avg_ms Average duration in ms")
	lines = append(lines, "# TYPE pipeline_duration_avg_ms gauge")
	lines = append(lines, fmt.Sprintf("pipeline_duration_avg_ms %.2f", m.AverageDurationMs))

	lines = append(lines, "# HELP pipeline_duration_median_ms Median duration in ms")
	lines = append(lines, "# TYPE pipeline_duration_median_ms gauge")
	lines = append(lines, fmt.Sprintf("pipeline_duration_median_ms %d", m.MedianDurationMs))

	lines = append(lines, "# HELP pipeline_duration_p95_ms P95 duration in ms")
	lines = append(lines, "# TYPE pipeline_duration_p95_ms gauge")
	lines = append(lines, fmt.Sprintf("pipeline_duration_p95_ms %d", m.P95DurationMs))

	// Duration histogram buckets (in seconds)
	buckets := []int{10, 30, 60, 300, 900, 1800, 3600}
	lines = append(lines, "# HELP pipeline_run_duration_seconds Run duration in seconds")
	lines = append(lines, "# TYPE pipeline_run_duration_seconds histogram")

	var sumMs int64
	for _, b := range buckets {
		bMs := int64(b) * 1000
		var count int
		for _, m := range s.metrics {
			if m.DurationMs > 0 && m.DurationMs <= bMs {
				count++
			}
		}
		lines = append(lines, fmt.Sprintf("pipeline_run_duration_seconds_bucket{le=\"%d\"} %d", b, count))
	}
	// +Inf bucket
	var count int
	for _, m := range s.metrics {
		if m.DurationMs > 0 {
			count++
			sumMs += m.DurationMs
		}
	}
	lines = append(lines, fmt.Sprintf("pipeline_run_duration_seconds_bucket{le=\"+Inf\"} %d", count))
	lines = append(lines, fmt.Sprintf("pipeline_run_duration_seconds_sum %.0f", float64(sumMs)/1000.0))
	lines = append(lines, fmt.Sprintf("pipeline_run_duration_seconds_count %d", count))

	// Per-pipeline metrics
	for pid, pm := range m.RunsByPipeline {
		lines = append(lines, "# HELP pipeline_runs_by_pipeline_total Runs by pipeline")
		lines = append(lines, "# TYPE pipeline_runs_by_pipeline_total counter")
		lines = append(lines, fmt.Sprintf("pipeline_runs_by_pipeline_total{pipeline_id=\"%s\"} %d", pid, pm.Total))
		lines = append(lines, "# HELP pipeline_runs_by_pipeline_success Successful runs by pipeline")
		lines = append(lines, "# TYPE pipeline_runs_by_pipeline_success counter")
		lines = append(lines, fmt.Sprintf("pipeline_runs_by_pipeline_success{pipeline_id=\"%s\"} %d", pid, pm.Success))
		lines = append(lines, "# HELP pipeline_runs_by_pipeline_avg_duration_ms Avg duration by pipeline")
		lines = append(lines, "# TYPE pipeline_runs_by_pipeline_avg_duration_ms gauge")
		lines = append(lines, fmt.Sprintf("pipeline_runs_by_pipeline_avg_duration_ms{pipeline_id=\"%s\"} %.2f", pid, pm.AvgDurationMs))
	}

	// By trigger type
	for tt, c := range m.RunsByTriggerType {
		lines = append(lines, "# HELP pipeline_runs_by_trigger_type Runs by trigger type")
		lines = append(lines, "# TYPE pipeline_runs_by_trigger_type counter")
		lines = append(lines, fmt.Sprintf("pipeline_runs_by_trigger_type{trigger_type=\"%s\"} %d", tt, c))
	}

	// By error type
	for et, c := range m.FailuresByErrorType {
		lines = append(lines, "# HELP pipeline_failures_by_error_type Failures by error type")
		lines = append(lines, "# TYPE pipeline_failures_by_error_type counter")
		lines = append(lines, fmt.Sprintf("pipeline_failures_by_error_type{error_type=\"%s\"} %d", et, c))
	}

	return strings.Join(lines, "\n") + "\n"
}

// Clear clears all stored metrics (useful for testing).
func (s *MetricsService) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.metrics = make([]RunMetric, 0)
}

// CleanupExpired removes metrics older than maxAgeHours.
func (s *MetricsService) CleanupExpired() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-time.Duration(s.maxAgeHours) * time.Hour)
	filtered := make([]RunMetric, 0, len(s.metrics))
	for _, m := range s.metrics {
		if m.CompletedAt.After(cutoff) {
			filtered = append(filtered, m)
		}
	}
	s.metrics = filtered
}

// aggregateMetrics builds a PipelineMetric from the raw metrics slice.
func (s *MetricsService) aggregateMetrics(metrics []RunMetric) PipelineMetric {
	m := PipelineMetric{
		FailuresByErrorType: make(map[string]int),
		RunsByPipeline:      make(map[string]PipelineRunMetric),
		RunsByTriggerType:   make(map[string]int),
		LastUpdated:         time.Now(),
	}

	var durations []int64

	for _, rm := range metrics {
		m.TotalRuns++

		switch rm.Status {
		case models.StatusSuccess:
			m.SuccessRuns++
		case models.StatusFailed:
			m.FailedRuns++
			m.FailuresByErrorType[rm.ErrorType]++
		case models.StatusCancelled:
			m.CancelledRuns++
		case models.StatusRunning:
			m.RunningRuns++
		case models.StatusPending:
			m.PendingRuns++
		}

		if rm.DurationMs > 0 {
			durations = append(durations, rm.DurationMs)
		}

		// Per-pipeline
		pm := m.RunsByPipeline[rm.PipelineID]
		pm.Total++
		if rm.Status == models.StatusSuccess {
			pm.Success++
		}
		pm.AvgDurationMs += float64(rm.DurationMs)
		m.RunsByPipeline[rm.PipelineID] = pm

		// Per trigger type
		m.RunsByTriggerType[rm.TriggerType]++
	}

	// Finalize averages per pipeline
	for pid := range m.RunsByPipeline {
		pm := m.RunsByPipeline[pid]
		if pm.Total > 0 {
			pm.AvgDurationMs /= float64(pm.Total)
		}
		m.RunsByPipeline[pid] = pm
	}

	m.SuccessRate = m.computeSuccessRate()
	m.AverageDurationMs = m.computeAvgDuration(durations)
	m.MedianDurationMs = m.computeMedian(durations)
	m.P95DurationMs = m.computeP95(durations)

	return m
}

func (m *PipelineMetric) computeSuccessRate() float64 {
	if m.TotalRuns == 0 {
		return 0
	}
	return float64(m.SuccessRuns) / float64(m.TotalRuns)
}

func (m *PipelineMetric) computeAvgDuration(durations []int64) float64 {
	if len(durations) == 0 {
		return 0
	}
	var sum int64
	for _, d := range durations {
		sum += d
	}
	return float64(sum) / float64(len(durations))
}

func (m *PipelineMetric) computeMedian(durations []int64) int64 {
	if len(durations) == 0 {
		return 0
	}
	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})
	mid := len(durations) / 2
	if len(durations)%2 == 0 {
		return (durations[mid-1] + durations[mid]) / 2
	}
	return durations[mid]
}

func (m *PipelineMetric) computeP95(durations []int64) int64 {
	if len(durations) == 0 {
		return 0
	}
	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})
	idx := int(float64(len(durations)) * 0.95)
	if idx >= len(durations) {
		idx = len(durations) - 1
	}
	return durations[idx]
}

// classifyError maps an error context string to a categorized error type.
func (s *MetricsService) classifyError(errMsg string) string {
	lower := strings.ToLower(errMsg)
	if strings.Contains(lower, "timeout") {
		return "timeout"
	}
	if strings.Contains(lower, "permission") || strings.Contains(lower, "unauthorized") || strings.Contains(lower, "forbidden") {
		return "permission"
	}
	if strings.Contains(lower, "not found") {
		return "not_found"
	}
	if strings.Contains(lower, "network") || strings.Contains(lower, "connection") {
		return "network"
	}
	if strings.Contains(lower, "syntax") || strings.Contains(lower, "compilation") {
		return "compilation"
	}
	if strings.Contains(lower, "cancelled") {
		return "cancelled"
	}
	return "unknown"
}
