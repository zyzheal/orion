package service

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// newMockService creates a Service backed by sqlmock, returning the service,
// mock, and a cleanup function.
func newMockService(t *testing.T) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockDB.Close() })

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	return NewService(repo), mock
}

// notificationRows returns a mock.Rows with standard notification columns
// matching the Notification model fields exactly.
func notificationRows(id string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "user_id", "type", "title", "channel",
		"recipient", "subject", "body", "status", "metadata",
		"read_at", "sent_at", "created_at", "updated_at",
	}).
		AddRow(id, "t1", "u1", "test", "Title", "email",
			"u@e.com", "Hi", "Hello", "pending", nil,
			nil, nil, time.Now(), time.Now())
}

func TestNewServiceNotNil(t *testing.T) {
	svc, _ := newMockService(t)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestServiceSendNotification(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("INSERT INTO notifications").
		WillReturnResult(sqlmock.NewResult(1, 1))
	// MarkAsSent after create
	mock.ExpectQuery("UPDATE notifications SET status='sent', sent_at=NOW\\(\\) WHERE id=\\$1 RETURNING \\*").
		WillReturnRows(notificationRows("n-1"))

	req := &models.CreateNotificationRequest{
		UserID:    "u1",
		Recipient: "u@e.com",
		Subject:   "Hi",
		Body:      "Hello",
		Type:      "test",
		Channel:   models.ChannelEmail,
	}
	_, err := svc.SendNotification(context.Background(), "t1", req)
	if err != nil {
		t.Errorf("SendNotification failed: %v", err)
	}
}

func TestServiceGetNotification(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("n-1", "t1").
		WillReturnRows(notificationRows("n-1"))

	_, err := svc.GetNotification(context.Background(), "t1", "n-1")
	if err != nil {
		t.Errorf("GetNotification failed: %v", err)
	}
}

func TestServiceGetNotification_NotFound(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("n-1", "t1").
		WillReturnError(sql.ErrNoRows)

	_, err := svc.GetNotification(context.Background(), "t1", "n-1")
	if err == nil {
		t.Error("expected error for missing notification")
	}
}

func TestServiceListNotifications(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("SELECT \\* FROM notifications WHERE tenant_id").
		WillReturnRows(notificationRows("n-1"))

	_, _, err := svc.ListNotifications(context.Background(), "t1", models.ListNotificationsQuery{Page: 1, Limit: 10})
	if err != nil {
		t.Errorf("ListNotifications failed: %v", err)
	}
}

func TestServiceMarkAsRead(t *testing.T) {
	svc, mock := newMockService(t)
	// First, service verifies notification exists via GetNotification
	mock.ExpectQuery("SELECT \\* FROM notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("n-1", "t1").
		WillReturnRows(notificationRows("n-1"))
	// Then MarkAsRead
	mock.ExpectQuery("UPDATE notifications SET status='read', read_at=NOW\\(\\) WHERE id=\\$1 AND tenant_id=\\$2 RETURNING \\*").
		WithArgs("n-1", "t1").
		WillReturnRows(notificationRows("n-1"))

	_, err := svc.MarkAsRead(context.Background(), "t1", "n-1")
	if err != nil {
		t.Errorf("MarkAsRead failed: %v", err)
	}
}

func TestServiceGetUnreadCount(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1 AND user_id=\\$2 AND status='sent'").
		WithArgs("t1", "u-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	_, err := svc.GetUnreadCount(context.Background(), "t1", "u-1")
	if err != nil {
		t.Errorf("GetUnreadCount failed: %v", err)
	}
}

func TestServiceBroadcast(t *testing.T) {
	svc, mock := newMockService(t)
	// Broadcast creates one notification per user in UserIDs
	mock.ExpectExec("INSERT INTO notifications").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("UPDATE notifications SET status='sent', sent_at=NOW\\(\\) WHERE id=\\$1 RETURNING \\*").
		WillReturnRows(notificationRows("n-1"))

	req := &models.BroadcastRequest{
		UserIDs: []string{"u1"},
		Type:    "test",
		Title:   "Broadcast",
		Message: "Hello all",
	}
	_, err := svc.Broadcast(context.Background(), "t1", req)
	if err != nil {
		t.Errorf("Broadcast failed: %v", err)
	}
}

func TestServiceDelete(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("DELETE FROM notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("n-1", "t1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := svc.Delete(context.Background(), "t1", "n-1")
	if err != nil {
		t.Errorf("Delete failed: %v", err)
	}
}

func TestServiceCount(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1").
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

	_, err := svc.Count(context.Background(), "t1")
	if err != nil {
		t.Errorf("Count failed: %v", err)
	}
}

func TestServiceStats(t *testing.T) {
	svc, mock := newMockService(t)
	// 5 separate COUNT queries matching the actual repository SQL
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1").
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(100))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1 AND status=\\$2").
		WithArgs("t1", models.StatusPending).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(30))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1 AND status=\\$2").
		WithArgs("t1", models.StatusSent).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(50))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1 AND status=\\$2").
		WithArgs("t1", models.StatusFailed).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications WHERE tenant_id=\\$1 AND status=\\$2").
		WithArgs("t1", models.StatusRead).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(15))

	_, err := svc.Stats(context.Background(), "t1")
	if err != nil {
		t.Errorf("Stats failed: %v", err)
	}
}

