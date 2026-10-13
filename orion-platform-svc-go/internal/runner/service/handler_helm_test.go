package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

// stubHelmRunner implements HelmActionRunner for tests.
type stubHelmRunner struct {
	installCalled   bool
	upgradeCalled   bool
	uninstallCalled bool
	lastParams      *HelmRunParams
	result          *HelmReleaseInfo
	err             error
}

func (s *stubHelmRunner) capture(p *HelmRunParams) (*HelmReleaseInfo, error) {
	s.lastParams = p
	if s.err != nil {
		return nil, s.err
	}
	if s.result != nil {
		return s.result, nil
	}
	return &HelmReleaseInfo{
		ReleaseName: p.Target.ReleaseName,
		Namespace:   p.Target.Namespace,
		Revision:    1,
		Status:      "deployed",
	}, nil
}

func (s *stubHelmRunner) RunInstall(p *HelmRunParams) (*HelmReleaseInfo, error) {
	s.installCalled = true
	return s.capture(p)
}

func (s *stubHelmRunner) RunUpgrade(p *HelmRunParams) (*HelmReleaseInfo, error) {
	s.upgradeCalled = true
	return s.capture(p)
}

func (s *stubHelmRunner) RunUninstall(p *HelmRunParams) (*HelmReleaseInfo, error) {
	s.uninstallCalled = true
	return s.capture(p)
}

func TestParseHelmEndpoint_OK(t *testing.T) {
	tgt, err := ParseHelmEndpoint("helm://nginx-release?chart=oci://registry.example.com/nginx&namespace=prod&repo=myrepo")
	if err != nil {
		t.Fatalf("ParseHelmEndpoint: %v", err)
	}
	if tgt.ReleaseName != "nginx-release" {
		t.Errorf("ReleaseName = %q", tgt.ReleaseName)
	}
	if tgt.Chart != "oci://registry.example.com/nginx" {
		t.Errorf("Chart = %q", tgt.Chart)
	}
	if tgt.Namespace != "prod" {
		t.Errorf("Namespace = %q", tgt.Namespace)
	}
	if tgt.Repo != "myrepo" {
		t.Errorf("Repo = %q", tgt.Repo)
	}
}

func TestParseHelmEndpoint_DefaultNamespace(t *testing.T) {
	tgt, err := ParseHelmEndpoint("helm://rel?chart=./chart")
	if err != nil {
		t.Fatalf("ParseHelmEndpoint: %v", err)
	}
	if tgt.Namespace != "default" {
		t.Errorf("Namespace default = %q, want 'default'", tgt.Namespace)
	}
}

func TestParseHelmEndpoint_Errors(t *testing.T) {
	cases := []string{
		"",
		"http://my-pod",
		"helm://",
		"helm://my-release",              // missing chart
		"helm://rel?namespace=prod",     // missing chart
	}
	for _, c := range cases {
		if _, err := ParseHelmEndpoint(c); err == nil {
			t.Errorf("ParseHelmEndpoint(%q): expected error", c)
		}
	}
}

func TestHelmHandler_DispatchTask_Install(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{Timeout: 5 * time.Second})
	h.WithRunner(stub)

	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://my-release?chart=oci://x/nginx&namespace=prod"},
		&RunnerJobView{JobID: "job-1", TaskType: "install", Params: map[string]interface{}{"values": map[string]interface{}{"replicaCount": 3}}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if !stub.installCalled {
		t.Error("RunInstall not called")
	}
	if stub.lastParams.Target.ReleaseName != "my-release" {
		t.Errorf("target release = %q", stub.lastParams.Target.ReleaseName)
	}
	if stub.lastParams.Values["replicaCount"] == nil {
		t.Error("values not passed through")
	}
	if stub.lastParams.Timeout != 5*time.Second {
		t.Errorf("timeout = %v", stub.lastParams.Timeout)
	}
	// Return payload should include the release name.
	var resp HelmOperationResult
	if err := json.Unmarshal([]byte(id), &resp); err != nil {
		t.Fatalf("response json: %v", err)
	}
	if resp.ReleaseName != "my-release" {
		t.Errorf("response release = %q", resp.ReleaseName)
	}
	if resp.Revision != 1 {
		t.Errorf("response revision = %d", resp.Revision)
	}
}

func TestHelmHandler_DispatchTask_Upgrade(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{Timeout: 5 * time.Second})
	h.WithRunner(stub)

	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://my-release?chart=./chart&namespace=prod"},
		&RunnerJobView{JobID: "job-1", TaskType: "upgrade"},
	)
	if err != nil {
		t.Fatalf("DispatchTask upgrade: %v", err)
	}
	if !stub.upgradeCalled || stub.installCalled || stub.uninstallCalled {
		t.Errorf("wrong action called: install=%v upgrade=%v uninstall=%v",
			stub.installCalled, stub.upgradeCalled, stub.uninstallCalled)
	}
}

func TestHelmHandler_DispatchTask_Uninstall(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(stub)

	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://my-release?chart=./chart&namespace=prod"},
		&RunnerJobView{JobID: "job-1", TaskType: "uninstall"},
	)
	if err != nil {
		t.Fatalf("DispatchTask uninstall: %v", err)
	}
	if !stub.uninstallCalled {
		t.Error("RunUninstall not called")
	}
}

func TestHelmHandler_DispatchTask_DeployAlias(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: "j", TaskType: "deploy"},
	)
	if err != nil {
		t.Fatalf("deploy alias: %v", err)
	}
	if !stub.installCalled {
		t.Error("deploy should map to install")
	}
}

