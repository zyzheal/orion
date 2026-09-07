package aireview

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewAIClientWithEmptyConfigReportsDisabled(t *testing.T) {
	c := NewAIClient("", "", "")
	if c.IsEnabled() {
		t.Error("expected disabled client for empty baseURL/apiKey")
	}
	if _, _, err := c.Review(context.Background(), "prompt"); err != ErrAIDisabled {
		t.Errorf("expected ErrAIDisabled, got %v", err)
	}
}

func TestAIClientReviewSuccess(t *testing.T) {
	var gotBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("expected /v1/chat/completions, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing auth header: %q", r.Header.Get("Authorization"))
		}
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		  "id":"chat-1","model":"gpt-4o-mini",
		  "choices":[{"message":{"role":"assistant","content":"{\"suggestions\":[{\"category\":\"performance\",\"severity\":\"warning\",\"title\":\"T\"}]}"}}]
		}`))
	}))
	defer srv.Close()

	c := NewAIClientWithConfig(AIClientConfig{
		BaseURL: srv.URL,
		APIKey:  "test-key",
		Model:   "gpt-4o-mini",
		Timeout: 2 * time.Second,
	})
	if !c.IsEnabled() {
		t.Fatal("expected enabled client")
	}

	suggestions, model, err := c.Review(context.Background(), "prompt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if model != "gpt-4o-mini" {
		t.Errorf("expected model gpt-4o-mini, got %q", model)
	}
	if len(suggestions) != 1 || suggestions[0].Title != "T" {
		t.Errorf("unexpected suggestions: %v", suggestions)
	}
	// Request body should carry our prompt and model.
	if gotBody["model"] != "gpt-4o-mini" {
		t.Errorf("expected model in request, got %v", gotBody["model"])
	}
	msgs := gotBody["messages"].([]interface{})
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].(map[string]interface{})["content"] != "prompt" {
		t.Errorf("expected prompt content")
	}
}

func TestAIClientReviewTimeoutDegrades(t *testing.T) {
	// Trigger a timeout via the outer context, not via http.Client.
	// A hung handler goroutine in httptest would block server.Close(),
	// so we drive the timeout through context.WithTimeout instead.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Sleep long enough that the outer context fires first.
		time.Sleep(500 * time.Millisecond)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"suggestions\":[]}"}}]}`))
	}))
	defer srv.Close()

	c := NewAIClientWithConfig(AIClientConfig{
		BaseURL: srv.URL,
		APIKey:  "k",
		Model:   "m",
		Timeout: 2 * time.Second,
	})
	// 30ms outer deadline — should fire before the client timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, _, err := c.Review(ctx, "prompt")
	if err == nil {
		t.Error("expected timeout error")
	}
	joined := strings.ToLower(err.Error())
	if !strings.Contains(joined, "deadline") &&
		!strings.Contains(joined, "context") {
		t.Errorf("expected timeout-ish error, got: %v", err)
	}
}

func TestAIClientReviewHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
	}))
	defer srv.Close()

	c := NewAIClientWithConfig(AIClientConfig{
		BaseURL: srv.URL, APIKey: "k", Model: "m", Timeout: 2 * time.Second,
	})
	_, _, err := c.Review(context.Background(), "p")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("expected status in error, got %v", err)
	}
}

func TestAIClientMalformedResponseReturnsEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"not json at all"}}]}`))
	}))
	defer srv.Close()

	c := NewAIClientWithConfig(AIClientConfig{
		BaseURL: srv.URL, APIKey: "k", Model: "m", Timeout: 2 * time.Second,
	})
	got, _, err := c.Review(context.Background(), "p")
	// Contract: parse errors return []AISuggestion{} not error.
	if err != nil {
		t.Fatalf("malformed LLM output should not surface as error, got %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Errorf("expected empty non-nil slice, got %v", got)
	}
}

func TestAIClientRateLimitPerTenant(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"suggestions\":[]}"}}]}`))
	}))
	defer srv.Close()

	c := NewAIClientWithConfig(AIClientConfig{
		BaseURL: srv.URL, APIKey: "k", Model: "m",
		Timeout: 2 * time.Second,
		RateLimitPerTenant: 3,
	})
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		if _, _, err := c.ReviewForTenant(ctx, "p", "t1"); err != nil {
			t.Fatalf("call %d should succeed: %v", i, err)
		}
	}
	if _, _, err := c.ReviewForTenant(ctx, "p", "t1"); err != ErrRateLimited {
		t.Errorf("expected ErrRateLimited on 4th call, got %v", err)
	}
	// Different tenant should still be allowed.
	if _, _, err := c.ReviewForTenant(ctx, "p", "t2"); err != nil {
		t.Errorf("other tenant should be allowed, got %v", err)
	}
}

func TestAIClientBaseURLWithV1Suffix(t *testing.T) {
	c := NewAIClient("http://example.com/v1", "k", "m")
	if c.requestURL() != "http://example.com/v1/chat/completions" {
		t.Errorf("expected /v1 suffix preservation, got %s", c.requestURL())
	}
	c2 := NewAIClient("http://example.com", "k", "m")
	if c2.requestURL() != "http://example.com/v1/chat/completions" {
		t.Errorf("expected /v1 prefix added, got %s", c2.requestURL())
	}
}
