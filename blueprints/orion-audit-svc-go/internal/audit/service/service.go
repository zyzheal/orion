package service

import (
	"context"
	"github.com/orion/audit-svc/internal/audit/repository"
)

type AuditService interface {
	ListLogs(ctx context.Context, page, size int) (interface{}, int64, error)
	CreateLog(ctx context.Context, action, resource, detail string) error
	GetLog(ctx context.Context, id string) (interface{}, error)
	SearchLogs(ctx context.Context, query string) (interface{}, error)
	ListComplianceChecks(ctx context.Context) (interface{}, error)
	RunComplianceCheck(ctx context.Context, checkType, target string) (interface{}, error)
}

type auditServiceImpl struct {
	Repo repository.AuditRepository
}

func NewAuditService(repo repository.AuditRepository) AuditService {
	return &auditServiceImpl{Repo: repo}
}

func (s *auditServiceImpl) ListLogs(ctx context.Context, page, size int) (interface{}, int64, error) {
	return s.Repo.ListLogs(ctx, page, size)
}

func (s *auditServiceImpl) CreateLog(ctx context.Context, action, resource, detail string) error {
	return s.Repo.CreateLog(ctx, action, resource, detail)
}

func (s *auditServiceImpl) GetLog(ctx context.Context, id string) (interface{}, error) {
	return s.Repo.GetLog(ctx, id)
}

func (s *auditServiceImpl) SearchLogs(ctx context.Context, query string) (interface{}, error) {
	return s.Repo.SearchLogs(ctx, query)
}

func (s *auditServiceImpl) ListComplianceChecks(ctx context.Context) (interface{}, error) {
	return s.Repo.ListComplianceChecks(ctx)
}

func (s *auditServiceImpl) RunComplianceCheck(ctx context.Context, checkType, target string) (interface{}, error) {
	return s.Repo.RunComplianceCheck(ctx, checkType, target)
}
