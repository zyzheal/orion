package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCanonicalProtocol_NormalizesAliases(t *testing.T) {
	cases := []struct {
		in   string
		want RunnerProtocol
	}{
		{"http", ProtocolHTTP},
		{"HTTP", ProtocolHTTP},
		{"ssh", ProtocolSSH},
		{"k8s-exec", ProtocolK8sExec},
		{"k8s_exec", ProtocolK8sExec},
		{"kubernetes", ProtocolK8sExec},
		{"winrm", ProtocolWinRM},
		{"grpc", ProtocolGRPC},
		{"", DefaultProtocol},
		{"default", DefaultProtocol},
		{"  http  ", ProtocolHTTP}, // trim
		{"unknown", ProtocolHTTP},  // fallback
		{"ftp", ProtocolHTTP},      // fallback
	}
	for _, tc := range cases {
		got := CanonicalProtocol(RunnerProtocol(tc.in))
		if got != tc.want {
			t.Errorf("CanonicalProtocol(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestHandlerRegistry_RegisterAndLookup(t *testing.T) {
	r := NewHandlerRegistry()

	if h := r.Lookup(ProtocolHTTP); h != nil {
		t.Errorf("empty registry Lookup(http) = %v, want nil", h)
	}

	h := NewHTTPHandler()
	r.Register(ProtocolHTTP, h)

	got := r.Lookup(ProtocolHTTP)
	if got != h {
		t.Errorf("Lookup(http) after Register = %T, want %T", got, h)
	}
	// Case-insensitive / alias: canonical form stored, alias also resolves.
	if got2 := r.Lookup(RunnerProtocol("HTTP")); got2 != h {
		t.Errorf("Lookup('HTTP') via alias = %T, want same handler", got2)
	}
}

func TestHandlerRegistry_RegisterIgnoresNil(t *testing.T) {
	r := NewHandlerRegistry()
	r.Register(ProtocolHTTP, nil)
	if h := r.Lookup(ProtocolHTTP); h != nil {
		t.Errorf("nil Register: Lookup = %v, want nil", h)
	}
}

func TestHandlerRegistry_NormalizesKeyOnRegister(t *testing.T) {
	r := NewHandlerRegistry()
	h := newK8sExecPlaceholder()
	// Register under an alias — must land in the canonical slot.
	r.Register(RunnerProtocol("k8s_exec"), h)
	got := r.Lookup(ProtocolK8sExec)
	if got != h {
		t.Errorf("Register('k8s_exec') + Lookup('k8s-exec') = %T, want same handler", got)
	}
}

func TestAllHandlers_RegistersAll5(t *testing.T) {
	r := AllHandlers()
	for _, p := range AllProtocols {
		if h := r.Lookup(p); h == nil {
			t.Errorf("AllHandlers: Lookup(%s) = nil", p)
		}
	}
}

func TestHTTPHandler_DispatchTask_OK(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.Header.Get("X-Orion-Protocol") != "http" {
			t.Errorf("X-Orion-Protocol = %q", r.Header.Get("X-Orion-Protocol"))
		}
		if r.Header.Get("X-Orion-Agent-Id") != "agent-1" {
			t.Errorf("X-Orion-Agent-Id = %q", r.Header.Get("X-Orion-Agent-Id"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"dispatch_id":"dj-xyz"}`))
	}))
	defer server.Close()

	h := NewHTTPHandler()
	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{ID: "id-1", AgentID: "agent-1", Endpoint: server.URL, Protocol: ProtocolHTTP},
		&RunnerJobView{JobID: "job-1", TaskType: "shell", Params: map[string]interface{}{"command": "echo hi"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if id != `{"dispatch_id":"dj-xyz"}` {
		t.Errorf("dispatch id = %q", id)
	}
}

func TestHTTPHandler_DispatchTask_204(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	h := NewHTTPHandler()
	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: server.URL},
		&RunnerJobView{JobID: "job-1"},
	)
	if err != nil {
		t.Fatalf("DispatchTask 204: %v", err)
	}
	if id != "" {
		t.Errorf("dispatch id for 204 = %q, want empty", id)
	}
}

func TestHTTPHandler_DispatchTask_Non2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer server.Close()

	h := NewHTTPHandler()
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: server.URL},
		&RunnerJobView{JobID: "job-1"},
	)
	if err == nil {
		t.Fatalf("DispatchTask non-2xx: expected error, got nil")
	}
}

func TestHTTPHandler_DispatchTask_MissingEndpoint(t *testing.T) {
	h := NewHTTPHandler()
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: ""},
		&RunnerJobView{JobID: "job-1"},
	)
	if err == nil {
		t.Fatalf("DispatchTask empty endpoint: expected error")
	}
}

func TestHTTPHandler_DispatchTask_MissingJobID(t *testing.T) {
	h := NewHTTPHandler()
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "http://example.com"},
		&RunnerJobView{JobID: ""},
	)
	if err == nil {
		t.Fatalf("DispatchTask empty job_id: expected error")
	}
}

func TestHTTPHandler_DispatchTask_ContextCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	h := NewHTTPHandler().WithHTTPClient(&http.Client{Timeout: 5 * time.Second})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := h.DispatchTask(ctx,
		&RunnerAgentView{Endpoint: server.URL},
		&RunnerJobView{JobID: "job-1"},
	)
	if err == nil {
		t.Fatalf("DispatchTask cancelled ctx: expected error")
	}
}

func TestPlaceholderHandlers_ReturnErrHandlerNotFound(t *testing.T) {
	cases := []RunnerHandler{
		NewSSHHandler(),
		newK8sExecPlaceholder(),
		NewWinRMHandler(),
		NewGRPCHandler(),
	}
	for _, h := range cases {
		_, err := h.DispatchTask(context.Background(),
			&RunnerAgentView{Endpoint: "x"},
			&RunnerJobView{JobID: "j"},
		)
		if !errors.Is(err, ErrHandlerNotFound) {
			t.Errorf("handler %s DispatchTask: got %v, want ErrHandlerNotFound", h.Protocol(), err)
		}
	}
}
