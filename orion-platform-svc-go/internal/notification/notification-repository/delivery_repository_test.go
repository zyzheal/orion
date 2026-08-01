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

func TestDeliveryRepository_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	now := time.Now()
	subject := "Test"
	body := "Body"
	d := &models.NotificationDelivery{
		ID:             "del-1",
		TenantID:       "tenant-1",
		NotificationID: "notif-1",
		Channel:        models.DeliveryChannelEmail,
		Recipient:      "user@example.com",
		Subject:        &subject,
		Body:           &body,
		Status:         models.DeliveryStatusPending,
		AttemptNumber:  1,
		MaxAttempts:    3,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	mock.ExpectExec("INSERT INTO notification_deliveries").
		WithArgs(d.ID, d.TenantID, d.NotificationID, d.Channel, d.Recipient, d.Subject, d.Body,
			d.Status, d.AttemptNumber, d.MaxAttempts, d.FallbackChannel, d.Metadata,
			d.NextRetryAt, d.CreatedAt, d.UpdatedAt).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := repo.CreateDelivery(ctx, d); err != nil {
		t.Fatalf("CreateDelivery failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestDeliveryRepository_FindByID(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM notification_deliveries WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("del-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "user@example.com", "Test", "Body",
				"pending", 1, 3, nil, nil, now, nil, nil, nil, 0, now, now))

	ctx := context.Background()
	result, err := repo.FindByID(ctx, "tenant-1", "del-1")
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if result.ID != "del-1" {
		t.Errorf("FindByID ID = %s, want del-1", result.ID)
	}
	if result.Status != models.DeliveryStatusPending {
		t.Errorf("FindByID Status = %s, want pending", result.Status)
	}
}

func TestDeliveryRepository_FindByID_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	mock.ExpectQuery("SELECT \\* FROM notification_deliveries WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("del-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	_, err = repo.FindByID(ctx, "tenant-1", "del-missing")
	if err == nil {
		t.Error("FindByID expected error for missing record, got nil")
	}
}

func TestDeliveryRepository_FindByNotificationID(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM notification_deliveries WHERE notification_id=\\$1 AND tenant_id=\\$2").
		WithArgs("notif-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "u1", "S", "B", "sent", 1, 3, nil, nil, now, now, nil, nil, 0, now, now).
			AddRow("del-2", "tenant-1", "notif-1", "sms", "u2", "S", "B", "failed", 1, 3, nil, nil, now, nil, "err", nil, 0, now, now))

	ctx := context.Background()
	items, err := repo.FindByNotificationID(ctx, "tenant-1", "notif-1")
	if err != nil {
		t.Fatalf("FindByNotificationID failed: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("FindByNotificationID count = %d, want 2", len(items))
	}
}

func TestDeliveryRepository_FindPendingForRetry(t *testing.T) {
	mockDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	fixedTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	repo := NewDeliveryRepository(sqlxDB)
	repo.NowFunc = func() time.Time { return fixedTime }

	mock.ExpectQuery("SELECT * FROM notification_deliveries WHERE tenant_id=$1 AND status IN ('pending','retrying') AND next_retry_at IS NOT NULL AND next_retry_at <= $2 AND attempt_number <= max_attempts ORDER BY next_retry_at ASC LIMIT $3").
		WithArgs("tenant-1", fixedTime, 10).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "u1", "S", "B", "pending", 1, 3, nil, nil, fixedTime, nil, nil, nil, 0, fixedTime, fixedTime))

	ctx := context.Background()
	items, err := repo.FindPendingForRetry(ctx, "tenant-1", 10)
	if err != nil {
		t.Fatalf("FindPendingForRetry failed: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("FindPendingForRetry count = %d, want 1", len(items))
	}
}

func TestDeliveryRepository_UpdateStatus(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	now := time.Now()
	d := &models.NotificationDelivery{
		ID:            "del-1",
		TenantID:      "tenant-1",
		Status:        models.DeliveryStatusSent,
		AttemptNumber: 2,
		ErrorMessage:  strPtr("error"),
		UpdatedAt:     now,
	}

	mock.ExpectExec("UPDATE notification_deliveries SET status=\\$1, attempt_number=\\$2, error_message=\\$3, response_body=\\$4, response_status=\\$5, sent_at=\\$6, next_retry_at=\\$7, metadata=\\$8, updated_at=\\$9 WHERE id=\\$10 AND tenant_id=\\$11").
		WithArgs(d.Status, d.AttemptNumber, d.ErrorMessage, d.ResponseBody, d.ResponseStatus, d.SentAt, d.NextRetryAt, d.Metadata, d.UpdatedAt, d.ID, d.TenantID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := repo.UpdateStatus(ctx, d); err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestDeliveryRepository_IncrementAttempt(t *testing.T) {
	mockDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	fixedTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	repo := NewDeliveryRepository(sqlxDB)
	repo.NowFunc = func() time.Time { return fixedTime }

	mock.ExpectQuery("UPDATE notification_deliveries SET attempt_number = attempt_number + 1, status = 'retrying', updated_at = $1 WHERE id=$2 AND tenant_id=$3 RETURNING *").
		WithArgs(fixedTime, "del-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "u1", "S", "B", "retrying", 2, 3, nil, nil, fixedTime, nil, nil, nil, 0, fixedTime, fixedTime))

	ctx := context.Background()
	result, err := repo.IncrementAttempt(ctx, "tenant-1", "del-1")
	if err != nil {
		t.Fatalf("IncrementAttempt failed: %v", err)
	}
	if result.AttemptNumber != 2 {
		t.Errorf("IncrementAttempt attempt_number = %d, want 2", result.AttemptNumber)
	}
	if result.Status != models.DeliveryStatusRetrying {
		t.Errorf("IncrementAttempt status = %s, want retrying", result.Status)
	}
}

func TestDeliveryRepository_MarkExhausted(t *testing.T) {
	mockDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	fixedTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	repo := NewDeliveryRepository(sqlxDB)
	repo.NowFunc = func() time.Time { return fixedTime }

	mock.ExpectQuery("UPDATE notification_deliveries SET status = 'exhausted', error_message = COALESCE($3, error_message), updated_at = $4 WHERE id=$1 AND tenant_id=$2 RETURNING *").
		WithArgs("del-1", "tenant-1", "max retries", fixedTime).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "u1", "S", "B", "exhausted", 3, 3, nil, nil, fixedTime, nil, "max retries", nil, 0, fixedTime, fixedTime))

	ctx := context.Background()
	result, err := repo.MarkExhausted(ctx, "tenant-1", "del-1", "max retries")
	if err != nil {
		t.Fatalf("MarkExhausted failed: %v", err)
	}
	if result.Status != models.DeliveryStatusExhausted {
		t.Errorf("MarkExhausted status = %s, want exhausted", result.Status)
	}
}

func TestDeliveryRepository_Count(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDeliveryRepository(sqlxDB)

	t.Run("no filters", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notification_deliveries WHERE tenant_id=\\$1").
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

	t.Run("with notification_id filter", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notification_deliveries").
			WithArgs("tenant-1", "notif-1").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

		ctx := context.Background()
		count, err := repo.Count(ctx, "tenant-1", "notif-1", "")
		if err != nil {
			t.Fatalf("Count failed: %v", err)
		}
		if count != 5 {
			t.Errorf("Count = %d, want 5", count)
		}
	})

	t.Run("with status filter", func(t *testing.T) {
		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notification_deliveries").
			WithArgs("tenant-1", "notif-1", "sent").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

		ctx := context.Background()
		count, err := repo.Count(ctx, "tenant-1", "notif-1", models.DeliveryStatusSent)
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

