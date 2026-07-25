package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"orion/platform-svc-go/internal/monitoring/internal/monitoring/models"
	"go.uber.org/zap"
)

type MonitoringService struct {
	prometheusURL string
	httpClient    *http.Client
	logger        *zap.Logger
	predefined    map[string]*models.PredefinedMetric
}

func NewMonitoringService(prometheusURL string, logger *zap.Logger) *MonitoringService {
	s := &MonitoringService{
		prometheusURL: prometheusURL,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		logger:        logger,
		predefined:    make(map[string]*models.PredefinedMetric),
	}
	s.initPredefinedMetrics()
	return s
}

func (s *MonitoringService) initPredefinedMetrics() {
	s.predefined = map[string]*models.PredefinedMetric{
		"cpu":           {ID: "cpu", Name: "CPU Usage", Description: "Rate of process CPU seconds", PromQL: "rate(process_cpu_seconds_total[5m])"},
		"memory":        {ID: "memory", Name: "Memory Usage", Description: "Process resident memory bytes", PromQL: "process_resident_memory_bytes"},
		"requests":      {ID: "requests", Name: "Request Rate", Description: "Rate of HTTP requests", PromQL: "rate(http_requests_total[5m])"},
		"errors":        {ID: "errors", Name: "Error Rate", Description: "Rate of 5xx errors", PromQL: "rate(http_requests_total{status=~\"5..\"}[5m])"},
		"latency_p95":   {ID: "latency_p95", Name: "P95 Latency", Description: "95th percentile latency", PromQL: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"},
		"latency_p99":   {ID: "latency_p99", Name: "P99 Latency", Description: "99th percentile latency", PromQL: "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"},
		"up":            {ID: "up", Name: "Target Up", Description: "Target availability", PromQL: "up"},
		"goroutines":    {ID: "goroutines", Name: "Goroutines", Description: "Number of goroutines", PromQL: "go_goroutines"},
		"memory_heap":   {ID: "memory_heap", Name: "Heap Memory", Description: "Heap memory usage", PromQL: "go_memstats_alloc_bytes"},
		"gc_pause":      {ID: "gc_pause", Name: "GC Pause", Description: "GC pause time", PromQL: "rate(go_gc_duration_seconds_sum[5m]) / rate(go_gc_duration_seconds_count[5m])"},
		"disk_usage":    {ID: "disk_usage", Name: "Disk Usage", Description: "Disk usage percentage", PromQL: "node_filesystem_avail_bytes / node_filesystem_size_bytes * 100"},
		"network_in":    {ID: "network_in", Name: "Network In", Description: "Network bytes received", PromQL: "rate(node_network_receive_bytes_total[5m])"},
	}
}

// Query performs an instant query.
func (s *MonitoringService) Query(ctx context.Context, req *models.PrometheusQueryRequest) (*models.PrometheusResponse, error) {
	promQL := req.Query

	// Check if it's a predefined metric ID
	if m, ok := s.predefined[promQL]; ok {
		promQL = m.PromQL
	}

	params := url.Values{}
	params.Set("query", promQL)
	if req.Time != "" {
		params.Set("time", req.Time)
	}

	url := fmt.Sprintf("%s/api/v1/query?%s", s.prometheusURL, params.Encode())
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create query request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to query prometheus",
			zap.String("query", promQL),
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		s.logger.Error("failed to parse prometheus response",
			zap.String("body", string(body[:100])),
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: "invalid prometheus response"}, nil
	}

	s.logger.Info("prometheus query completed",
		zap.String("query", promQL),
		zap.String("status", result.Status),
	)
	return &result, nil
}

