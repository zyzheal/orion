package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/branch-policy/models"
	"orion/platform-svc-go/internal/branch-policy/service"
)

// stubSvc implements the small slice of ServiceInterface used by BranchEnvGuard.
type stubSvc struct {
	match bool
	err   error
	calls []string
}

func (s *stubSvc) VerifyImageTagMatch(ctx context.Context, tenantID, branch, envName, imageTag string) (bool, error) {
	s.calls = append(s.calls, tenantID+"/"+branch+"/"+envName+"/"+imageTag)
	return s.match, s.err
}

// compile-time check — all other methods are inherited from the full interface
// via embedding? No; we must embed service.ServiceInterface as a nil value.
type embed struct{ service.ServiceInterface }

// Ensure the full interface is satisfied so we can pass stubSvc into middleware.
var _ service.ServiceInterface = (*fullStubSvc)(nil)

type fullStubSvc struct {
	*stubSvc
	embed
}

func TestBranchEnvGuard_ValidDeploy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	body := `{"branch":"bp-1","targetEnv":"prod","imageTag":"myrepo/release-ent/abc"}`
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(body))

	called := false
	handler := gin.HandlerFunc(func(c *gin.Context) { called = true; c.JSON(200, gin.H{"ok": true}) })
	mw(c)
	handler(c)

	if w.Code != 200 || !called {
		t.Fatalf("expected 200 and handler called, got code=%d called=%v", w.Code, called)
	}
	if len(stub.calls) != 1 {
		t.Fatalf("expected 1 service call, got %d: %v", len(stub.calls), stub.calls)
	}
	if !strings.Contains(stub.calls[0], "myrepo/release-ent/abc") {
		t.Fatalf("wrong image tag forwarded: %v", stub.calls)
	}
}

func TestBranchEnvGuard_MismatchFailClosed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: false}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(`{"branch":"bp-1","targetEnv":"prod","imageTag":"wrong-tag"}`))

	mw(c)
	// Abort() prevents downstream handling; middleware writes the response itself.
	if w.Code != 400 {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("bad json: %v body=%s", err, w.Body.String())
	}
	if out["code"] != "BRANCH_ENV_MISMATCH" {
		t.Fatalf("expected BRANCH_ENV_MISMATCH, got %v", out["code"])
	}
}

func TestBranchEnvGuard_RequiredFieldsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	// Missing branch.
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(`{"targetEnv":"prod","imageTag":"x"}`))
	mw(c)
	if w.Code != 400 {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["code"] != "BRANCH_ENV_REQUIRED" {
		t.Fatalf("expected BRANCH_ENV_REQUIRED, got %v", out["code"])
	}
}

func TestBranchEnvGuard_StorageError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: false, err: context.DeadlineExceeded}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(`{"branch":"b","targetEnv":"p","imageTag":"i"}`))
	mw(c)
	if w.Code != 500 {
		t.Fatalf("expected 500 on service error, got %d", w.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["code"] != "BRANCH_ENV_VERIFY_FAILED" {
		t.Fatalf("expected BRANCH_ENV_VERIFY_FAILED, got %v", out["code"])
	}
}

func TestBranchEnvGuard_NonDeployBodySkipped(t *testing.T) {
	// A body that fails to unmarshal into DeployRequest is silently skipped.
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: false}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(`not-json-at-all`))

	called := false
	handler := gin.HandlerFunc(func(c *gin.Context) { called = true; c.JSON(200, nil) })
	mw(c)
	handler(c)
	if !called {
		t.Fatalf("handler should be called when body is not deploy-shaped")
	}
	if len(stub.calls) != 0 {
		t.Fatalf("service should not be called for malformed body, got %v", stub.calls)
	}
}

func TestBranchEnvGuard_EmptyBodyFailClosed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	mw := BranchEnvGuard(stub)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Request = httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(""))
	mw(c)
	if w.Code != 400 {
		t.Fatalf("expected 400 for empty body (missing required fields), got %d", w.Code)
	}
}

