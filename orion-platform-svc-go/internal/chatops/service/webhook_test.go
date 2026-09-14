package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/chatops/models"
)

// webhookRepo overrides only the two calls TestWebhook makes. Embedding the full
// mock keeps this from restating the repository interface, which would have to be
// re-edited every time the interface grows.
type webhookRepo struct {
	*mockChatOpsRepo
	webhook    *models.Webhook
	webhookErr error
	logErr     error
	logs       []webhookLog
}

type webhookLog struct {
	tenantID, webhookID, status, responseBody, errMsg string
	durationMS                                        int64
}

func (m *webhookRepo) GetWebhook(_ context.Context, _, _ string) (*models.Webhook, error) {
	return m.webhook, m.webhookErr
}

func (m *webhookRepo) InsertWebhookLog(_ context.Context, tenantID, webhookID, status, responseBody, errMsg string, durationMS int64) error {
	if m.logErr != nil {
		return m.logErr
	}
	m.logs = append(m.logs, webhookLog{tenantID, webhookID, status, responseBody, errMsg, durationMS})
	return nil
}

func webhookSample() *models.Webhook {
	return &models.Webhook{
		ID: "w-1", TenantID: "t-1", Name: "ci-done",
		URL: "https://example.test/hook", SecretKey: "shh",
		Headers: `{"X-Team":"ci"}`, TimeoutSeconds: 15,
	}
}

// TestTestWebhook_PostsThenLogs pins both halves of the endpoint: the probe has to
// really reach the URL, and the outcome has to land in chatops_webhook_logs. The
// first version of this method returned a fixed success result after loading the
// row, so the admin UI reported "delivered" for a URL that nobody had called.
func TestTestWebhook_PostsThenLogs(t *testing.T) {
	var gotPath string
	var gotHeaders http.Header
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotHeaders = r.Header.Clone()
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	wh := webhookSample()
	wh.URL = srv.URL + "/hook"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh}
	withWebhookClient(t, srv.Client())

	result, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if !result.Success {
		t.Fatalf("want a delivered probe, got %q", result.Message)
	}
	if !strings.Contains(result.Message, "HTTP 200") {
		t.Errorf("message does not report the status code: %q", result.Message)
	}

	if gotPath != "/hook" {
		t.Errorf("probe did not POST to the stored URL: %q", gotPath)
	}
	if ct := gotHeaders.Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q", ct)
	}
	if ev := gotHeaders.Get("X-Orion-Webhook-Event"); ev != "webhook_test" {
		t.Errorf("X-Orion-Webhook-Event = %q", ev)
	}
	if sig := gotHeaders.Get("X-Orion-Signature"); sig != "shh" {
		t.Errorf("X-Orion-Signature = %q, want the stored secret", sig)
	}
	if extra := gotHeaders.Get("X-Team"); extra != "ci" {
		t.Errorf("stored header JSON was not applied: X-Team = %q", extra)
	}

	var payload map[string]string
	if err := json.Unmarshal(gotBody, &payload); err != nil {
		t.Fatalf("probe body is not JSON: %v", err)
	}
	if payload["event"] != "webhook_test" || payload["webhook_id"] != "w-1" || payload["tenant_id"] != "t-1" {
		t.Errorf("unexpected payload: %v", payload)
	}
	if _, ok := payload["sent_at"]; !ok {
		t.Errorf("payload has no sent_at: %v", payload)
	}

	if len(repo.logs) != 1 {
		t.Fatalf("expected one delivery log, got %d", len(repo.logs))
	}
	log := repo.logs[0]
	if log.tenantID != "t-1" || log.webhookID != "w-1" {
		t.Errorf("log keyed at %q/%q", log.tenantID, log.webhookID)
	}
	if log.status != "delivered" || log.responseBody != "ok" || log.errMsg != "" {
		t.Errorf("unexpected log: %+v", log)
	}
	if log.durationMS < 0 {
		t.Errorf("negative duration: %d", log.durationMS)
	}
}

// TestTestWebhook_Non2xxIsAFailure pins the other outcome: the endpoint has to say
// the receiver answered, and say that it did not accept.
func TestTestWebhook_Non2xxIsAFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// w.Write alone would default to 200 and hide the failure path
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))
	defer srv.Close()

	wh := webhookSample()
	wh.URL = srv.URL + "/hook"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh}
	withWebhookClient(t, srv.Client())

	result, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if result.Success {
		t.Fatalf("HTTP 500 reported as a delivery: %q", result.Message)
	}
	if !strings.Contains(result.Message, "HTTP 500") {
		t.Errorf("message does not report the status code: %q", result.Message)
	}
	if len(repo.logs) != 1 {
		t.Fatalf("expected one delivery log, got %d", len(repo.logs))
	}
	log := repo.logs[0]
	if log.status != "failed" || log.errMsg != "HTTP 500" || log.responseBody != "boom" {
		t.Errorf("unexpected log: %+v", log)
	}
}

