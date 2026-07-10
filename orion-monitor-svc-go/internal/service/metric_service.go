package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/models"
	"orion/monitor-svc-go/internal/repository"
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
	return s.metricRepo.GetSeries(ctx, tenantID, metricName)
}

// GetAggregation proxies to MetricRepository.GetSummary.
func (s *MetricService) GetAggregation(ctx context.Context, tenantID uuid.UUID, metricName string, windowMs int64) (*models.MetricAggregation, error) {
	return s.metricRepo.GetSummary(ctx, tenantID, metricName, windowMs)
}