// QueryRange performs a range query.
func (s *MonitoringService) QueryRange(ctx context.Context, req *models.PrometheusRangeQueryRequest) (*models.PrometheusResponse, error) {
	params := url.Values{}
	params.Set("query", req.Query)
	params.Set("start", req.Start)
	params.Set("end", req.End)
	if req.Step != "" {
		params.Set("step", req.Step)
	}

	url := fmt.Sprintf("%s/api/v1/query_range?%s", s.prometheusURL, params.Encode())
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create range query request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to query prometheus range",
			zap.String("query", req.Query),
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse prometheus response: %w", err)
	}

	s.logger.Info("prometheus range query completed",
		zap.String("query", req.Query),
		zap.String("status", result.Status),
	)
	return &result, nil
}

// GetTargets returns Prometheus scrape targets.
func (s *MonitoringService) GetTargets(ctx context.Context) (*models.PrometheusResponse, error) {
	url := fmt.Sprintf("%s/api/v1/targets", s.prometheusURL)
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create targets request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to get prometheus targets",
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse prometheus response: %w", err)
	}
	return &result, nil
}

// GetAlerts returns Prometheus alerts.
func (s *MonitoringService) GetAlerts(ctx context.Context) (*models.PrometheusResponse, error) {
	url := fmt.Sprintf("%s/api/v1/alerts", s.prometheusURL)
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create alerts request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to get prometheus alerts",
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse prometheus response: %w", err)
	}
	return &result, nil
}

// ListPredefined returns all predefined metrics.
func (s *MonitoringService) ListPredefined() []models.PredefinedMetric {
	var metrics []models.PredefinedMetric
	for _, m := range s.predefined {
		metrics = append(metrics, *m)
	}
	return metrics
}

// GetPredefined returns a predefined metric by ID.
func (s *MonitoringService) GetPredefined(id string) (*models.PredefinedMetric, error) {
	if m, ok := s.predefined[id]; ok {
		return m, nil
	}
	return nil, fmt.Errorf("predefined metric not found: %s", id)
}

// GetMetrics returns available metrics from Prometheus.
func (s *MonitoringService) GetMetrics(ctx context.Context) (*models.PrometheusResponse, error) {
	url := fmt.Sprintf("%s/api/v1/label/__name__/values", s.prometheusURL)
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create metrics request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to get prometheus metrics",
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse prometheus response: %w", err)
	}
	return &result, nil
}

// GetSeries returns time series data for a metric.
func (s *MonitoringService) GetSeries(ctx context.Context, metricName string, limit, offset int) (*models.PrometheusResponse, error) {
	params := url.Values{}
	params.Set("match[]", metricName)
	params.Set("limit", fmt.Sprintf("%d", limit))
	params.Set("offset", fmt.Sprintf("%d", offset))

	url := fmt.Sprintf("%s/api/v1/series?%s", s.prometheusURL, params.Encode())
	req2, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create series request: %w", err)
	}

	resp, err := s.httpClient.Do(req2)
	if err != nil {
		s.logger.Error("failed to get prometheus series",
			zap.String("metric", metricName),
			zap.Error(err),
		)
		return &models.PrometheusResponse{Status: "error", Error: err.Error()}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result models.PrometheusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse prometheus response: %w", err)
	}
	return &result, nil
}

// GetSummary returns metric summary statistics.
func (s *MonitoringService) GetSummary(ctx context.Context, metricName string) (*models.PrometheusResponse, error) {
	// Use promql to get summary statistics
	query := fmt.Sprintf("histogram_quantile(0.50, rate(%s_bucket[5m]))", metricName)
	req := &models.PrometheusQueryRequest{Query: query}
	p50, err := s.Query(ctx, req)
	if err != nil {
		return nil, err
	}

	query95 := fmt.Sprintf("histogram_quantile(0.95, rate(%s_bucket[5m]))", metricName)
	req95 := &models.PrometheusQueryRequest{Query: query95}
	p95, err := s.Query(ctx, req95)
	if err != nil {
		return nil, err
	}

	return &models.PrometheusResponse{
		Status: "success",
		Data: map[string]interface{}{
			"p50": p50.Data,
			"p95": p95.Data,
		},
	}, nil
}