// TestTestWebhook_UnreachableStillWritesALog: the answer is that the host could
// not be reached, not that the check passed.
func TestTestWebhook_UnreachableStillWritesALog(t *testing.T) {
	// port 1 is not listening, so this is a refused connection rather than a hang
	wh := webhookSample()
	wh.URL = "http://127.0.0.1:1/hook"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh}

	result, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if result.Success || !strings.Contains(result.Message, "webhook unreachable") {
		t.Fatalf("unreachable host reported as %q", result.Message)
	}
	if len(repo.logs) != 1 || repo.logs[0].status != "failed" || repo.logs[0].errMsg == "" {
		t.Fatalf("expected a failed log with a reason, got %+v", repo.logs)
	}
}

// TestTestWebhook_MalformedURLFailsFast: a URL the client cannot build is not a
// delivery, and it still has to say where it went wrong.
func TestTestWebhook_MalformedURLFailsFast(t *testing.T) {
	wh := webhookSample()
	wh.URL = "://not-a-url"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh}

	result, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if result.Success || !strings.Contains(result.Message, "build webhook request") {
		t.Fatalf("bad URL reported as %q", result.Message)
	}
	// the audit row carries the raw driver error; the human message carries the
	// prefix, so both must be non-empty
	if len(repo.logs) != 1 || repo.logs[0].status != "failed" || repo.logs[0].errMsg == "" {
		t.Fatalf("expected a logged build error, got %+v", repo.logs)
	}
}

// TestTestWebhook_HonoursTheCallerContextDeadline proves the request carries the
// derived context. A server that never answers would otherwise hang for the whole
// stored timeout; with a parent deadline the probe gives up and reports it.
func TestTestWebhook_HonoursTheCallerContextDeadline(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(time.Second)
	}))
	defer srv.Close()

	wh := webhookSample()
	wh.URL = srv.URL + "/hook"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh}
	withWebhookClient(t, srv.Client())

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	result, err := NewService(repo).TestWebhook(ctx, "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if result.Success || !strings.Contains(result.Message, "webhook unreachable") {
		t.Fatalf("deadline reported as %q", result.Message)
	}
	if len(repo.logs) != 1 || repo.logs[0].status != "failed" {
		t.Fatalf("expected a failed log, got %+v", repo.logs)
	}
}

// TestTestWebhook_LogWriteFailureKeepsTheAnswer: the probe already reached the
// receiver, so a failed audit write must not turn the result into an error.
func TestTestWebhook_LogWriteFailureKeepsTheAnswer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	wh := webhookSample()
	wh.URL = srv.URL + "/hook"
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhook: wh,
		logErr: errors.New("audit table unavailable")}
	withWebhookClient(t, srv.Client())

	result, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("TestWebhook: %v", err)
	}
	if !result.Success {
		t.Fatalf("a logged failure hid the delivery: %q", result.Message)
	}
	if !strings.Contains(result.Message, "delivery log not written") ||
		!strings.Contains(result.Message, "audit table unavailable") {
		t.Errorf("message does not carry the log failure: %q", result.Message)
	}
}

// TestTestWebhook_MissingWebhookIsNotFound: both repository outcomes for a
// nonexistent row have to reach the handler as 404, not as a 500.
func TestTestWebhook_MissingWebhookIsNotFound(t *testing.T) {
	for _, tc := range []struct {
		name       string
		webhook    *models.Webhook
		webhookErr error
	}{
		// the repository wraps the driver's sql.ErrNoRows in getOne
		{"repository wrapped no rows", nil, sentinel.NotFound},
		{"nil row and nil error", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(),
				webhook: tc.webhook, webhookErr: tc.webhookErr}
			_, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-missing")
			if !IsNotFound(err) {
				t.Fatalf("want sentinel.NotFound, got %v", err)
			}
			if len(repo.logs) != 0 {
				t.Fatalf("a probe that never ran still wrote %d log(s)", len(repo.logs))
			}
		})
	}
}

// TestTestWebhook_RepositoryErrorSurfaces: a database failure is not a
// "not found" row, so it has to come out as itself.
func TestTestWebhook_RepositoryErrorSurfaces(t *testing.T) {
	repo := &webhookRepo{mockChatOpsRepo: newMockChatOpsRepo(), webhookErr: errors.New("db down")}
	_, err := NewService(repo).TestWebhook(context.Background(), "t-1", "w-1")
	if err == nil || errors.Is(err, sentinel.NotFound) || err.Error() != "db down" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWebhookHeaderMap_ParsesAndToleratesGarbage(t *testing.T) {
	for _, tc := range []struct {
		name string
		raw  string
		want map[string]string
	}{
		{"empty", "", map[string]string{}},
		{"whitespace", "  ", map[string]string{}},
		{"valid", `{"X-Team":"ci","X-Retry":"3"}`, map[string]string{"X-Team": "ci", "X-Retry": "3"}},
		{"garbage", "not json", map[string]string{}},
		{"wrong shape", `[1,2]`, map[string]string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := webhookHeaderMap(tc.raw)
			if len(got) != len(tc.want) {
				t.Fatalf("webhookHeaderMap(%q) = %v", tc.raw, got)
			}
			if got == nil {
				t.Fatal("nil map where the caller expects an empty one")
			}
		})
	}
}

// withWebhookClient swaps the package-level client for the duration of a test.
// The real server is never opened by these tests; the probe goes wherever the
// httptest transport points it.
func withWebhookClient(t *testing.T, c *http.Client) {
	t.Helper()
	orig := webhookTestClient
	webhookTestClient = c
	t.Cleanup(func() { webhookTestClient = orig })
}
