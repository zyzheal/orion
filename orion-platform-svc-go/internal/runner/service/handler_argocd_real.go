// Package service — ArgoCDRESTClient: self-hosted REST client for an
// external ArgoCD control plane.
//
// This adapter talks to the ArgoCD REST API (/api/v1) directly over
// standard HTTP. It intentionally avoids pulling in
// github.com/argoproj/argo-cd/v2 (a heavy dependency that drags in a
// large grpc/k8s closure and risks dependency-hell interactions with the
// module's helm/k8s pins). The SPI (ArgoCDClientInterface) keeps this
// client swappable for a future argocd-client-backed adapter.
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

// ArgoCDRESTConfig configures the REST client transport.
type ArgoCDRESTConfig struct {
	// Token is the bearer token used for Authorization. Empty uses
	// in-cluster-style anonymous (dev only).
	Token string
	// HTTPClient is overridable for tests (HTTPServer stub). Defaults to
	// a 30s-timeout client.
	HTTPClient *http.Client
}

// ArgoCDRESTClient implements ArgoCDClientInterface against the ArgoCD
// REST API. Server URL and auth come from the run params at call time.
type ArgoCDRESTClient struct {
	cfg ArgoCDRESTConfig
}

// NewArgoCDRESTClient returns an ArgoCDClientInterface backed by the
// ArgoCD REST API.
func NewArgoCDRESTClient(cfg ArgoCDRESTConfig) *ArgoCDRESTClient {
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &ArgoCDRESTClient{cfg: cfg}
}

// WithToken overrides the bearer token.
func (c *ArgoCDRESTClient) WithToken(t string) *ArgoCDRESTClient {
	c.cfg.Token = t
	return c
}

// Sync triggers an Application sync.
func (c *ArgoCDRESTClient) Sync(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	body := map[string]interface{}{
		"revision": p.Revision,
		"prune":    true,
		"dryRun":   false,
	}
	resp, err := c.doJSON(p.Ctx, p.Target.Server, http.MethodPost,
		"/api/v1/applications/"+pathSegment(p.Target.Application)+"/sync", body,
		p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	_ = resp
	return c.toInfo(p, "synced", "Synced", "Healthy"), nil
}

// Create upserts an ArgoCD Application.
func (c *ArgoCDRESTClient) Create(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	repoURL, _ := p.Params["repo_url"].(string)
	path, _ := p.Params["path"].(string)
	targetRev, _ := p.Params["target_revision"].(string)
	ns := p.Target.Namespace
	if ns == "" {
		ns = "default"
	}
	// Minimal Application spec; ArgoCD accepts partial specs and applies
	// defaults server-side.
	app := map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":      p.Target.Application,
			"namespace": "argocd",
		},
		"spec": map[string]interface{}{
			"project": p.Target.Project,
			"source": map[string]interface{}{
				"repoURL":        repoURL,
				"path":           path,
				"targetRevision": targetRev,
			},
			"destination": map[string]interface{}{
				"server":    "https://kubernetes.default.svc",
				"namespace": ns,
			},
		},
	}
	resp, err := c.doJSON(p.Ctx, p.Target.Server, http.MethodPost,
		"/api/v1/applications", app, p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	_ = resp
	return c.toInfo(p, "created", "Unknown", "Unknown"), nil
}

