package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode"

	"orion/platform-svc-go/internal/visor/internal/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestServiceErrors(t *testing.T) {
	if ErrDashboardNotFound.Error() != "dashboard not found" {
		t.Errorf("unexpected: %s", ErrDashboardNotFound.Error())
	}
}

// The repository spreads most of its SQL over two lines, so the matcher
// collapses whitespace before comparing. It is duplicated from the repository
// test rather than exported out of it: this is test scaffolding, and promoting
// it into a non-test package would make it look load-bearing.
func newTestService(t *testing.T) (sqlmock.Sqlmock, *Service) {
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
	return mock, NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")))
}

// The handler owns the floor and the cap. The service must not reinterpret the
// values it was given, otherwise a handler fix can be silently undone here.
func TestServiceListDashboards_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT id, tenant_id, name, dashboard_type, config, layout, shared, created_at FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 200, 100).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "dashboard_type", "config", "layout",
			"shared", "created_at",
		}))
	items, err := svc.ListDashboards(context.Background(), "tenant-1", 200, 100)
	if err != nil {
		t.Fatalf("ListDashboards: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestServiceListHosts_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT id, tenant_id, name, host, port, status, os_type, tags, agent_id, last_heartbeat, created_at, updated_at FROM monitor_hosts WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 780, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "host", "port", "status", "os_type", "tags",
			"agent_id", "last_heartbeat", "created_at", "updated_at",
		}))
	items, err := svc.ListHosts(context.Background(), "tenant-1", 780, 20)
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

func TestServiceListAlerts_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM alert_instances WHERE tenant_id=$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))
	mock.ExpectQuery("SELECT id, tenant_id, rule_id, rule_name, metric, value, threshold, severity, status, message, triggered_at, acknowledged_at, acknowledged_by, resolved_at, tags FROM alert_instances WHERE tenant_id=$1 ORDER BY triggered_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 25, 25).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "rule_id", "rule_name", "metric", "value", "threshold",
			"severity", "status", "message", "triggered_at", "acknowledged_at",
			"acknowledged_by", "resolved_at", "tags",
		}))
	items, total, err := svc.ListAlerts(context.Background(), "tenant-1", "", "", 25, 25)
	if err != nil {
		t.Fatalf("ListAlerts: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(items) != 0 {
		t.Errorf("len(items) = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// ListNotificationHistory is the one list in this module with no handler cap.
// Its floor is owned here. Without it, page_size=0 and page_size=-100 both
// reached the database as LIMIT 0 and LIMIT -100.
func TestServiceListNotificationHistory_FloorsAZeroLimit(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at FROM notification_history WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT $2").
		WithArgs("tenant-1", 50).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "alert_id", "channel_id", "channel_type", "status",
			"error_message", "sent_at",
		}))
	items, err := svc.ListNotificationHistory(context.Background(), "tenant-1", "", 0)
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

func TestServiceListNotificationHistory_FloorsANegativeLimit(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at FROM notification_history WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT $2").
		WithArgs("tenant-1", 50).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "alert_id", "channel_id", "channel_type", "status",
			"error_message", "sent_at",
		}))
	items, err := svc.ListNotificationHistory(context.Background(), "tenant-1", "", -100)
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

// A positive limit must pass through unaltered: the floor is a floor, not a cap.
func TestServiceListNotificationHistory_LeavesAPositiveLimitAlone(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT id, tenant_id, alert_id, channel_id, channel_type, status, error_message, sent_at FROM notification_history WHERE tenant_id=$1 AND alert_id=$2 ORDER BY sent_at DESC LIMIT $3").
		WithArgs("tenant-1", "alert-9", 7).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "alert_id", "channel_id", "channel_type", "status",
			"error_message", "sent_at",
		}))
	items, err := svc.ListNotificationHistory(context.Background(), "tenant-1", "alert-9", 7)
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
