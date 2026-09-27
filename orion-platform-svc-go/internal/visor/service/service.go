package service

import (
	"errors"

	internalrepo "orion/platform-svc-go/internal/visor/internal/repository"
	internalsvc "orion/platform-svc-go/internal/visor/internal/service"
)

// Service re-exports the internal visor service implementation.
type Service = internalsvc.Service

// MetricAggregation and AnomalyResult are derived read models computed inside
// the service rather than persisted rows, so they are declared in the internal
// service package instead of the models package. Re-exporting them here lets
// the handler's Service interface name them without reaching into internal/.
type (
	MetricAggregation = internalsvc.MetricAggregation
	AnomalyResult     = internalsvc.AnomalyResult
)

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
