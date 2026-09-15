package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/service"

	"github.com/gin-gonic/gin"
)

// cfgFake records every call the handler forwards. The old handler tests only
// checked that no status was 500 or worse, so 200, 201, 400, 401 and 404 all
// passed: a handler that answered 404 for an existing row, or 400 for a
// database outage, was invisible to the suite.
type cfgFake struct {
	getErr, listErr, updateErr, deleteErr, createErr error
	approvedErr, historyErr, updateCRErr             error
	driftErr, getDriftErr, updateDriftErr            error
	deleted                                          bool

	calls      []string
	lastTenant string
	lastID     string
	lastActor  string
	lastReq    interface{}
}

func (f *cfgFake) record(name, tenantID, id, actor string, req interface{}) {
	f.calls = append(f.calls, name)
	f.lastTenant = tenantID
	f.lastID = id
	f.lastActor = actor
	f.lastReq = req
}

func (f *cfgFake) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ConfigMgmt, error) {
	f.record("Create", tenantID, "", "", req)
	if f.createErr != nil {
		return nil, f.createErr
	}
	return &models.ConfigMgmt{ID: "cm-1", TenantID: tenantID, Name: req.Name}, nil
}

func (f *cfgFake) Get(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	f.record("Get", tenantID, id, "", nil)
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &models.ConfigMgmt{ID: id, TenantID: tenantID, Name: "n"}, nil
}

func (f *cfgFake) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	f.record("List", tenantID, "", "", nil)
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []models.ConfigMgmt{{ID: "cm-1", Name: "n"}}, nil
}

func (f *cfgFake) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ConfigMgmt, error) {
	f.record("Update", tenantID, id, "", req)
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &models.ConfigMgmt{ID: id, TenantID: tenantID, Name: "n"}, nil
}

func (f *cfgFake) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	f.record("Delete", tenantID, id, "", nil)
	if f.deleteErr != nil {
		return false, f.deleteErr
	}
	return f.deleted, nil
}

func (f *cfgFake) ApproveChangeRequest(ctx context.Context, tenantID, id, caller string, req *models.ApproveRequest) (*models.ChangeRequest, error) {
	f.record("ApproveChangeRequest", tenantID, id, caller, req)
	if f.approvedErr != nil {
		return nil, f.approvedErr
	}
	return &models.ChangeRequest{ID: id, Status: models.StatusApproved, Approvals: `[{"approver":"u1","action":"approve"}]`}, nil
}

func (f *cfgFake) ExecuteChangeRequest(ctx context.Context, tenantID, id, actor string) (*models.ChangeRequest, error) {
	f.record("ExecuteChangeRequest", tenantID, id, actor, nil)
	if f.approvedErr != nil {
		return nil, f.approvedErr
	}
	return &models.ChangeRequest{ID: id, Status: models.StatusExecuted}, nil
}

func (f *cfgFake) RollbackChangeRequest(ctx context.Context, tenantID, id, actor string, req *models.RollbackRequest) (*models.ChangeRequest, error) {
	f.record("RollbackChangeRequest", tenantID, id, actor, req)
	if f.approvedErr != nil {
		return nil, f.approvedErr
	}
	return &models.ChangeRequest{ID: id, Status: models.StatusRolledBack}, nil
}

func (f *cfgFake) GetChangeHistory(ctx context.Context, tenantID, id string) ([]models.ChangeHistoryEntry, error) {
	f.record("GetChangeHistory", tenantID, id, "", nil)
	if f.historyErr != nil {
		return nil, f.historyErr
	}
	return []models.ChangeHistoryEntry{{Action: "approve"}}, nil
}

func (f *cfgFake) DriftDetect(ctx context.Context, tenantID string, req *models.DriftDetectRequest) (*models.DriftDetectResult, error) {
	f.record("DriftDetect", tenantID, "", "", req)
	if f.driftErr != nil {
		return nil, f.driftErr
	}
	return &models.DriftDetectResult{Status: "in_sync", Drifts: []models.DriftEntry{}, Targets: len(req.Targets), Scope: req.Scope}, nil
}

