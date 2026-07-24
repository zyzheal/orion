package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/middleware-ops/models"
	"orion/platform-svc-go/internal/infrastructure/middleware-ops/repository"

	"github.com/google/uuid"
)

var (
	ErrInstanceNotFound = errors.New("middleware instance not found")
	ErrBackupNotFound   = errors.New("backup record not found")
)

// Service holds all repositories and implements the business logic layer.
type Service struct {
	instanceRepo *repository.InstanceRepository
	backupRepo   *repository.BackupRepository
	metricRepo   *repository.MetricRepository
	connPoolRepo *repository.ConnectionPoolRepository
	mqStatsRepo  *repository.MqStatsRepository
	alertRepo    *repository.AlertRepository
}

func NewService(
	instanceRepo *repository.InstanceRepository,
	backupRepo *repository.BackupRepository,
	metricRepo *repository.MetricRepository,
	connPoolRepo *repository.ConnectionPoolRepository,
	mqStatsRepo *repository.MqStatsRepository,
	alertRepo *repository.AlertRepository,
) *Service {
	return &Service{
		instanceRepo: instanceRepo,
		backupRepo:   backupRepo,
		metricRepo:   metricRepo,
		connPoolRepo: connPoolRepo,
		mqStatsRepo:  mqStatsRepo,
		alertRepo:    alertRepo,
	}
}

// ---- Instance CRUD ----

