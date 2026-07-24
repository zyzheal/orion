package handler

import (
	"context"
	"net/http"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/notification/repository"
	"orion/platform-svc-go/internal/notification/notification/service"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// --- ChannelHandler Tests ---

func TestChannelHandler_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewChannelService(repo, zap.NewNop())
	h := NewChannelHandler(svc)

	mock.ExpectExec("INSERT INTO notification_channels").
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := `{"name":"Email","type":"email","config":{"smtp_host":"localhost"},"enabled":true}`
	c, w := setupTestContext("POST", "/channels", body)
	h.Create(c)

	if w.Code != http.StatusCreated {
		t.Errorf("Create status = %d, want 201", w.Code)
	}
}

func TestChannelHandler_List(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewChannelService(repo, zap.NewNop())
	h := NewChannelHandler(svc)

	now := time.Now().Truncate(time.Second)
	mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE tenant_id=\\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_at"}).
			AddRow("ch-1", "tenant-1", "Email", "email", `{"smtp_host":"localhost"}`, true, now))

	c, w := setupTestContext("GET", "/channels", "")
	h.List(c)

	if w.Code != http.StatusOK {
		t.Errorf("List status = %d, want 200", w.Code)
	}
}

func TestChannelHandler_Get(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		mockDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("failed to create sqlmock: %v", err)
		}
		defer mockDB.Close()

		sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
		repo := repository.NewRepository(sqlxDB)
		svc := service.NewChannelService(repo, zap.NewNop())
		h := NewChannelHandler(svc)

		now := time.Now().Truncate(time.Second)
		mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
			WithArgs("ch-1", "tenant-1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_at"}).
				AddRow("ch-1", "tenant-1", "Email", "email", `{"smtp_host":"localhost"}`, true, now))

		c, w := setupTestContext("GET", "/channels/ch-1", "")
		c.Params = gin.Params{{Key: "id", Value: "ch-1"}}
		h.Get(c)

		if w.Code != http.StatusOK {
			t.Errorf("Get found status = %d, want 200", w.Code)
		}
	})

	t.Run("not found", func(t *testing.T) {
		mockDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("failed to create sqlmock: %v", err)
		}
		defer mockDB.Close()

		sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
		repo := repository.NewRepository(sqlxDB)
		svc := service.NewChannelService(repo, zap.NewNop())
		h := NewChannelHandler(svc)

		mock.ExpectQuery("SELECT \\* FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
			WithArgs("ch-missing", "tenant-1").
			WillReturnError(context.DeadlineExceeded)

		c, w := setupTestContext("GET", "/channels/ch-missing", "")
		c.Params = gin.Params{{Key: "id", Value: "ch-missing"}}
		h.Get(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("Get not found status = %d, want 404", w.Code)
		}
	})
}

func TestChannelHandler_Update(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewChannelService(repo, zap.NewNop())
	h := NewChannelHandler(svc)

	mock.ExpectExec("UPDATE notification_channels SET name=\\$1, type=\\$2, config=\\$3, enabled=\\$4 WHERE id=\\$5 AND tenant_id=\\$6").
		WithArgs("Email Updated", "email", sqlmock.AnyArg(), true, "ch-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := `{"name":"Email Updated","type":"email","config":{"smtp_host":"localhost"},"enabled":true}`
	c, w := setupTestContext("PUT", "/channels/ch-1", body)
	c.Params = gin.Params{{Key: "id", Value: "ch-1"}}
	h.Update(c)

	if w.Code != http.StatusOK {
		t.Errorf("Update status = %d, want 200", w.Code)
	}
}

func TestChannelHandler_Delete(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewChannelService(repo, zap.NewNop())
	h := NewChannelHandler(svc)

	mock.ExpectExec("DELETE FROM notification_channels WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("ch-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	c, w := setupTestContext("DELETE", "/channels/ch-1", "")
	c.Params = gin.Params{{Key: "id", Value: "ch-1"}}
	h.Delete(c)

	if w.Code != http.StatusOK {
		t.Errorf("Delete status = %d, want 200", w.Code)
	}
}

// --- TemplateHandler Tests ---

func TestTemplateHandler_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewTemplateService(repo, zap.NewNop())
	h := NewTemplateHandler(svc)

	mock.ExpectExec("INSERT INTO notification_templates").
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := `{"name":"Welcome Email","eventType":"user.signup","channel":"email","subject":"Welcome","body":"Hello {{name}}"}`
	c, w := setupTestContext("POST", "/templates", body)
	h.Create(c)

	if w.Code != http.StatusCreated {
		t.Errorf("Create status = %d, want 201", w.Code)
	}
}

func TestTemplateHandler_List(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewTemplateService(repo, zap.NewNop())
	h := NewTemplateHandler(svc)

	now := time.Now().Truncate(time.Second)
	mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE tenant_id=\\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "channel", "subject", "body", "created_at"}).
			AddRow("tmpl-1", "tenant-1", "Welcome Email", "email", "Welcome", "Hello", now))

	c, w := setupTestContext("GET", "/templates", "")
	h.List(c)

	if w.Code != http.StatusOK {
		t.Errorf("List status = %d, want 200", w.Code)
	}
}

func TestTemplateHandler_Get(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		mockDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("failed to create sqlmock: %v", err)
		}
		defer mockDB.Close()

		sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
		repo := repository.NewRepository(sqlxDB)
		svc := service.NewTemplateService(repo, zap.NewNop())
		h := NewTemplateHandler(svc)

		now := time.Now().Truncate(time.Second)
		mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
			WithArgs("tmpl-1", "tenant-1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "channel", "subject", "body", "created_at"}).
				AddRow("tmpl-1", "tenant-1", "Welcome Email", "email", "Welcome", "Hello", now))

		c, w := setupTestContext("GET", "/templates/tmpl-1", "")
		c.Params = gin.Params{{Key: "id", Value: "tmpl-1"}}
		h.Get(c)

		if w.Code != http.StatusOK {
			t.Errorf("Get found status = %d, want 200", w.Code)
		}
	})

	t.Run("not found", func(t *testing.T) {
		mockDB, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("failed to create sqlmock: %v", err)
		}
		defer mockDB.Close()

		sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
		repo := repository.NewRepository(sqlxDB)
		svc := service.NewTemplateService(repo, zap.NewNop())
		h := NewTemplateHandler(svc)

		mock.ExpectQuery("SELECT \\* FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
			WithArgs("tmpl-missing", "tenant-1").
			WillReturnError(context.DeadlineExceeded)

		c, w := setupTestContext("GET", "/templates/tmpl-missing", "")
		c.Params = gin.Params{{Key: "id", Value: "tmpl-missing"}}
		h.Get(c)

		if w.Code != http.StatusNotFound {
			t.Errorf("Get not found status = %d, want 404", w.Code)
		}
	})
}

func TestTemplateHandler_Delete(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewRepository(sqlxDB)
	svc := service.NewTemplateService(repo, zap.NewNop())
	h := NewTemplateHandler(svc)

	mock.ExpectExec("DELETE FROM notification_templates WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("tmpl-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	c, w := setupTestContext("DELETE", "/templates/tmpl-1", "")
	c.Params = gin.Params{{Key: "id", Value: "tmpl-1"}}
	h.Delete(c)

	if w.Code != http.StatusOK {
		t.Errorf("Delete status = %d, want 200", w.Code)
	}
}
