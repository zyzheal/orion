// Package service — K8sExecHandler: real Kubernetes pod-exec dispatch.
//
// P0-D2 delivers real (not placeholder) client-side dispatch for the
// k8s-exec protocol. Wire protocol: kubectl-style SPDY exec against the
// pod's /exec subresource on the K8s API server.
//
// Endpoint encoding (per ADR-012 registry pattern):
//   agent.Endpoint = "k8s://<pod-name>?namespace=<ns>&container=<c>"
//
// KubernetesConfig supplies the K8s API server URL, bearer token, and
// optional CA bundle. Missing required values return early with an
// actionable error.
//
// Testability: ExecutorFactory is injectable so tests can stub stream
// execution without standing up a real K8s cluster.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

// KubernetesConfig holds credentials for connecting to a K8s API server.
type KubernetesConfig struct {
	// APIHost is the K8s API server URL (e.g. "https://10.0.0.1:6443").
	APIHost string
	// BearerToken is the API token.
	BearerToken string
	// CAServerName, if set, overrides server name verification.
	CAServerName string
	// CACertBytes is a PEM CA bundle (optional).
	CACertBytes []byte
	// InsecureSkipTLSVerify skips server cert verification (dev only).
	InsecureSkipTLSVerify bool
	// Timeout bounds the exec stream (default 10 min).
	Timeout time.Duration
}

// K8sExecTarget is the decoded form of agent.Endpoint.
type K8sExecTarget struct {
	Pod       string
	Namespace string
	Container string
}

// ParseK8sEndpoint decodes "k8s://<pod>?namespace=<ns>&container=<c>"
// into a K8sExecTarget. Empty pod/namespace returns an error.
func ParseK8sEndpoint(endpoint string) (*K8sExecTarget, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("runner: k8s-exec endpoint is required")
	}
	if !strings.HasPrefix(endpoint, "k8s://") {
		return nil, fmt.Errorf("runner: k8s-exec endpoint must start with 'k8s://', got %q", endpoint)
	}
	rest := strings.TrimPrefix(endpoint, "k8s://")
	// Split at the first '?' — path is pod name, query carries namespace/container.
	pod, queryStr, _ := strings.Cut(rest, "?")
	pod = strings.TrimSpace(pod)
	if pod == "" {
		return nil, fmt.Errorf("runner: k8s-exec endpoint missing pod name: %q", endpoint)
	}
	q, err := url.ParseQuery(queryStr)
	if err != nil {
		return nil, fmt.Errorf("runner: parse k8s endpoint query: %w", err)
	}
	ns := q.Get("namespace")
	if ns == "" {
		return nil, fmt.Errorf("runner: k8s-exec endpoint missing namespace query param: %q", endpoint)
	}
	container := q.Get("container")
	if container == "" {
		container = "bash"
	}
	return &K8sExecTarget{Pod: pod, Namespace: ns, Container: container}, nil
}

// K8sExecHandler dispatches jobs into a running Pod via kubectl-style SPDY exec.
type K8sExecHandler struct {
	config KubernetesConfig
	// executorFactory builds the remotecommand.Executor for a given
	// rest.Config + API URL. Overridable for testing (nil uses NewSPDYExecutor).
	executorFactory func(cfg *rest.Config, apiURL string) (remotecommand.Executor, error)
}

// NewK8sExecHandlerWithConfig wires a K8sExecHandler with an explicit K8s
// API config. If APIHost is empty, DispatchTask will fail at call time.
func NewK8sExecHandlerWithConfig(cfg KubernetesConfig) *K8sExecHandler {
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Minute
	}
	return &K8sExecHandler{config: cfg}
}

// WithExecutorFactory overrides the remotecommand.Executor constructor.
// Tests use this to stub SPDY streams without a real cluster.
func (h *K8sExecHandler) WithExecutorFactory(f func(cfg *rest.Config, apiURL string) (remotecommand.Executor, error)) *K8sExecHandler {
	h.executorFactory = f
	return h
}

// Protocol returns "k8s-exec".
func (h *K8sExecHandler) Protocol() RunnerProtocol { return ProtocolK8sExec }

