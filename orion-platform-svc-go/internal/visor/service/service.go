package service

import (
	"errors"

	internalrepo "orion/platform-svc-go/internal/visor/internal/repository"
	internalsvc "orion/platform-svc-go/internal/visor/internal/service"
)

// Service re-exports the internal visor service implementation.
type Service = internalsvc.Service

// Sentinel errors re-exported for the handler layer.
var (
	ErrDashboardNotFound = errors.New("dashboard not found")
	ErrHostNotFound      = errors.New("host not found")
	ErrAlertRuleNotFound = errors.New("alert rule not found")
	ErrChannelNotFound   = errors.New("channel not found")
	ErrMetricNotFound    = errors.New("metric not found")
)

// NewService creates a new Service and wraps the internal implementation.
func NewService(repo *internalrepo.Repository) *Service {
	return internalsvc.NewService(repo)
}
