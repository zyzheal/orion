package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/notification/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("failed to parse time %q: %v", s, err)
	}
	return parsed
}

func TestScheduledNotificationRepository_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()
	n := &models.ScheduledNotification{
		ID:          "sn-abc123",
		TenantID:    "tenant-1",
		UserID:      "user-1",
		TemplateID:  "tmpl-1",
		Type:        "alert",
		Title:       "Test",
		Message:     "Hello",
		Channel:     "in_app",
		ScheduledAt: &now,
		Status:      models.ScheduledStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	mock.ExpectExec("INSERT INTO scheduled_notifications").
		WithArgs(n.ID, n.TenantID, n.UserID, n.TemplateID, n.Type, n.Title, n.Message,
			n.Channel, n.ScheduledAt, n.Status, n.CreatedAt, n.UpdatedAt).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	err = repo.Create(ctx, n)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestScheduledNotificationRepository_FindByID(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM scheduled_notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("sn-abc123", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "template_id", "type", "title", "message", "channel",
			"scheduled_at", "status", "sent_at", "error_message", "created_at", "updated_at",
		}).
			AddRow("sn-abc123", "tenant-1", "user-1", "tmpl-1", "alert", "Test", "Hello", "in-app",
				now.Add(1*time.Hour), "pending", nil, nil, now, now))

	ctx := context.Background()
	result, err := repo.FindByID(ctx, "tenant-1", "sn-abc123")
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if result.ID != "sn-abc123" {
		t.Errorf("FindByID ID = %s, want sn-abc123", result.ID)
	}
	if result.Title != "Test" {
		t.Errorf("FindByID Title = %s, want Test", result.Title)
	}
}

func TestScheduledNotificationRepository_FindByID_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	mock.ExpectQuery("SELECT \\* FROM scheduled_notifications WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("sn-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	_, err = repo.FindByID(ctx, "tenant-1", "sn-missing")
	if err == nil {
		t.Error("FindByID expected error for missing record, got nil")
	}
}

func TestScheduledNotificationRepository_FindAll(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM scheduled_notifications").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery("SELECT \\* FROM scheduled_notifications").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "template_id", "type", "title", "message", "channel",
			"scheduled_at", "status", "sent_at", "error_message", "created_at", "updated_at",
		}).
			AddRow("sn-1", "tenant-1", "user-1", nil, "alert", "A", "MsgA", "in-app", now, "pending", nil, nil, now, now).
			AddRow("sn-2", "tenant-1", "user-2", nil, "alert", "B", "MsgB", "email", now, "sent", nil, nil, now, now))

	ctx := context.Background()
	items, total, err := repo.FindAll(ctx, "tenant-1", models.ListNotificationsQuery{})
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if total != 2 {
		t.Errorf("FindAll total = %d, want 2", total)
	}
	if len(items) != 2 {
		t.Errorf("FindAll items count = %d, want 2", len(items))
	}
}

func TestScheduledNotificationRepository_FindPendingByTimeRange(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()
	start := now
	end := now.Add(1 * time.Hour)

	mock.ExpectQuery("SELECT \\* FROM scheduled_notifications").
		WithArgs("tenant-1", "pending", start, end).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "template_id", "type", "title", "message", "channel",
			"scheduled_at", "status", "sent_at", "error_message", "created_at", "updated_at",
		}).
			AddRow("sn-1", "tenant-1", "user-1", nil, "alert", "A", "MsgA", "in-app", now, "pending", nil, nil, now, now))

	ctx := context.Background()
	items, err := repo.FindPendingByTimeRange(ctx, "tenant-1", start, end)
	if err != nil {
		t.Fatalf("FindPendingByTimeRange failed: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("FindPendingByTimeRange count = %d, want 1", len(items))
	}
}

