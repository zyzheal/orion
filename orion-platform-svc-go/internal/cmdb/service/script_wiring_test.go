package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/cmdb/models"
	"orion/platform-svc-go/internal/cmdb/script"
)

// --- ExecuteScript router wiring tests ---

func TestService_ExecuteScript_ReturnsResultForValidRequest(t *testing.T) {
	svc := NewService(nil)
	res, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "echo ok",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Status != "completed" {
		t.Errorf("expected completed, got %q", res.Status)
	}
	if len(res.Results) != 1 || res.Results[0].CIID != "host-1" {
		t.Errorf("unexpected results: %+v", res.Results)
	}
}

func TestService_ExecuteScript_RejectsEmptyTarget(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{},
		Script:      "echo ok",
	})
	if !errors.Is(err, script.ErrTargetEmpty) {
		t.Errorf("expected ErrTargetEmpty, got %v", err)
	}
}

func TestService_ExecuteScript_RejectsEmptyScript(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "   ",
	})
	if !errors.Is(err, script.ErrScriptBodyEmpty) {
		t.Errorf("expected ErrScriptBodyEmpty, got %v", err)
	}
}

func TestService_ExecuteScript_RejectsUnsupportedType(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "x",
		ScriptType:  "powershell",
	})
	if !errors.Is(err, script.ErrScriptTypeUnsupported) {
		t.Errorf("expected ErrScriptTypeUnsupported, got %v", err)
	}
}

func TestService_ExecuteScript_WhitelistEnforcedViaCtx(t *testing.T) {
	w := script.NewWhitelist()
	w.Add("tenant-A", "bash")
	router := script.NewRouter().WithWhitelist(w)
	svc := NewService(nil).WithScriptRouter(router)

	ctx := context.WithValue(context.Background(), "tenantID", "tenant-A")
	_, err := svc.ExecuteScript(ctx, &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "x",
		ScriptType:  "python",
	})
	if !errors.Is(err, script.ErrScriptTypeNotAllowed) {
		t.Errorf("expected ErrScriptTypeNotAllowed, got %v", err)
	}
}

func TestService_ExecuteScript_AllowsWhitelistedType(t *testing.T) {
	w := script.NewWhitelist()
	w.Add("tenant-A", "bash")
	router := script.NewRouter().WithWhitelist(w)
	svc := NewService(nil).WithScriptRouter(router)

	ctx := context.WithValue(context.Background(), "tenantID", "tenant-A")
	res, err := svc.ExecuteScript(ctx, &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "echo hi",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "completed" {
		t.Errorf("expected completed, got %q", res.Status)
	}
}

func TestService_ExecuteScriptForTenant_DirectTenantArg(t *testing.T) {
	w := script.NewWhitelist()
	w.Add("t1", "bash")
	router := script.NewRouter().WithWhitelist(w)
	svc := NewService(nil).WithScriptRouter(router)

	res, err := svc.ExecuteScriptForTenant(context.Background(), "t1", &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "echo hi",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "completed" {
		t.Errorf("expected completed, got %q", res.Status)
	}
}

func TestService_ExecuteScript_NoRouterFails(t *testing.T) {
	svc := &Service{} // zero value — no router
	_, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1"},
		Script:      "echo ok",
	})
	if err == nil {
		t.Fatal("expected error when router is nil")
	}
}