// Delete removes an ArgoCD Application.
func (c *ArgoCDRESTClient) Delete(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	resp, err := c.doJSON(p.Ctx, p.Target.Server, http.MethodDelete,
		"/api/v1/applications/"+pathSegment(p.Target.Application), nil, p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	_ = resp
	return c.toInfo(p, "deleted", "Unknown", "Unknown"), nil
}

// Rollback rolls the Application back to a revision.
func (c *ArgoCDRESTClient) Rollback(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	// ArgoCD rollback expects a numeric application revision ID; we pass
	// the requested revision string (or 0 for latest).
	body := map[string]interface{}{"id": 0}
	if p.Revision != "" {
		body["id"] = p.Revision
	}
	resp, err := c.doJSON(p.Ctx, p.Target.Server, http.MethodPost,
		"/api/v1/applications/"+pathSegment(p.Target.Application)+"/rollback", body,
		p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	_ = resp
	return c.toInfo(p, "rolled-back", "Synced", "Healthy"), nil
}

// Get fetches the current Application status.
func (c *ArgoCDRESTClient) Get(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	body, err := c.doRaw(p.Ctx, p.Target.Server, http.MethodGet,
		"/api/v1/applications/"+pathSegment(p.Target.Application), p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Metadata struct {
			Name string `json:"name"`
		} `json:"metadata"`
		Status struct {
			Sync struct {
				Status   string `json:"status"`
				Revision string `json:"revision"`
			} `json:"sync"`
			Health struct {
				Status  string `json:"status"`
				Message string `json:"message"`
			} `json:"health"`
		} `json:"status"`
	}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &parsed); err == nil {
			info := c.toInfo(p, "retrieved", parsed.Status.Sync.Status, parsed.Status.Health.Status)
			info.Revision = parsed.Status.Sync.Revision
			if parsed.Status.Health.Message != "" {
				info.Details = append(info.Details, parsed.Status.Health.Message)
			}
			return info, nil
		}
	}
	return c.toInfo(p, "retrieved", "Unknown", "Unknown"), nil
}

// Health probes ArgoCD server connectivity.
func (c *ArgoCDRESTClient) Health(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if err := c.requireTarget(p); err != nil {
		return nil, err
	}
	_, err := c.doRaw(p.Ctx, p.Target.Server, http.MethodGet, "/api/v1/applications", p.tokenOr(c.cfg.Token))
	if err != nil {
		return nil, err
	}
	return c.toInfo(p, "reachable", "Unknown", "Unknown"), nil
}

// --- helpers ---

func (c *ArgoCDRESTClient) requireTarget(p *ArgoCDRunParams) error {
	if p == nil || p.Target == nil {
		return fmt.Errorf("runner: argocd action requires target")
	}
	if p.Target.Server == "" {
		return fmt.Errorf("runner: argocd target missing server")
	}
	return nil
}

func (c *ArgoCDRESTClient) toInfo(p *ArgoCDRunParams, status, syncStatus, health string) *ArgoCDAppInfo {
	ns := ""
	if p.Target != nil {
		ns = p.Target.Namespace
	}
	project := ""
	if p.Target != nil {
		project = p.Target.Project
	}
	return &ArgoCDAppInfo{
		Application: p.Target.Application,
		Project:     project,
		Namespace:   ns,
		Status:      status,
		SyncStatus:  syncStatus,
		Health:      health,
	}
}

// doJSON issues a request with an optional JSON body and discards the
// response body, returning it for the caller's inspection. Non-2xx
// responses are surfaced as errors with the status line.
func (c *ArgoCDRESTClient) doJSON(ctx context.Context, baseURL, method, path string, body interface{}, token string) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("argocd: marshal request: %w", err)
		}
		reader = bytes.NewReader(b)
	}
	return c.do(ctx, baseURL, method, path, reader, "application/json", token)
}

// doRaw issues a request without a body and returns the raw response body.
func (c *ArgoCDRESTClient) doRaw(ctx context.Context, baseURL, method, path string, token string) ([]byte, error) {
	return c.do(ctx, baseURL, method, path, nil, "application/json", token)
}

func (c *ArgoCDRESTClient) do(ctx context.Context, baseURL, method, path string, reader io.Reader, contentType, token string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, reader)
	if err != nil {
		return nil, fmt.Errorf("argocd: new request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if contentType != "" && reader != nil {
		req.Header.Set("Content-Type", contentType)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("argocd: %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("argocd: read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("argocd: %s %s rejected (status=%d): %s",
			method, path, resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return respBody, nil
}

// pathSegment safely URL-encodes a single path segment (application name).
func pathSegment(s string) string {
	replacer := strings.NewReplacer("/", "%2F", " ", "%20", "?", "%3F", "#", "%23")
	return replacer.Replace(s)
}

// tokenOr returns the per-call token if set, else the client default.
func (p *ArgoCDRunParams) tokenOr(def string) string {
	if p != nil && p.ServerToken != "" {
		return p.ServerToken
	}
	return def
}
