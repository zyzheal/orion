package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cost-allocation/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/cost-allocation/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeCost_allocationService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

<<<<<<< Updated upstream
type fakeCost_allocationService struct{}

func (f *fakeCost_allocationService) CompleteReport(ctx context.Context, tenantID, id string, totalCost, allocatedCost float64, resultData string) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeCost_allocationService) CreateAllocation(ctx context.Context, tenantID string, req models.CreateAllocationRequest) (*models.Allocation, error) {
	return &models.Allocation{}, nil
}

func (f *fakeCost_allocationService) CreateReport(ctx context.Context, tenantID string, req models.CreateReportRequest) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeCost_allocationService) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) (*models.Rule, error) {
	return &models.Rule{}, nil
}

func (f *fakeCost_allocationService) DeleteAllocation(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeCost_allocationService) DeleteReport(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeCost_allocationService) DeleteRule(ctx context.Context, tenantID, ruleID string) (bool, error) {
	return false, nil
}

func (f *fakeCost_allocationService) FailReport(ctx context.Context, tenantID, id string, errMsg string) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeCost_allocationService) GetAllocation(ctx context.Context, tenantID, id string) (*models.Allocation, error) {
	return &models.Allocation{}, nil
}

func (f *fakeCost_allocationService) GetReport(ctx context.Context, tenantID, id string) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeCost_allocationService) ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) ([]models.Allocation, error) {
	return []models.Allocation{}, nil
}

func (f *fakeCost_allocationService) ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) ([]models.Report, error) {
	return []models.Report{}, nil
}

func (f *fakeCost_allocationService) ListRules(ctx context.Context, tenantID, allocationID string) ([]models.Rule, error) {
	return []models.Rule{}, nil
}

func (f *fakeCost_allocationService) UpdateAllocation(ctx context.Context, tenantID, id string, req models.UpdateAllocationRequest) (*models.Allocation, error) {
	return &models.Allocation{}, nil
}

var _ service.ServiceInterface = (*fakeCost_allocationService)(nil)
=======
type fakecost_allocationService struct{}

func (f *fakecost_allocationService) CompleteReport(ctx context.Context, tenantID, id string, totalCost, allocatedCost float64, resultData string) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakecost_allocationService) CreateAllocation(ctx context.Context, tenantID string, req models.CreateAllocationRequest) ((*models.Allocation, error)) {
	return &models.Allocation{}, nil
}

func (f *fakecost_allocationService) CreateReport(ctx context.Context, tenantID string, req models.CreateReportRequest) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakecost_allocationService) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) ((*models.Rule, error)) {
	return &models.Rule{}, nil
}

func (f *fakecost_allocationService) DeleteAllocation(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakecost_allocationService) DeleteReport(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakecost_allocationService) DeleteRule(ctx context.Context, tenantID, ruleID string) ((bool, error)) {
	return false, nil
}

func (f *fakecost_allocationService) FailReport(ctx context.Context, tenantID, id string, errMsg string) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakecost_allocationService) GetAllocation(ctx context.Context, tenantID, id string) ((*models.Allocation, error)) {
	return &models.Allocation{}, nil
}

func (f *fakecost_allocationService) GetReport(ctx context.Context, tenantID, id string) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakecost_allocationService) ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) (([]models.Allocation, error)) {
	return []models.Allocation{}, nil
}

func (f *fakecost_allocationService) ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) (([]models.Report, error)) {
	return []models.Report{}, nil
}

func (f *fakecost_allocationService) ListRules(ctx context.Context, tenantID, allocationID string) (([]models.Rule, error)) {
	return []models.Rule{}, nil
}

func (f *fakecost_allocationService) UpdateAllocation(ctx context.Context, tenantID, id string, req models.UpdateAllocationRequest) ((*models.Allocation, error)) {
	return &models.Allocation{}, nil
}

var _ service.ServiceInterface = (*fakecost_allocationService)(nil)
>>>>>>> Stashed changes


func TestCOST_ALLOCATION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCOST_ALLOCATION_Handler_ListAllocations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAllocations(c)
	if w.Code >= 500 {
		t.Fatalf("ListAllocations: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateAllocation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateAllocation(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_GetAllocation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAllocation(c)
	if w.Code >= 500 {
		t.Fatalf("GetAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_UpdateAllocation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateAllocation(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteAllocation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteAllocation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAllocation: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_ListRules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListRules: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRule: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CreateReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateReport(c)
	if w.Code >= 500 {
		t.Fatalf("CreateReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_ListReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_GetReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_CompleteReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CompleteReport(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_FailReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().FailReport(c)
	if w.Code >= 500 {
		t.Fatalf("FailReport: got %d", w.Code)
	}
}

func TestCOST_ALLOCATION_Handler_DeleteReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteReport(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteReport: got %d", w.Code)
	}
}
