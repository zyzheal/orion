package auditlogger

import (
	"context"

	"orion/platform-svc-go/internal/audit/models"
	audit_service "orion/platform-svc-go/internal/audit/service"
)

// AuditServiceAdapter wraps audit.Service to implement the AuditLogger
// interface. It converts AuditEntry into AuditLogCreateRequest and
// delegates to the audit service's chain-based Create method.
type AuditServiceAdapter struct {
	svc *audit_service.Service
}

// NewAuditServiceAdapter creates an AuditLogger backed by the audit
// module's Service. The audit service handles hashing, chaining, and
// persistence.
func NewAuditServiceAdapter(svc *audit_service.Service) *AuditServiceAdapter {
	return &AuditServiceAdapter{svc: svc}
}

func (a *AuditServiceAdapter) Log(ctx context.Context, entry AuditEntry) error {
	if a.svc == nil {
		return nil
	}
	req := models.AuditLogCreateRequest{
		Action:       entry.Action,
		UserID:       entry.UserID,
		TenantID:     entry.TenantID,
		Details:      entry.Details,
		ResourceType: entry.ResourceType,
		ResourceID:   entry.ResourceID,
	}
	_, err := a.svc.Create(ctx, entry.TenantID, req)
	return err
}
