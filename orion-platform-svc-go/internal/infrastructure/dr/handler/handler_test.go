package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dr/models"
	"orion/platform-svc-go/internal/infrastructure/dr/service"

	"github.com/gin-gonic/gin"
)

// drSvcFake is the RepositoryInterface the handler reaches through
// service.NewService, so the handler tests exercise the real service error
// mapping instead of a second copy of it.
type drSvcFake struct {
	readErr      error
	writeErr     error
	countErr     error
	listPlans    []models.DRPlan
	planErr      error
	backupErr    error
	policyErr    error
	listPlansErr error
	lastOffset   int
	lastLimit    int
}

func (f *drSvcFake) CreatePlan(ctx context.Context, p *models.DRPlan) error {
	return f.writeErr
}
func (f *drSvcFake) GetPlanByID(ctx context.Context, tenantID, id string) (*models.DRPlan, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return &models.DRPlan{ID: id, TenantID: tenantID, Name: "n", Status: "active"}, nil
}
func (f *drSvcFake) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPlan, error) {
	f.lastOffset = offset
	f.lastLimit = limit
	if f.listPlansErr != nil {
		return nil, f.listPlansErr
	}
	return f.listPlans, nil
}
func (f *drSvcFake) UpdatePlan(ctx context.Context, tenantID, id string, req *models.UpdateDRPlanRequest) (*models.DRPlan, error) {
	if f.planErr != nil {
		return nil, f.planErr
	}
	return &models.DRPlan{ID: id}, nil
}
func (f *drSvcFake) UpdatePlanStatus(ctx context.Context, tenantID, id, status string) error {
	return f.writeErr
}
func (f *drSvcFake) UpdatePlanLastTested(ctx context.Context, tenantID, id string, testedAt time.Time) error {
	return f.writeErr
}
func (f *drSvcFake) DeletePlan(ctx context.Context, tenantID, id string) error {
	return f.writeErr
}
func (f *drSvcFake) CountPlans(ctx context.Context, tenantID string) (int, error) {
	return 0, f.countErr
}
func (f *drSvcFake) CreateFailoverTest(ctx context.Context, t *models.FailoverTest) error {
	return f.writeErr
}
func (f *drSvcFake) GetFailoverTestByID(ctx context.Context, tenantID, id string) (*models.FailoverTest, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return &models.FailoverTest{ID: id, PlanID: id}, nil
}
func (f *drSvcFake) ListFailoverTests(ctx context.Context, tenantID string, planID *string) ([]models.FailoverTest, error) {
	return nil, f.listPlansErr
}
func (f *drSvcFake) CompleteFailoverTest(ctx context.Context, tenantID, id string, req *models.CompleteFailoverTestRequest) (*models.FailoverTest, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	return &models.FailoverTest{ID: id, Result: req.Result}, nil
}
func (f *drSvcFake) CreateBackupConfig(ctx context.Context, b *models.BackupConfig) error {
	return f.writeErr
}
func (f *drSvcFake) GetBackupConfigByID(ctx context.Context, tenantID, id string) (*models.BackupConfig, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return &models.BackupConfig{ID: id}, nil
}
func (f *drSvcFake) ListBackupConfigs(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupConfig, error) {
	f.lastOffset = offset
	f.lastLimit = limit
	return nil, nil
}
func (f *drSvcFake) UpdateBackupConfig(ctx context.Context, tenantID, id string, req *models.UpdateBackupConfigRequest) (*models.BackupConfig, error) {
	if f.backupErr != nil {
		return nil, f.backupErr
	}
	return &models.BackupConfig{ID: id}, nil
}
func (f *drSvcFake) DeleteBackupConfig(ctx context.Context, tenantID, id string) error {
	return f.writeErr
}
func (f *drSvcFake) CountBackupConfigs(ctx context.Context, tenantID string) (int, error) {
	return 0, f.countErr
}
func (f *drSvcFake) CreatePolicy(ctx context.Context, p *models.DRPolicy) error {
	return f.writeErr
}
func (f *drSvcFake) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.DRPolicy, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return &models.DRPolicy{ID: id, Strategy: "active-active"}, nil
}
func (f *drSvcFake) ListPolicies(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPolicy, error) {
	f.lastOffset = offset
	f.lastLimit = limit
	return nil, nil
}
func (f *drSvcFake) CountPolicies(ctx context.Context, tenantID string) (int, error) {
	return 0, f.countErr
}
func (f *drSvcFake) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.DRPolicy, error) {
	if f.policyErr != nil {
		return nil, f.policyErr
	}
	return &models.DRPolicy{ID: id}, nil
}
func (f *drSvcFake) DeletePolicy(ctx context.Context, tenantID, id string) error {
	return f.writeErr
}

