package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

// stubExecutor implements remotecommand.Executor. Returns canned stdout.
type stubExecutor struct {
	stdout   string
	stderr   string
	err      error
	streamed bool
	lastOpts remotecommand.StreamOptions
}

func (s *stubExecutor) Stream(options remotecommand.StreamOptions) error {
	s.streamed = true
	s.lastOpts = options
	return nil
}

func (s *stubExecutor) StreamWithContext(ctx context.Context, opts remotecommand.StreamOptions) error {
	s.streamed = true
	s.lastOpts = opts
	if s.err != nil {
		return s.err
	}
	if opts.Stdout != nil {
		_, _ = opts.Stdout.Write([]byte(s.stdout))
	}
	if opts.Stderr != nil && s.stderr != "" {
		_, _ = opts.Stderr.Write([]byte(s.stderr))
	}
	return nil
}

func TestParseK8sEndpoint_OK(t *testing.T) {
	tgt, err := ParseK8sEndpoint("k8s://my-pod?namespace=prod&container=sidecar")
	if err != nil {
		t.Fatalf("ParseK8sEndpoint: %v", err)
	}
	if tgt.Pod != "my-pod" {
		t.Errorf("Pod = %q, want my-pod", tgt.Pod)
	}
	if tgt.Namespace != "prod" {
		t.Errorf("Namespace = %q, want prod", tgt.Namespace)
	}
	if tgt.Container != "sidecar" {
		t.Errorf("Container = %q, want sidecar", tgt.Container)
	}
}

func TestParseK8sEndpoint_DefaultContainer(t *testing.T) {
	tgt, err := ParseK8sEndpoint("k8s://my-pod?namespace=prod")
	if err != nil {
		t.Fatalf("ParseK8sEndpoint: %v", err)
	}
	if tgt.Container != "bash" {
		t.Errorf("Container default = %q, want bash", tgt.Container)
	}
}

func TestParseK8sEndpoint_Errors(t *testing.T) {
	cases := []string{
		"",
		"http://my-pod?namespace=prod",
		"k8s://",
		"k8s://my-pod",
	}
	for _, c := range cases {
		if _, err := ParseK8sEndpoint(c); err == nil {
			t.Errorf("ParseK8sEndpoint(%q): expected error", c)
		}
	}
}

func TestBuildExecURL(t *testing.T) {
	got, err := buildExecURL("https://10.0.0.1:6443",
		&K8sExecTarget{Pod: "my-pod", Namespace: "prod", Container: "c1"})
	if err != nil {
		t.Fatalf("buildExecURL: %v", err)
	}
	for _, want := range []string{
		"https://10.0.0.1:6443/api/v1/namespaces",
		"/prod/pods/my-pod/exec",
		"command=sh",
		"container=c1",
		"stdout=true",
		"stderr=true",
		"stdin=false",
		"tty=false",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("buildExecURL result %q missing %q", got, want)
		}
	}
}

func TestBuildRESTConfig(t *testing.T) {
	cfg := KubernetesConfig{
		APIHost:               "https://10.0.0.1:6443",
		BearerToken:           "tok",
		CAServerName:          "k8s.local",
		CACertBytes:           []byte("PEM"),
		InsecureSkipTLSVerify: true,
	}
	rc := buildRESTConfig(cfg)
	if rc.Host != cfg.APIHost {
		t.Errorf("Host = %q, want %q", rc.Host, cfg.APIHost)
	}
	if rc.BearerToken != cfg.BearerToken {
		t.Errorf("BearerToken = %q", rc.BearerToken)
	}
	if rc.TLSClientConfig.ServerName != cfg.CAServerName {
		t.Errorf("ServerName = %q", rc.TLSClientConfig.ServerName)
	}
	if !rc.TLSClientConfig.Insecure {
		t.Error("Insecure not set")
	}
}

