package service

import (
	"context"
	"testing"
	"time"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func TestChannelService_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewChannelService(repo, zap.NewNop())

	ch := &models.NotificationChannel{
		TenantID: "tenant-1",
		Name:     "Email",
		Type:     models.ChannelEmail,
		Config:   models.JSONB{"smtp_host": "localhost"},
		Enabled:  true,
	}

	mock.ExpectExec("INSERT INTO notification_channels").
		WithArgs(sqlmock.AnyArg(), ch.TenantID, ch.Name, ch.Type, ch.Config, ch.Enabled).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := svc.CreateChannel(ctx, "tenant-1", ch); err != nil {
		t.Fatalf("CreateChannel failed: %v", err)
	}

	if ch.ID == "" {
		t.Error("CreateChannel should set ID")
	}
	if ch.TenantID != "tenant-1" {
		t.Errorf("CreateChannel TenantID = %s, want tenant-1", ch.TenantID)
	}
}

func TestChannelService_List(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewChannelService(repo, zap.NewNop())

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE tenant_id=\\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_at"}).
			AddRow("ch-1", "tenant-1", "Email", "email", `{"smtp_host":"localhost"}`, true, now).
			AddRow("ch-2", "tenant-1", "Slack", "slack", `{"webhook_url":"https://hooks.slack.com"}`, true, now))

	ctx := context.Background()
	items, err := svc.ListChannels(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("ListChannels failed: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("ListChannels count = %d, want 2", len(items))
	}
}

func TestChannelService_Get(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewChannelService(repo, zap.NewNop())

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("ch-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_at"}).
			AddRow("ch-1", "tenant-1", "Email", "email", `{"smtp_host":"localhost"}`, true, now))

	ctx := context.Background()
	ch, err := svc.GetChannel(ctx, "tenant-1", "ch-1")
	if err != nil {
		t.Fatalf("GetChannel failed: %v", err)
	}
	if ch.Name != "Email" {
		t.Errorf("GetChannel Name = %s, want Email", ch.Name)
	}
}

func TestChannelService_Update(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewChannelService(repo, zap.NewNop())

	mock.ExpectExec("UPDATE notification_channels SET name=\\$1, type=\\$2, config=\\$3, enabled=\\$4 WHERE id=\\$5 AND tenant_id=\\$6").
		WithArgs("Email Updated", "email", sqlmock.AnyArg(), true, "ch-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	ch := &models.NotificationChannel{
		ID:      "ch-1",
		TenantID: "tenant-1",
		Name:    "Email Updated",
		Type:    models.ChannelEmail,
		Config:  models.JSONB{"smtp_host": "localhost"},
		Enabled: true,
	}
	if err := svc.UpdateChannel(ctx, "tenant-1", ch); err != nil {
		t.Fatalf("UpdateChannel failed: %v", err)
	}
}

func TestChannelService_Delete(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewChannelService(repo, zap.NewNop())

	mock.ExpectExec("DELETE FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("ch-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := svc.DeleteChannel(ctx, "tenant-1", "ch-1"); err != nil {
		t.Fatalf("DeleteChannel failed: %v", err)
	}
}