func newH(f *drSvcFake) *Handler {
	return NewHandler(service.NewService(f))
}

func makeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t1")
	c.Set("user_id", "u1")
	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Params = gin.Params{{Key: "id", Value: "plan-1"}}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func mustStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Fatalf("status = %d, want %d (body %q)", w.Code, want, w.Body.String())
	}
}

func TestDrRegisterRoutes(t *testing.T) {
	h := newH(&drSvcFake{})
	r := gin.New()
	h.RegisterRoutes(&r.RouterGroup)
}

func TestParsePaginationRejectsBadInput(t *testing.T) {
	for _, tc := range []struct {
		query string
		frag  string
	}{
		{"?page=abc", "page must be an integer"},
		{"?page=0", "page must be an integer"},
		{"?page=-3", "page must be an integer"},
		{"?page_size=0", "page_size must be an integer between 1 and 100"},
		{"?page_size=101", "page_size must be an integer between 1 and 100"},
		{"?page_size=zz", "page_size must be an integer between 1 and 100"},
	} {
		t.Run(tc.query, func(t *testing.T) {
			f := &drSvcFake{}
			h := newH(f)
			c, w := makeCtx(http.MethodGet, "/plans"+tc.query, nil)
			h.ListPlans(c)
			mustStatus(t, w, http.StatusBadRequest)
			if !strings.Contains(w.Body.String(), tc.frag) {
				t.Errorf("body %q does not carry %q", w.Body.String(), tc.frag)
			}
			if f.lastOffset != 0 || f.lastLimit != 0 {
				t.Errorf("a rejected page must not reach the repository (offset=%d limit=%d)",
					f.lastOffset, f.lastLimit)
			}
		})
	}
}

func TestParsePaginationComputesOffsetAndLimit(t *testing.T) {
	for _, tc := range []struct {
		query      string
		wantOffset int
		wantLimit  int
	}{
		{"", 0, 20},
		{"?page=1&page_size=5", 0, 5},
		{"?page=3&page_size=10", 20, 10},
		{"?page=101&page_size=100", 10000, 100},
	} {
		t.Run(tc.query, func(t *testing.T) {
			f := &drSvcFake{}
			h := newH(f)
			c, w := makeCtx(http.MethodGet, "/plans"+tc.query, nil)
			h.ListPlans(c)
			mustStatus(t, w, http.StatusOK)
			if f.lastOffset != tc.wantOffset || f.lastLimit != tc.wantLimit {
				t.Errorf("offset=%d limit=%d, want %d %d: the offset used to be page*size",
					f.lastOffset, f.lastLimit, tc.wantOffset, tc.wantLimit)
			}
		})
	}
}

