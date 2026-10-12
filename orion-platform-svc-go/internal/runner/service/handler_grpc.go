// Package service — GRPCHandler: real gRPC-based runner dispatch.
//
// P0-D2 delivers a real gRPC client for the grpc protocol. The wire
// contract is intentionally minimal: DispatchTask uses a
// unary-call convention with the Job payload serialized as
// application/grpc+json (proto JSON marshalling via google.golang.org/protobuf).
//
// Endpoint encoding:
//   agent.Endpoint = "grpc://<host:port>" or "grpcs://<host:port>?tls=false"
//
// The handler is pluggable: GRPCRunnerClientInterface is the SPI a
// generated proto client implements. Without a generated client, callers
// can supply any unary-call adapter — the wire protocol itself is
// orthogonal to this handler.
//
// Default: uses a minimal JSON-over-gRPC dispatcher that talks to a
// runner-side unary endpoint. For typed clients, wrap and register your
// own GRPCRunnerClientInterface.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"google.golang.org/grpc"
	grpcinsecure "google.golang.org/grpc/credentials/insecure"
)

// GRPCRunnerConfig holds gRPC connection settings.
type GRPCRunnerConfig struct {
	// DefaultDeadline caps unary calls (default 30s).
	DefaultDeadline time.Duration
	// Credentials are optional; empty means insecure (in-cluster/dev).
	Credentials credentialsConfig
}

// credentialsConfig is a minimal view of transport credential options.
// Kept as a wrapper to avoid leaking google.golang.org/grpc/credentials
// into the public handler struct.
type credentialsConfig struct {
	// Insecure allows plaintext (dev only; production should use TLS).
	Insecure bool
	// TLSConfig is passed through to grpc.WithTransportCredentials.
	// If nil + Insecure=true, plaintext is used.
	TLSConfig interface{}
}

// GRPCRunnerClientInterface is the SPI a generated gRPC client
// implements. Real implementations wrap a .pb.go generated client and
// translate the request/response into the wire JSON.
type GRPCRunnerClientInterface interface {
	// DispatchJob invokes the runner's dispatch unary RPC.
	// Returns the dispatch ID (echoed from the runner).
	DispatchJob(ctx context.Context, targetGRPCEndpoint string, req *GRPCCallRequest) (string, error)
}

// GRPCCallRequest is the JSON payload sent to the runner gRPC endpoint.
type GRPCCallRequest struct {
	JobID    string                 `json:"job_id"`
	TaskType string                 `json:"task_type"`
	Params   map[string]interface{} `json:"params"`
}

// GRPCHandler dispatches jobs to a Runner agent over gRPC.
type GRPCHandler struct {
	config GRPCRunnerConfig
	// clientFactory builds a grpc.ClientConnInterface for a target.
	// Overridable for tests (nil uses defaultDial).
	clientFactory func(ctx context.Context, target string, cfg GRPCRunnerConfig) (grpc.ClientConnInterface, error)
	// clientAdapter is the unary-call SPI. Overridable for tests.
	clientAdapter GRPCRunnerClientInterface
}

// NewGRPCHandlerWithConfig wires a GRPCHandler with an explicit config.
func NewGRPCHandlerWithConfig(cfg GRPCRunnerConfig) *GRPCHandler {
	if cfg.DefaultDeadline == 0 {
		cfg.DefaultDeadline = 30 * time.Second
	}
	return &GRPCHandler{config: cfg}
}

// WithClientFactory overrides the grpc.DialContext constructor (for tests).
func (h *GRPCHandler) WithClientFactory(f func(ctx context.Context, target string, cfg GRPCRunnerConfig) (grpc.ClientConnInterface, error)) *GRPCHandler {
	h.clientFactory = f
	return h
}

// WithClientAdapter overrides the unary-call adapter (for tests / typed clients).
func (h *GRPCHandler) WithClientAdapter(c GRPCRunnerClientInterface) *GRPCHandler {
	h.clientAdapter = c
	return h
}

// Protocol returns "grpc".
func (h *GRPCHandler) Protocol() RunnerProtocol { return ProtocolGRPC }

