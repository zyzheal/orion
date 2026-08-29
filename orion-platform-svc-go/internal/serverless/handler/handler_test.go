package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/serverless/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/serverless/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeServerlessService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeServerlessService struct{}

func (f *fakeServerlessService) Create(ctx context.Context, tenantID string, req models.CreateFunctionRequest) (*models.Function, error) {
	return &models.Function{}, nil
}

func (f *fakeServerlessService) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) (*models.Trigger, error) {
	return &models.Trigger{}, nil
}

func (f *fakeServerlessService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeServerlessService) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeServerlessService) Deploy(ctx context.Context, tenantID, functionID string) (*models.Deployment, error) {
	return &models.Deployment{}, nil
}

func (f *fakeServerlessService) EvaluateAutoScaling(ctx context.Context, tenantID string) ([]models.AutoScalingRecommendation, error) {
	return []models.AutoScalingRecommendation{}, nil
}

func (f *fakeServerlessService) Get(ctx context.Context, tenantID, id string) (*models.Function, error) {
	return &models.Function{}, nil
}

func (f *fakeServerlessService) GetAggregateMetrics(ctx context.Context, tenantID string) (*models.AggregateMetrics, error) {
	return &models.AggregateMetrics{}, nil
}

func (f *fakeServerlessService) GetLogs(ctx context.Context, tenantID, functionID string, q models.GetFunctionLogsQuery) ([]models.FunctionLog, error) {
	return []models.FunctionLog{}, nil
}

func (f *fakeServerlessService) GetMetrics(ctx context.Context, tenantID, functionID string) (*models.FunctionMetric, error) {
	return &models.FunctionMetric{}, nil
}

func (f *fakeServerlessService) GetTrigger(ctx context.Context, tenantID, id string) (*models.Trigger, error) {
	return &models.Trigger{}, nil
}

func (f *fakeServerlessService) Invoke(ctx context.Context, tenantID, functionID string, payload any) (*models.InvokeResult, error) {
	return &models.InvokeResult{}, nil
}

func (f *fakeServerlessService) List(ctx context.Context, tenantID string, q models.ListFunctionsQuery, limit, offset int) ([]models.Function, error) {
	return []models.Function{}, nil
}

func (f *fakeServerlessService) ListDeployments(ctx context.Context, tenantID, functionID string) ([]models.Deployment, error) {
	return []models.Deployment{}, nil
}

func (f *fakeServerlessService) ListTriggers(ctx context.Context, tenantID string, q models.ListTriggersQuery) ([]models.Trigger, error) {
	return []models.Trigger{}, nil
}

func (f *fakeServerlessService) Update(ctx context.Context, tenantID, id string, req models.UpdateFunctionRequest) (*models.Function, error) {
	return &models.Function{}, nil
}

var _ service.ServiceInterface = (*fakeServerlessService)(nil)

func TestHandler_SERVERLESS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVERLESS_CreateFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateFunction(c)
	if w.Code >= 500 {
		t.Fatalf("CreateFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunction(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListFunctions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListFunctions(c)
	if w.Code >= 500 {
		t.Fatalf("ListFunctions: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_UpdateFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateFunction(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeleteFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteFunction(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeployFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeployFunction(c)
	if w.Code >= 500 {
		t.Fatalf("DeployFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListDeployments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDeployments(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeployments: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_InvokeFunction(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().InvokeFunction(c)
	if w.Code >= 500 {
		t.Fatalf("InvokeFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunctionLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunctionLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunctionLogs: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunctionMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunctionMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunctionMetrics: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetAggregateMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAggregateMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetAggregateMetrics: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_CreateTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListTriggers(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("ListTriggers: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeleteTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_EvaluateAutoScaling(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluateAutoScaling(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateAutoScaling: got %d", w.Code)
	}
}
