// DO NOT EDIT. Generated for handler DI.
package service

import (
	"context"
	"orion/platform-svc-go/internal/alert-escalation/models"
	"time"
)

type ServiceInterface interface {
	CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, operator string) (*models.EscalationPolicy, error)
	GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error)
	UpdatePolicy(ctx context.Context, id, tenantID string, req *models.UpdatePolicyRequest) (*models.EscalationPolicy, error)
	DeletePolicy(ctx context.Context, id, tenantID string) (bool, error)
	EvaluatePolicy(ctx context.Context, alertID, severity, tenantID string) ([]*models.EscalationTrigger, error)
	ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error)
	ResolveTrigger(ctx context.Context, id, tenantID string) (*models.EscalationTrigger, error)
	CreateAlertClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error)
	AcknowledgeAlert(ctx context.Context, alertID, tenantID, operator string) (*models.AlertClosure, error)
	ResolveAlert(ctx context.Context, req *models.ResolveRequest, tenantID string) (*models.AlertClosure, error)
	GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error)
	ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error)
	GetMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error)
	RecordMetric(ctx context.Context, tenantID string, day time.Time, stats map[string]interface{}) error
}

var _ ServiceInterface = (*Service)(nil)
