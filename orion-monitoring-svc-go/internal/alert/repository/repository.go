package repository

import (
	"context"
	"database/sql"

	"orion/go-common/pkg/database"
)

// NewAlertRepository creates all alert repositories sharing one DB connection.
func NewAlertRepository(db *database.DB) *AlertRepository {
	return &AlertRepository{base: *NewBaseRepository(db)}
}

// NewAlertRuleRepository creates the alert rule repository.
func NewAlertRuleRepository(db *database.DB) *AlertRuleRepository {
	return &AlertRuleRepository{base: *NewBaseRepository(db)}
}

// NewAlertSilenceRepository creates the alert silence repository.
func NewAlertSilenceRepository(db *database.DB) *AlertSilenceRepository {
	return &AlertSilenceRepository{base: *NewBaseRepository(db)}
}

// NewAlertNotificationRepository creates the alert notification repository.
func NewAlertNotificationRepository(db *database.DB) *AlertNotificationRepository {
	return &AlertNotificationRepository{base: *NewBaseRepository(db)}
}

// NewDeduplicationRepository creates the deduplication repository.
func NewDeduplicationRepository(db *database.DB) *DeduplicationRepository {
	return &DeduplicationRepository{base: *NewBaseRepository(db)}
}

// NewCorrelationRepository creates the correlation group repository.
func NewCorrelationRepository(db *database.DB) *CorrelationRepository {
	return &CorrelationRepository{base: *NewBaseRepository(db)}
}

// NewRCARepository creates the RCA result repository.
func NewRCARepository(db *database.DB) *RCARepository {
	return &RCARepository{base: *NewBaseRepository(db)}
}

// ==================== Context helpers ====================

func withTenant(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, "tenant_id", tenantID)
}

func getTenantID(ctx context.Context) string {
	if v := ctx.Value("tenant_id"); v != nil {
		return v.(string)
	}
	return ""
}

// ==================== JSON helpers ====================

// jsonRawMessage converts a value to json.RawMessage.
func jsonRawMessage(v interface{}) []byte {
	if v == nil {
		return nil
	}
	if b, ok := v.([]byte); ok {
		return b
	}
	if s, ok := v.(string); ok {
		return []byte(s)
	}
	return nil
}

// nullString returns a *sql.NullString from a *string.
func nullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}
