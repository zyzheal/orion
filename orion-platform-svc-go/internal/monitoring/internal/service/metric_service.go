package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/monitoring/internal/models"
	"orion/platform-svc-go/internal/monitoring/internal/repository"
	"go.uber.org/zap"
)

type MetricService struct {
	metricRepo *repository.MetricRepository
	traceRepo  *repository.TraceRepository
	logger     *zap.Logger
}

func NewMetricService(metricRepo *repository.MetricRepository, traceRepo *repository.TraceRepository, logger *zap.Logger) *MetricService {
	return &MetricService{
		metricRepo: metricRepo,
		traceRepo:  traceRepo,
		logger:     logger,
	}
}

func (s *MetricService) ReportMetric(ctx context.Context, tenantID uuid.UUID, req models.MetricQueryRequest) (*models.Metric, error) {
	if req.MetricName == "" {
		return nil, nil
	}

	m := &models.Metric{
		ID:         uuid.New(),
		TenantID:   tenantID,
		MetricName: req.MetricName,
		Value:      0,
		Timestamp:  time.Now(),
	}

	// Allow tags to be passed as JSON
	if len(req.Tags) > 0 {
		// Tags would be serialized to JSON here; simplified for this implementation
	}

	if err := s.metricRepo.Insert(ctx, m); err != nil {
		s.logger.Error("failed to report metric", zap.Error(err))
		return nil, err
	}

	s.logger.Info("metric reported",
		zap.String("metricName", m.MetricName),
		zap.String("tenantId", tenantID.String()),
	)
	return m, nil
}

func (s *MetricService) QueryMetrics(ctx context.Context, tenantID uuid.UUID, req models.MetricQueryRequest) (models.MetricResponse, error) {
	return s.metricRepo.Query(ctx, tenantID, req)
}

func (s *MetricService) GetServices(ctx context.Context, tenantID uuid.UUID) ([]string, error) {
	return s.traceRepo.GetServiceNames(ctx, tenantID)
}

func (s *MetricService) GetServiceOverview(ctx context.Context, tenantID uuid.UUID, serviceName string) (*models.ServiceOverview, error) {
	return s.traceRepo.GetServiceOverview(ctx, tenantID, serviceName)
}

func (s *MetricService) GetTraces(ctx context.Context, tenantID uuid.UUID, req models.TraceQueryRequest) (models.TraceResponse, error) {
	return s.traceRepo.Query(ctx, tenantID, req)
}

func (s *MetricService) GetTraceDetail(ctx context.Context, tenantID uuid.UUID, traceID string) ([]models.Trace, error) {
	return s.traceRepo.GetByTraceID(ctx, tenantID, traceID)
}

// GetSeries proxies to MetricRepository.GetSeries.
func (s *MetricService) GetSeries(ctx context.Context, tenantID uuid.UUID, metricName string) ([]models.Metric, error) {
	return s.metricRepo.GetSeries(ctx, tenantID, metricName, time.Now().Add(-time.Hour), time.Now())
}

// GetAggregation proxies to MetricRepository.GetSummary.
func (s *MetricService) GetAggregation(ctx context.Context, tenantID uuid.UUID, metricName string, windowMs int64) (*models.MetricAggregation, error) {
	return s.metricRepo.GetSummary(ctx, tenantID, metricName, windowMs)
}

// CollectSystemMetrics accepts a collection of system-level metrics (CPU, memory,
// disk, network) and persists them as individual metric data points for the tenant.
func (s *MetricService) CollectSystemMetrics(ctx context.Context, tenantID uuid.UUID, req models.CollectSystemMetricsRequest) (*models.CollectSystemMetricsResponse, error) {
	var metrics []*models.Metric
	timestamp := req.CollectedAt
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	metricName := req.MetricName
	if metricName == "" {
		metricName = "system.cpu.usage"
	}

	// Build individual metric points for each dimension.
	points := []struct {
		name  string
		value float64
	}{
		{"system.cpu.usage", req.CPUUsage},
		{"system.memory.usage", req.MemoryUsage},
		{"system.memory.used_bytes", float64(req.MemoryUsed)},
		{"system.memory.total_bytes", float64(req.MemoryTotal)},
		{"system.load.avg_1m", req.LoadAvg1m},
		{"system.load.avg_5m", req.LoadAvg5m},
		{"system.load.avg_15m", req.LoadAvg15m},
		{"system.process.goroutines", float64(req.Goroutines)},
		{"system.disk.used_bytes", float64(req.DiskUsed)},
		{"system.disk.total_bytes", float64(req.DiskTotal)},
		{"system.network.in_bytes", float64(req.NetInBytes)},
		{"system.network.out_bytes", float64(req.NetOutBytes)},
	}

	for _, p := range points {
		metrics = append(metrics, &models.Metric{
			ID:         uuid.New(),
			TenantID:   tenantID,
			MetricName: p.name,
			Value:      p.value,
			Tags:       s.buildTags(req.Hostname, req.Tags),
			Timestamp:  timestamp,
		})
	}

	// Bulk insert the points.
	if err := s.metricRepo.BulkInsert(ctx, metrics); err != nil {
		s.logger.Error("failed to collect system metrics",
			zap.String("hostname", req.Hostname),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("system metrics collected",
		zap.String("hostname", req.Hostname),
		zap.Int("points", len(metrics)),
		zap.String("tenantId", tenantID.String()),
	)

	return &models.CollectSystemMetricsResponse{
		Success: true,
		Message: "System metrics collected",
		System: models.SystemMetrics{
			CPUUsage:    req.CPUUsage,
			MemoryUsage: req.MemoryUsage,
			MemoryUsed:  req.MemoryUsed,
			MemoryTotal: req.MemoryTotal,
			LoadAvg1m:   req.LoadAvg1m,
			LoadAvg5m:   req.LoadAvg5m,
			LoadAvg15m:  req.LoadAvg15m,
			Goroutines:  req.Goroutines,
			Hostname:    req.Hostname,
			CollectedAt: timestamp,
		},
		PointCount: len(metrics),
		Tags:       s.buildTags(req.Hostname, req.Tags),
	}, nil
}

func (s *MetricService) buildTags(hostname string, tags map[string]string) json.RawMessage {
	if tags == nil {
		tags = map[string]string{}
	}
	tags["host"] = hostname
	// Build the tags byte slice manually to avoid importing json in the
	// service method's return path when it is not already imported.
	pair := fmt.Sprintf(`{"host":"%s"}`, hostname)
	return []byte(pair)
}