func (f *cfgFake) RemediateDrift(ctx context.Context, tenantID, id string, req *models.RemediateRequest) (*models.DriftReport, error) {
	f.record("RemediateDrift", tenantID, id, "", req)
	if f.getDriftErr != nil {
		return nil, f.getDriftErr
	}
	if f.updateDriftErr != nil {
		return nil, f.updateDriftErr
	}
	return &models.DriftReport{ID: id, ConfigGroup: "g", DriftStatus: models.DriftRemediated}, nil
}

var _ service.ServiceInterface = (*cfgFake)(nil)

func newCfgH(f *cfgFake) *Handler {
	return NewHandler(f)
}

// makeCtx sets up a gin context. withTenant=false simulates an unauthenticated
// request: the middleware chain never stamped tenant_id.
func makeCtx(method, path string, body interface{}, id string, withTenant bool) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if withTenant {
		c.Set("tenant_id", "tenant-1")
	}
	c.Set("user_id", "u1")
	if id != "" {
		c.Params = gin.Params{{Key: "id", Value: id}}
	}
	if body != nil {
		b, _ := json.Marshal(body)
		c.Request = httptest.NewRequest(method, path, strings.NewReader(string(b)))
	} else {
		c.Request = httptest.NewRequest(method, path, strings.NewReader(""))
	}
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func assertBodyContains(t *testing.T, w *httptest.ResponseRecorder, want string) {
	t.Helper()
	if !strings.Contains(w.Body.String(), want) {
		t.Errorf("body %q does not carry %q", w.Body.String(), want)
	}
}

func TestCfgHandlerRegisterRoutes(t *testing.T) {
	r := gin.New()
	newCfgH(&cfgFake{}).RegisterRoutes(&r.RouterGroup)
}

func TestCfgHandlerListSuccessIs200(t *testing.T) {
	f := &cfgFake{}
	c, w := makeCtx(http.MethodGet, "/config-mgmt", nil, "", true)
	newCfgH(f).List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", w.Code, w.Body.String())
	}
	assertBodyContains(t, w, "cm-1")
	if f.lastTenant != "tenant-1" {
		t.Errorf("tenant = %q, want tenant-1", f.lastTenant)
	}
}

func TestCfgHandlerListErrorIs500(t *testing.T) {
	// Nil with no error answered 200 with an empty payload, which reads as an
	// empty store rather than a database outage.
	f := &cfgFake{listErr: errors.New("connection refused")}
	c, w := makeCtx(http.MethodGet, "/config-mgmt", nil, "", true)
	newCfgH(f).List(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body %q)", w.Code, w.Body.String())
	}
}

func TestCfgHandlerCreate(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/config-mgmt", map[string]interface{}{"name": "n"}, "", true)
	newCfgH(&cfgFake{}).Create(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", w.Code, w.Body.String())
	}

	f := &cfgFake{}
	c, w = makeCtx(http.MethodPost, "/config-mgmt", map[string]interface{}{}, "", true)
	newCfgH(f).Create(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for a missing name", w.Code)
	}
	if len(f.calls) != 0 {
		t.Errorf("a rejected body must not reach the service: %v", f.calls)
	}

	c, w = makeCtx(http.MethodPost, "/config-mgmt", map[string]interface{}{"name": "n"}, "", false)
	newCfgH(&cfgFake{}).Create(c)
	// Bind runs before the tenant check, so a malformed body wins over a
	// missing tenant. That ordering is intentional: report the cheapest fix
	// first rather than asking the client to authenticate before seeing its
	// validation error.
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 for a missing tenant", w.Code)
	}

	f = &cfgFake{createErr: errors.New("deadlock")}
	c, w = makeCtx(http.MethodPost, "/config-mgmt", map[string]interface{}{"name": "n"}, "", true)
	newCfgH(f).Create(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
}

