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

// Ensure DeployRequestAlias still matches models.DeployRequest.
var _ DeployRequestAlias = models.DeployRequest{}