func TestHelmHandler_DispatchTask_UnknownOp(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: "j", TaskType: "banana"},
	)
	if err == nil {
		t.Fatalf("expected unknown operation error")
	}
	if !strings.Contains(err.Error(), "unknown helm operation") {
		t.Errorf("err = %v", err)
	}
}

func TestHelmHandler_DispatchTask_DefaultOpInstall(t *testing.T) {
	stub := &stubHelmRunner{}
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: "j"}, // empty TaskType → default install
	)
	if err != nil {
		t.Fatalf("default op: %v", err)
	}
	if !stub.installCalled {
		t.Error("empty TaskType should default to install")
	}
}

func TestHelmHandler_DispatchTask_InvalidEndpoint(t *testing.T) {
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(&stubHelmRunner{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "not-helm://x"},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatalf("expected endpoint parse error")
	}
}

func TestHelmHandler_DispatchTask_MissingEndpoint(t *testing.T) {
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(&stubHelmRunner{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: ""},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected endpoint error")
	}
}

func TestHelmHandler_DispatchTask_MissingJobID(t *testing.T) {
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(&stubHelmRunner{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: ""},
	)
	if err == nil {
		t.Fatal("expected job_id error")
	}
}

func TestHelmHandler_DispatchTask_NoRunner(t *testing.T) {
	h := NewHelmHandlerWithConfig(HelmConfig{})
	// No WithRunner — dispatch must fail with an actionable error.
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected runner missing error")
	}
	if !strings.Contains(err.Error(), "HelmActionRunner") {
		t.Errorf("err = %v", err)
	}
}

func TestHelmHandler_DispatchTask_RunnerError(t *testing.T) {
	stub := &stubHelmRunner{err: errors.New("helm boom")}
	h := NewHelmHandlerWithConfig(HelmConfig{})
	h.WithRunner(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c&namespace=ns"},
		&RunnerJobView{JobID: "j", TaskType: "install"},
	)
	if err == nil {
		t.Fatal("expected runner error")
	}
	if !strings.Contains(err.Error(), "helm boom") {
		t.Errorf("err = %v", err)
	}
}

func TestHelmHandler_PlaceholderReturnsNotFound(t *testing.T) {
	p := newHelmPlaceholder()
	_, err := p.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "helm://rel?chart=./c"},
		&RunnerJobView{JobID: "j"},
	)
	if !errors.Is(err, ErrHandlerNotFound) {
		t.Errorf("placeholder: got %v, want ErrHandlerNotFound", err)
	}
}

func TestArgoCDHandler_PlaceholderReturnsNotFound(t *testing.T) {
	p := newArgoCDPlaceholder()
	_, err := p.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://x/y"},
		&RunnerJobView{JobID: "j"},
	)
	if !errors.Is(err, ErrHandlerNotFound) {
		t.Errorf("argocd placeholder: got %v, want ErrHandlerNotFound", err)
	}
}

func TestCanonicalProtocol_HelmArgoCD(t *testing.T) {
	if got := CanonicalProtocol(RunnerProtocol("helm")); got != ProtocolHelm {
		t.Errorf("CanonicalProtocol(helm) = %q", got)
	}
	if got := CanonicalProtocol(RunnerProtocol("argocd")); got != ProtocolArgoCD {
		t.Errorf("CanonicalProtocol(argocd) = %q", got)
	}
	if got := CanonicalProtocol(RunnerProtocol("Argo-CD")); got != ProtocolArgoCD {
		t.Errorf("CanonicalProtocol(Argo-CD) = %q", got)
	}
	if got := CanonicalProtocol(RunnerProtocol("helm ")); got != ProtocolHelm {
		t.Errorf("CanonicalProtocol('helm ') trimmed = %q", got)
	}
}

func TestExtractHelmValues_MapStringInterface(t *testing.T) {
	v := extractHelmValues(map[string]interface{}{"values": map[string]interface{}{"replicaCount": 3}})
	if v["replicaCount"] == nil {
		t.Error("replicaCount missing")
	}
}

func TestExtractHelmValues_MapStringString(t *testing.T) {
	v := extractHelmValues(map[string]interface{}{"values": map[string]string{"image": "nginx"}})
	if v["image"] != "nginx" {
		t.Errorf("image = %v", v["image"])
	}
}

func TestExtractHelmValues_JSONString(t *testing.T) {
	v := extractHelmValues(map[string]interface{}{"values": `{"image":"nginx"}`})
	if v["image"] != "nginx" {
		t.Errorf("image = %v", v["image"])
	}
}

func TestExtractHelmValues_Missing(t *testing.T) {
	if v := extractHelmValues(map[string]interface{}{"foo": "bar"}); v != nil {
		t.Errorf("missing values: got %v, want nil", v)
	}
	if v := extractHelmValues(nil); v != nil {
		t.Errorf("nil params: got %v, want nil", v)
	}
}

func TestExtractHelmValues_InvalidJSON(t *testing.T) {
	// Invalid JSON silently returns nil (values are optional).
	v := extractHelmValues(map[string]interface{}{"values": "{not valid"})
	if v != nil {
		t.Errorf("invalid JSON: got %v, want nil", v)
	}
}

// Integration smoke: NewRealHelmRunner constructs without panicking.
// We do NOT invoke RunInstall/Upgrade/Uninstall here — those require a
// live K8s cluster. This test only guards against accidental nils at
// wiring time.
func TestRealHelmRunner_Construct(t *testing.T) {
	r := NewRealHelmRunner()
	if r == nil {
		t.Fatal("NewRealHelmRunner returned nil")
	}
	r = r.WithKubeConfig("").WithRepoCache("/tmp/helm-cache")
	if r.kubeConfigPath != "" || r.repoCache != "/tmp/helm-cache" {
		t.Errorf("builder methods not applied: %+v", r)
	}
}