// runGuard drives the middleware against a 200-returning handler so the test
// can observe both the abort path (status code + body) and the pass-through
// path (handler called) without standing up a real engine.
func runGuard(t *testing.T, svc *fullStubSvc, ctxTenant, ctxHeader, body string) (*httptest.ResponseRecorder, bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	mw := BranchEnvGuard(svc)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if ctxTenant != "" {
		c.Set("tenant_id", ctxTenant)
	}
	req := httptest.NewRequest(http.MethodPost, "/deploy", bytes.NewBufferString(body))
	if ctxHeader != "" {
		req.Header.Set("X-Tenant-Id", ctxHeader)
	}
	c.Request = req

	called := false
	mw(c)
	// Respect the abort flag: gin's engine would not invoke the next handler
	// after c.Abort(), and the failure cases are exactly the ones that abort.
	if !c.IsAborted() {
		handler := gin.HandlerFunc(func(*gin.Context) { called = true })
		handler(c)
	}
	return w, called
}

// The guard used to key the check on the body's tenantId, falling back to the
// auth tenant only when the body was empty. The binding it reads is
// tenant-scoped, so a body tenantId let any caller clear the guard against
// another tenant's NamespaceBinding prefix. Every case below names an
// attacker tenant in the body and asserts it never reaches the service.
func TestBranchEnvGuard_BodyTenantIgnoredAuthTenantUsed(t *testing.T) {
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	w, called := runGuard(t, stub, "caller-tenant", "",
		`{"tenantId":"attacker-tenant","branch":"bp-1","targetEnv":"prod","imageTag":"myrepo/release-ent/abc"}`)

	if !called || w.Code != 200 {
		t.Fatalf("expected pass-through, got code=%d called=%v", w.Code, called)
	}
	if got := stub.calls[0]; got != "caller-tenant/bp-1/prod/myrepo/release-ent/abc" {
		t.Fatalf("wrong tenant forwarded, got %q", got)
	}
}

func TestBranchEnvGuard_AuthTenantBeatsXTenantIdHeader(t *testing.T) {
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	_, called := runGuard(t, stub, "caller-tenant", "header-tenant",
		`{"tenantId":"attacker-tenant","branch":"bp-1","targetEnv":"prod","imageTag":"tag/1"}`)

	if !called {
		t.Fatalf("expected pass-through, handler not called")
	}
	if got := stub.calls[0]; got != "caller-tenant/bp-1/prod/tag/1" {
		t.Fatalf("expected the auth tenant to beat both the body and the header, got %q", got)
	}
}

// With auth disabled the context tenant is empty and the caller identifies the
// tenant via X-Tenant-Id. That path is deliberately preserved; the body
// tenantId is not a substitute for it.
func TestBranchEnvGuard_HeaderTenantUsedWhenAuthAbsent(t *testing.T) {
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	_, called := runGuard(t, stub, "", "header-tenant",
		`{"branch":"bp-1","targetEnv":"prod","imageTag":"tag/1"}`)

	if !called {
		t.Fatalf("expected pass-through, handler not called")
	}
	if got := stub.calls[0]; got != "header-tenant/bp-1/prod/tag/1" {
		t.Fatalf("expected the header tenant, got %q", got)
	}
}

func TestBranchEnvGuard_FailsClosedWithoutAnyTenant(t *testing.T) {
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	w, called := runGuard(t, stub, "", "", `{"branch":"bp-1","targetEnv":"prod","imageTag":"tag/1"}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("bad json: %v body=%s", err, w.Body.String())
	}
	if out["code"] != "BRANCH_ENV_REQUIRED" {
		t.Fatalf("expected BRANCH_ENV_REQUIRED, got %v", out["code"])
	}
	if called || len(stub.calls) != 0 {
		t.Fatalf("guard must not call the service without a tenant, called=%v calls=%v", called, stub.calls)
	}
}

// The route comment used to claim the guard skips non-deploy endpoint shapes so
// it could be mounted on wider route groups. json.Unmarshal only errors on
// invalid JSON: a valid body with unrelated keys yields a zero DeployRequest,
// which then fails the required-field check. This pins the actual behaviour.
func TestBranchEnvGuard_ValidNonDeployJSONBodyFailsClosed(t *testing.T) {
	stub := &fullStubSvc{stubSvc: &stubSvc{match: true}}
	w, called := runGuard(t, stub, "t1", "", `{"unrelated":"field"}`)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a non-deploy JSON body, got %d", w.Code)
	}
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out["code"] != "BRANCH_ENV_REQUIRED" {
		t.Fatalf("expected BRANCH_ENV_REQUIRED, got %v", out["code"])
	}
	if called || len(stub.calls) != 0 {
		t.Fatalf("guard must not call the service, called=%v calls=%v", called, stub.calls)
	}
}

// Ensure DeployRequestAlias still matches models.DeployRequest.
var _ DeployRequestAlias = models.DeployRequest{}
