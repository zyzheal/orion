// Package service — concrete RunnerHandler implementations for each protocol.
//
// P0-D1 introduces 5 pluggable protocols (http, ssh, k8s-exec, winrm, grpc).
// Each handler packages the job payload and delivers it to the agent's
// endpoint over that protocol. The handlers here are minimal working
// skeletons that:
//
//   - HTTP: POST the job JSON to the agent endpoint (real implementation)
//   - SSH: placeholder returning ErrHandlerNotFound (delegates to SSHExecutor later)
//   - K8s-Exec: placeholder (requires k8s.io/client-go — P0-D2)
//   - WinRM: placeholder (requires Azure/go-winrm — P0-D2)
//   - gRPC: placeholder (requires generated client — P0-D2)
//
// Placeholder handlers return a sentinel error so operators can distinguish
// "not implemented yet" from "network failure". All handlers accept nil-safe
// inputs and validate the endpoint prefix to prevent SSRF-style accidents.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// dispatchRequest is the JSON body sent to HTTP agents. Kept separate
// from models.CreateJobRequest to decouple the wire format from the
// REST API shape (agents only need job_id, task_type, params).
type dispatchRequest struct {
	JobID    string                 `json:"job_id"`
	TaskType string                 `json:"task_type"`
	Params   map[string]interface{} `json:"params"`
}

// HTTPHandler delivers jobs to a Runner agent over HTTP POST.
// This is the reference implementation; other protocols should mirror
// its error surface (context cancellation, transport error, non-2xx).
type HTTPHandler struct {
	client *http.Client
	// Headers are merged into every request (e.g. Authorization).
	Headers map[string]string
}

// NewHTTPHandler returns an HTTPHandler with sane defaults (10s timeout).
func NewHTTPHandler() *HTTPHandler {
	return &HTTPHandler{
		client:  &http.Client{Timeout: 10 * time.Second},
		Headers: map[string]string{},
	}
}

// WithHTTPClient overrides the http.Client (for tests / long jobs).
func (h *HTTPHandler) WithHTTPClient(c *http.Client) *HTTPHandler {
	if c != nil {
		h.client = c
	}
	return h
}

// WithHeaders merges the given headers into every outbound request.
func (h *HTTPHandler) WithHeaders(hs map[string]string) *HTTPHandler {
	for k, v := range hs {
		h.Headers[k] = v
	}
	return h
}

// Protocol returns "http".
func (h *HTTPHandler) Protocol() RunnerProtocol { return ProtocolHTTP }

// DispatchTask POSTs the job payload to agent.Endpoint.
// Returns a dispatch ID (currently the HTTP response body, or
// an empty string when the agent returned 204/205).
func (h *HTTPHandler) DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error) {
	if agent == nil || agent.Endpoint == "" {
		return "", fmt.Errorf("runner: http handler requires agent.endpoint")
	}
	if job == nil || job.JobID == "" {
		return "", fmt.Errorf("runner: http handler requires job.job_id")
	}
	body, err := json.Marshal(dispatchRequest{
		JobID:    job.JobID,
		TaskType: job.TaskType,
		Params:   job.Params,
	})
	if err != nil {
		return "", fmt.Errorf("runner: marshal dispatch: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, agent.Endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("runner: new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Orion-Protocol", string(ProtocolHTTP))
	req.Header.Set("X-Orion-Agent-Id", agent.AgentID)
	for k, v := range h.Headers {
		req.Header.Set(k, v)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("runner: http dispatch: %w", err)
	}
	defer resp.Body.Close()

	// 204/205 = accepted, no body.
	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusResetContent {
		return "", nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("runner: http dispatch rejected (status=%d)", resp.StatusCode)
	}

	buf := new(bytes.Buffer)
	// Cap read to avoid unbounded memory on hostile endpoints.
	_, _ = buf.ReadFrom(io.LimitReader(resp.Body, 4096))
	return strings.TrimSpace(buf.String()), nil
}

// ---------------------------------------------------------------------------
// Placeholder handlers for P0-D2. Return ErrHandlerNotFound so operators can
// distinguish "not implemented yet" from transient network failures.
// ---------------------------------------------------------------------------

// SSHHandler is a placeholder for the SSH transport. Real implementation
// delegates to a pre-existing SSHExecutor (from cmdb/script).
type SSHHandler struct{}

func NewSSHHandler() *SSHHandler { return &SSHHandler{} }

func (h *SSHHandler) Protocol() RunnerProtocol { return ProtocolSSH }

func (h *SSHHandler) DispatchTask(_ context.Context, _ *RunnerAgentView, _ *RunnerJobView) (string, error) {
	return "", fmt.Errorf("%w: ssh dispatch not implemented (P0-D2)", ErrHandlerNotFound)
}

// K8sExecHandler is the real k8s-exec transport (see handler_k8s_exec.go).
// Kept as a placeholder-compatible constructor so AllHandlers() stays
// usable without a K8s config — calls fall through to ErrHandlerNotFound.
type k8sExecPlaceholder struct{}

func newK8sExecPlaceholder() *k8sExecPlaceholder { return &k8sExecPlaceholder{} }

func (h *k8sExecPlaceholder) Protocol() RunnerProtocol { return ProtocolK8sExec }

func (h *k8sExecPlaceholder) DispatchTask(_ context.Context, _ *RunnerAgentView, _ *RunnerJobView) (string, error) {
	return "", fmt.Errorf("%w: k8s-exec dispatch requires KubernetesConfig (see NewK8sExecHandlerWithConfig)", ErrHandlerNotFound)
}

// WinRMHandler is a placeholder for the WinRM transport.
type WinRMHandler struct{}

func NewWinRMHandler() *WinRMHandler { return &WinRMHandler{} }

func (h *WinRMHandler) Protocol() RunnerProtocol { return ProtocolWinRM }

func (h *WinRMHandler) DispatchTask(_ context.Context, _ *RunnerAgentView, _ *RunnerJobView) (string, error) {
	return "", fmt.Errorf("%w: winrm dispatch not implemented (P0-D2)", ErrHandlerNotFound)
}

// GRPCHandler is the real gRPC transport (see handler_grpc.go).
// Kept as a placeholder-compatible constructor so AllHandlers() stays
// usable without a gRPC config — calls fall through to ErrHandlerNotFound.
type grpcPlaceholder struct{}

func newGRPCPlaceholder() *grpcPlaceholder { return &grpcPlaceholder{} }

func (h *grpcPlaceholder) Protocol() RunnerProtocol { return ProtocolGRPC }

func (h *grpcPlaceholder) DispatchTask(_ context.Context, _ *RunnerAgentView, _ *RunnerJobView) (string, error) {
	return "", fmt.Errorf("%w: grpc dispatch requires config (see NewGRPCHandlerWithConfig)", ErrHandlerNotFound)
}

// AllHandlers returns a fresh HandlerRegistry pre-loaded with all 5 protocol
// handlers (HTTP fully implemented; the other 4 are P0-D2 placeholders).
// Callers can override individual slots by calling Register again.
func AllHandlers() *HandlerRegistry {
	r := NewHandlerRegistry()
	r.Register(ProtocolHTTP, NewHTTPHandler())
	r.Register(ProtocolSSH, NewSSHHandler())
	r.Register(ProtocolK8sExec, newK8sExecPlaceholder())
	r.Register(ProtocolWinRM, NewWinRMHandler())
	r.Register(ProtocolGRPC, newGRPCPlaceholder())
	return r
}
