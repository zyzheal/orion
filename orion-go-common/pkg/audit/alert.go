package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// SecurityAlertType categorizes security alerts.
type SecurityAlertType string

const (
	AlertTypePermissionDenial  SecurityAlertType = "permission_denial"
	AlertTypePrivilegeEscalation SecurityAlertType = "privilege_escalation"
	AlertTypeAnomalousBehavior SecurityAlertType = "anomalous_behavior"
	AlertTypeChainIntegrity    SecurityAlertType = "chain_integrity"
	AlertTypeCrossTenant       SecurityAlertType = "cross_tenant"
)

// SecurityAlert represents a security alert to be sent to the notification service.
type SecurityAlert struct {
	ID          string            `json:"id"`
	Type        SecurityAlertType `json:"type"`
	Severity    AlertSeverity     `json:"severity"`
	TenantID    string            `json:"tenant_id"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	UserID      string            `json:"user_id,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AlertNotifier sends security alerts to external systems.
type AlertNotifier interface {
	// Notify sends a security alert.
	Notify(ctx context.Context, alert SecurityAlert) error
}

// NotificationServiceNotifier sends alerts via the notification service.
type NotificationServiceNotifier struct {
	endpoint string
	apiKey   string
}

// NewNotificationServiceNotifier creates a notifier that sends to the notification-svc.
func NewNotificationServiceNotifier(endpoint, apiKey string) *NotificationServiceNotifier {
	return &NotificationServiceNotifier{
		endpoint: endpoint,
		apiKey:   apiKey,
	}
}

// Notify sends an alert to the notification service.
func (n *NotificationServiceNotifier) Notify(ctx context.Context, alert SecurityAlert) error {
	// In production, this would make an HTTP POST to the notification service.
	// For now, we serialize and log the alert.
	_, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert: %w", err)
	}
	// TODO: HTTP POST to n.endpoint with alert body
	return nil
}

// LogNotifier writes alerts to a logger (for development/testing).
type LogNotifier struct {
	alerts []SecurityAlert
}

// NewLogNotifier creates a notifier that stores alerts in memory.
func NewLogNotifier() *LogNotifier {
	return &LogNotifier{}
}

// Notify stores the alert in memory.
func (l *LogNotifier) Notify(ctx context.Context, alert SecurityAlert) error {
	l.alerts = append(l.alerts, alert)
	return nil
}

// GetAlerts returns all stored alerts.
func (l *LogNotifier) GetAlerts() []SecurityAlert {
	return l.alerts
}

// AlertRouter routes UEBA alerts to the notification system.
type AlertRouter struct {
	notifiers []AlertNotifier
}

// NewAlertRouter creates a new alert router.
func NewAlertRouter(notifiers ...AlertNotifier) *AlertRouter {
	return &AlertRouter{notifiers: notifiers}
}

// Route converts a UEBA alert to a security alert and sends it.
func (r *AlertRouter) Route(ctx context.Context, uebaAlert UEBAAlert) {
	secAlert := SecurityAlert{
		ID:          fmt.Sprintf("sec_%s_%d", uebaAlert.TenantID, time.Now().UnixNano()),
		Type:        mapUEBAToAlertType(uebaAlert.RuleID),
		Severity:    uebaAlert.Severity,
		TenantID:    uebaAlert.TenantID,
		Title:       uebaAlert.RuleName,
		Description: uebaAlert.Detail,
		UserID:      uebaAlert.UserID,
		Timestamp:   uebaAlert.Timestamp,
		Metadata:    uebaAlert.Metadata,
	}

	for _, n := range r.notifiers {
		_ = n.Notify(ctx, secAlert)
	}
}

// mapUEBAToAlertType maps UEBA rule IDs to alert types.
func mapUEBAToAlertType(ruleID string) SecurityAlertType {
	switch ruleID {
	case "excessive-denials":
		return AlertTypePermissionDenial
	case "privilege-escalation-attempt":
		return AlertTypePrivilegeEscalation
	case "unusual-resource-access", "off-hours-access", "brute-force-permission":
		return AlertTypeAnomalousBehavior
	case "cross-tenant-attempt":
		return AlertTypeCrossTenant
	default:
		return AlertTypeAnomalousBehavior
	}
}