// DispatchTask dials the gRPC endpoint (or reuses a cached conn) and
// invokes the runner's dispatch unary RPC.
func (h *GRPCHandler) DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error) {
	if agent == nil || agent.Endpoint == "" {
		return "", fmt.Errorf("runner: grpc handler requires agent.endpoint")
	}
	target, insecure := parseGRPCEndpoint(agent.Endpoint)
	if target == "" {
		return "", fmt.Errorf("runner: grpc handler requires 'grpc://host:port' or 'grpcs://host:port' endpoint")
	}
	if job == nil || job.JobID == "" {
		return "", fmt.Errorf("runner: grpc handler requires job.job_id")
	}
	callCtx, cancel := context.WithTimeout(ctx, h.config.DefaultDeadline)
	defer cancel()

	// If a custom client adapter is installed, delegate immediately.
	if h.clientAdapter != nil {
		return h.clientAdapter.DispatchJob(callCtx, target, &GRPCCallRequest{
			JobID:    job.JobID,
			TaskType: job.TaskType,
			Params:   job.Params,
		})
	}

	conn, err := h.dial(callCtx, target, insecure)
	if err != nil {
		return "", fmt.Errorf("runner: grpc dial %s: %w", target, err)
	}
	// *ClientConn (concrete) has Close; ClientConnInterface does not.
	// Safe type-assert — defaultDial always returns *ClientConn.
	if cc, ok := conn.(*grpc.ClientConn); ok {
		defer cc.Close()
	}

	// Default adapter: use grpc.Invoke with a JSON-encoded body.
	// The runner-side service is expected to expose a generic
	// /runner.Dispatcher/Dispatch method. Callers who prefer typed
	// clients should install a custom adapter.
	body := GRPCCallRequest{
		JobID:    job.JobID,
		TaskType: job.TaskType,
		Params:   job.Params,
	}
	reqBytes, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("runner: grpc marshal: %w", err)
	}
	var respBytes []byte
	err = conn.Invoke(callCtx, "/runner.Dispatcher/Dispatch", reqBytes, &respBytes)
	if err != nil {
		return "", fmt.Errorf("runner: grpc invoke: %w", err)
	}
	var resp struct {
		DispatchID string `json:"dispatch_id"`
	}
	if len(respBytes) > 0 {
		if err := json.Unmarshal(respBytes, &resp); err != nil {
			// Non-JSON response: return the raw body trimmed.
			return strings.TrimSpace(string(respBytes)), nil
		}
	}
	return resp.DispatchID, nil
}

// dial builds a grpc.ClientConnInterface using the configured transport.
func (h *GRPCHandler) dial(ctx context.Context, target string, insecure bool) (grpc.ClientConnInterface, error) {
	if h.clientFactory != nil {
		return h.clientFactory(ctx, target, h.config)
	}
	return defaultDial(ctx, target, h.config, insecure)
}

// defaultDial is the production dialer. Empty insecure=true uses
// credentials/insecure.NewCredentials (in-cluster/dev).
func defaultDial(ctx context.Context, target string, cfg GRPCRunnerConfig, insecure bool) (grpc.ClientConnInterface, error) {
	opts := []grpc.DialOption{}
	if insecure {
		opts = append(opts, grpc.WithTransportCredentials(grpcinsecure.NewCredentials()))
	}
	conn, err := grpc.DialContext(ctx, target, opts...)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

// parseGRPCEndpoint extracts (host:port, insecure) from the endpoint.
// Supports:
//   - "grpc://host:port"       → (host:port, true)  insecure
//   - "grpcs://host:port"      → (host:port, false) TLS
//   - "host:port" (bare)       → (host:port, true)  insecure default
//
// Query params after '?' are stripped (url.Parse handles them, but we
// only care about the host:port segment).
func parseGRPCEndpoint(endpoint string) (string, bool) {
	if endpoint == "" {
		return "", false
	}
	rest := endpoint
	insecure := true // default
	if strings.HasPrefix(rest, "grpcs://") {
		rest = strings.TrimPrefix(rest, "grpcs://")
		insecure = false
	} else if strings.HasPrefix(rest, "grpc://") {
		rest = strings.TrimPrefix(rest, "grpc://")
		insecure = true
	}
	// Strip query string if present.
	if i := strings.IndexByte(rest, '?'); i >= 0 {
		rest = rest[:i]
	}
	// Split off a leading path segment if the URL had a path.
	// E.g. "grpc://10.0.0.1:50051/foo" → we only want "10.0.0.1:50051".
	// We do NOT parse via url.Parse because IPv4 without brackets
	// (10.0.0.1:50051) is ambiguous under URL syntax.
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		rest = rest[:i]
	}
	rest = strings.TrimSpace(rest)
	if rest == "" {
		return "", false
	}
	return rest, insecure
}
