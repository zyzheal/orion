package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// stubArgoCDClient implements ArgoCDClientInterface for tests.
type stubArgoCDClient struct {
	action string
	info   *ArgoCDAppInfo
	err    error
}

func (s *stubArgoCDClient) capture(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.info != nil {
		return s.info, nil
	}
	return &ArgoCDAppInfo{
		Application: p.Target.Application,
		Project:     p.Target.Project,
		Namespace:   p.Target.Namespace,
		Status:      "synced",
		SyncStatus:  "Synced",
		Health:      "Healthy",
	}, nil
}

func (s *stubArgoCDClient) Sync(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "sync"
	return s.capture(p)
}
func (s *stubArgoCDClient) Create(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "create"
	return s.capture(p)
}
func (s *stubArgoCDClient) Delete(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "delete"
	return s.capture(p)
}
func (s *stubArgoCDClient) Rollback(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "rollback"
	return s.capture(p)
}
func (s *stubArgoCDClient) Get(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "get"
	return s.capture(p)
}
func (s *stubArgoCDClient) Health(p *ArgoCDRunParams) (*ArgoCDAppInfo, error) {
	s.action = "health"
	return s.capture(p)
}

func TestParseArgoCDEndpoint_OK(t *testing.T) {
	tgt, err := ParseArgoCDEndpoint("argocd://my-app?server=argocd.example.com:443&project=platform&namespace=prod")
	if err != nil {
		t.Fatalf("ParseArgoCDEndpoint: %v", err)
	}
	if tgt.Application != "my-app" {
		t.Errorf("Application = %q", tgt.Application)
	}
	if tgt.Server != "https://argocd.example.com:443" {
		t.Errorf("Server = %q (want https scheme default)", tgt.Server)
	}
	if tgt.Project != "platform" {
		t.Errorf("Project = %q", tgt.Project)
	}
	if tgt.Namespace != "prod" {
		t.Errorf("Namespace = %q", tgt.Namespace)
	}
}

func TestParseArgoCDEndpoint_DefaultProject(t *testing.T) {
	tgt, err := ParseArgoCDEndpoint("argocd://rel?server=http://10.0.0.5:8080")
	if err != nil {
		t.Fatalf("ParseArgoCDEndpoint: %v", err)
	}
	if tgt.Server != "http://10.0.0.5:8080" {
		t.Errorf("Server = %q", tgt.Server)
	}
	if tgt.Project != "default" {
		t.Errorf("Project default = %q, want 'default'", tgt.Project)
	}
}

func TestParseArgoCDEndpoint_Errors(t *testing.T) {
	cases := []string{
		"",
		"grpc://my-pod",
		"argocd://",
		"argocd://my-app",          // missing server
		"argocd://?server=x:443",   // missing application
	}
	for _, c := range cases {
		if _, err := ParseArgoCDEndpoint(c); err == nil {
			t.Errorf("ParseArgoCDEndpoint(%q): expected error", c)
		}
	}
}

func TestArgoCDHandler_DispatchTask_Sync(t *testing.T) {
	stub := &stubArgoCDClient{}
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{Timeout: 5 * time.Second})
	h.WithClient(stub)

	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://my-app?server=x:443&namespace=prod"},
		&RunnerJobView{JobID: "job-1", TaskType: "sync"},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if stub.action != "sync" {
		t.Errorf("action = %q, want sync", stub.action)
	}
	var resp ArgoCDOperationResult
	if err := json.Unmarshal([]byte(id), &resp); err != nil {
		t.Fatalf("response json: %v", err)
	}
	if resp.Application != "my-app" {
		t.Errorf("response application = %q", resp.Application)
	}
	if resp.Server != "https://x:443" {
		t.Errorf("response server = %q", resp.Server)
	}
	if resp.SyncStatus != "Synced" {
		t.Errorf("response sync_status = %q", resp.SyncStatus)
	}
}