// DispatchTask streams the job as `sh -c <script>` inside the pod's
// primary container. Command comes from job.Params["command"]
// (fallback to job.Params["script"]).
func (h *K8sExecHandler) DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error) {
	if agent == nil || agent.Endpoint == "" {
		return "", fmt.Errorf("runner: k8s-exec requires agent.endpoint")
	}
	if job == nil || job.JobID == "" {
		return "", fmt.Errorf("runner: k8s-exec requires job.job_id")
	}
	target, err := ParseK8sEndpoint(agent.Endpoint)
	if err != nil {
		return "", err
	}
	if h.config.APIHost == "" {
		return "", fmt.Errorf("runner: k8s-exec KubernetesConfig.APIHost not set")
	}

	cmd := ""
	if v, ok := job.Params["command"]; ok {
		cmd = fmt.Sprintf("%v", v)
	}
	if cmd == "" {
		if v, ok := job.Params["script"]; ok {
			cmd = fmt.Sprintf("%v", v)
		}
	}
	if cmd == "" {
		return "", fmt.Errorf("runner: k8s-exec job requires command or script param")
	}

	apiURL, err := buildExecURL(h.config.APIHost, target)
	if err != nil {
		return "", err
	}

	cfg := buildRESTConfig(h.config)

	exec, err := h.newExecutor(cfg, apiURL)
	if err != nil {
		return "", fmt.Errorf("runner: k8s-exec new executor: %w", err)
	}

	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)

	execCtx, cancel := context.WithTimeout(ctx, h.config.Timeout)
	defer cancel()

	if err := exec.StreamWithContext(execCtx, remotecommand.StreamOptions{
		Stdin:  nil,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    false,
	}); err != nil {
		return "", fmt.Errorf("runner: k8s-exec stream: %w (stderr=%q)", err, stderr.String())
	}

	payload := map[string]string{
		"pod":       target.Pod,
		"namespace": target.Namespace,
		"stdout":    strings.TrimSpace(stdout.String()),
	}
	if s := strings.TrimSpace(stderr.String()); s != "" {
		payload["stderr"] = s
	}
	b, _ := json.Marshal(payload)
	return string(b), nil
}

// newExecutor constructs a remotecommand.Executor. Uses NewSPDYExecutor
// by default; tests can inject a factory to bypass real SPDY.
func (h *K8sExecHandler) newExecutor(cfg *rest.Config, apiURL string) (remotecommand.Executor, error) {
	if h.executorFactory != nil {
		return h.executorFactory(cfg, apiURL)
	}
	u, err := url.Parse(apiURL)
	if err != nil {
		return nil, fmt.Errorf("runner: k8s-exec parse api url: %w", err)
	}
	return remotecommand.NewSPDYExecutor(cfg, "POST", u)
}

// buildExecURL composes the K8s pod /exec subresource URL with the
// standard SPDY query params.
func buildExecURL(apiHost string, t *K8sExecTarget) (string, error) {
	if apiHost == "" {
		return "", fmt.Errorf("runner: api host is required")
	}
	u, err := url.Parse(strings.TrimRight(apiHost, "/"))
	if err != nil {
		return "", fmt.Errorf("runner: parse api host: %w", err)
	}
	u.Path = fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/exec", t.Namespace, t.Pod)
	u.RawQuery = url.Values{
		"command":   []string{"sh"},
		"container": []string{t.Container},
		"stdout":    []string{"true"},
		"stderr":    []string{"true"},
		"stdin":     []string{"false"},
		"tty":       []string{"false"},
	}.Encode()
	return u.String(), nil
}

// buildRESTConfig converts KubernetesConfig to a rest.Config suitable
// for SPDY transport.
func buildRESTConfig(cfg KubernetesConfig) *rest.Config {
	return &rest.Config{
		Host:        cfg.APIHost,
		BearerToken: cfg.BearerToken,
		TLSClientConfig: rest.TLSClientConfig{
			CAData:     cfg.CACertBytes,
			ServerName: cfg.CAServerName,
			Insecure:   cfg.InsecureSkipTLSVerify,
		},
	}
}
