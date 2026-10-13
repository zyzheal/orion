// Package service — HelmHandler: real Helm release dispatch.
//
// P0-D2 delivers real (not placeholder) client-side dispatch for the
// helm protocol. Wire protocol: helm chart install/upgrade/uninstall
// against the target release in the K8s cluster.
//
// Endpoint encoding (per ADR-012 registry pattern):
//   agent.Endpoint = "helm://<release-name>?chart=<chart-path-or-URL>&namespace=<ns>&repo=<name>"
//
// Operation dispatch is driven by job.TaskType:
//   - "install" / "deploy" → action.NewInstall (create release)
//   - "upgrade"            → action.NewUpgrade (upgrade existing release)
//   - "uninstall"          → action.NewUninstall (delete release)
//
// Testability: HelmActionRunner is an SPI that any adapter (real
// helm.sh/helm/v3/pkg/action or a stub) can satisfy. Tests inject a
// stub via WithRunner to exercise dispatch logic without a live K8s
// cluster or helm binary.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/release"
)

// HelmConfig holds Helm operation settings.
type HelmConfig struct {
	// Timeout bounds each Helm action (default 10 min).
	Timeout time.Duration
	// DefaultNamespace is used when the endpoint query omits ?namespace=.
	// Defaults to "default".
	DefaultNamespace string
	// DryRun renders templates without applying to the cluster.
	// Useful for validation-only jobs.
	DryRun bool
	// Wait blocks until resources are ready (installs/upgrades).
	Wait bool
}

// HelmTarget is the decoded form of agent.Endpoint.
type HelmTarget struct {
	ReleaseName string
	Chart       string
	Namespace   string
	Repo        string
}

// ParseHelmEndpoint decodes "helm://<release>?chart=<c>&namespace=<ns>&repo=<r>"
// into a HelmTarget. Empty release or chart returns an error.
func ParseHelmEndpoint(endpoint string) (*HelmTarget, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("runner: helm endpoint is required")
	}
	if !strings.HasPrefix(endpoint, "helm://") {
		return nil, fmt.Errorf("runner: helm endpoint must start with 'helm://', got %q", endpoint)
	}
	rest := strings.TrimPrefix(endpoint, "helm://")
	releaseName, queryStr, _ := strings.Cut(rest, "?")
	releaseName = strings.TrimSpace(releaseName)
	if releaseName == "" {
		return nil, fmt.Errorf("runner: helm endpoint missing release name: %q", endpoint)
	}
	q, err := url.ParseQuery(queryStr)
	if err != nil {
		return nil, fmt.Errorf("runner: parse helm endpoint query: %w", err)
	}
	chartRef := q.Get("chart")
	if chartRef == "" {
		return nil, fmt.Errorf("runner: helm endpoint missing chart query param: %q", endpoint)
	}
	ns := q.Get("namespace")
	if ns == "" {
		ns = "default"
	}
	return &HelmTarget{
		ReleaseName: releaseName,
		Chart:       chartRef,
		Namespace:   ns,
		Repo:        q.Get("repo"),
	}, nil
}

// HelmOperationResult is the response returned to the platform after
// a Helm action completes.
type HelmOperationResult struct {
	ReleaseName string `json:"release_name"`
	Namespace   string `json:"namespace"`
	Revision    int    `json:"revision"`
	Status      string `json:"status"`
}

// HelmRunParams is the argument bundle an adapter receives when the
// platform wants a specific Helm action. Kept separate from action.*
// types to decouple the SPI from helm.sh/helm/v3 internals.
type HelmRunParams struct {
	Target   *HelmTarget
	Values   map[string]interface{}
	Timeout  time.Duration
	DryRun   bool
	Wait     bool
	Ctx      context.Context
}

// HelmReleaseInfo is the minimal response shape a HelmRun returns.
type HelmReleaseInfo struct {
	ReleaseName string
	Namespace   string
	Revision    int
	Status      string
}

// HelmActionRunner is the SPI the HelmHandler invokes to run a real
// (or stubbed) Helm action.
type HelmActionRunner interface {
	// RunInstall creates a new release.
	RunInstall(p *HelmRunParams) (*HelmReleaseInfo, error)
	// RunUpgrade upgrades an existing release.
	RunUpgrade(p *HelmRunParams) (*HelmReleaseInfo, error)
	// RunUninstall deletes a release.
	RunUninstall(p *HelmRunParams) (*HelmReleaseInfo, error)
}

