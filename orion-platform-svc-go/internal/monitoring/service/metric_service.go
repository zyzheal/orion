package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"runtime"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
)

// --- Metrics --------------------------------------------------------

func (s *Service) CreateMetric(ctx context.Context, tenantID string, req models.CreateMetricRequest) (*models.Metric, error) {
	m := &models.Metric{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Unit:     req.Unit,
		Labels:   req.Labels,
		Help:     req.Help,
		Enabled:  true,
	}
	if err := s.repo.CreateMetric(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) RecordMetric(ctx context.Context, tenantID string, req models.RecordMetricRequest) error {
	return s.repo.RecordMetric(ctx, tenantID, req)
}

func (s *Service) GetRegisteredMetrics(ctx context.Context, tenantID string, limit, offset int) ([]models.Metric, error) {
	return s.repo.ListMetrics(ctx, tenantID, limit, offset)
}

func (s *Service) GetMetricSeries(ctx context.Context, tenantID, name string, since *time.Time, until *time.Time, limit int) (*models.MetricSeries, error) {
	points, err := s.repo.GetMetricSeries(ctx, tenantID, name, since, until, limit)
	if err != nil {
		return nil, err
	}
	return &models.MetricSeries{Name: name, Points: points}, nil
}

func (s *Service) GetMetricSummary(ctx context.Context, tenantID, name string, since *time.Time, until *time.Time) (*models.MetricSummary, error) {
	return s.repo.GetMetricSummary(ctx, tenantID, name, since, until)
}

// --- Anomalies ------------------------------------------------------

// DetectAnomalies scans every registered metric for statistical outliers using
// the z-score method (|z| > 3) and persists newly detected anomalies.
//
// The algorithm:
//  1. Fetch the last 30 data points for each enabled metric.
//  2. Compute mean and standard deviation.
//  3. For the most recent point, compute the z-score.
//  4. If |z| > 3, classify severity and create an anomaly record.
//
// Returns persisted anomalies ordered by detection time.
func (s *Service) DetectAnomalies(ctx context.Context, tenantID string, limit, offset int) ([]models.Anomaly, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	metrics, err := s.repo.ListMetrics(ctx, tenantID, 200, 0)
	if err != nil {
		return nil, fmt.Errorf("detect anomalies: list metrics: %w", err)
	}

	for _, m := range metrics {
		if !m.Enabled {
			continue
		}
		series, err := s.repo.GetMetricSeries(ctx, tenantID, m.Name, nil, nil, 30)
		if err != nil || len(series) < 2 {
			// Need at least 2 points to compute a baseline.
			continue
		}
		anomaly := detectAnomalyForMetric(tenantID, m.Name, series)
		if anomaly != nil {
			if createErr := s.repo.CreateAnomaly(ctx, anomaly); createErr != nil {
				// Non-fatal: one metric failing does not abort the batch.
				_ = createErr
			}
		}
	}

	return s.repo.ListAnomalies(ctx, tenantID, limit, offset)
}

// detectAnomalyForMetric applies z-score anomaly detection to a metric series.
// Returns an Anomaly when the latest point is an outlier; nil otherwise.
func detectAnomalyForMetric(tenantID, metricName string, series []models.MetricSeriesPoint) *models.Anomaly {
	if len(series) < 2 {
		return nil
	}

	// Compute mean and standard deviation.
	n := len(series)
	var sum float64
	for i := 0; i < n; i++ {
		sum += series[i].Value
	}
	mean := sum / float64(n)
	var variance float64
	for i := 0; i < n; i++ {
		diff := series[i].Value - mean
		variance += diff * diff
	}
	stdDev := math.Sqrt(variance / float64(n))

	latest := series[n-1]
	if stdDev == 0 {
		// No variance means no anomaly possible.
		return nil
	}

	zScore := (latest.Value - mean) / stdDev
	if math.Abs(zScore) <= 3.0 {
		return nil
	}

	severity := classifySeverity(math.Abs(zScore))

	return &models.Anomaly{
		TenantID:    tenantID,
		Metric:      metricName,
		Score:       math.Round(zScore*100) / 100,
		Baseline:    math.Round(mean*100) / 100,
		Actual:      latest.Value,
		Severity:    severity,
		Description: fmt.Sprintf("z-score %.2f (mean %.2f, stddev %.2f)", zScore, mean, stdDev),
	}
}

func classifySeverity(absZ float64) string {
	switch {
	case absZ >= 4.0:
		return "critical"
	case absZ >= 3.5:
		return "warning"
	default:
		return "info"
	}
}

// --- System Collect -------------------------------------------------

// CollectSystemMetrics gathers Go runtime and host-level metrics and stores
// them as metric data points for later querying.
//
// Metrics collected:
//   - CPU: usage percent (caller-supplied, or 0 if omitted)
//   - Memory: heap allocation in MB (from runtime.MemStats)
//   - Disk: usage percent (caller-supplied, or 0 if omitted)
//   - Goroutines: runtime.NumGoroutine
//   - Uptime: runtime since process start
//   - Hostname: os.Hostname() or caller-supplied Host
//
// If caller-supplied values are nil, zero is recorded as the data point.
func (s *Service) CollectSystemMetrics(ctx context.Context, tenantID string, req models.CollectSystemMetricsRequest) (*models.SystemMetrics, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	hostname := req.Host
	if hostname == "" {
		h, err := os.Hostname()
		if err == nil {
			hostname = h
		}
	}
	if hostname == "" {
		hostname = "unknown"
	}

	cpu := 0.0
	if req.CPU != nil {
		cpu = *req.CPU
	}
	disk := 0.0
	if req.Disk != nil {
		disk = *req.Disk
	}

	// Compute host metric values and store them as metric data points.
	metricRecords := []struct {
		name  string
		value float64
	}{
		{"cpu_usage_percent", cpu},
		{"mem_heap_mb", float64(mem.HeapAlloc) / 1024 / 1024},
		{"mem_alloc_mb", float64(mem.TotalAlloc) / 1024 / 1024},
		{"disk_usage_percent", disk},
		{"goroutines", float64(runtime.NumGoroutine())},
	}

	for _, rec := range metricRecords {
		_ = s.repo.RecordMetric(ctx, tenantID, models.RecordMetricRequest{
			Name:   "system_" + rec.name,
			Value:  math.Round(rec.value*100) / 100,
			Labels: map[string]string{"host": hostname},
		})
	}

	return &models.SystemMetrics{
		Timestamp:  time.Now().UTC(),
		Host:       hostname,
		CPU:        cpu,
		Memory:     float64(mem.HeapAlloc) / 1024 / 1024,
		Disk:       disk,
		Goroutines: runtime.NumGoroutine(),
		UptimeSec:  float64(time.Since(runtimeMetricsStartTime).Seconds()),
		HTTPReqs:   0, // populated by gateway metrics when available
		Errors:     0, // populated by gateway metrics when available
	}, nil
}