func TestService_ExecuteScript_CtxCancelReturnsCancelled(t *testing.T) {
	svc := NewService(nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	res, err := svc.ExecuteScript(ctx, &models.ScriptExecRequest{
		TargetCiIds: []string{"host-1", "host-2"},
		Script:      "echo ok",
	})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Status != "cancelled" {
		t.Errorf("expected cancelled, got %q", res.Status)
	}
}

// --- CICD lister tests ---

// fakeCICDLister captures calls and returns canned resources.
type fakeCICDLister struct {
	mu         sync.Mutex
	calledWith struct {
		tenantID string
		status   *string
		limit    int
		offset   int
	}
	returnItems []models.CICDResource
	returnErr   error
}

func (f *fakeCICDLister) List(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.CICDResource, int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calledWith = struct {
		tenantID string
		status   *string
		limit    int
		offset   int
	}{tenantID, status, limit, offset}
	return f.returnItems, len(f.returnItems), f.returnErr
}

func TestService_ListCICDResources_NoListerReturnsEmpty(t *testing.T) {
	svc := NewService(nil)
	items, total, err := svc.ListCICDResources(context.Background(), nil, 20, 0)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if items == nil || total != 0 {
		t.Errorf("expected empty slice + 0, got %v / %d", items, total)
	}
}

func TestService_ListCICDResources_DelegatesToLister(t *testing.T) {
	want := []models.CICDResource{
		{ID: "cicd-1", Name: "build-pipeline", Type: "Pipeline", Status: "success", Project: "orion-platform"},
	}
	l := &fakeCICDLister{returnItems: want}
	svc := NewService(nil).WithCICDLister(l)

	got, total, err := svc.ListCICDResources(context.Background(), nil, 20, 0)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if total != 1 || len(got) != 1 || got[0].ID != "cicd-1" {
		t.Errorf("unexpected result: %+v / %d", got, total)
	}
}

func TestService_ListCICDResources_PassesStatusAndPagination(t *testing.T) {
	l := &fakeCICDLister{returnItems: []models.CICDResource{}}
	svc := NewService(nil).WithCICDLister(l)
	status := "running"
	_, _, err := svc.ListCICDResources(context.Background(), &status, 50, 10)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.calledWith.status == nil || *l.calledWith.status != "running" {
		t.Errorf("expected status=running passed to lister, got %v", l.calledWith.status)
	}
	if l.calledWith.limit != 50 || l.calledWith.offset != 10 {
		t.Errorf("expected 50/10, got %d/%d", l.calledWith.limit, l.calledWith.offset)
	}
}

func TestService_ListCICDResources_ClarifiesNegOffsetAndZeroLimit(t *testing.T) {
	l := &fakeCICDLister{returnItems: []models.CICDResource{}}
	svc := NewService(nil).WithCICDLister(l)
	_, _, _ = svc.ListCICDResources(context.Background(), nil, 0, -5)
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.calledWith.limit != 20 {
		t.Errorf("expected default limit 20, got %d", l.calledWith.limit)
	}
	if l.calledWith.offset != 0 {
		t.Errorf("expected clamped offset 0, got %d", l.calledWith.offset)
	}
}

func TestService_ListCICDResources_PropagatesListerError(t *testing.T) {
	l := &fakeCICDLister{returnErr: errors.New("upstream down")}
	svc := NewService(nil).WithCICDLister(l)
	_, _, err := svc.ListCICDResources(context.Background(), nil, 20, 0)
	if err == nil || !strings.Contains(err.Error(), "upstream down") {
		t.Errorf("expected lister error propagated, got %v", err)
	}
}

// TestExecuteScript_RealBashEndToEnd verifies that the router wiring
// actually invokes a real LocalExecutor with the bash binary and returns
// the stdout from `echo`. This is the "5 项至少 4 项判据达标" test per
// D5 in docs/cmdb-k8s-script-stub-upgrade-2026-10-11.md.
func TestExecuteScript_RealBashEndToEnd(t *testing.T) {
	svc := NewService(nil)
	res, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-x"},
		Script:      "echo NEW-EA-14-OK",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "completed" || len(res.Results) != 1 {
		t.Fatalf("unexpected: %+v", res)
	}
	if !strings.Contains(res.Results[0].Output, "NEW-EA-14-OK") {
		t.Errorf("expected stdout echo, got %q", res.Results[0].Output)
	}
}

// TestExecuteScript_ExplicitTimeoutHonored ensures ctx-level cancellation
// propagates through the router to LocalExecutor.
func TestExecuteScript_ExplicitTimeoutHonored(t *testing.T) {
	// Custom router with a very short per-target timeout.
	router := script.NewRouter().WithTargetTimeout(50 * time.Millisecond)
	svc := NewService(nil).WithScriptRouter(router)
	res, err := svc.ExecuteScript(context.Background(), &models.ScriptExecRequest{
		TargetCiIds: []string{"host-x"},
		Script:      "sleep 5",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(res.Results) != 1 || !strings.Contains(res.Results[0].Error, "timed out") {
		t.Errorf("expected timeout error in result, got %+v", res.Results)
	}
}