func TestScheduledNotificationRepository_Update(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()
	newTitle := "Updated Title"
	repo.NowFunc = func() time.Time { return now }

	mock.ExpectQuery("UPDATE scheduled_notifications").
		WithArgs(now, newTitle, "sn-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "template_id", "type", "title", "message", "channel",
			"scheduled_at", "status", "sent_at", "error_message", "created_at", "updated_at",
		}).
			AddRow("sn-1", "tenant-1", "user-1", nil, "alert", "Updated Title", "Msg", "in-app", now, "pending", nil, nil, now, now))

	ctx := context.Background()
	result, err := repo.Update(ctx, "tenant-1", "sn-1", map[string]interface{}{"title": newTitle})
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if result.Title != "Updated Title" {
		t.Errorf("Update Title = %s, want Updated Title", result.Title)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestScheduledNotificationRepository_MarkAsSent(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	now := time.Now()

	mock.ExpectQuery("UPDATE scheduled_notifications").
		WithArgs("sn-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "user_id", "template_id", "type", "title", "message", "channel",
			"scheduled_at", "status", "sent_at", "error_message", "created_at", "updated_at",
		}).
			AddRow("sn-1", "tenant-1", "user-1", nil, "alert", "A", "MsgA", "in-app", now, "sent", now, nil, now, now))

	ctx := context.Background()
	result, err := repo.MarkAsSent(ctx, "tenant-1", "sn-1")
	if err != nil {
		t.Fatalf("MarkAsSent failed: %v", err)
	}
	if result.Status != models.ScheduledStatusSent {
		t.Errorf("MarkAsSent Status = %s, want sent", result.Status)
	}
}

func TestScheduledNotificationRepository_Cancel(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	t.Run("success", func(t *testing.T) {
		mock.ExpectExec("UPDATE scheduled_notifications SET status='cancelled'").
			WithArgs("sn-1", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 1))

		ctx := context.Background()
		ok, err := repo.Cancel(ctx, "tenant-1", "sn-1")
		if err != nil {
			t.Fatalf("Cancel failed: %v", err)
		}
		if !ok {
			t.Error("Cancel returned false, want true")
		}
	})

	t.Run("not found", func(t *testing.T) {
		mock.ExpectExec("UPDATE scheduled_notifications SET status='cancelled'").
			WithArgs("sn-missing", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 0))

		ctx := context.Background()
		ok, err := repo.Cancel(ctx, "tenant-1", "sn-missing")
		if err != nil {
			t.Fatalf("Cancel failed: %v", err)
		}
		if ok {
			t.Error("Cancel returned true for missing record, want false")
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestScheduledNotificationRepository_Delete(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	t.Run("success", func(t *testing.T) {
		mock.ExpectExec("DELETE FROM scheduled_notifications").
			WithArgs("sn-1", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 1))

		ctx := context.Background()
		ok, err := repo.Delete(ctx, "tenant-1", "sn-1")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		if !ok {
			t.Error("Delete returned false, want true")
		}
	})

	t.Run("not found", func(t *testing.T) {
		mock.ExpectExec("DELETE FROM scheduled_notifications").
			WithArgs("sn-missing", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 0))

		ctx := context.Background()
		ok, err := repo.Delete(ctx, "tenant-1", "sn-missing")
		if err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		if ok {
			t.Error("Delete returned true for missing record, want false")
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestScheduledNotificationRepository_Count(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewScheduledNotificationRepository(sqlxDB)

	t.Run("no filters", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM scheduled_notifications WHERE tenant_id=\\$1").
			WithArgs("tenant-1").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

		ctx := context.Background()
		count, err := repo.Count(ctx, "tenant-1", "", "")
		if err != nil {
			t.Fatalf("Count failed: %v", err)
		}
		if count != 10 {
			t.Errorf("Count = %d, want 10", count)
		}
	})

	t.Run("with user_id filter", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM scheduled_notifications").
			WithArgs("tenant-1", "user-1").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

		ctx := context.Background()
		count, err := repo.Count(ctx, "tenant-1", "user-1", "")
		if err != nil {
			t.Fatalf("Count failed: %v", err)
		}
		if count != 5 {
			t.Errorf("Count = %d, want 5", count)
		}
	})

	t.Run("with status filter", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM scheduled_notifications").
			WithArgs("tenant-1", "user-1", "pending").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

		ctx := context.Background()
		count, err := repo.Count(ctx, "tenant-1", "user-1", models.ScheduledStatusPending)
		if err != nil {
			t.Fatalf("Count failed: %v", err)
		}
		if count != 3 {
			t.Errorf("Count = %d, want 3", count)
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func strPtr(s string) *string {
	return &s
}
