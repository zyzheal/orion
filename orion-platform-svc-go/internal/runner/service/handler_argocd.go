// Package service — ArgoCDHandler: dispatch to an external ArgoCD instance.
//
// P0-D2 delivers a real client adapter for the argocd protocol. The
// handler treats ArgoCD as an external GitOps control plane: jobs are
// dispatched to synchronise, create, delete, or roll back ArgoCD
// Applications owned by a tenant.
//
// Endpoint encoding (per ADR-012 registry pattern):
//   agent.Endpoint = "argocd://<application>?server=<host:port>&project=<project>&namespace=<ns>"
//
//   - <application> is the ArgoCD Application name (required)
//   - server is the external ArgoCD server base URL (required; scheme
//     defaults to https, override with server=https://... or server=http://...)
//   - project is the ArgoCD AppProject (optional, defaults to "default")
//   - namespace is the target cluster namespace (optional)
//
// Operation dispatch is driven by job.TaskType:
//   - "sync" / "deploy"      → ArgoCDClientInterface.Sync (trigger Application sync)
//   - "create" / "upsert"    → ArgoCDClientInterface.Create (create/upsert Application)
//   - "delete"               → ArgoCDClientInterface.Delete (remove Application)
//   - "rollback"             → ArgoCDClientInterface.Rollback (roll back to a revision)
//   - "get" / "status"       → ArgoCDClientInterface.Get (fetch Application status)
//   - "health"               → ArgoCDClientInterface.Health (connectivity probe)
//
// Testability: ArgoCDClientInterface is an SPI that any adapter (a real
// HTTP REST client or a stub) can satisfy. Tests inject a stub via
// WithClient to exercise dispatch logic without a live ArgoCD server.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// ArgoCDConfig holds ArgoCD operation settings.
type ArgoCDConfig struct {
	// Timeout bounds each ArgoCD API call (default 30s).
	Timeout time.Duration
	// DefaultProject is used when the endpoint omits ?project=.
	// Defaults to "default".
	DefaultProject string
	// DefaultNamespace is used when the endpoint omits ?namespace=.
	DefaultNamespace string
}

// ArgoCDTarget is the decoded form of agent.Endpoint.
type ArgoCDTarget struct {
	Application string // ArgoCD Application name (required)
	Server      string // external ArgoCD server base URL (required)
	Project     string // AppProject (optional, default "default")
	Namespace   string // target cluster namespace (optional)
}

// ParseArgoCDEndpoint decodes "argocd://<app>?server=<host>&project=<p>&namespace=<ns>"
// into an ArgoCDTarget. Application and server are required.
func ParseArgoCDEndpoint(endpoint string) (*ArgoCDTarget, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("runner: argocd endpoint is required")
	}
	if !strings.HasPrefix(endpoint, "argocd://") {
		return nil, fmt.Errorf("runner: argocd endpoint must start with 'argocd://', got %q", endpoint)
	}
	rest := strings.TrimPrefix(endpoint, "argocd://")
	app, queryStr, _ := strings.Cut(rest, "?")
	app = strings.TrimSpace(app)
	if app == "" {
		return nil, fmt.Errorf("runner: argocd endpoint missing application name: %q", endpoint)
	}
	q, err := url.ParseQuery(queryStr)
	if err != nil {
		return nil, fmt.Errorf("runner: parse argocd endpoint query: %w", err)
	}
	server := q.Get("server")
	if server == "" {
		return nil, fmt.Errorf("runner: argocd endpoint missing server query param: %q", endpoint)
	}
	// Normalise server to a scheme-qualified base URL. Accept both
	// "host:port" and "https://host:port".
	if !strings.Contains(server, "://") {
		server = "https://" + server
	}
	project := q.Get("project")
	if project == "" {
		project = "default"
	}
	return &ArgoCDTarget{
		Application: app,
		Server:      strings.TrimRight(server, "/"),
		Project:     project,
		Namespace:   q.Get("namespace"),
	}, nil
}

// ArgoCDOperationResult is the response returned to the platform after
// an ArgoCD action completes.
type ArgoCDOperationResult struct {
	Application string `json:"application"`
	Server      string `json:"server"`
	Project     string `json:"project"`
	Namespace   string `json:"namespace,omitempty"`
	Status      string `json:"status"`
	Revision    string `json:"revision,omitempty"`
	SyncStatus  string `json:"sync_status,omitempty"`
	Health      string `json:"health,omitempty"`
	// Message carries extra detail (e.g. a sync operation ID or error text).
	Message string `json:"message,omitempty"`
}

// ArgoCDRunParams is the argument bundle an adapter receives when the
// platform wants a specific ArgoCD action. Decoupled from the ArgoCD API
// types to keep the SPI independent of any SDK.
type ArgoCDRunParams struct {
	Target *ArgoCDTarget
	// Revision is used by rollback; empty uses latest available.
	Revision string
	// Params carries job.Params for adapter-specific options (e.g. values,
	// sync strategy, prune, apply-only).
	Params map[string]interface{}
	// ServerToken is the bearer token for ArgoCD auth (from agent metadata).
	ServerToken string
	Timeout     time.Duration
	Ctx         context.Context
}

