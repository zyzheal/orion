package repository

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// most of the SQL in this repository is a backtick string spread over two
// lines. Comparing it literally would mean typing a newline and a tab into the
// expectation, so the matcher below collapses every whitespace run to a single
// space before comparing. `$1` and `*` stay literal: there is nothing to escape
// in this mode.
func newMockDB(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	collapse := func(s string) string {
		var b strings.Builder
		seenSpace := false
		for _, r := range s {
			if unicode.IsSpace(r) {
				if !seenSpace {
					b.WriteByte(' ')
				}
				seenSpace = true
			} else {
				b.WriteRune(r)
				seenSpace = false
			}
		}
		return strings.TrimSpace(b.String())
	}
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
		func(expected, actual string) error {
			if collapse(expected) != collapse(actual) {
				return errors.New("sql does not match: " + actual)
			}
			return nil
		})))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	return mock, NewRepository(sqlx.NewDb(db, "sqlmock"))
}

func TestListDashboards_BindsTenantOffsetAndLimit(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 50, 25).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "dashboard_type", "config", "layout", "shared", "created_at",
		}))
	items, err := repo.List(context.Background(), "tenant-1", 50, 25)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListHosts_BindsTenantOffsetAndLimit(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT id, tenant_id, name, host, port, status, os_type, tags, agent_id, last_heartbeat, created_at, updated_at FROM monitor_hosts WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 100).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "host", "port", "status", "os_type", "tags",
			"agent_id", "last_heartbeat", "created_at", "updated_at",
		}))
	items, err := repo.ListHosts(context.Background(), "tenant-1", 0, 100)
	if err != nil {
		t.Fatalf("ListHosts: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// An empty table must come back as an empty slice, not a slice the caller
// cannot tell from nil. The handler depends on `len == 0` for both.
func TestListDashboards_EmptyTableYieldsZeroRows(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery(`SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`).
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "dashboard_type", "config", "layout",
			"shared", "created_at",
		}))
	items, err := repo.List(context.Background(), "tenant-1", 0, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
}

func TestListDashboards_PropagatesTheDriverError(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery(`SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`).
		WithArgs("tenant-1", 0, 20).
		WillReturnError(errors.New("connection refused"))
	items, err := repo.List(context.Background(), "tenant-1", 0, 20)
	if err == nil {
		t.Fatalf("List returned nil error")
	}
	if items != nil {
		t.Errorf("items = %v, want nil", items)
	}
}

// The count query must carry the same filters as the list query. Without them
// the envelope reports the tenant total for a filtered page.
func TestListAlerts_CountSharesTheListFilters(t *testing.T) {
	t.Run("bothFilters", func(t *testing.T) {
		mock, repo := newMockDB(t)
		mock.ExpectQuery("SELECT COUNT(*) FROM alert_instances WHERE tenant_id=$1 AND status=$2 AND severity=$3").
			WithArgs("tenant-1", "firing", "critical").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(41))
		mock.ExpectQuery("SELECT id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, triggered_at, acknowledged_at, acknowledged_by, resolved_at, tags FROM alert_instances WHERE tenant_id=$1 AND status=$2 AND severity=$3 ORDER BY triggered_at DESC OFFSET $4 LIMIT $5").
			WithArgs("tenant-1", "firing", "critical", 25, 25).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "tenant_id", "rule_id", "rule_name", "metric", "value", "threshold",
				"severity", "status", "message", "triggered_at", "acknowledged_at",
				"acknowledged_by", "resolved_at", "tags",
			}))
		items, total, err := repo.ListAlerts(context.Background(), "tenant-1", "firing", "critical", 25, 25)
		if err != nil {
			t.Fatalf("ListAlerts: %v", err)
		}
		if total != 41 {
			t.Errorf("total = %d, want 41", total)
		}
		if len(items) != 0 {
			t.Errorf("len(items) = %d, want 0", len(items))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("expectations: %v", err)
		}
	})

	t.Run("noFilters", func(t *testing.T) {
		mock, repo := newMockDB(t)
		mock.ExpectQuery("SELECT COUNT(*) FROM alert_instances WHERE tenant_id=$1").
			WithArgs("tenant-1").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))
		mock.ExpectQuery("SELECT id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, triggered_at, acknowledged_at, acknowledged_by, resolved_at, tags FROM alert_instances WHERE tenant_id=$1 ORDER BY triggered_at DESC OFFSET $2 LIMIT $3").
			WithArgs("tenant-1", 0, 20).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "tenant_id", "rule_id", "rule_name", "metric", "value", "threshold",
				"severity", "status", "message", "triggered_at", "acknowledged_at",
				"acknowledged_by", "resolved_at", "tags",
			}))
		items, total, err := repo.ListAlerts(context.Background(), "tenant-1", "", "", 0, 20)
		if err != nil {
			t.Fatalf("ListAlerts: %v", err)
		}
		if total != 7 {
			t.Errorf("total = %d, want 7", total)
		}
		if len(items) != 0 {
			t.Errorf("len(items) = %d, want 0", len(items))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("expectations: %v", err)
		}
	})

	t.Run("countFailureFailsTheCall", func(t *testing.T) {
		mock, repo := newMockDB(t)
		mock.ExpectQuery("SELECT COUNT(*)").WillReturnError(errors.New("no such table"))
		items, total, err := repo.ListAlerts(context.Background(), "tenant-1", "", "", 0, 20)
		if err == nil {
			t.Fatalf("ListAlerts returned nil error")
		}
		if items != nil || total != 0 {
			t.Errorf("items=%v total=%d, want nil 0", items, total)
		}
	})
}

// ListNotificationHistory has two branches, and neither clamps `limit`. The
// floor lives in the service.
func TestListNotificationHistory_FiltersByAlertWhenGiven(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at FROM notification_history WHERE tenant_id=$1 AND alert_id=$2 ORDER BY sent_at DESC LIMIT $3").
		WithArgs("tenant-1", "alert-9", 50).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "alert_id", "channel_id", "channel_type", "status",
			"error_message", "sent_at",
		}))
	items, err := repo.ListNotificationHistory(context.Background(), "tenant-1", "alert-9", 50)
	if err != nil {
		t.Fatalf("ListNotificationHistory: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListNotificationHistory_SkipsTheAlertFilterWhenEmpty(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at FROM notification_history WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT $2").
		WithArgs("tenant-1", 50).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "alert_id", "channel_id", "channel_type", "status",
			"error_message", "sent_at",
		}))
	items, err := repo.ListNotificationHistory(context.Background(), "tenant-1", "", 50)
	if err != nil {
		t.Fatalf("ListNotificationHistory: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// Alert rules are not paginated at all: one query, one argument, the tenant.
func TestListAlertRules_BindsOnlyTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT id, tenant_id, name, metric, condition, threshold, severity, enabled, suppressed, cooldown_ms, tags, description, created_at, updated_at FROM alert_rules WHERE tenant_id=$1 ORDER BY created_at DESC").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "metric", "condition", "threshold", "severity",
			"enabled", "suppressed", "cooldown_ms", "tags", "description",
			"created_at", "updated_at",
		}))
	items, err := repo.ListAlertRules(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("ListAlertRules: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
