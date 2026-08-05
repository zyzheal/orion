package handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/notification/repository"
	"orion/platform-svc-go/internal/notification/notification/service"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// setupTestContext creates a gin test context with tenant_id set.
func setupTestContext(method, path, body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req, _ := http.NewRequest(method, path, bodyReader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("tenant_id", "tenant-1")
	return c, w
}

// TestDeliveryHandler_List tests the List endpoint.
func TestDeliveryHandler_List(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDeliveryRepository(sqlxDB)
	svc := service.NewDeliveryService(repo, nil)
	h := NewDeliveryHandler(svc)

	now := time.Now()
	mock.ExpectQuery("SELECT \\* FROM notification_deliveries WHERE notification_id=\\$1 AND tenant_id=\\$2").
		WithArgs("notif-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "notification_id", "channel", "recipient", "subject", "body",
			"status", "attempt_number", "max_attempts", "fallback_channel", "metadata",
			"next_retry_at", "sent_at", "error_message", "response_body", "response_status",
			"created_at", "updated_at",
		}).
			AddRow("del-1", "tenant-1", "notif-1", "email", "u1", "s", "b", "sent", 1, 3, nil, nil, now, now, nil, nil, 0, now, now))

	c, w := setupTestContext("GET", "/deliveries?notification_id=notif-1", "")
	h.List(c)

	if w.Code != http.StatusOK {
		t.Errorf("List status = %d, want 200", w.Code)
	}
}

// TestDeliveryHandler_Get tests the Get endpoint.
func TestDeliveryHandler_Get(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDeliveryRepository(sqlxDB)
	svc := service.NewDeliveryService(repo, nil)
	h := NewDeliveryHandler(svc)

	c, w := setupTestContext("GET", "/deliveries/del-1", "")
	c.Params = gin.Params{{Key: "id", Value: "del-1"}}
	h.Get(c)

	// Service stub returns nil, nil → handler returns 200
	if w.Code != http.StatusOK {
		t.Errorf("Get status = %d, want 200", w.Code)
	}
}

// TestDeliveryHandler_Retry tests the Retry endpoint.
func TestDeliveryHandler_Retry(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDeliveryRepository(sqlxDB)
	svc := service.NewDeliveryService(repo, nil)
	h := NewDeliveryHandler(svc)

	c, w := setupTestContext("POST", "/deliveries/del-1/retry", "")
	c.Params = gin.Params{{Key: "id", Value: "del-1"}}
	h.Retry(c)

	// Service stub returns nil, nil → handler returns 200
	if w.Code != http.StatusOK {
		t.Errorf("Retry status = %d, want 200", w.Code)
	}
}

// TestDNDHandler_Set tests the Set DND endpoint.
func TestDNDHandler_Set(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := service.NewDNDService(repo, zap.NewNop())
	h := NewDNDHandler(svc)

	now := time.Now()
	start := now.Add(1 * time.Hour).Truncate(time.Second)
	end := now.Add(2 * time.Hour).Truncate(time.Second)
	mock.ExpectQuery("INSERT INTO do_not_disturb").
		WithArgs("tenant-1", "user-1", start, end, nil).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, now, now))

	// Use snake_case JSON keys matching CreateDoNotDisturbInput (notification/models/models.go)
	body := `{"user_id":"user-1","start_time":"` + start.Format(time.RFC3339) + `","end_time":"` + end.Format(time.RFC3339) + `"}`
	c, w := setupTestContext("PUT", "/dnd/user-1", body)
	c.Params = gin.Params{{Key: "user_id", Value: "user-1"}}
	h.Set(c)

	// Service stub returns nil, nil → handler returns 200
	if w.Code != http.StatusOK {
		t.Errorf("Set status = %d, want 200", w.Code)
	}
}

// TestDNDHandler_Clear tests the Clear DND endpoint.
func TestDNDHandler_Clear(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := service.NewDNDService(repo, zap.NewNop())
	h := NewDNDHandler(svc)

	c, w := setupTestContext("DELETE", "/dnd/user-1", "")
	c.Params = gin.Params{{Key: "user_id", Value: "user-1"}}
	h.Clear(c)

	// Service stub returns nil → handler returns 200
	if w.Code != http.StatusOK {
		t.Errorf("Clear status = %d, want 200", w.Code)
	}
}

// TestDNDHandler_Get tests the Get DND endpoint.
func TestDNDHandler_Get(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := service.NewDNDService(repo, zap.NewNop())
	h := NewDNDHandler(svc)

	now := time.Now()
	start := now.Add(1 * time.Hour)
	end := now.Add(2 * time.Hour)
	mock.ExpectQuery("SELECT \\* FROM do_not_disturb WHERE user_id=\\$1 AND tenant_id=\\$2").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, now, now))

	c, w := setupTestContext("GET", "/dnd/user-1", "")
	c.Params = gin.Params{{Key: "user_id", Value: "user-1"}}
	h.Get(c)

	if w.Code != http.StatusOK {
		t.Errorf("Get status = %d, want 200", w.Code)
	}
}

// TestScheduledNotificationHandler_Create tests the Create endpoint.
func TestScheduledNotificationHandler_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewScheduledNotificationRepository(sqlxDB)
	svc := service.NewScheduledNotificationService(repo, zap.NewNop())
	h := NewScheduledNotificationHandler(svc)

	mock.ExpectExec("INSERT INTO scheduled_notifications").
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Use snake_case JSON keys matching CreateScheduledNotificationInput
	body := `{"user_id":"user-1","type":"alert","title":"Test","message":"Hello","scheduled_at":"2026-01-01T12:00:00Z"}`
	c, w := setupTestContext("POST", "/scheduled-notifications", body)
	h.Create(c)

	if w.Code != http.StatusCreated {
		t.Errorf("Create status = %d, want 201", w.Code)
	}
}

// TestScheduledNotificationHandler_ValidateCron tests the ValidateCron endpoint.
func TestScheduledNotificationHandler_ValidateCron(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewScheduledNotificationRepository(sqlxDB)
	svc := service.NewScheduledNotificationService(repo, zap.NewNop())
	h := NewScheduledNotificationHandler(svc)

	c, w := setupTestContext("GET", "/scheduled-notifications/validate-cron?expression=0+0+9+*+*+*", "")
	h.ValidateCron(c)

	if w.Code != http.StatusOK {
		t.Errorf("ValidateCron status = %d, want 200", w.Code)
	}
}