func (s *Service) CreateInstance(ctx context.Context, tenantID string, req *models.CreateInstanceRequest) (*models.MiddlewareInstance, error) {
	inst := &models.MiddlewareInstance{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Version:  req.Version,
		Host:     req.Host,
		Port:     req.Port,
		Status:   models.StatusHealthy,
		Config:   req.Config,
		Labels:   req.Labels,
	}
	if err := s.instanceRepo.Create(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

func (s *Service) ListInstances(ctx context.Context, tenantID string, offset, limit int, typeFilter, statusFilter string) ([]models.MiddlewareInstance, error) {
	return s.instanceRepo.List(ctx, tenantID, offset, limit, typeFilter, statusFilter)
}

func (s *Service) GetInstance(ctx context.Context, tenantID, id string) (*models.MiddlewareInstance, error) {
	return s.instanceRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdateInstance(ctx context.Context, tenantID, id string, req *models.CreateInstanceRequest) (*models.MiddlewareInstance, error) {
	inst, err := s.instanceRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrInstanceNotFound
	}
	inst.Name = req.Name
	inst.Type = req.Type
	inst.Version = req.Version
	inst.Host = req.Host
	inst.Port = req.Port
	inst.Config = req.Config
	inst.Labels = req.Labels
	if err := s.instanceRepo.Update(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

func (s *Service) DeleteInstance(ctx context.Context, tenantID, id string) error {
	return s.instanceRepo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.instanceRepo.Count(ctx, tenantID)
}

// ---- Backup ----

func (s *Service) CreateBackup(ctx context.Context, tenantID string, req *models.CreateBackupRequest) (*models.BackupRecord, error) {
	rec := &models.BackupRecord{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		InstanceID: req.InstanceID,
		Status:     "running",
		StartedAt:  time.Now(),
	}
	if err := s.backupRepo.Create(ctx, rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func (s *Service) ListBackupsByInstance(ctx context.Context, tenantID, instanceID string) ([]models.BackupRecord, error) {
	return s.backupRepo.ListByInstance(ctx, tenantID, instanceID)
}

// ---- Metrics ----

func (s *Service) RecordMetric(ctx context.Context, tenantID string, req *models.CreateMetricRequest) (*models.MiddlewareMetric, error) {
	m := &models.MiddlewareMetric{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		MiddlewareID: req.MiddlewareID,
		MetricName:   req.MetricName,
		Value:        req.Value,
		Unit:         req.Unit,
	}
	if err := s.metricRepo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) ListMetrics(ctx context.Context, tenantID string, offset, limit int, middlewareID, metricName string) ([]models.MiddlewareMetric, error) {
	return s.metricRepo.List(ctx, tenantID, offset, limit, middlewareID, metricName)
}

// ---- Connection Pools ----

// RecordConnectionPool records a connection pool snapshot and auto-creates an
// alert when pool utilization reaches 90% or above.
func (s *Service) RecordConnectionPool(ctx context.Context, tenantID string, req *models.CreateConnectionPoolRequest) (*models.ConnectionPool, error) {
	pool := &models.ConnectionPool{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		MiddlewareID: req.MiddlewareID,
		PoolName:     req.PoolName,
		Active:       req.Active,
		Idle:         req.Idle,
		Max:          req.Max,
		Waiting:      req.Waiting,
		TotalCreated: int64(req.Active + req.Idle),
		TotalClosed:  0,
	}
	if err := s.connPoolRepo.Create(ctx, pool); err != nil {
		return nil, err
	}

	// Check for connection pool exhaustion (port of Node.js auto-alert logic)
	if req.Max > 0 {
		utilization := (float64(req.Active) / float64(req.Max)) * 100
		if utilization >= 90 {
			instance, err := s.instanceRepo.GetByID(ctx, tenantID, req.MiddlewareID)
			if err == nil && instance != nil {
				alert := &models.MiddlewareAlert{
					ID:             uuid.New().String(),
					TenantID:       tenantID,
					MiddlewareID:   req.MiddlewareID,
					MiddlewareName: instance.Name,
					AlertType:      models.AlertTypeConnPoolExhaustion,
					Severity:       models.SeverityCritical,
					Message:        fmt.Sprintf("连接池 %s 使用率达 %.0f%%", req.PoolName, utilization),
					Value:          utilization,
					Threshold:      90,
				}
				// Best-effort alert creation; log but don't fail the pool record.
				_ = s.alertRepo.Create(ctx, alert)
			}
		}
	}

	return pool, nil
}

func (s *Service) ListConnectionPools(ctx context.Context, tenantID string, offset, limit int, middlewareID string) ([]models.ConnectionPool, error) {
	return s.connPoolRepo.List(ctx, tenantID, offset, limit, middlewareID)
}

// ---- Message Queue Stats ----

// RecordMqStats records message queue statistics and auto-creates an alert
// when the queue backlog exceeds 10,000 messages (>50,000 is critical).
func (s *Service) RecordMqStats(ctx context.Context, tenantID string, req *models.CreateMqStatsRequest) (*models.MessageQueueStats, error) {
	stats := &models.MessageQueueStats{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		MiddlewareID:      req.MiddlewareID,
		QueueName:         req.QueueName,
		MessageCount:      req.MessageCount,
		ConsumerCount:     req.ConsumerCount,
		MessagesPerSecond: req.MessagesPerSecond,
		AvgLatencyMs:      req.AvgLatencyMs,
		DeadLetterCount:   req.DeadLetterCount,
	}
	if err := s.mqStatsRepo.Create(ctx, stats); err != nil {
		return nil, err
	}

	// Check for queue backlog (port of Node.js auto-alert logic)
	if req.MessageCount > 10000 {
		instance, err := s.instanceRepo.GetByID(ctx, tenantID, req.MiddlewareID)
		if err == nil && instance != nil {
			severity := models.SeverityWarning
			if req.MessageCount > 50000 {
				severity = models.SeverityCritical
			}
			alert := &models.MiddlewareAlert{
				ID:             uuid.New().String(),
				TenantID:       tenantID,
				MiddlewareID:   req.MiddlewareID,
				MiddlewareName: instance.Name,
				AlertType:      models.AlertTypeQueueBacklog,
				Severity:       severity,
				Message:        fmt.Sprintf("消息队列 %s 积压 %d 条", req.QueueName, req.MessageCount),
				Value:          float64(req.MessageCount),
				Threshold:      10000,
			}
			_ = s.alertRepo.Create(ctx, alert)
		}
	}

	return stats, nil
}

func (s *Service) ListMqStats(ctx context.Context, tenantID string, offset, limit int, middlewareID string) ([]models.MessageQueueStats, error) {
	return s.mqStatsRepo.List(ctx, tenantID, offset, limit, middlewareID)
}

// ---- Alerts ----

func (s *Service) ListAlerts(ctx context.Context, tenantID string, offset, limit int, severity, alertType string) ([]models.MiddlewareAlert, error) {
	return s.alertRepo.List(ctx, tenantID, offset, limit, severity, alertType)
}

func (s *Service) DeleteAlert(ctx context.Context, tenantID, id string) error {
	return s.alertRepo.Delete(ctx, tenantID, id)
}

// ---- Health Summary ----

// GetHealthSummary computes the overall health score for a tenant's middleware
// fleet. The formula matches the Node.js implementation:
//
//	healthScore = (healthy*100 + degraded*50) / total, default 100 when empty.
func (s *Service) GetHealthSummary(ctx context.Context, tenantID string) (*models.HealthSummary, error) {
	hc, err := s.instanceRepo.HealthCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	ac, err := s.alertRepo.AlertCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	healthScore := 100
	if hc.Total > 0 {
		healthScore = (hc.Healthy*100 + hc.Degraded*50) / hc.Total
	}

	return &models.HealthSummary{
		TotalInstances: hc.Total,
		HealthyCount:   hc.Healthy,
		DegradedCount:  hc.Degraded,
		UnhealthyCount: hc.Unhealthy,
		TotalAlerts:    ac.Total,
		CriticalAlerts: ac.Critical,
		HealthScore:    healthScore,
	}, nil
}
