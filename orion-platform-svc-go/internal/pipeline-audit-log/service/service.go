package service

import (
	"context"
	"encoding/json"
	"errors"

	"orion/platform-svc-go/internal/pipeline-audit-log/models"
	"orion/platform-svc-go/internal/pipeline-audit-log/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CleanupExpired(ctx context.Context, tenantID string, retentionDays int) (int64, error)
	GetRunAuditTrail(ctx context.Context, tenantID, runID string, limit int) (*models.AuditTrailResponse, error)
	Query(ctx context.Context, q models.AuditLogQuery) ([]models.AuditLog, int, error)
	Record(ctx context.Context, log *models.AuditLog) error
	RecordBatch(ctx context.Context, logs []*models.AuditLog) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Record creates a single audit log entry from a request.
func (s *Service) Record(ctx context.Context, req *models.AuditLogRequest, tenantID string) (*models.AuditLog, error) {
	log := toAuditLog(req, tenantID)
	if err := s.repo.Record(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

// RecordBatch creates multiple audit log entries from requests.
func (s *Service) RecordBatch(ctx context.Context, reqs []models.AuditLogRequest, tenantID string) ([]*models.AuditLog, error) {
	if len(reqs) == 0 {
		return nil, ErrEmptyBatch
	}
	logs := make([]*models.AuditLog, len(reqs))
	for i, req := range reqs {
		logs[i] = toAuditLog(&req, tenantID)
	}
	if err := s.repo.RecordBatch(ctx, logs); err != nil {
		return nil, err
	}
	return logs, nil
}

// Query retrieves filtered audit logs with pagination.
func (s *Service) Query(ctx context.Context, q *models.AuditLogQuery, tenantID string) ([]models.AuditLog, int, error) {
	q.TenantID = tenantID
	if q.Limit <= 0 {
		q.Limit = 50
	}
	if q.Offset < 0 {
		q.Offset = 0
	}
	return s.repo.Query(ctx, *q)
}

// GetRunAuditTrail retrieves the full audit trail for a pipeline run.
func (s *Service) GetRunAuditTrail(ctx context.Context, tenantID, runID string, limit int) (*models.AuditTrailResponse, error) {
	trail, err := s.repo.GetRunAuditTrail(ctx, tenantID, runID, limit)
	if err != nil {
		if repository.IsNoRows(err) {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	return trail, nil
}

// CleanupExpired deletes audit logs older than retentionDays (default 90).
func (s *Service) CleanupExpired(ctx context.Context, tenantID string, req *models.CleanupRequest) (int64, error) {
	retentionDays := 90
	if req != nil && req.RetentionDays != nil && *req.RetentionDays > 0 {
		retentionDays = *req.RetentionDays
	}
	return s.repo.CleanupExpired(ctx, tenantID, retentionDays)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func toAuditLog(req *models.AuditLogRequest, tenantID string) *models.AuditLog {
	log := &models.AuditLog{
		TenantID:      tenantID,
		RunID:         req.RunID,
		StageID:       req.StageID,
		TaskID:        req.TaskID,
		Action:        req.Action,
		Actor:         req.Actor,
		Outcome:       req.Outcome,
		DurationMS:    req.DurationMS,
		InputSummary:  req.InputSummary,
		OutputSummary: req.OutputSummary,
		ErrorMessage:  req.ErrorMessage,
	}
	// Ensure metadata is valid JSON text. If it is not parseable JSON, store as
	// a JSON string value so the column always contains valid JSON.
	if req.Metadata != nil {
		log.Metadata = *req.Metadata
		var raw interface{}
		if json.Unmarshal([]byte(*req.Metadata), &raw) != nil {
			s, _ := json.Marshal(*req.Metadata)
			log.Metadata = string(s)
		}
	}
	return log
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrEmptyBatch  = errors.New("batch logs array is required")
	ErrRunNotFound = errors.New("pipeline run not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, ErrRunNotFound)
}
