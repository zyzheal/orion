package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func TestTemplateService_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewTemplateService(repo, zap.NewNop())

	tmpl := &models.NotificationTemplate{
		TenantID:  "tenant-1",
		Name:      "Welcome Email",
		EventType: "user.signup",
		Channel:   models.ChannelEmail,
		Subject:   "Welcome",
		Body:      "Hello {{name}}",
	}

	mock.ExpectExec("INSERT INTO notification_templates").
		WithArgs(sqlmock.AnyArg(), tmpl.TenantID, tmpl.Name, tmpl.Channel, tmpl.Subject, tmpl.Body).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := svc.CreateTemplate(ctx, "tenant-1", tmpl); err != nil {
		t.Fatalf("CreateTemplate failed: %v", err)
	}

	if tmpl.ID == "" {
		t.Error("CreateTemplate should set ID")
	}
	if tmpl.TenantID != "tenant-1" {
		t.Errorf("CreateTemplate TenantID = %s, want tenant-1", tmpl.TenantID)
	}
}

func TestTemplateService_List(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewTemplateService(repo, zap.NewNop())

	now := time.Now().Truncate(time.Second)
	mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE tenant_id=\\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "channel", "subject", "body", "created_at"}).
			AddRow("tmpl-1", "tenant-1", "Welcome Email", "email", "Welcome", "Hello", now).
			AddRow("tmpl-2", "tenant-1", "Alert", "slack", "Alert", "Warning", now))

	ctx := context.Background()
	items, err := svc.ListTemplates(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("ListTemplates failed: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("ListTemplates count = %d, want 2", len(items))
	}
}

func TestTemplateService_Get(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewTemplateService(repo, zap.NewNop())

	now := time.Now().Truncate(time.Second)
	mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("tmpl-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "channel", "subject", "body", "created_at"}).
			AddRow("tmpl-1", "tenant-1", "Welcome Email", "email", "Welcome", "Hello", now))

	ctx := context.Background()
	tmpl, err := svc.GetTemplate(ctx, "tenant-1", "tmpl-1")
	if err != nil {
		t.Fatalf("GetTemplate failed: %v", err)
	}
	if tmpl.Name != "Welcome Email" {
		t.Errorf("GetTemplate Name = %s, want Welcome Email", tmpl.Name)
	}
}

func TestTemplateService_Delete(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := NewTemplateService(repo, zap.NewNop())

	mock.ExpectExec("DELETE FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("tmpl-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	if err := svc.DeleteTemplate(ctx, "tenant-1", "tmpl-1"); err != nil {
		t.Fatalf("DeleteTemplate failed: %v", err)
	}
}
