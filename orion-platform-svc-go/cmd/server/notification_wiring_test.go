package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.uber.org/zap"

	notification_models "orion/platform-svc-go/internal/notification/models"
)

// SendNotification persists the record, marks it sent, and only then attempts
// delivery in a goroutine. When no dispatcher was attached that goroutine
// returned immediately, so notifications were reported as sent without ever
// reaching a channel. Nothing at startup complains about a missing dispatcher.
func TestNotificationDispatcherIsWired(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	initWiring(stubInfrastructure(logger), logger)

	if notificationSvc == nil {
		t.Fatal("notificationSvc is nil: wireNotificationModules did not build a service")
	}
	if d := notificationSvc.Dispatcher(); d == nil {
		t.Fatal("notificationSvc.Dispatcher() is nil: notifications are marked sent and never delivered")
	}

	// Drive the wired dispatcher end to end: it has to reach a real HTTP
	// endpoint with the notification payload in the request body.
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	err := notificationSvc.Dispatcher().Dispatch(context.Background(), notification_models.ChannelWebhook,
		"u@e.com", "Hi", "Hello", notification_models.JSONB{"webhook_url": srv.URL})
	if err != nil {
		t.Fatalf("wired dispatcher failed to deliver: %v", err)
	}
	if !strings.Contains(gotBody, "Hello") {
		t.Fatalf("recipient received %q, want the notification body", gotBody)
	}
}