// ArgoCDAppInfo is the minimal response shape an ArgoCD adapter returns.
type ArgoCDAppInfo struct {
	Application string
	Project     string
	Namespace   string
	Status      string   // "created" | "deleted" | "synced" | "out-of-sync" | "unknown"
	Revision    string   // head revision after sync / current revision
	SyncStatus  string   // "Synced" | "OutOfSync" | "Unknown"
	Health      string   // "Healthy" | "Degraded" | "Progressing" | "Missing" | "Unknown"
	Details     []string // extra human-readable detail lines
}

// ArgoCDClientInterface is the SPI the ArgoCDHandler invokes to perform
// a real (or stubbed) ArgoCD action against an external instance.
type ArgoCDClientInterface interface {
	// Sync triggers an Application sync and waits (best-effort) for the
	// operation to progress. Returns resulting app status.
	Sync(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
	// Create upserts an ArgoCD Application resource.
	Create(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
	// Delete removes an ArgoCD Application resource.
	Delete(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
	// Rollback rolls the Application back to a revision.
	Rollback(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
	// Get fetches the current Application status.
	Get(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
	// Health probes ArgoCD server connectivity.
	Health(p *ArgoCDRunParams) (*ArgoCDAppInfo, error)
}

// ArgoCDHandler dispatches jobs to an external ArgoCD instance via an
// ArgoCDClientInterface adapter.
type ArgoCDHandler struct {
	config ArgoCDConfig
	// client is the ArgoCDClientInterface SPI. If nil, dispatch returns
	// an actionable error until an adapter is installed via WithClient.
	client ArgoCDClientInterface
}

// NewArgoCDHandlerWithConfig wires an ArgoCDHandler with an explicit config.
func NewArgoCDHandlerWithConfig(cfg ArgoCDConfig) *ArgoCDHandler {
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.DefaultProject == "" {
		cfg.DefaultProject = "default"
	}
	return &ArgoCDHandler{config: cfg}
}

// WithClient overrides the ArgoCDClientInterface (for tests / custom adapters).
func (h *ArgoCDHandler) WithClient(c ArgoCDClientInterface) *ArgoCDHandler {
	if c != nil {
		h.client = c
	}
	return h
}

// Protocol returns "argocd".
func (h *ArgoCDHandler) Protocol() RunnerProtocol { return ProtocolArgoCD }

// DispatchTask runs the ArgoCD action described by job.TaskType against
// the Application encoded in agent.Endpoint.
func (h *ArgoCDHandler) DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error) {
	if agent == nil || agent.Endpoint == "" {
		return "", fmt.Errorf("runner: argocd handler requires agent.endpoint")
	}
	if job == nil || job.JobID == "" {
		return "", fmt.Errorf("runner: argocd handler requires job.job_id")
	}
	target, err := ParseArgoCDEndpoint(agent.Endpoint)
	if err != nil {
		return "", err
	}
	if target.Project == "" {
		target.Project = h.config.DefaultProject
	}
	if h.client == nil {
		return "", fmt.Errorf("runner: argocd handler requires ArgoCDClientInterface (see NewArgoCDHandlerWithConfig + WithClient)")
	}

	op := strings.ToLower(strings.TrimSpace(job.TaskType))
	if op == "" {
		op = "sync"
	}

	params := &ArgoCDRunParams{
		Target:      target,
		Revision:    paramString(job.Params, "revision"),
		Params:      job.Params,
		ServerToken: agent.Metadata["argocd_token"],
		Timeout:     h.config.Timeout,
		Ctx:         ctx,
	}

	info, err := switchArgoCDAction(op, h.client, params)
	if err != nil {
		return "", fmt.Errorf("runner: argocd %s: %w", op, err)
	}

	result := ArgoCDOperationResult{
		Application: info.Application,
		Server:      target.Server,
		Project:     info.Project,
		Namespace:   info.Namespace,
		Status:      info.Status,
		Revision:    info.Revision,
		SyncStatus:  info.SyncStatus,
		Health:      info.Health,
	}
	if len(info.Details) > 0 {
		result.Message = strings.Join(info.Details, "; ")
	}
	b, _ := json.Marshal(result)
	return string(b), nil
}

// switchArgoCDAction routes op to the matching ArgoCDClientInterface method.
func switchArgoCDAction(op string, c ArgoCDClientInterface, p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	switch op {
	case "sync", "deploy", "deploy-app", "sync-app":
		return c.Sync(p)
	case "create", "upsert", "create-app":
		return c.Create(p)
	case "delete", "delete-app", "remove":
		return c.Delete(p)
	case "rollback", "rollback-app":
		return c.Rollback(p)
	case "get", "status", "get-app":
		return c.Get(p)
	case "health", "ping", "probe":
		return c.Health(p)
	default:
		return nil, fmt.Errorf("unknown argocd operation %q (want sync|create|delete|rollback|get|health)", op)
	}
}

// paramString extracts a string param, tolerant of missing or non-string.
func paramString(params map[string]interface{}, key string) string {
	if params == nil {
		return ""
	}
	raw, ok := params[key]
	if !ok {
		return ""
	}
	switch v := raw.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%v", v)
	default:
		return ""
	}
}
