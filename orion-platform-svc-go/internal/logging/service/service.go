// Package service provides centralized log ingestion and query capabilities.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/logging/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Insert(ctx context.Context, m *models.LogEntry) error
	InsertBatch(ctx context.Context, entries []*models.LogEntry) error
	GetByID(ctx context.Context, tenantID, id string) (*models.LogEntry, error)
	FindByTraceID(ctx context.Context, tenantID, traceID string) ([]models.LogEntry, error)
	Query(ctx context.Context, q *models.LogQuery) ([]models.LogEntry, int64, error)
	Aggregation(ctx context.Context, q *models.LogQuery) (*models.LogAggregation, error)
	DeleteByTime(ctx context.Context, tenantID string, before time.Time) (int64, error)
}

// RetentionDays is the default log retention period.
const RetentionDays = 30

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Ingest creates a single log entry.
func (s *Service) Ingest(ctx context.Context, tenantID string, req models.IngestLogRequest) (*models.LogEntry, error) {
	meta, _ := json.Marshal(req.Metadata)
	entry := &models.LogEntry{
		TenantID:  tenantID,
		Service:   req.Service,
		Level:     req.Level,
		Message:   req.Message,
		Timestamp: time.Now().UTC(),
		TraceID:   req.TraceID,
		Metadata:  meta,
	}
	if req.Timestamp != nil {
		entry.Timestamp = *req.Timestamp
	}
	if err := s.repo.Insert(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

// IngestBatch creates multiple log entries atomically.
func (s *Service) IngestBatch(ctx context.Context, tenantID string, requests []models.IngestLogRequest) (int, error) {
	if len(requests) == 0 {
		return 0, nil
	}
	entries := make([]*models.LogEntry, 0, len(requests))
	for i := range requests {
		req := &requests[i]
		meta, _ := json.Marshal(req.Metadata)
		entry := &models.LogEntry{
			TenantID:  tenantID,
			Service:   req.Service,
			Level:     req.Level,
			Message:   req.Message,
			Timestamp: time.Now().UTC(),
			TraceID:   req.TraceID,
			Metadata:  meta,
		}
		if req.Timestamp != nil {
			entry.Timestamp = *req.Timestamp
		}
		entries = append(entries, entry)
	}
	if err := s.repo.InsertBatch(ctx, entries); err != nil {
		return 0, err
	}
	return len(entries), nil
}

// GetByTrace retrieves all log entries for a trace ID.
func (s *Service) GetByTrace(ctx context.Context, tenantID, traceID string) ([]models.LogEntry, error) {
	return s.repo.FindByTraceID(ctx, tenantID, traceID)
}

// Query searches log entries with filtering and pagination.
func (s *Service) Query(ctx context.Context, q *models.LogQuery) ([]models.LogEntry, int64, error) {
	if q.TenantID == "" {
		return nil, 0, errors.New("tenantId is required")
	}
	return s.repo.Query(ctx, q)
}

// Search performs a keyword search across log messages.
func (s *Service) Search(ctx context.Context, tenantID string, keywords []string) ([]models.LogEntry, error) {
	q := &models.LogQuery{
		TenantID: tenantID,
		Keywords: keywords,
	}
	entries, _, err := s.repo.Query(ctx, q)
	return entries, err
}

// Aggregation returns aggregated statistics for a query.
func (s *Service) Aggregation(ctx context.Context, q *models.LogQuery) (*models.LogAggregation, error) {
	if q.TenantID == "" {
		return nil, errors.New("tenantId is required")
	}
	return s.repo.Aggregation(ctx, q)
}

// CleanupOld deletes log entries older than the retention period.
func (s *Service) CleanupOld(ctx context.Context, tenantID string) (int64, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -RetentionDays)
	return s.repo.DeleteByTime(ctx, tenantID, cutoff)
}