func TestServiceCreateTemplate(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("INSERT INTO notification_templates").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := svc.CreateTemplate(context.Background(), "t1", &models.NotificationTemplate{})
	if err != nil {
		t.Errorf("CreateTemplate failed: %v", err)
	}
}

func TestServiceListTemplates(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE tenant_id=\\$1").
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "channel", "subject", "body",
			"created_at", "updated_at",
		}).AddRow("tpl-1", "t1", "welcome", "email", "Hi", "Hello", time.Now(), time.Now()))

	_, err := svc.ListTemplates(context.Background(), "t1")
	if err != nil {
		t.Errorf("ListTemplates failed: %v", err)
	}
}

func TestServiceGetTemplate(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("tpl-1", "t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "channel", "subject", "body",
			"created_at", "updated_at",
		}).AddRow("tpl-1", "t1", "welcome", "email", "Hi", "Hello", time.Now(), time.Now()))

	_, err := svc.GetTemplate(context.Background(), "t1", "tpl-1")
	if err != nil {
		t.Errorf("GetTemplate failed: %v", err)
	}
}

func TestServiceDeleteTemplate(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("DELETE FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("tpl-1", "t1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := svc.DeleteTemplate(context.Background(), "t1", "tpl-1")
	if err != nil {
		t.Errorf("DeleteTemplate failed: %v", err)
	}
}

func TestServiceCreateChannel(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("INSERT INTO notification_channels").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := svc.CreateChannel(context.Background(), "t1", &models.NotificationChannel{})
	if err != nil {
		t.Errorf("CreateChannel failed: %v", err)
	}
}

func TestServiceListChannels(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE tenant_id=\\$1").
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "type", "config", "enabled",
			"created_at", "updated_at",
		}).AddRow("ch-1", "t1", "Email", "email", nil, true, time.Now(), time.Now()))

	_, err := svc.ListChannels(context.Background(), "t1")
	if err != nil {
		t.Errorf("ListChannels failed: %v", err)
	}
}

func TestServiceGetChannel(t *testing.T) {
	svc, mock := newMockService(t)
	// ChannelService.GetChannel delegates to repo.GetChannel
	mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("ch-1", "t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "type", "config", "enabled",
			"created_at", "updated_at",
		}).AddRow("ch-1", "t1", "Email", "email", nil, true, time.Now(), time.Now()))

	_, err := svc.GetChannel(context.Background(), "t1", "ch-1")
	if err != nil {
		t.Errorf("GetChannel failed: %v", err)
	}
}

func TestServiceGetSettings(t *testing.T) {
	svc, mock := newMockService(t)
	// First call: GetSettings returns ErrNoRows → service creates defaults via UpsertSettings
	mock.ExpectQuery("SELECT \\* FROM notification_settings WHERE tenant_id=\\$1 AND user_id=\\$2").
		WithArgs("t1", "u-1").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectExec("INSERT INTO notification_settings").
		WillReturnResult(sqlmock.NewResult(1, 1))

	_, err := svc.GetSettings(context.Background(), "t1", "u-1")
	if err != nil {
		t.Errorf("GetSettings failed: %v", err)
	}
}

func TestServiceGetSubscriptions(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM notification_subscriptions WHERE tenant_id=\\$1 AND user_id=\\$2").
		WithArgs("t1", "u-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "channel", "enabled", "created_at",
		}).AddRow("sub-1", "t1", "u-1", "email", true, time.Now()))

	_, err := svc.GetSubscriptions(context.Background(), "t1", "u-1")
	if err != nil {
		t.Errorf("GetSubscriptions failed: %v", err)
	}
}

func TestServiceSubscribe(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("INSERT INTO notification_subscriptions").
		WillReturnResult(sqlmock.NewResult(1, 1))

	_, err := svc.Subscribe(context.Background(), "t1", "u-1", "email", true)
	if err != nil {
		t.Errorf("Subscribe failed: %v", err)
	}
}

func TestServiceUnsubscribe(t *testing.T) {
	svc, mock := newMockService(t)
	mock.ExpectExec("DELETE FROM notification_subscriptions WHERE tenant_id=\\$1 AND user_id=\\$2 AND channel=\\$3").
		WithArgs("t1", "u-1", "email").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := svc.Unsubscribe(context.Background(), "t1", "u-1", "email")
	if err != nil {
		t.Errorf("Unsubscribe failed: %v", err)
	}
}
