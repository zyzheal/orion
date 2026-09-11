package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-adapter-v2/repository"
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

// stubHandler is a valid INotificationHandler with no side effects.
type stubHandler struct{ ch string }

func (h *stubHandler) Channel() string { return h.ch }
func (h *stubHandler) Initialize(ctx context.Context, cfg map[string]string) error {
	return nil
}
func (h *stubHandler) Send(ctx context.Context, tpl string, v map[string]string) error {
	return nil
}
func (h *stubHandler) ValidateConfig(ctx context.Context, cfg map[string]string) error {
	return nil
}

// TestCreateAdapterBindsAllFields pins the request-binding bug in CreateAdapter.
//
// The request struct previously declared all three fields under one shared tag
// (Name, Channel and Config all tagged json:"name"), and Go decoder lets the
// first-declared field claim a tag that several fields share. The "name" key
// therefore went to Name while Channel and Config stayed empty every time, so
// CreateAdapter rejected every adapter as an empty, invalid channel.
func TestCreateAdapterBindsAllFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO alert_notification_adapters").
		WillReturnResult(sqlmock.NewResult(1, 1))

	factory := service.NewFactory(repository.NewRepository(sqlx.NewDb(db, "sqlmock")),
		zap.NewNop())
	factory.Register(&stubHandler{ch: "email"})

	r := gin.New()
	r.POST("/adapters", NewHandler(factory).CreateAdapter)

	body := `{"name":"ops-email","channel":"email","config":"{\"from\":\"a@example.com\"}"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/adapters", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if strings.Contains(w.Body.String(), "invalid notification channel") {
		t.Fatalf("channel was not bound from the \"channel\" key: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("adapter was never persisted, so channel/config never reached the service: %v\nbody=%s",
			err, w.Body.String())
	}
}

// TestCreateAdapterRejectsMalformedBody pins that a broken JSON body is
// answered with the binding error rather than being silently ignored (the
// previous code discarded ShouldBindJSON's error with `_ =`, which then fell
// through and produced a confusing "invalid notification channel" 400).
func TestCreateAdapterRejectsMalformedBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	factory := service.NewFactory(repository.NewRepository(sqlx.NewDb(db, "sqlmock")),
		zap.NewNop())

	r := gin.New()
	r.POST("/adapters", NewHandler(factory).CreateAdapter)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/adapters", strings.NewReader(`{not json`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d; body=%s", w.Code, http.StatusBadRequest, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "invalid notification channel") {
		t.Fatalf("binding error was swallowed and the request fell through: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet sqlmock expectations: %v", err)
	}
}
