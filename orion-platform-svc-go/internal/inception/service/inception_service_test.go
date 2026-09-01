package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/inception/engine"
	"orion/platform-svc-go/internal/inception/models"
)

type fakeEngine struct {
	checkResult *engine.Result
	execResult  *engine.Result
	checkErr    error
	execErr     error
	checkCalls  int
	execCalls   int
	healthErr   error
	lastCheck   engine.TaskRequest
	lastExec    engine.TaskRequest
}

func (f *fakeEngine) CheckSQL(_ context.Context, req engine.TaskRequest) (*engine.Result, error) {
	f.checkCalls++
	f.lastCheck = req
	return f.checkResult, f.checkErr
}

func (f *fakeEngine) ExecuteSQL(_ context.Context, req engine.TaskRequest) (*engine.Result, error) {
	f.execCalls++
	f.lastExec = req
	return f.execResult, f.execErr
}

func (f *fakeEngine) Health(_ context.Context) error { return f.healthErr }

func newTestService(c EngineClient) *Service { return &Service{client: c} }

func TestSubmitToEngine_CheckSuccess(t *testing.T) {
	f := &fakeEngine{
		checkResult: &engine.Result{Success: true, AffectedRows: 3, DurationMS: 42, Warnings: []string{"w1"}},
	}
	s := newTestService(f)
	a := &models.SQLAuditHistory{ID: "audit-1", TenantID: "t1", DBName: "app", SQLStatement: "SELECT 1", OperationType: "audit", Status: "pending"}
	status, errs, warnings, affected, execMs := s.submitToEngine(context.Background(), a, false)
	if status != "success" { t.Fatalf("expected success, got %q", status) }
	if f.checkCalls != 1 { t.Fatalf("expected 1 CheckSQL call, got %d", f.checkCalls) }
	if affected == nil || *affected != 3 { t.Fatalf("expected affected=3, got %v", affected) }
	if execMs == nil || *execMs != 42 { t.Fatalf("expected exec_ms=42, got %v", execMs) }
	if len(warnings) != 1 || warnings[0] != "w1" { t.Fatalf("expected [w1], got %v", warnings) }
	if len(errs) != 0 { t.Fatalf("expected no errors, got %v", errs) }
	if f.lastCheck.TaskName != "audit-1" { t.Fatalf("expected task_name=audit-1, got %q", f.lastCheck.TaskName) }
	if !f.lastCheck.DryRun { t.Fatal("non-execute path should set DryRun=true") }
}

func TestSubmitToEngine_ExecuteUsesExecuteSQL(t *testing.T) {
	f := &fakeEngine{execResult: &engine.Result{Success: true, AffectedRows: 1, DurationMS: 5}}
	s := newTestService(f)
	a := &models.SQLAuditHistory{ID: "audit-2", TenantID: "t1", DBName: "app", SQLStatement: "INSERT INTO t VALUES (1)", OperationType: "execute", Status: "pending"}
	status, _, _, _, _ := s.submitToEngine(context.Background(), a, true)
	if status != "success" { t.Fatalf("expected success, got %q", status) }
	if f.checkCalls != 0 || f.execCalls != 1 { t.Fatalf("expected only ExecuteSQL, got check=%d exec=%d", f.checkCalls, f.execCalls) }
	if f.lastExec.DryRun { t.Fatal("execute path should not set DryRun=true") }
}

func TestSubmitToEngine_TransportErrorPersistsFailed(t *testing.T) {
	f := &fakeEngine{checkErr: errors.New("engine down")}
	s := newTestService(f)
	a := &models.SQLAuditHistory{ID: "audit-3", TenantID: "t1", SQLStatement: "SELECT 1", OperationType: "audit", Status: "pending"}
	status, errs, _, _, _ := s.submitToEngine(context.Background(), a, false)
	if status != "failed" { t.Fatalf("expected failed, got %q", status) }
	if len(errs) != 1 || errs[0] == "" { t.Fatalf("expected engine error, got %v", errs) }
}

func TestSubmitToEngine_SkipsTerminalStatus(t *testing.T) {
	f := &fakeEngine{checkResult: &engine.Result{Success: true}}
	s := newTestService(f)
	a := &models.SQLAuditHistory{ID: "audit-4", TenantID: "t1", SQLStatement: "SELECT 1", OperationType: "audit", Status: "success"}
	status, _, _, _, _ := s.submitToEngine(context.Background(), a, false)
	if status != "success" { t.Fatalf("expected success pass-through, got %q", status) }
	if f.checkCalls != 0 { t.Fatalf("expected no engine call, got %d", f.checkCalls) }
}

func TestSubmitToEngine_NilClientIsNoOp(t *testing.T) {
	s := &Service{}
	a := &models.SQLAuditHistory{ID: "audit-5", TenantID: "t1", SQLStatement: "SELECT 1", OperationType: "audit", Status: "pending"}
	status, _, _, _, _ := s.submitToEngine(context.Background(), a, false)
	if status != "" { t.Fatalf("expected empty status, got %q", status) }
}

func TestSubmitToEngine_NonSuccessResultPersistsFailed(t *testing.T) {
	f := &fakeEngine{checkResult: &engine.Result{Success: false, Errors: []string{"syntax error"}}}
	s := newTestService(f)
	a := &models.SQLAuditHistory{ID: "audit-6", TenantID: "t1", SQLStatement: "BAD SQL", OperationType: "audit", Status: "pending"}
	status, errs, _, _, _ := s.submitToEngine(context.Background(), a, false)
	if status != "failed" { t.Fatalf("expected failed, got %q", status) }
	if len(errs) != 1 || errs[0] != "syntax error" { t.Fatalf("expected syntax error, got %v", errs) }
}

func TestHealth_NoClientReportsNotConfigured(t *testing.T) {
	s := &Service{}
	st, err := s.Health(context.Background())
	if err != nil { t.Fatal(err) }
	if st != "not_configured" { t.Fatalf("expected not_configured, got %q", st) }
}

func TestHealth_ClientOKReportsOK(t *testing.T) {
	s := newTestService(&fakeEngine{})
	st, err := s.Health(context.Background())
	if err != nil { t.Fatal(err) }
	if st != "ok" { t.Fatalf("expected ok, got %q", st) }
}

func TestHealth_ClientDownReportsUnreachable(t *testing.T) {
	s := newTestService(&fakeEngine{healthErr: errors.New("connection refused")})
	st, err := s.Health(context.Background())
	if err == nil { t.Fatal("expected error") }
	if st != "unreachable" { t.Fatalf("expected unreachable, got %q", st) }
}

func TestServiceErrorsDefined(t *testing.T) {
	if ErrInceptionProjectNotFound.Error() != "project not found" {
		t.Errorf("unexpected: %s", ErrInceptionProjectNotFound.Error())
	}
	if ErrEngineNotConfigured.Error() != "inception engine not configured for tenant" {
		t.Errorf("unexpected: %s", ErrEngineNotConfigured.Error())
	}
}

func TestSetEngineClient(t *testing.T) {
	s := &Service{}
	f := &fakeEngine{}
	s.SetEngineClient(f)
	if s.client == nil { t.Fatal("client not wired") }
	if st, _ := s.Health(context.Background()); st != "ok" { t.Fatalf("expected ok, got %q", st) }
}

func TestSetDefaultEngineClient(t *testing.T) {
	s := &Service{}
	s.SetDefaultEngineClient("http://localhost:6669", "k", 0)
	if s.client == nil { t.Fatal("client not wired") }
}