func TestCfgHandlerGetErrorSplit(t *testing.T) {
	f := &cfgFake{getErr: sentinel.NotFound}
	c, w := makeCtx(http.MethodGet, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Get(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %q)", w.Code, w.Body.String())
	}
	assertBodyContains(t, w, "not found")

	f = &cfgFake{getErr: errors.New("connection refused")}
	c, w = makeCtx(http.MethodGet, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Get(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{getErr: nil}
	c, w = makeCtx(http.MethodGet, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
}

func TestCfgHandlerUpdate(t *testing.T) {
	f := &cfgFake{updateErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodPut, "/config-mgmt/cm-1", map[string]interface{}{"name": "x"}, "cm-1", true)
	newCfgH(f).Update(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{}
	c, w = makeCtx(http.MethodPut, "/config-mgmt/cm-1", map[string]interface{}{"name": "x"}, "cm-1", true)
	newCfgH(f).Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if f.lastID != "cm-1" {
		t.Errorf("id = %q, want cm-1", f.lastID)
	}
}

func TestCfgHandlerDelete(t *testing.T) {
	f := &cfgFake{deleteErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodDelete, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Delete(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{deleted: false}
	c, w = makeCtx(http.MethodDelete, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Delete(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}

	f = &cfgFake{deleted: true}
	c, w = makeCtx(http.MethodDelete, "/config-mgmt/cm-1", nil, "cm-1", true)
	newCfgH(f).Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
}

func TestCfgHandlerApproveThreadsCallerIdentity(t *testing.T) {
	f := &cfgFake{}
	c, w := makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/approve", map[string]interface{}{"comment": "ok"}, "cr-1", true)
	newCfgH(f).ApproveChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", w.Code, w.Body.String())
	}
	if f.lastActor != "u1" {
		t.Errorf("caller = %q, want the authenticated user u1", f.lastActor)
	}
	if f.lastID != "cr-1" || f.lastTenant != "tenant-1" {
		t.Errorf("id=%q tenant=%q, want cr-1 tenant-1", f.lastID, f.lastTenant)
	}
	assertBodyContains(t, w, "approved")

	// A caller-supplied approver would let a client pick the name written to
	// the audit trail. ApproveRequest therefore carries no approver field at
	// all: the identity comes only from the middleware context.
	f = &cfgFake{}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/approve", map[string]interface{}{"comment": "ok", "approver": "someone-else"}, "cr-1", true)
	newCfgH(f).ApproveChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if f.lastActor != "u1" {
		t.Errorf("caller = %q, want the authenticated user u1, not the body value", f.lastActor)
	}
}

func TestCfgHandlerApproveErrorSplit(t *testing.T) {
	f := &cfgFake{approvedErr: service.ErrInvalidState}
	c, w := makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/approve", map[string]interface{}{}, "cr-1", true)
	newCfgH(f).ApproveChangeRequest(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for a state transition (body %q)", w.Code, w.Body.String())
	}
	assertBodyContains(t, w, "invalid state")

	f = &cfgFake{approvedErr: sentinel.NotFound}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/approve", map[string]interface{}{}, "cr-1", true)
	newCfgH(f).ApproveChangeRequest(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for a missing row", w.Code)
	}

	f = &cfgFake{approvedErr: errors.New("deadlock")}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/approve", map[string]interface{}{}, "cr-1", true)
	newCfgH(f).ApproveChangeRequest(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
}

func TestCfgHandlerExecuteAndRollbackThreadActor(t *testing.T) {
	f := &cfgFake{}
	c, w := makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/execute", nil, "cr-1", true)
	newCfgH(f).ExecuteChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("execute status = %d, want 200", w.Code)
	}
	if f.lastActor != "u1" {
		t.Errorf("actor = %q, want u1", f.lastActor)
	}
	assertBodyContains(t, w, "executed")

	f = &cfgFake{approvedErr: errors.New("deadlock")}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/execute", nil, "cr-1", true)
	newCfgH(f).ExecuteChangeRequest(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("execute error status = %d, want 500", w.Code)
	}

	f = &cfgFake{}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/rollback", map[string]interface{}{"reason": "regression"}, "cr-1", true)
	newCfgH(f).RollbackChangeRequest(c)
	if w.Code != http.StatusOK {
		t.Fatalf("rollback status = %d, want 200", w.Code)
	}
	if f.lastActor != "u1" {
		t.Errorf("rollback actor = %q, want u1", f.lastActor)
	}
	assertBodyContains(t, w, "rolled_back")

	f = &cfgFake{approvedErr: sentinel.NotFound}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/change-requests/cr-1/rollback", map[string]interface{}{}, "cr-1", true)
	newCfgH(f).RollbackChangeRequest(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("rollback status = %d, want 404", w.Code)
	}
}

func TestCfgHandlerChangeHistory(t *testing.T) {
	f := &cfgFake{historyErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodGet, "/config-mgmt/change-requests/cr-1/history", nil, "cr-1", true)
	newCfgH(f).GetChangeHistory(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{historyErr: sentinel.NotFound}
	c, w = makeCtx(http.MethodGet, "/config-mgmt/change-requests/cr-1/history", nil, "cr-1", true)
	newCfgH(f).GetChangeHistory(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}

	f = &cfgFake{}
	c, w = makeCtx(http.MethodGet, "/config-mgmt/change-requests/cr-1/history", nil, "cr-1", true)
	newCfgH(f).GetChangeHistory(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	assertBodyContains(t, w, "approve")
}

func TestCfgHandlerDriftDetect(t *testing.T) {
	f := &cfgFake{driftErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodPost, "/config-mgmt/drift-detect", map[string]interface{}{"scope": "g"}, "", true)
	newCfgH(f).DriftDetect(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/drift-detect", map[string]interface{}{"scope": "g", "targets": []string{"t1", "t2"}}, "", true)
	newCfgH(f).DriftDetect(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	assertBodyContains(t, w, "in_sync")
	assertBodyContains(t, w, "2")
}

func TestCfgHandlerRemediateDrift(t *testing.T) {
	f := &cfgFake{getDriftErr: sentinel.NotFound}
	c, w := makeCtx(http.MethodPost, "/config-mgmt/drift/d-1/remediate", map[string]interface{}{"strategy": "replace"}, "d-1", true)
	newCfgH(f).RemediateDrift(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}

	f = &cfgFake{updateDriftErr: errors.New("deadlock")}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/drift/d-1/remediate", map[string]interface{}{"strategy": "replace"}, "d-1", true)
	newCfgH(f).RemediateDrift(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}

	f = &cfgFake{}
	c, w = makeCtx(http.MethodPost, "/config-mgmt/drift/d-1/remediate", map[string]interface{}{"strategy": "replace"}, "d-1", true)
	newCfgH(f).RemediateDrift(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	assertBodyContains(t, w, "remediated")
}

// getTenantID must bail: middleware.RespondUnauthorized does not call
// c.Abort, so without the bool the 401 is written and every handler keeps
// running with an empty tenant_id.
func TestCfgHandlerMissingTenantBails(t *testing.T) {
	f := &cfgFake{}
	c, w := makeCtx(http.MethodGet, "/config-mgmt", nil, "", false)
	newCfgH(f).List(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
	assertBodyContains(t, w, "tenant_id required")
	if len(f.calls) != 0 {
		t.Errorf("a rejected tenant must not reach the service: %v", f.calls)
	}

	for _, tc := range []struct {
		name   string
		method string
		want   int
		call   func(*gin.Context, *httptest.ResponseRecorder)
	}{
		// No body binding, so the tenant check is the first failure.
		{"Get", http.MethodGet, http.StatusUnauthorized,
			func(c *gin.Context, w *httptest.ResponseRecorder) { newCfgH(f).Get(c) }},
		{"Delete", http.MethodDelete, http.StatusUnauthorized,
			func(c *gin.Context, w *httptest.ResponseRecorder) { newCfgH(f).Delete(c) }},
		// Binding runs before the tenant check, so the empty body wins.
		{"Update", http.MethodPut, http.StatusBadRequest,
			func(c *gin.Context, w *httptest.ResponseRecorder) { newCfgH(f).Update(c) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f.calls = f.calls[:0]
			c, w := makeCtx(tc.method, "/config-mgmt/cm-1", nil, "cm-1", false)
			tc.call(c, w)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %q)", w.Code, tc.want, w.Body.String())
			}
			if len(f.calls) != 0 {
				t.Errorf("a rejected tenant must not reach the service: %v", f.calls)
			}
		})
	}
}

func TestCfgRespondServiceErrorMapping(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want int
		frag string
	}{
		{"notFoundIs404", sentinel.NotFound, http.StatusNotFound, "not found"},
		{"invalidStateIs400", service.ErrInvalidState, http.StatusBadRequest, "invalid state"},
		{"invalidInputIs400", service.ErrInvalidInput, http.StatusBadRequest, "invalid input"},
		{"driverErrorIs500", errors.New("relation config_mgmt does not exist"), http.StatusInternalServerError, "config_mgmt"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			respondServiceError(c, tc.err)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %q)", w.Code, tc.want, w.Body.String())
			}
			assertBodyContains(t, w, tc.frag)
		})
	}
}
