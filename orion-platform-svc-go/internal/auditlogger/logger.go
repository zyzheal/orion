// Package auditlogger defines a lightweight interface for recording audit
// log entries from domain services. It is implemented by the audit module
// and injected into domain services that need to record mutations.
//
// The interface is deliberately minimal so domain modules don't depend on
// the full audit service package — they only need to call Log.
package auditlogger

import "context"

// AuditEntry is the minimal information a domain service needs to provide
// for an audit log record. The HTTP layer (middleware) enriches with
// IP address, user agent, request method, etc.
type AuditEntry struct {
	Action       string         // e.g. "create", "update", "delete"
	TenantID     string         // tenant scope
	UserID       string         // actor performing the action
	ResourceType string         // e.g. "rdm.requirement", "alert.sla"
	ResourceID   string         // the affected resource's ID
	Details      map[string]any // mutation-specific details (before/after, fields)
}

// AuditLogger records audit entries. Implementations may forward to the
// audit module's chain-based store, a log sink, or be a no-op.
type AuditLogger interface {
	Log(ctx context.Context, entry AuditEntry) error
}

// NoopLogger is a no-op implementation that does nothing. Useful for
// tests and as a default when no audit module is configured.
type NoopLogger struct{}

func (NoopLogger) Log(context.Context, AuditEntry) error { return nil }