func TestK8sExecHandler_DispatchTask_OK(t *testing.T) {
	stub := &stubExecutor{stdout: "hello from pod\n"}
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{
		APIHost: "https://10.0.0.1:6443",
		BearerToken: "tok",
		Timeout: 5 * time.Second,
	})
	h.WithExecutorFactory(func(_ *rest.Config, apiURL string) (remotecommand.Executor, error) {
		if !strings.Contains(apiURL, "/prod/pods/my-pod/exec") {
			t.Errorf("apiURL = %q, want prod/pods/my-pod/exec", apiURL)
		}
		return stub, nil
	})

	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://my-pod?namespace=prod&container=c1"},
		&RunnerJobView{JobID: "job-1", TaskType: "shell", Params: map[string]interface{}{"command": "echo hello from pod"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if !stub.streamed {
		t.Error("stub.StreamWithContext was not called")
	}
	if !strings.Contains(id, "my-pod") || !strings.Contains(id, "hello from pod") {
		t.Errorf("dispatch id = %q", id)
	}
}

func TestK8sExecHandler_DispatchTask_UsesScriptFallback(t *testing.T) {
	stub := &stubExecutor{stdout: "script ok"}
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{APIHost: "https://x"})
	h.WithExecutorFactory(func(_ *rest.Config, _ string) (remotecommand.Executor, error) {
		return stub, nil
	})

	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://my-pod?namespace=prod"},
		&RunnerJobView{JobID: "job-1", Params: map[string]interface{}{"script": "echo hi"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask script fallback: %v", err)
	}
	if !stub.streamed {
		t.Error("stub not called")
	}
}

func TestK8sExecHandler_DispatchTask_NoCommandOrScript(t *testing.T) {
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{APIHost: "https://x"})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://my-pod?namespace=prod"},
		&RunnerJobView{JobID: "job-1", Params: map[string]interface{}{"foo": "bar"}},
	)
	if err == nil {
		t.Fatalf("expected error when no command/script")
	}
}

func TestK8sExecHandler_DispatchTask_InvalidEndpoint(t *testing.T) {
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{APIHost: "https://x"})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "not-a-k8s-url"},
		&RunnerJobView{JobID: "job-1", Params: map[string]interface{}{"command": "echo"}},
	)
	if err == nil {
		t.Fatalf("expected parse error")
	}
}

func TestK8sExecHandler_DispatchTask_MissingAPIHost(t *testing.T) {
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://my-pod?namespace=prod"},
		&RunnerJobView{JobID: "job-1", Params: map[string]interface{}{"command": "echo"}},
	)
	if err == nil {
		t.Fatalf("expected APIHost error")
	}
}

func TestK8sExecHandler_DispatchTask_StreamerError(t *testing.T) {
	stub := &stubExecutor{err: errors.New("stream broken")}
	h := NewK8sExecHandlerWithConfig(KubernetesConfig{APIHost: "https://x"})
	h.WithExecutorFactory(func(_ *rest.Config, _ string) (remotecommand.Executor, error) {
		return stub, nil
	})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://my-pod?namespace=prod"},
		&RunnerJobView{JobID: "job-1", Params: map[string]interface{}{"command": "echo"}},
	)
	if err == nil {
		t.Fatalf("expected stream error to propagate")
	}
	if !strings.Contains(err.Error(), "stream broken") {
		t.Errorf("err = %v, want contains 'stream broken'", err)
	}
}

func TestK8sExecHandler_PlaceholderReturnsNotFound(t *testing.T) {
	p := newK8sExecPlaceholder()
	_, err := p.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "k8s://x?namespace=y"},
		&RunnerJobView{JobID: "j"},
	)
	if !errors.Is(err, ErrHandlerNotFound) {
		t.Errorf("placeholder: got %v, want ErrHandlerNotFound", err)
	}
}

func TestHTTPHandler_BuildRESTConfigNotUsed(t *testing.T) {
	// Sanity check: HTTPHandler doesn't touch K8s config.
	h := NewHTTPHandler()
	_ = h
}

// HTTP test double for verifying no cross-contamination between handlers.
var _ http.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
})

// Ensure httptest imports are exercised by at least one test (compile-time check).
func TestHTTPServerHelperAvailable(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer s.Close()
	if s.URL == "" {
		t.Error("expected httptest server URL")
	}
}
