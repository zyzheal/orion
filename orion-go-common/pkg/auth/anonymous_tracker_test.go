package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// recordingTracker captures every Track invocation so tests can assert the
// reason and path were passed correctly.
type recordingTracker struct {
	calls []anonymousCall
}

type anonymousCall struct {
	method string
	path   string
	reason string
}

func (r *recordingTracker) Track(c *gin.Context, method, path, reason string) {
	r.calls = append(r.calls, anonymousCall{method: method, path: path, reason: reason})
}

func TestOptionalAuth_TracksNoAuthorizationHeader(t *testing.T) {
	tracker := &recordingTracker{}
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{AnonymousTracker: tracker}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("OptionalAuth must not reject unauthenticated requests, got %d", w.Code)
	}
	if len(tracker.calls) != 1 {
		t.Fatalf("expected 1 tracker call, got %d", len(tracker.calls))
	}
	c := tracker.calls[0]
	if c.method != http.MethodGet {
		t.Errorf("method = %q, want GET", c.method)
	}
	if c.path != "/ping" {
		t.Errorf("path = %q, want /ping", c.path)
	}
	if c.reason != "no-authorization-header" {
		t.Errorf("reason = %q, want no-authorization-header", c.reason)
	}
}

func TestOptionalAuth_TracksNonBearerAuthHeader(t *testing.T) {
	tracker := &recordingTracker{}
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{AnonymousTracker: tracker}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Authorization", "Token abc")
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("OptionalAuth must not reject unauthenticated requests, got %d", w.Code)
	}
	if len(tracker.calls) != 1 {
		t.Fatalf("expected 1 tracker call, got %d", len(tracker.calls))
	}
	if tracker.calls[0].reason != "non-bearer-auth-header" {
		t.Errorf("reason = %q, want non-bearer-auth-header", tracker.calls[0].reason)
	}
}

func TestOptionalAuth_TracksTokenParseError(t *testing.T) {
	tracker := &recordingTracker{}
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{
		JWTSecret:        "test-secret",
		AnonymousTracker: tracker,
	}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Authorization", "Bearer not-a-valid-jwt")
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("OptionalAuth must not reject unauthenticated requests, got %d", w.Code)
	}
	if len(tracker.calls) != 1 {
		t.Fatalf("expected 1 tracker call, got %d", len(tracker.calls))
	}
	if tracker.calls[0].reason != "token-parse-error" {
		t.Errorf("reason = %q, want token-parse-error", tracker.calls[0].reason)
	}
}

func TestOptionalAuth_DoesNotTrackWhenAuthenticated(t *testing.T) {
	tracker := &recordingTracker{}
	// We need a valid token to test the positive case. Use HS256 with the
	// configured secret.
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       "u1",
		"tenant_id": "t1",
		"role":      "developer",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})
	token, err := tok.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{
		JWTSecret:        "test-secret",
		AnonymousTracker: tracker,
	}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if len(tracker.calls) != 0 {
		t.Errorf("authenticated request must not fire the tracker, got %d calls", len(tracker.calls))
	}
}

func TestOptionalAuth_DoesNotTrackWhenSkipped(t *testing.T) {
	tracker := &recordingTracker{}
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{
		SkipPaths:        []string{"/healthz"},
		AnonymousTracker: tracker,
	}))
	ng.GET("/healthz", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if len(tracker.calls) != 0 {
		t.Errorf("skipPaths must bypass the tracker, got %d calls", len(tracker.calls))
	}
}

func TestOptionalAuth_TrackerNilIsSafe(t *testing.T) {
	// nil tracker = legacy behaviour, no tracking. Must not panic.
	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	ng.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
