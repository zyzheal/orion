package engine

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCheckSQL_PostsToCheckAndReturnsResult(t *testing.T) {
	var gotPath, gotMethod, gotBody string
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		gotAuth = r.Header.Get("X-API-Key")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(Result{
			Success:      true,
			AffectedRows: 42,
			Warnings:     []string{"warn-1"},
			DurationMS:   123,
		})
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL, APIKey: "secret", Timeout: 5 * time.Second})
	res, err := c.CheckSQL(context.Background(), TaskRequest{
		TaskName:     "audit-1",
		SQLStatement: "SELECT 1",
		DryRun:       true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodPost || gotPath != "/check" {
		t.Fatalf("expected POST /check, got %s %s", gotMethod, gotPath)
	}
	if gotAuth != "secret" {
		t.Fatalf("expected X-API-Key: secret, got %q", gotAuth)
	}
	if !strings.Contains(gotBody, "\"sql\":\"SELECT 1\"") {
		t.Errorf("body did not contain sql: %s", gotBody)
	}
	if !res.Success || res.AffectedRows != 42 || len(res.Warnings) != 1 {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestExecuteSQL_PostsToExecute(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(Result{Success: true})
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	if _, err := c.ExecuteSQL(context.Background(), TaskRequest{TaskName: "x", SQLStatement: "INSERT INTO t VALUES (1)"}); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/execute" {
		t.Fatalf("expected /execute, got %s", gotPath)
	}
}

func TestClient_NonSuccessReturnsAPIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"invalid sql"}`))
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	_, err := c.CheckSQL(context.Background(), TaskRequest{TaskName: "x", SQLStatement: "not sql"})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", apiErr.StatusCode)
	}
	if !strings.Contains(apiErr.Body, "invalid sql") {
		t.Fatalf("expected body to contain error, got %q", apiErr.Body)
	}
}

func TestClient_EmptyBaseURLReturnsError(t *testing.T) {
	c := New(Config{})
	_, err := c.CheckSQL(context.Background(), TaskRequest{})
	if err == nil {
		t.Fatal("expected error for empty baseURL")
	} else if !strings.Contains(err.Error(), "baseURL is empty") {
		t.Fatalf("expected baseURL-empty error, got %v", err)
	}
	if err := c.Health(context.Background()); err == nil {
		t.Fatal("expected error for empty baseURL")
	} else if !strings.Contains(err.Error(), "baseURL is empty") {
		t.Fatalf("expected baseURL-empty error, got %v", err)
	}
}

func TestParseResultResponse(t *testing.T) {
	body := []byte(`{"success":true,"message":"ok","affected_rows":3,"errors":[],"warnings":["w1"],"duration_ms":9}`)
	res, err := ParseResultResponse(body)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Success || res.AffectedRows != 3 || res.DurationMS != 9 {
		t.Fatalf("unexpected: %+v", res)
	}
}

func TestHealth_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("expected /health, got %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	if err := c.Health(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestHealth_DownReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	if err := c.Health(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

func TestHealth_TransportErrorPropagates(t *testing.T) {
	c := New(Config{BaseURL: "http://127.0.0.1:1", Timeout: 50 * time.Millisecond})
	if err := c.Health(context.Background()); err == nil {
		t.Fatal("expected connection refused error")
	}
}