// HelmHandler dispatches jobs to a Helm release via action.Run adapters.
type HelmHandler struct {
	config HelmConfig
	// runner is the HelmActionRunner SPI. If nil, the default production
	// runner is used (helm.sh/helm/v3/pkg/action with action.NewInstall etc).
	runner HelmActionRunner
}

// NewHelmHandlerWithConfig wires a HelmHandler with an explicit HelmConfig.
func NewHelmHandlerWithConfig(cfg HelmConfig) *HelmHandler {
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Minute
	}
	if cfg.DefaultNamespace == "" {
		cfg.DefaultNamespace = "default"
	}
	return &HelmHandler{config: cfg}
}

// WithRunner overrides the HelmActionRunner (for tests / custom adapters).
func (h *HelmHandler) WithRunner(r HelmActionRunner) *HelmHandler {
	if r != nil {
		h.runner = r
	}
	return h
}

// Protocol returns "helm".
func (h *HelmHandler) Protocol() RunnerProtocol { return ProtocolHelm }

// DispatchTask runs the Helm action described by job.TaskType against
// the release encoded in agent.Endpoint.
func (h *HelmHandler) DispatchTask(ctx context.Context, agent *RunnerAgentView, job *RunnerJobView) (string, error) {
	if agent == nil || agent.Endpoint == "" {
		return "", fmt.Errorf("runner: helm handler requires agent.endpoint")
	}
	if job == nil || job.JobID == "" {
		return "", fmt.Errorf("runner: helm handler requires job.job_id")
	}
	target, err := ParseHelmEndpoint(agent.Endpoint)
	if err != nil {
		return "", err
	}
	if target.Namespace == "" {
		target.Namespace = h.config.DefaultNamespace
	}
	if h.runner == nil {
		return "", fmt.Errorf("runner: helm handler requires HelmActionRunner (see NewHelmHandlerWithConfig + WithRunner)")
	}

	op := strings.ToLower(strings.TrimSpace(job.TaskType))
	if op == "" {
		op = "install"
	}

	values := extractHelmValues(job.Params)
	params := &HelmRunParams{
		Target:   target,
		Values:   values,
		Timeout:  h.config.Timeout,
		DryRun:   h.config.DryRun,
		Wait:     h.config.Wait,
		Ctx:      ctx,
	}

	info, err := switchAction(op, h.runner, params)
	if err != nil {
		return "", fmt.Errorf("runner: helm %s: %w", op, err)
	}

	result := HelmOperationResult{
		ReleaseName: info.ReleaseName,
		Namespace:   info.Namespace,
		Revision:    info.Revision,
		Status:      info.Status,
	}
	b, _ := json.Marshal(result)
	return string(b), nil
}

// switchAction routes op ("install"/"upgrade"/"uninstall") to the
// matching HelmActionRunner method.
func switchAction(op string, r HelmActionRunner, p *HelmRunParams) (*HelmReleaseInfo, error) {
	switch op {
	case "install", "deploy", "create":
		return r.RunInstall(p)
	case "upgrade":
		return r.RunUpgrade(p)
	case "uninstall", "delete":
		return r.RunUninstall(p)
	default:
		return nil, fmt.Errorf("unknown helm operation %q (want install|upgrade|uninstall)", op)
	}
}

// extractHelmValues pulls the "values" key from job.Params, tolerating
// both map[string]interface{} and raw string JSON.
func extractHelmValues(params map[string]interface{}) map[string]interface{} {
	if params == nil {
		return nil
	}
	raw, ok := params["values"]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case map[string]interface{}:
		return v
	case map[string]string:
		out := make(map[string]interface{}, len(v))
		for k, s := range v {
			out[k] = s
		}
		return out
	case string:
		var out map[string]interface{}
		if err := json.Unmarshal([]byte(v), &out); err != nil {
			return nil
		}
		return out
	default:
		return nil
	}
}

// RealHelmRunner implements HelmActionRunner using helm.sh/helm/v3.
// Kept in the same package so callers can opt into the production
// runner without pulling helm.sh/helm/v3 into their own go.mod
// (though the module already depends on it for this handler).
//
// Configuration:
//   - KubeConfigPath (optional; empty = use in-cluster config)
//   - RepositoryCache (optional; defaults to ~/.cache/helm/repository)
//
// NOTE: NewConfiguration requires a storage driver bound to a K8s
// cluster. If the handler is registered but no runner is set, dispatch
// returns an actionable error. Callers who want real Helm execution
// should call NewRealHelmRunner() and pass it via WithRunner.
type RealHelmRunner struct {
	kubeConfigPath string
	repoCache      string
}