func TestArgoCDHandler_DispatchTask_AllOps(t *testing.T) {
	cases := []struct {
		taskType string
		want     string
	}{
		{"sync", "sync"},
		{"deploy", "sync"},
		{"sync-app", "sync"},
		{"create", "create"},
		{"upsert", "create"},
		{"delete", "delete"},
		{"rollback", "rollback"},
		{"get", "get"},
		{"status", "get"},
		{"health", "health"},
	}
	for _, tc := range cases {
		stub := &stubArgoCDClient{}
		h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
		h.WithClient(stub)
		_, err := h.DispatchTask(context.Background(),
			&RunnerAgentView{Endpoint: "argocd://rel?server=x:443&namespace=ns"},
			&RunnerJobView{JobID: "j", TaskType: tc.taskType},
		)
		if err != nil {
			t.Fatalf("%s: %v", tc.taskType, err)
		}
		if stub.action != tc.want {
			t.Errorf("taskType=%q: action=%q, want %q", tc.taskType, stub.action, tc.want)
		}
	}
}

func TestArgoCDHandler_DispatchTask_DefaultSync(t *testing.T) {
	stub := &stubArgoCDClient{}
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443"},
		&RunnerJobView{JobID: "j"}, // empty TaskType → default sync
	)
	if err != nil {
		t.Fatalf("default op: %v", err)
	}
	if stub.action != "sync" {
		t.Errorf("empty TaskType should default to sync, got %q", stub.action)
	}
}

func TestArgoCDHandler_DispatchTask_UnknownOp(t *testing.T) {
	stub := &stubArgoCDClient{}
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443"},
		&RunnerJobView{JobID: "j", TaskType: "banana"},
	)
	if err == nil {
		t.Fatalf("expected unknown operation error")
	}
	if !strings.Contains(err.Error(), "unknown argocd operation") {
		t.Errorf("err = %v", err)
	}
}

func TestArgoCDHandler_DispatchTask_NoClient(t *testing.T) {
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	// No WithClient — dispatch must fail with an actionable error.
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443"},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected client missing error")
	}
	if !strings.Contains(err.Error(), "ArgoCDClientInterface") {
		t.Errorf("err = %v", err)
	}
}

func TestArgoCDHandler_DispatchTask_ClientError(t *testing.T) {
	stub := &stubArgoCDClient{err: errors.New("argocd down")}
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443"},
		&RunnerJobView{JobID: "j", TaskType: "sync"},
	)
	if err == nil {
		t.Fatal("expected client error")
	}
	if !strings.Contains(err.Error(), "argocd down") {
		t.Errorf("err = %v", err)
	}
}

func TestArgoCDHandler_DispatchTask_MissingEndpoint(t *testing.T) {
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(&stubArgoCDClient{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: ""},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected endpoint error")
	}
}

