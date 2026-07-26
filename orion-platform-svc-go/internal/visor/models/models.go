// Package models re-exports types from the internal models package.
// This bridge ensures the handler layer (which imports visor/models)
// uses the same types as the service layer (which uses visor/internal/models).
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	internalmodels "orion/platform-svc-go/internal/visor/internal/models"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// Re-exported types from internal models.
// These type aliases ensure the handler and service layers use the same types.
type (
	Dashboard              = internalmodels.Dashboard
	CreateDashboardRequest = internalmodels.CreateDashboardRequest
	UpdateDashboardRequest = internalmodels.UpdateDashboardRequest
	MonitorHost            = internalmodels.MonitorHost
	CreateHostRequest      = internalmodels.CreateHostRequest
	UpdateHostRequest      = internalmodels.UpdateHostRequest
	AlertRule              = internalmodels.AlertRule
	CreateAlertRuleRequest = internalmodels.CreateAlertRuleRequest
	UpdateAlertRuleRequest = internalmodels.UpdateAlertRuleRequest
	AlertInstance          = internalmodels.AlertInstance
	MetricDataPoint        = internalmodels.MetricDataPoint
	RecordMetricRequest    = internalmodels.RecordMetricRequest
	NotificationChannel    = internalmodels.NotificationChannel
	CreateChannelRequest   = internalmodels.CreateChannelRequest
	NotificationHistory    = internalmodels.NotificationHistory
	PaginatedRequest       = internalmodels.PaginatedRequest
	AlertStats             = internalmodels.AlertStats
	PaginatedResult        = internalmodels.PaginatedResult
)

// PaginatedResponse wraps a list result with pagination metadata.
type PaginatedResponse struct {
	Total int64       `json:"total"`
	Data  interface{} `json:"data"`
}

// Ensure compile-time compatibility.
var _ = time.Time{}