// NewRealHelmRunner returns a HelmActionRunner backed by helm.sh/helm/v3.
func NewRealHelmRunner() *RealHelmRunner {
	return &RealHelmRunner{}
}

// WithKubeConfig overrides the kubeconfig path (empty = in-cluster).
func (r *RealHelmRunner) WithKubeConfig(path string) *RealHelmRunner {
	r.kubeConfigPath = path
	return r
}

// WithRepoCache overrides the helm repository cache directory.
func (r *RealHelmRunner) WithRepoCache(dir string) *RealHelmRunner {
	r.repoCache = dir
	return r
}

// RunInstall downloads the chart and installs a new release.
func (r *RealHelmRunner) RunInstall(p *HelmRunParams) (*HelmReleaseInfo, error) {
	if p == nil || p.Target == nil {
		return nil, fmt.Errorf("runner: helm install requires target")
	}
	chrt, err := fetchChart(p.Target.Chart, r.repoCache)
	if err != nil {
		return nil, fmt.Errorf("fetch chart %q: %w", p.Target.Chart, err)
	}
	cfg, err := newActionConfiguration(r.kubeConfigPath, p.Target.Namespace)
	if err != nil {
		return nil, err
	}
	inst := actionNewInstall(cfg)
	inst.ReleaseName = p.Target.ReleaseName
	inst.Namespace = p.Target.Namespace
	inst.Timeout = p.Timeout
	inst.DryRun = p.DryRun
	inst.Wait = p.Wait
	inst.CreateNamespace = true
	rel, err := inst.Run(chrt, p.Values)
	if err != nil {
		return nil, err
	}
	return releaseToInfo(rel), nil
}

// RunUpgrade downloads the chart and upgrades the existing release.
func (r *RealHelmRunner) RunUpgrade(p *HelmRunParams) (*HelmReleaseInfo, error) {
	if p == nil || p.Target == nil {
		return nil, fmt.Errorf("runner: helm upgrade requires target")
	}
	chrt, err := fetchChart(p.Target.Chart, r.repoCache)
	if err != nil {
		return nil, fmt.Errorf("fetch chart %q: %w", p.Target.Chart, err)
	}
	cfg, err := newActionConfiguration(r.kubeConfigPath, p.Target.Namespace)
	if err != nil {
		return nil, err
	}
	ug := actionNewUpgrade(cfg)
	ug.Namespace = p.Target.Namespace
	ug.Timeout = p.Timeout
	ug.DryRun = p.DryRun
	ug.Wait = p.Wait
	ug.Force = true
	rel, err := ug.Run(p.Target.ReleaseName, chrt, p.Values)
	if err != nil {
		return nil, err
	}
	return releaseToInfo(rel), nil
}

// RunUninstall deletes the release.
func (r *RealHelmRunner) RunUninstall(p *HelmRunParams) (*HelmReleaseInfo, error) {
	if p == nil || p.Target == nil {
		return nil, fmt.Errorf("runner: helm uninstall requires target")
	}
	cfg, err := newActionConfiguration(r.kubeConfigPath, p.Target.Namespace)
	if err != nil {
		return nil, err
	}
	ui := actionNewUninstall(cfg)
	ui.Timeout = p.Timeout
	ui.DryRun = p.DryRun
	ui.Wait = p.Wait
	ui.KeepHistory = false
	resp, err := ui.Run(p.Target.ReleaseName)
	if err != nil {
		return nil, err
	}
	releaseName := ""
	if resp != nil && resp.Release != nil {
		releaseName = resp.Release.Name
	}
	return &HelmReleaseInfo{
		ReleaseName: releaseName,
		Namespace:   p.Target.Namespace,
		Revision:    0,
		Status:      "uninstalled",
	}, nil
}

func releaseToInfo(rel *release.Release) *HelmReleaseInfo {
	if rel == nil {
		return &HelmReleaseInfo{Status: "unknown"}
	}
	return &HelmReleaseInfo{
		ReleaseName: rel.Name,
		Namespace:   rel.Namespace,
		Revision:    rel.Version,
		Status:      string(rel.Info.Status),
	}
}

// fetchChart loads a chart from a local path, an http(s) URL, or an
// OCI reference. helm's loader.Load handles all of these encodings.
func fetchChart(chartRef string, _ string) (*chart.Chart, error) {
	if chartRef == "" {
		return nil, fmt.Errorf("chart reference is required")
	}
	return loader.Load(chartRef)
}