func TestListPlansListErrorIs500(t *testing.T) {
	f := &drSvcFake{listPlansErr: errors.New("relation dr_plans does not exist")}
	c, w := makeCtx(http.MethodGet, "/plans", nil)
	newH(f).ListPlans(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestListPlansCountErrorIs500(t *testing.T) {
	// Discarding the count error answered total: 0 with a full data array, which
	// reads as an empty store in any UI bound to total.
	f := &drSvcFake{countErr: errors.New("deadlock detected")}
	c, w := makeCtx(http.MethodGet, "/plans?page=1&page_size=5", nil)
	newH(f).ListPlans(c)
	mustStatus(t, w, http.StatusInternalServerError)
	if strings.Contains(w.Body.String(), "200") {
		t.Errorf("a failed count must not report a partial payload")
	}
}

func TestListBackupConfigsCountErrorIs500(t *testing.T) {
	f := &drSvcFake{countErr: errors.New("deadlock detected")}
	c, w := makeCtx(http.MethodGet, "/backup-configs?page=1&page_size=5", nil)
	newH(f).ListBackupConfigs(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestListPoliciesPaginationAndCount(t *testing.T) {
	f := &drSvcFake{}
	c, w := makeCtx(http.MethodGet, "/policies?page=4&page_size=25", nil)
	newH(f).ListPolicies(c)
	mustStatus(t, w, http.StatusOK)
	if f.lastOffset != 75 || f.lastLimit != 25 {
		t.Errorf("offset=%d limit=%d, want 75 25", f.lastOffset, f.lastLimit)
	}
	f.countErr = errors.New("deadlock detected")
	c, w = makeCtx(http.MethodGet, "/policies", nil)
	newH(f).ListPolicies(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCreatePlanValidationIs400(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/plans", map[string]interface{}{"name": "n"})
	newH(&drSvcFake{}).CreatePlan(c)
	mustStatus(t, w, http.StatusBadRequest)
}

func TestCreatePlanInvalidInputIs400(t *testing.T) {
	f := &drSvcFake{}
	f.writeErr = service.ErrInvalidInput
	c, w := makeCtx(http.MethodPost, "/plans", map[string]interface{}{
		"name": "n", "plan_type": "database", "rpo": 1, "rto": 1,
	})
	newH(f).CreatePlan(c)
	mustStatus(t, w, http.StatusBadRequest)
}

func TestCreatePlanStorageErrorIs500(t *testing.T) {
	f := &drSvcFake{writeErr: errors.New("relation dr_plans does not exist")}
	c, w := makeCtx(http.MethodPost, "/plans", map[string]interface{}{
		"name": "n", "plan_type": "database", "rpo": 1, "rto": 1,
	})
	newH(f).CreatePlan(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestUpdatePlanErrorSplit(t *testing.T) {
	f := &drSvcFake{planErr: service.ErrDRPlanNotFound}
	c, w := makeCtx(http.MethodPut, "/plans/plan-1", map[string]interface{}{"name": "x"})
	newH(f).UpdatePlan(c)
	mustStatus(t, w, http.StatusNotFound)

	f.planErr = errors.New("deadlock")
	c, w = makeCtx(http.MethodPut, "/plans/plan-1", map[string]interface{}{"name": "x"})
	newH(f).UpdatePlan(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestDeletePlanStorageErrorIs500(t *testing.T) {
	// A failed DELETE used to read as an already-deleted plan.
	f := &drSvcFake{writeErr: errors.New("deadlock detected")}
	c, w := makeCtx(http.MethodDelete, "/plans/plan-1", nil)
	newH(f).DeletePlan(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestDeletePlanNotFoundIs404(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrDRPlanNotFound}
	c, w := makeCtx(http.MethodDelete, "/plans/plan-1", nil)
	newH(f).DeletePlan(c)
	mustStatus(t, w, http.StatusNotFound)
}

func TestGetPlanErrorSplit(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrDRPlanNotFound}
	c, w := makeCtx(http.MethodGet, "/plans/plan-1", nil)
	newH(f).GetPlan(c)
	mustStatus(t, w, http.StatusNotFound)

	f.readErr = errors.New("connection refused")
	c, w = makeCtx(http.MethodGet, "/plans/plan-1", nil)
	newH(f).GetPlan(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestGetFailoverTestErrorSplit(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrFailoverTestNotFound}
	c, w := makeCtx(http.MethodGet, "/failover-tests/t-1", nil)
	newH(f).GetFailoverTest(c)
	mustStatus(t, w, http.StatusNotFound)

	f.readErr = errors.New("connection refused")
	c, w = makeCtx(http.MethodGet, "/failover-tests/t-1", nil)
	newH(f).GetFailoverTest(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCompleteFailoverTestErrorSplit(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrFailoverTestNotFound}
	c, w := makeCtx(http.MethodPost, "/failover-tests/t-1/complete", map[string]interface{}{"result": "passed"})
	newH(f).CompleteFailoverTest(c)
	mustStatus(t, w, http.StatusNotFound)

	f.readErr = nil
	f.writeErr = errors.New("disk full")
	c, w = makeCtx(http.MethodPost, "/failover-tests/t-1/complete", map[string]interface{}{"result": "passed"})
	newH(f).CompleteFailoverTest(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCompleteFailoverTestBadBodyIs400(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/failover-tests/t-1/complete", map[string]interface{}{"result": "maybe"})
	newH(&drSvcFake{}).CompleteFailoverTest(c)
	mustStatus(t, w, http.StatusBadRequest)
}

func TestGetBackupConfigErrorSplit(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrBackupConfigNotFound}
	c, w := makeCtx(http.MethodGet, "/backup-configs/b-1", nil)
	newH(f).GetBackupConfig(c)
	mustStatus(t, w, http.StatusNotFound)

	f.readErr = errors.New("timeout")
	c, w = makeCtx(http.MethodGet, "/backup-configs/b-1", nil)
	newH(f).GetBackupConfig(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestBackupConfigDeleteAndCount(t *testing.T) {
	f := &drSvcFake{writeErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodDelete, "/backup-configs/b-1", nil)
	newH(f).DeleteBackupConfig(c)
	mustStatus(t, w, http.StatusInternalServerError)

	f.writeErr = nil
	f.countErr = errors.New("deadlock")
	c, w = makeCtx(http.MethodGet, "/backup-configs/count", nil)
	newH(f).CountBackupConfigs(c)
	mustStatus(t, w, http.StatusInternalServerError)

	f.countErr = nil
	c, w = makeCtx(http.MethodGet, "/backup-configs/count", nil)
	newH(f).CountBackupConfigs(c)
	mustStatus(t, w, http.StatusOK)
}

func TestCountPlansErrorIs500(t *testing.T) {
	f := &drSvcFake{countErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodGet, "/plans/count", nil)
	newH(f).CountPlans(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestScheduleDrillErrorSplit(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrDRPlanNotFound}
	c, w := makeCtx(http.MethodPost, "/drills", map[string]interface{}{
		"plan_id": "plan-1", "component_type": "checkout",
	})
	newH(f).ScheduleDrill(c)
	mustStatus(t, w, http.StatusNotFound)

	f.readErr = service.ErrInvalidInput
	c, w = makeCtx(http.MethodPost, "/drills", map[string]interface{}{
		"plan_id": "plan-1", "component_type": "checkout", "scheduled_at": "next tuesday",
	})
	newH(f).ScheduleDrill(c)
	mustStatus(t, w, http.StatusBadRequest)

	f.readErr = errors.New("connection refused")
	c, w = makeCtx(http.MethodPost, "/drills", map[string]interface{}{
		"plan_id": "plan-1", "component_type": "checkout",
	})
	newH(f).ScheduleDrill(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCountPoliciesNotFoundIsNotRelevant(t *testing.T) {
	f := &drSvcFake{countErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodGet, "/policies/count", nil)
	newH(f).CountPolicies(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCanFailoverRequiresRegion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/policies/plan-1/can-failover", nil)
	newH(&drSvcFake{}).CanFailover(c)
	mustStatus(t, w, http.StatusBadRequest)
	// The status alone would also pass a response that merely named the
	// parameter, so the message text is pinned too.
	if !strings.Contains(w.Body.String(), "region query parameter is required") {
		t.Errorf("body %q does not say the region parameter is required", w.Body.String())
	}
}

func TestCanFailoverMissingPolicyIs404(t *testing.T) {
	f := &drSvcFake{readErr: service.ErrPolicyNotFound}
	c, w := makeCtx(http.MethodGet, "/policies/plan-1/can-failover?region=us-east-2", nil)
	newH(f).CanFailover(c)
	mustStatus(t, w, http.StatusNotFound)
}

func TestCanFailoverStorageErrorIs500(t *testing.T) {
	f := &drSvcFake{readErr: errors.New("connection refused")}
	c, w := makeCtx(http.MethodGet, "/policies/plan-1/can-failover?region=us-east-2", nil)
	newH(f).CanFailover(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCheckPolicyComplianceParamValidation(t *testing.T) {
	h := newH(&drSvcFake{})
	// The guard ORs two empties, so each empty side on its own must be rejected.
	// Only covering the both-empty case cannot distinguish OR from AND.
	for _, tc := range []struct {
		query string
		frag  string
	}{
		{"", "actual_rto and actual_rpo query parameters are required"},
		{"?actual_rto=5", "actual_rto and actual_rpo query parameters are required"},
		{"?actual_rpo=5", "actual_rto and actual_rpo query parameters are required"},
		{"?actual_rto=5&actual_rpo=", "actual_rto and actual_rpo query parameters are required"},
		{"?actual_rto=abc&actual_rpo=5", "invalid actual_rto"},
		{"?actual_rto=5&actual_rpo=abc", "invalid actual_rpo"},
	} {
		t.Run(tc.query, func(t *testing.T) {
			c, w := makeCtx(http.MethodGet, "/policies/plan-1/compliance"+tc.query, nil)
			h.CheckPolicyCompliance(c)
			mustStatus(t, w, http.StatusBadRequest)
			if !strings.Contains(w.Body.String(), tc.frag) {
				t.Errorf("body %q does not carry %q", w.Body.String(), tc.frag)
			}
		})
	}
}

func TestCheckPolicyComplianceStorageErrorIs500(t *testing.T) {
	f := &drSvcFake{readErr: errors.New("connection refused")}
	c, w := makeCtx(http.MethodGet, "/policies/plan-1/compliance?actual_rto=5&actual_rpo=5", nil)
	newH(f).CheckPolicyCompliance(c)
	mustStatus(t, w, http.StatusInternalServerError)
}

func TestCheckPolicyComplianceSuccess(t *testing.T) {
	f := &drSvcFake{}
	c, w := makeCtx(http.MethodGet, "/policies/plan-1/compliance?actual_rto=5&actual_rpo=5", nil)
	newH(f).CheckPolicyCompliance(c)
	mustStatus(t, w, http.StatusOK)
	if !strings.Contains(w.Body.String(), "compliant") {
		t.Errorf("body %q does not carry the compliance verdict", w.Body.String())
	}
}

func TestGetCostEstimate(t *testing.T) {
	h := newH(&drSvcFake{})
	c, w := makeCtx(http.MethodGet, "/policies/cost-estimate?strategy=warm-standby&service_count=3", nil)
	h.GetCostEstimate(c)
	mustStatus(t, w, http.StatusOK)
	if !strings.Contains(w.Body.String(), "530") {
		t.Errorf("body %q does not carry the warm-standby cost (base 500 plus 3x10)",
			w.Body.String())
	}
}

func TestListFailoverTestsErrorIs500(t *testing.T) {
	f := &drSvcFake{listPlansErr: errors.New("deadlock")}
	c, w := makeCtx(http.MethodGet, "/failover-tests", nil)
	newH(f).ListFailoverTests(c)
	mustStatus(t, w, http.StatusInternalServerError)
}
