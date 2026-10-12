package service

import (
	"context"
	"errors"
	"strings"
	"sync"
)

// RunnerProtocol identifies how the platform reaches a Runner agent.
// Values are case-insensitive on input; the canonical form is stored.
type RunnerProtocol string

const (
	ProtocolHTTP   RunnerProtocol = "http"
	ProtocolSSH    RunnerProtocol = "ssh"
	ProtocolK8sExec RunnerProtocol = "k8s-exec"
	ProtocolWinRM  RunnerProtocol = "winrm"
	ProtocolGRPC   RunnerProtocol = "grpc"
)

// AllProtocols is the ordered list of supported protocols. Used for
// registration, filtering, and test enumeration.
var AllProtocols = []RunnerProtocol{
	ProtocolHTTP,
	ProtocolSSH,
	ProtocolK8sExec,
	ProtocolWinRM,
	ProtocolGRPC,
}

// DefaultProtocol is used when CreateAgentRequest.Protocol is empty.
const DefaultProtocol RunnerProtocol = ProtocolHTTP

// RunnerHandler is the pluggable SPI a Handler implements to dispatch
// tasks over a specific protocol. Implementations are registered via
// WithHandler and resolved per agent at job dispatch time.
type RunnerHandler interface {
	Protocol() RunnerProtocol
	// DispatchTask packages the job payload and delivers it over the
	// agent's endpoint using this protocol. Returns a job ID that the
	// agent will report back on via ReportJobResult.
	DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error)
}

// RunnerAgentView is the minimal projection of an agent needed by a
// RunnerHandler. Kept internal to avoid coupling handlers to the
// repository type.
type RunnerAgentView struct {
	ID         string
	AgentID    string
	Endpoint   string
	Protocol   RunnerProtocol
	Metadata   map[string]string
	Labels     []string
}

// RunnerJobView is the minimal projection of a job needed by a
// RunnerHandler.
type RunnerJobView struct {
	JobID    string
	TaskType string
	Params   map[string]interface{}
}

// HandlerRegistry holds RunnerHandler implementations keyed by
// protocol. Empty registry (nil map) is a compile-safe fallback that
// always returns ErrHandlerNotFound.
type HandlerRegistry struct {
	mu       sync.RWMutex
	handlers map[RunnerProtocol]RunnerHandler
}

// NewHandlerRegistry returns an empty registry.
func NewHandlerRegistry() *HandlerRegistry {
	return &HandlerRegistry{handlers: make(map[RunnerProtocol]RunnerHandler)}
}

// Register adds a handler for the given protocol. Nil handler is
// silently ignored so callers can pass optional impls.
func (r *HandlerRegistry) Register(p RunnerProtocol, h RunnerHandler) {
	if h == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[CanonicalProtocol(p)] = h
}

// Lookup returns the handler for the protocol, or nil.
func (r *HandlerRegistry) Lookup(p RunnerProtocol) RunnerHandler {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.handlers[CanonicalProtocol(p)]
}

// CanonicalProtocol normalizes a RunnerProtocol string: lowercase,
// trimmed, aliases mapped. Empty or unknown → ProtocolHTTP.
func CanonicalProtocol(p RunnerProtocol) RunnerProtocol {
	switch strings.ToLower(strings.TrimSpace(string(p))) {
	case "http":
		return ProtocolHTTP
	case "ssh":
		return ProtocolSSH
	case "k8s-exec", "k8s_exec", "kubernetes":
		return ProtocolK8sExec
	case "winrm":
		return ProtocolWinRM
	case "grpc":
		return ProtocolGRPC
	case "", "default":
		return DefaultProtocol
	}
	return ProtocolHTTP
}

// ErrUnsupportedProtocol indicates an unrecognised protocol string
// was passed. Returned only when callers demand strictness.
var ErrUnsupportedProtocol = errors.New("runner: unsupported protocol")

// ErrHandlerNotFound indicates a Handler was requested for a protocol
// that has no registered implementation.
var ErrHandlerNotFound = errors.New("runner: no handler registered for protocol")