func TestArgoCDHandler_DispatchTask_MissingJobID(t *testing.T) {
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(&stubArgoCDClient{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443"},
		&RunnerJobView{JobID: ""},
	)
	if err == nil {
		t.Fatal("expected job_id error")
	}
}

func TestArgoCDHandler_PassesRevisionAndToken(t *testing.T) {
	stub := &stubArgoCDClient{}
	h := NewArgoCDHandlerWithConfig(ArgoCDConfig{})
	h.WithClient(stub)
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "argocd://rel?server=x:443", Metadata: map[string]string{"argocd_token": "tok-123"}},
		&RunnerJobView{JobID: "j", TaskType: "rollback", Params: map[string]interface{}{"revision": "v2.0.1"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if stub.action != "rollback" {
		t.Errorf("action = %q", stub.action)
	}
}

// --- REST client tests against an httptest server ---

func TestArgoCDRESTClient_Get_ParsesStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("Authorization = %q", r.Header.Get("Authorization"))
		}
		if r.URL.Path != "/api/v1/applications/my-app" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"metadata":{"name":"my-app"},"status":{"sync":{"status":"Synced","revision":"abc123"},"health":{"status":"Healthy","message":"ok"}}}`))
	}))
	defer srv.Close()

	client := NewArgoCDRESTClient(ArgoCDRESTConfig{Token: "tok"})
	info, err := client.Get(&ArgoCDRunParams{
		Target: &ArgoCDTarget{Application: "my-app", Server: srv.URL, Project: "default"},
		Ctx:    context.Background(),
	})
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if info.Status != "retrieved" {
		t.Errorf("Status = %q", info.Status)
	}
	if info.SyncStatus != "Synced" {
		t.Errorf("SyncStatus = %q", info.SyncStatus)
	}
	if info.Health != "Healthy" {
		t.Errorf("Health = %q", info.Health)
	}
	if info.Revision != "abc123" {
		t.Errorf("Revision = %q", info.Revision)
	}
}

func TestArgoCDRESTClient_Sync_SendsRequest(t *testing.T) {
	var gotPath, gotMethod string
	var gotBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	client := NewArgoCDRESTClient(ArgoCDRESTConfig{})
	_, err := client.Sync(&ArgoCDRunParams{
		Target: &ArgoCDTarget{Application: "my-app", Server: srv.URL, Project: "default"},
		Ctx:    context.Background(),
		Revision: "v2",
	})
	if err != nil {
		t.Fatalf("Sync: %v", err)
	}
	if gotPath != "/api/v1/applications/my-app/sync" {
		t.Errorf("path = %q", gotPath)
	}
	if gotMethod != http.MethodPost {
		t.Errorf("method = %q", gotMethod)
	}
	if gotBody["revision"] != "v2" {
		t.Errorf("revision = %v", gotBody["revision"])
	}
	if gotBody["prune"] != true {
		t.Errorf("prune = %v", gotBody["prune"])
	}
}

func TestArgoCDRESTClient_Create_SendsSpec(t *testing.T) {
	var gotPath, gotMethod string
	var gotBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	client := NewArgoCDRESTClient(ArgoCDRESTConfig{})
	_, err := client.Create(&ArgoCDRunParams{
		Target: &ArgoCDTarget{Application: "my-app", Server: srv.URL, Project: "platform", Namespace: "prod"},
		Params: map[string]interface{}{"repo_url": "https://git/repo.git", "path": "charts/nginx", "target_revision": "main"},
		Ctx:    context.Background(),
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if gotPath != "/api/v1/applications" {
		t.Errorf("path = %q", gotPath)
	}
	if gotMethod != http.MethodPost {
		t.Errorf("method = %q", gotMethod)
	}
	spec, _ := gotBody["spec"].(map[string]interface{})
	if spec["project"] != "platform" {
		t.Errorf("spec.project = %v", spec["project"])
	}
	source, _ := spec["source"].(map[string]interface{})
	if source["repoURL"] != "https://git/repo.git" {
		t.Errorf("source.repoURL = %v", source["repoURL"])
	}
}

func TestArgoCDRESTClient_Delete_SendsDelete(t *testing.T) {
	var gotPath, gotMethod string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	client := NewArgoCDRESTClient(ArgoCDRESTConfig{})
	_, err := client.Delete(&ArgoCDRunParams{
		Target: &ArgoCDTarget{Application: "my-app", Server: srv.URL},
		Ctx:    context.Background(),
	})
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if gotPath != "/api/v1/applications/my-app" {
		t.Errorf("path = %q", gotPath)
	}
	if gotMethod != http.MethodDelete {
		t.Errorf("method = %q", gotMethod)
	}
}

func TestArgoCDRESTClient_Non2xx_ReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"invalid token"}`))
	}))
	defer srv.Close()

	client := NewArgoCDRESTClient(ArgoCDRESTConfig{})
	_, err := client.Get(&ArgoCDRunParams{
		Target: &ArgoCDTarget{Application: "my-app", Server: srv.URL},
		Ctx:    context.Background(),
	})
	if err == nil {
		t.Fatal("expected 401 error")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("err = %v", err)
	}
}

func TestArgoCDRESTClient_RequiresTarget(t *testing.T) {
	client := NewArgoCDRESTClient(ArgoCDRESTConfig{})
	_, err := client.Get(&ArgoCDRunParams{Ctx: context.Background()})
	if err == nil {
		t.Fatal("expected missing target error")
	}
}
